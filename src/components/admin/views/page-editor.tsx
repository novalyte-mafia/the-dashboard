"use client";

import { useEffect, useState } from "react";
import { useNav } from "@/components/admin/admin-app";
import {
  PageHeader, SectionCard, LoadingState, EmptyState, FormSection, StatusBadge,
} from "@/components/admin/shared";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Save, Loader2, CheckCircle2, XCircle, Rocket, Pause, Archive,
} from "lucide-react";
import { toast } from "sonner";

type Page = {
  id: string;
  path: string;
  status: string;
  host: string;
  page_type: string | null;
  public_title: string | null;
  seo_title: string | null;
  seo_description: string | null;
  hero: Record<string, unknown>;
  cta_primary: string | null;
  form_config: Record<string, unknown>;
  assessment_template_id: string | null;
  assessment_version_id: string | null;
  assessment_placement: string[];
  assessment_status: string;
  indexing_policy: string;
};

type QualityCheck = { id: string; label: string; passed: boolean; blocking: boolean; message?: string };
type Assessment = {
  id: string;
  name: string;
  assessment_engine_slug: string;
  mode: string;
  latestVersion: { id: string; version: number } | null;
};

const PLACEMENTS = [
  "hero",
  "below_hero",
  "mid_page",
  "near_clinics",
  "sticky_mobile",
  "bottom",
  "modal",
] as const;

const TABS = ["Content", "Assessment", "Quality", "Publish"] as const;

