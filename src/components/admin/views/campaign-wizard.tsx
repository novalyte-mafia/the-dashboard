"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useNav } from "@/components/admin/admin-app";
import {
  PageHeader, SectionCard, LoadingState, FormSection,
} from "@/components/admin/shared";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { ChevronLeft, ChevronRight, Loader2, Trash2, AlertTriangle } from "lucide-react";
import { toast } from "sonner";

type Vertical = { id: string; name: string; slug: string; default_assessment_slug?: string | null };
type Geo = { id: string; name: string; slug: string; kind: string };
type Assessment = {
  id: string;
  slug: string;
  name: string;
  assessment_engine_slug: string;
  mode: string;
  latestVersion: { id: string; version: number } | null;
};

type MatrixRow = {
  key: string;
  verticalId: string;
  verticalName: string;
  geoId: string;
  geoName: string;
  intent: string;
  clinicIds: string[];
  warnings: string[];
};

const LA_METRO_SLUGS = [
  "beverly-hills",
  "santa-monica",
  "west-hollywood",
  "pasadena",
  "long-beach",
];

const TRAFFIC_OPTIONS = [
  { value: "organic", label: "Organic" },
  { value: "paid_search", label: "Paid Search" },
  { value: "paid_social", label: "Paid Social" },
] as const;

const STEPS = [
  "Basics",
  "Vertical",
  "Cities",
  "Intent",
  "Assessment",
  "Clinics",
  "Matrix",
  "Create",
];

function defaultPageType(traffic: string): string {
  return traffic === "organic" ? "service_location" : "paid_conversion";
}