export function PageEditorView({ params }: { params?: Record<string, unknown> | null }) {
  const { navigate } = useNav();
  const pageId = (params as { pageId?: string } | undefined)?.pageId;

  const [tab, setTab] = useState<(typeof TABS)[number]>("Content");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [page, setPage] = useState<Page | null>(null);

  const [publicTitle, setPublicTitle] = useState("");
  const [seoTitle, setSeoTitle] = useState("");
  const [seoDescription, setSeoDescription] = useState("");
  const [heroHeadline, setHeroHeadline] = useState("");
  const [heroSubhead, setHeroSubhead] = useState("");
  const [ctaPrimary, setCtaPrimary] = useState("");

  const [assessments, setAssessments] = useState<Assessment[]>([]);
  const [assessmentsApiOk, setAssessmentsApiOk] = useState(true);
  const [selectedTemplateId, setSelectedTemplateId] = useState("");
  const [placements, setPlacements] = useState<Set<string>>(new Set(["below_hero"]));
  const [formConfigJson, setFormConfigJson] = useState("");

  const [qualityChecks, setQualityChecks] = useState<QualityCheck[]>([]);
  const [qualityScore, setQualityScore] = useState<number | null>(null);
  const [qualityBlocking, setQualityBlocking] = useState(false);
  const [runningQuality, setRunningQuality] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [overrideReason, setOverrideReason] = useState("");
  const [publishIndex, setPublishIndex] = useState(false);

  const hydrate = (p: Page) => {
    setPage(p);
    setPublicTitle(p.public_title ?? "");
    setSeoTitle(p.seo_title ?? "");
    setSeoDescription(p.seo_description ?? "");
    setHeroHeadline(typeof p.hero?.headline === "string" ? p.hero.headline : "");
    setHeroSubhead(typeof p.hero?.subheadline === "string" ? p.hero.subheadline : "");
    setCtaPrimary(p.cta_primary ?? "");
    setSelectedTemplateId(p.assessment_template_id ?? "");
    setPlacements(new Set(p.assessment_placement?.length ? p.assessment_placement : ["below_hero"]));
    setFormConfigJson(JSON.stringify(p.form_config ?? {}, null, 2));
    setPublishIndex(p.host === "organic" && p.indexing_policy === "index_follow");
  };

  useEffect(() => {
    if (!pageId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    Promise.all([
      fetch(`/api/campaigns/pages/${pageId}`).then((r) => r.json()),
      fetch("/api/campaigns/assessments").then((r) => (r.ok ? r.json() : null)),
    ])
      .then(([pData, aData]) => {
        if (pData.error) throw new Error(pData.error);
        hydrate(pData.page);
        if (aData?.assessments) {
          setAssessments(aData.assessments);
          setAssessmentsApiOk(true);
        } else {
          setAssessmentsApiOk(false);
        }
      })
      .catch((err) => {
        toast.error(err instanceof Error ? err.message : "Unable to load page.");
        setPage(null);
      })
      .finally(() => setLoading(false));
  }, [pageId]);

  const saveContent = async () => {
    if (!pageId) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/campaigns/pages/${pageId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          publicTitle,
          seoTitle,
          seoDescription,
          hero: { headline: heroHeadline, subheadline: heroSubhead },
          ctaPrimary,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Save failed");
      hydrate(data.page);
      toast.success("Page saved");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Unable to save.");
    } finally {
      setSaving(false);
    }
  };

  const saveAssessment = async () => {
    if (!pageId) return;
    setSaving(true);
    try {
      if (assessmentsApiOk && selectedTemplateId) {
        const template = assessments.find((a) => a.id === selectedTemplateId);
        if (!template?.latestVersion) throw new Error("Select a template with a published version.");
        const res = await fetch(`/api/campaigns/pages/${pageId}/assessment`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            templateId: template.id,
            versionId: template.latestVersion.id,
            placement: Array.from(placements),
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "Bind failed");
        hydrate(data.page);
      } else {
        const parsed = JSON.parse(formConfigJson) as Record<string, unknown>;
        const res = await fetch(`/api/campaigns/pages/${pageId}/assessment`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            formConfig: parsed,
            placement: Array.from(placements),
            assessmentStatus: "ready",
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "Save failed");
        hydrate(data.page);
      }
      toast.success("Assessment saved");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Unable to save assessment.");
    } finally {
      setSaving(false);
    }
  };

  const runQuality = async () => {
    if (!pageId) return;
    setRunningQuality(true);
    try {
      const res = await fetch(`/api/campaigns/pages/${pageId}/quality`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Quality check failed");
      setQualityChecks(data.result.checks ?? []);
      setQualityScore(data.result.score ?? null);
      setQualityBlocking(Boolean(data.result.blocking));
      toast.success(`Quality score: ${data.result.score}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Quality check failed.");
    } finally {
      setRunningQuality(false);
    }
  };

  const pageAction = async (action: string) => {
    if (!pageId) return;
    setActionLoading(true);
    try {
      const res = await fetch(`/api/campaigns/pages/${pageId}/actions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action,
          overrideReason: overrideReason.trim() || undefined,
          index: publishIndex,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Action failed");
      hydrate(data.page);
      toast.success(`Page ${action.replace(/_/g, " ")}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Action failed.");
    } finally {
      setActionLoading(false);
    }
  };

  const togglePlacement = (p: string) => {
    setPlacements((prev) => {
      const next = new Set(prev);
      if (next.has(p)) next.delete(p);
      else next.add(p);
      return next;
    });
  };

  if (!pageId) {
    return (
      <SectionCard>
        <EmptyState title="No page selected" description="Open a page from Landing Pages or Campaign Detail." />
      </SectionCard>
    );
  }

  if (loading) return <LoadingState label="Loading page editor…" />;
  if (!page) {
    return (
      <SectionCard>
        <EmptyState title="Page not found" action={<Button onClick={() => navigate("landing-pages")}>Back</Button>} />
      </SectionCard>
    );
  }

  return (
    <div>
      <PageHeader
        title={page.public_title ?? page.path}
        description={page.path}
        breadcrumbs={[
          { label: "Landing Pages", onClick: () => navigate("landing-pages") },
          { label: "Editor" },
        ]}
        action={
          <StatusBadge label={page.status.replace(/_/g, " ")} color={page.status === "published" ? "green" : "slate"} />
        }
      />

      <div className="flex gap-2 mb-5 border-b pb-2 overflow-x-auto">
        {TABS.map((t) => (
          <Button
            key={t}
            variant={tab === t ? "default" : "ghost"}
            size="sm"
            onClick={() => setTab(t)}
          >
            {t}
          </Button>
        ))}
      </div>

      {tab === "Content" && (
        <SectionCard>
          <FormSection title="Page content">
            <div className="space-y-4 max-w-xl">
              <div>
                <Label>Public title</Label>
                <Input value={publicTitle} onChange={(e) => setPublicTitle(e.target.value)} />
              </div>
              <div>
                <Label>SEO title</Label>
                <Input value={seoTitle} onChange={(e) => setSeoTitle(e.target.value)} />
              </div>
              <div>
                <Label>SEO description</Label>
                <Textarea value={seoDescription} onChange={(e) => setSeoDescription(e.target.value)} rows={3} />
              </div>
              <div>
                <Label>Hero headline</Label>
                <Input value={heroHeadline} onChange={(e) => setHeroHeadline(e.target.value)} />
              </div>
              <div>
                <Label>Hero subhead</Label>
                <Input value={heroSubhead} onChange={(e) => setHeroSubhead(e.target.value)} />
              </div>
              <div>
                <Label>Primary CTA</Label>
                <Input value={ctaPrimary} onChange={(e) => setCtaPrimary(e.target.value)} />
              </div>
              <Button onClick={saveContent} disabled={saving}>
                {saving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
                Save content
              </Button>
            </div>
          </FormSection>
        </SectionCard>
      )}

      {tab === "Assessment" && (
        <SectionCard>
          <FormSection title="Embedded assessment">
            <p className="text-sm text-muted-foreground mb-4">
              Every published landing page must embed AssessmentExperience (same engine as /patients) — never redirect-only CTAs.
            </p>
            {assessmentsApiOk ? (
              <div className="space-y-4 max-w-xl">
                <div>
                  <Label>Assessment template</Label>
                  <select
                    className="w-full mt-1 rounded-md border bg-background px-3 py-2 text-sm"
                    value={selectedTemplateId}
                    onChange={(e) => setSelectedTemplateId(e.target.value)}
                  >
                    <option value="">Select template…</option>
                    {assessments.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.name} ({a.assessment_engine_slug})
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <Label>Placement</Label>
                  <div className="flex flex-wrap gap-2 mt-2">
                    {PLACEMENTS.map((p) => (
                      <Button
                        key={p}
                        type="button"
                        size="sm"
                        variant={placements.has(p) ? "default" : "outline"}
                        onClick={() => togglePlacement(p)}
                      >
                        {p.replace(/_/g, " ")}
                      </Button>
                    ))}
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">
                  Preview on staging after save. Test flow uses the same assessment engine as patient intake.
                </p>
              </div>
            ) : (
              <div className="space-y-3 max-w-xl">
                <Label>form_config JSON</Label>
                <Textarea
                  value={formConfigJson}
                  onChange={(e) => setFormConfigJson(e.target.value)}
                  rows={12}
                  className="font-mono text-xs"
                  placeholder='{"engine":"assessment","assessment_slug":"...","template_id":"...","placement":["below_hero"],"mode":"full"}'
                />
              </div>
            )}
            <Button className="mt-4" onClick={saveAssessment} disabled={saving}>
              {saving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
              Save assessment
            </Button>
          </FormSection>
        </SectionCard>
      )}

      {tab === "Quality" && (
        <SectionCard>
          <FormSection title="Quality checks">
            <Button onClick={runQuality} disabled={runningQuality} className="mb-4">
              {runningQuality ? <Loader2 className="size-4 animate-spin" /> : null}
              Run quality check
            </Button>
            {qualityScore !== null && (
              <p className="text-sm mb-3">
                Score: <strong>{qualityScore}</strong>
                {qualityBlocking && <span className="text-rose-600 ml-2">Blocking issues present</span>}
              </p>
            )}
            <ul className="space-y-2">
              {qualityChecks.map((c) => (
                <li key={c.id} className="flex items-start gap-2 text-sm">
                  {c.passed ? (
                    <CheckCircle2 className="size-4 text-emerald-600 shrink-0 mt-0.5" />
                  ) : (
                    <XCircle className="size-4 text-rose-600 shrink-0 mt-0.5" />
                  )}
                  <div>
                    <span className={c.passed ? "" : "font-medium"}>{c.label}</span>
                    {c.message && <p className="text-xs text-muted-foreground">{c.message}</p>}
                  </div>
                </li>
              ))}
            </ul>
          </FormSection>
        </SectionCard>
      )}

      {tab === "Publish" && (
        <SectionCard>
          <FormSection title="Publish workflow">
            <p className="text-sm text-muted-foreground mb-4">
              Status: <strong>{page.status}</strong> · Host: <strong>{page.host}</strong>
            </p>
            <div className="flex flex-wrap gap-2 mb-4">
              <Button variant="outline" disabled={actionLoading} onClick={() => pageAction("submit_review")}>
                Submit for review
              </Button>
              <Button variant="outline" disabled={actionLoading} onClick={() => pageAction("approve")}>
                Approve
              </Button>
              <Button variant="outline" disabled={actionLoading} onClick={() => pageAction("request_changes")}>
                Request changes
              </Button>
            </div>
            <div className="space-y-3 max-w-lg border-t pt-4">
              {page.host === "organic" && (
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={publishIndex}
                    onChange={(e) => setPublishIndex(e.target.checked)}
                    className="rounded"
                  />
                  Allow indexing (index_follow) on publish
                </label>
              )}
              <div>
                <Label>Override reason (required if quality blocking)</Label>
                <Textarea value={overrideReason} onChange={(e) => setOverrideReason(e.target.value)} rows={2} />
              </div>
              <div className="flex flex-wrap gap-2">
                <Button disabled={actionLoading} onClick={() => pageAction("publish")}>
                  {actionLoading ? <Loader2 className="size-4 animate-spin" /> : <Rocket className="size-4" />}
                  Publish
                </Button>
                <Button variant="outline" disabled={actionLoading} onClick={() => pageAction("pause")}>
                  <Pause className="size-4" /> Pause
                </Button>
                <Button variant="outline" disabled={actionLoading} onClick={() => pageAction("archive")}>
                  <Archive className="size-4" /> Archive
                </Button>
              </div>
            </div>
          </FormSection>
        </SectionCard>
      )}
    </div>
  );
}