export function CampaignWizardView() {
  const { navigate } = useNav();
  const [step, setStep] = useState(0);
  const [submitting, setSubmitting] = useState(false);

  const [name, setName] = useState("");
  const [objective, setObjective] = useState("");
  const [trafficType, setTrafficType] = useState<string>("organic");

  const [verticals, setVerticals] = useState<Vertical[]>([]);
  const [verticalId, setVerticalId] = useState("");

  const [cities, setCities] = useState<Geo[]>([]);
  const [selectedCityIds, setSelectedCityIds] = useState<Set<string>>(new Set());

  const [pageType, setPageType] = useState("service_location");
  const [intent, setIntent] = useState("consultation");

  const [assessments, setAssessments] = useState<Assessment[]>([]);
  const [assessmentTemplateId, setAssessmentTemplateId] = useState("");
  const [assessmentsAvailable, setAssessmentsAvailable] = useState(true);

  const [clinicNote, setClinicNote] = useState("");
  const [clinicIds, setClinicIds] = useState<string[]>([]);
  const [matrixRows, setMatrixRows] = useState<MatrixRow[]>([]);

  const [loadingRefs, setLoadingRefs] = useState(true);

  useEffect(() => {
    setLoadingRefs(true);
    Promise.all([
      fetch("/api/campaigns/verticals").then((r) => r.json()),
      fetch("/api/campaigns/geo?kind=city").then((r) => r.json()),
      fetch("/api/campaigns/assessments").then((r) => (r.ok ? r.json() : { assessments: [] })),
    ])
      .then(([vData, gData, aData]) => {
        setVerticals(vData.verticals ?? []);
        setCities(gData.geo ?? []);
        const list = aData.assessments ?? [];
        setAssessments(list);
        setAssessmentsAvailable(list.length > 0);
      })
      .catch(() => toast.error("Unable to load wizard reference data."))
      .finally(() => setLoadingRefs(false));
  }, []);

  useEffect(() => {
    setPageType(defaultPageType(trafficType));
  }, [trafficType]);

  const selectedVertical = useMemo(
    () => verticals.find((v) => v.id === verticalId),
    [verticals, verticalId],
  );

  const laMetroCities = useMemo(
    () => cities.filter((c) => LA_METRO_SLUGS.includes(c.slug)),
    [cities],
  );

  const toggleCity = (id: string) => {
    setSelectedCityIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectLaMetro = () => {
    setSelectedCityIds(new Set(laMetroCities.map((c) => c.id)));
  };

  const buildMatrix = useCallback(() => {
    if (!verticalId) return;
    const vertical = verticals.find((v) => v.id === verticalId);
    if (!vertical) return;

    const rows: MatrixRow[] = [];
    const seen = new Map<string, number>();

    for (const geoId of selectedCityIds) {
      const geo = cities.find((c) => c.id === geoId);
      if (!geo) continue;
      const key = `${verticalId}:${geoId}:${pageType}`;
      const dup = seen.get(key) ?? 0;
      seen.set(key, dup + 1);
      const warnings: string[] = [];
      if (dup > 0) warnings.push("Duplicate vertical × city combination");

      rows.push({
        key: `${geoId}-${verticalId}`,
        verticalId,
        verticalName: vertical.name,
        geoId,
        geoName: geo.name,
        intent: pageType === "paid_conversion" ? intent : pageType,
        clinicIds,
        warnings,
      });
    }
    setMatrixRows(rows);
  }, [verticalId, verticals, selectedCityIds, cities, pageType, intent, clinicIds]);

  useEffect(() => {
    if (step === 6) buildMatrix();
  }, [step, buildMatrix]);

  const removeMatrixRow = (key: string) => {
    setMatrixRows((rows) => rows.filter((r) => r.key !== key));
    const row = matrixRows.find((r) => r.key === key);
    if (row) {
      setSelectedCityIds((prev) => {
        const next = new Set(prev);
        next.delete(row.geoId);
        return next;
      });
    }
  };

  const canNext = (): boolean => {
    switch (step) {
      case 0:
        return name.trim().length > 0 && Boolean(trafficType);
      case 1:
        return Boolean(verticalId);
      case 2:
        return selectedCityIds.size > 0;
      case 3:
        return Boolean(pageType);
      case 4:
        return assessmentsAvailable ? Boolean(assessmentTemplateId) : true;
      case 5:
        return true;
      case 6:
        return matrixRows.length > 0;
      default:
        return true;
    }
  };

  const handleCreate = async () => {
    if (matrixRows.length === 0) {
      toast.error("Add at least one target row.");
      return;
    }
    setSubmitting(true);
    try {
      const createRes = await fetch("/api/campaigns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          objective: objective.trim() || undefined,
          trafficType,
          verticalId,
          settings: {
            pageType,
            assessmentTemplateId: assessmentTemplateId || null,
            clinicNote: clinicNote.trim() || null,
          },
        }),
      });
      const createData = await createRes.json();
      if (!createRes.ok) throw new Error(createData.error ?? "Create failed");

      const campaignId = createData.campaign.id as string;

      const targets = matrixRows.map((r) => ({
        verticalId: r.verticalId,
        geoId: r.geoId,
        intent: r.intent,
        clinicIds: r.clinicIds,
        include: true,
        warnings: r.warnings,
      }));

      const targetsRes = await fetch(`/api/campaigns/${campaignId}/targets`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targets }),
      });
      const targetsData = await targetsRes.json();
      if (!targetsRes.ok) throw new Error(targetsData.error ?? "Targets failed");

      const genRes = await fetch(`/api/campaigns/${campaignId}/generate`, { method: "POST" });
      const genData = await genRes.json();
      if (!genRes.ok) throw new Error(genData.error ?? "Generation failed");

      toast.success(`Created campaign with ${genData.pages?.length ?? 0} pages`);
      navigate("campaign-detail", null, { campaignId });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Unable to create campaign.");
    } finally {
      setSubmitting(false);
    }
  };

  if (loadingRefs) return <LoadingState label="Loading wizard…" />;

  return (
    <div>
      <PageHeader
        title="Campaign Wizard"
        description="Create a campaign and generate landing pages from live targets"
        breadcrumbs={[
          { label: "Campaign Overview", onClick: () => navigate("campaign-overview") },
          { label: "Wizard" },
        ]}
      />

      <div className="flex items-center gap-2 mb-5 overflow-x-auto pb-1">
        {STEPS.map((label, i) => (
          <button
            key={label}
            type="button"
            onClick={() => i < step && setStep(i)}
            className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
              i === step
                ? "bg-primary text-primary-foreground"
                : i < step
                  ? "bg-muted text-foreground hover:bg-muted/80"
                  : "bg-muted/50 text-muted-foreground"
            }`}
          >
            {i + 1}. {label}
          </button>
        ))}
      </div>

      <SectionCard>
        {step === 0 && (
          <FormSection title="Campaign basics">
            <div className="space-y-4 max-w-lg">
              <div>
                <Label htmlFor="name">Campaign name</Label>
                <Input id="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="TRT — LA Metro Q3" />
              </div>
              <div>
                <Label htmlFor="objective">Objective</Label>
                <Textarea id="objective" value={objective} onChange={(e) => setObjective(e.target.value)} rows={3} placeholder="Drive qualified TRT consultations in LA metro" />
              </div>
              <div>
                <Label>Traffic type</Label>
                <div className="flex flex-wrap gap-2 mt-2">
                  {TRAFFIC_OPTIONS.map((opt) => (
                    <Button
                      key={opt.value}
                      type="button"
                      variant={trafficType === opt.value ? "default" : "outline"}
                      size="sm"
                      onClick={() => setTrafficType(opt.value)}
                    >
                      {opt.label}
                    </Button>
                  ))}
                </div>
              </div>
            </div>
          </FormSection>
        )}

        {step === 1 && (
          <FormSection title="Treatment vertical">
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2">
              {verticals.map((v) => (
                <button
                  key={v.id}
                  type="button"
                  onClick={() => setVerticalId(v.id)}
                  className={`text-left rounded-lg border p-3 transition-colors ${
                    verticalId === v.id ? "border-primary bg-primary/5" : "hover:border-primary/40"
                  }`}
                >
                  <p className="font-medium text-sm">{v.name}</p>
                  <p className="text-xs text-muted-foreground">{v.slug}</p>
                </button>
              ))}
            </div>
          </FormSection>
        )}

        {step === 2 && (
          <FormSection title="Target cities">
            <div className="mb-4">
              <Button type="button" variant="outline" size="sm" onClick={selectLaMetro}>
                Quick select: LA metro
              </Button>
              <p className="text-xs text-muted-foreground mt-1">
                Beverly Hills, Santa Monica, West Hollywood, Pasadena, Long Beach
              </p>
            </div>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2 max-h-80 overflow-y-auto">
              {cities.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => toggleCity(c.id)}
                  className={`text-left rounded-lg border p-3 transition-colors ${
                    selectedCityIds.has(c.id) ? "border-primary bg-primary/5" : "hover:border-primary/40"
                  }`}
                >
                  <p className="font-medium text-sm">{c.name}</p>
                  <p className="text-xs text-muted-foreground">{c.slug}</p>
                </button>
              ))}
            </div>
            <p className="text-sm text-muted-foreground mt-3">{selectedCityIds.size} cities selected</p>
          </FormSection>
        )}

        {step === 3 && (
          <FormSection title="Intent & page type">
            <p className="text-sm text-muted-foreground mb-4">
              Based on traffic ({trafficType.replace(/_/g, " ")}), recommended page type is{" "}
              <strong>{defaultPageType(trafficType).replace(/_/g, " ")}</strong>.
            </p>
            <div className="flex flex-wrap gap-2 mb-4">
              {(["service_location", "paid_conversion"] as const).map((pt) => (
                <Button
                  key={pt}
                  type="button"
                  variant={pageType === pt ? "default" : "outline"}
                  size="sm"
                  onClick={() => setPageType(pt)}
                >
                  {pt.replace(/_/g, " ")}
                </Button>
              ))}
            </div>
            {pageType === "paid_conversion" && (
              <div className="max-w-sm">
                <Label htmlFor="intent">Conversion intent</Label>
                <Input id="intent" value={intent} onChange={(e) => setIntent(e.target.value)} placeholder="consultation" />
              </div>
            )}
          </FormSection>
        )}

        {step === 4 && (
          <FormSection title="Assessment template">
            {assessmentsAvailable ? (
              <div className="grid sm:grid-cols-2 gap-2">
                {assessments.map((a) => (
                  <button
                    key={a.id}
                    type="button"
                    onClick={() => setAssessmentTemplateId(a.id)}
                    className={`text-left rounded-lg border p-3 transition-colors ${
                      assessmentTemplateId === a.id ? "border-primary bg-primary/5" : "hover:border-primary/40"
                    }`}
                  >
                    <p className="font-medium text-sm">{a.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {a.assessment_engine_slug} · {a.mode}
                    </p>
                  </button>
                ))}
              </div>
            ) : (
              <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
                <p className="font-medium text-foreground mb-1">Assessment API unavailable</p>
                <p>
                  Using vertical default:{" "}
                  <strong>{selectedVertical?.default_assessment_slug ?? "clinic-matching"}</strong>
                </p>
                <p className="mt-2 text-xs">
                  Pages will need assessment binding in the page editor before publish.
                </p>
              </div>
            )}
          </FormSection>
        )}

        {step === 5 && (
          <FormSection title="Clinic pool (optional)">
            <p className="text-sm text-muted-foreground mb-3">
              Only published directory clinics can be attached to landing pages. Leave empty to use geo-based matching.
            </p>
            <div className="max-w-lg space-y-3">
              <div>
                <Label htmlFor="clinicIds">Clinic IDs (comma-separated)</Label>
                <Input
                  id="clinicIds"
                  value={clinicIds.join(", ")}
                  onChange={(e) =>
                    setClinicIds(
                      e.target.value
                        .split(",")
                        .map((s) => s.trim())
                        .filter(Boolean),
                    )
                  }
                  placeholder="clinic_abc, clinic_xyz"
                />
              </div>
              <div>
                <Label htmlFor="clinicNote">Internal note</Label>
                <Textarea id="clinicNote" value={clinicNote} onChange={(e) => setClinicNote(e.target.value)} rows={2} placeholder="Prefer verified TRT clinics in Beverly Hills…" />
              </div>
            </div>
          </FormSection>
        )}

        {step === 6 && (
          <FormSection title="Confirm matrix">
            <p className="text-sm text-muted-foreground mb-4">
              {matrixRows.length} landing page{matrixRows.length !== 1 ? "s" : ""} will be generated.
            </p>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-muted-foreground">
                    <th className="py-2 pr-4">Vertical</th>
                    <th className="py-2 pr-4">City</th>
                    <th className="py-2 pr-4">Intent</th>
                    <th className="py-2 pr-4">Warnings</th>
                    <th className="py-2" />
                  </tr>
                </thead>
                <tbody>
                  {matrixRows.map((row) => (
                    <tr key={row.key} className="border-b last:border-0">
                      <td className="py-2 pr-4">{row.verticalName}</td>
                      <td className="py-2 pr-4">{row.geoName}</td>
                      <td className="py-2 pr-4">{row.intent}</td>
                      <td className="py-2 pr-4">
                        {row.warnings.length > 0 ? (
                          <span className="inline-flex items-center gap-1 text-amber-600 text-xs">
                            <AlertTriangle className="size-3" /> {row.warnings.join(", ")}
                          </span>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td className="py-2">
                        <Button type="button" variant="ghost" size="icon" onClick={() => removeMatrixRow(row.key)}>
                          <Trash2 className="size-4" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </FormSection>
        )}

        {step === 7 && (
          <FormSection title="Create campaign">
            <dl className="grid sm:grid-cols-2 gap-3 text-sm mb-4">
              <div><dt className="text-muted-foreground">Name</dt><dd className="font-medium">{name}</dd></div>
              <div><dt className="text-muted-foreground">Traffic</dt><dd className="font-medium">{trafficType.replace(/_/g, " ")}</dd></div>
              <div><dt className="text-muted-foreground">Vertical</dt><dd className="font-medium">{selectedVertical?.name ?? "—"}</dd></div>
              <div><dt className="text-muted-foreground">Pages</dt><dd className="font-medium">{matrixRows.length}</dd></div>
            </dl>
            <Button onClick={handleCreate} disabled={submitting}>
              {submitting ? <Loader2 className="size-4 animate-spin" /> : null}
              Create campaign & generate pages
            </Button>
          </FormSection>
        )}

        <div className="flex justify-between mt-6 pt-4 border-t">
          <Button type="button" variant="outline" disabled={step === 0} onClick={() => setStep((s) => s - 1)}>
            <ChevronLeft className="size-4" /> Back
          </Button>
          {step < 7 ? (
            <Button type="button" disabled={!canNext()} onClick={() => setStep((s) => s + 1)}>
              Next <ChevronRight className="size-4" />
            </Button>
          ) : null}
        </div>
      </SectionCard>
    </div>
  );
}
