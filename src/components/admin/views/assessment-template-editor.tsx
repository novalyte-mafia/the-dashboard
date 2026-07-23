"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useNav } from "@/components/admin/admin-app";
import {
  PageHeader, SectionCard, LoadingState, EmptyState, StatusBadge,
} from "@/components/admin/shared";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import {
  ArrowLeft, ArrowDown, ArrowUp, Plus, Trash2, Save, Upload,
} from "lucide-react";
import { toast } from "sonner";
import type { EditableQuestion, EditableQuestionType } from "@/lib/campaigns/assessment-questions";
import { questionsFromVersionConfig } from "@/lib/campaigns/assessment-questions";

type Version = {
  id: string;
  version: number;
  status: string;
  config: Record<string, unknown>;
  question_ids: string[];
  required_question_ids: string[];
  consent_copy: string | null;
  completion_message: string | null;
  next_action: string;
};

type Template = {
  id: string;
  slug: string;
  name: string;
  category: string;
  assessment_engine_slug: string;
  mode: string;
  versions: Version[];
};

const QUESTION_TYPES: EditableQuestionType[] = [
  "single", "multi", "text", "contact-name", "contact-email", "contact-location", "consent",
];

function blankQuestion(): EditableQuestion {
  return {
    id: `q_${Date.now().toString(36)}`,
    type: "single",
    title: "New question",
    required: true,
    stage: "goals",
    options: [
      { value: "option_a", label: "Option A" },
      { value: "option_b", label: "Option B" },
    ],
  };
}

export function AssessmentTemplateEditorView({
  params,
}: {
  params?: Record<string, unknown> | null;
}) {
  const { navigate, refresh, refreshKey } = useNav();
  const templateId = String(params?.templateId ?? "");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [template, setTemplate] = useState<Template | null>(null);
  const [activeVersionId, setActiveVersionId] = useState<string | null>(null);
  const [questions, setQuestions] = useState<EditableQuestion[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const load = useCallback(() => {
    if (!templateId) return;
    setLoading(true);
    fetch(`/api/campaigns/assessments/${templateId}`)
      .then(async (r) => {
        const data = await r.json();
        if (!r.ok) throw new Error(data.error ?? "Unable to load template");
        return data.template as Template;
      })
      .then((t) => {
        setTemplate(t);
        const draft = t.versions.find((v) => v.status === "draft");
        const published = t.versions.find((v) => v.status === "published");
        const active = draft ?? published ?? t.versions[0] ?? null;
        setActiveVersionId(active?.id ?? null);
        const qs = questionsFromVersionConfig(active?.config, t.assessment_engine_slug);
        setQuestions(qs);
        setSelectedId(qs[0]?.id ?? null);
      })
      .catch((err) => toast.error(err instanceof Error ? err.message : "Load failed"))
      .finally(() => setLoading(false));
  }, [templateId, refreshKey]);

  useEffect(() => {
    load();
  }, [load]);

  const activeVersion = useMemo(
    () => template?.versions.find((v) => v.id === activeVersionId) ?? null,
    [template, activeVersionId],
  );
  const selected = questions.find((q) => q.id === selectedId) ?? null;
  const editable = activeVersion?.status === "draft";

  async function createDraft() {
    setSaving(true);
    try {
      const r = await fetch(`/api/campaigns/assessments/${templateId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "create_draft",
          fromVersionId: activeVersionId ?? undefined,
        }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error ?? "Unable to create draft");
      toast.success(`Draft v${data.version.version} created`);
      refresh();
      load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Draft failed");
    } finally {
      setSaving(false);
    }
  }

  async function saveDraft() {
    if (!activeVersionId || !editable) return;
    setSaving(true);
    try {
      const r = await fetch(`/api/campaigns/assessments/${templateId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "update_draft",
          versionId: activeVersionId,
          questions,
        }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error ?? "Unable to save");
      toast.success("Draft saved");
      setTemplate((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          versions: prev.versions.map((v) => (v.id === data.version.id ? data.version : v)),
        };
      });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  async function publish() {
    if (!activeVersionId) return;
    setSaving(true);
    try {
      if (editable) {
        const save = await fetch(`/api/campaigns/assessments/${templateId}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "update_draft", versionId: activeVersionId, questions }),
        });
        if (!save.ok) {
          const data = await save.json();
          throw new Error(data.error ?? "Unable to save before publish");
        }
      }
      const r = await fetch(`/api/campaigns/assessments/${templateId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "publish", versionId: activeVersionId }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error ?? "Unable to publish");
      toast.success(`Published v${data.version.version}`);
      refresh();
      load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Publish failed");
    } finally {
      setSaving(false);
    }
  }

  function updateSelected(patch: Partial<EditableQuestion>) {
    if (!selectedId || !editable) return;
    setQuestions((prev) => prev.map((q) => (q.id === selectedId ? { ...q, ...patch } : q)));
  }

  function moveSelected(dir: -1 | 1) {
    if (!selectedId || !editable) return;
    setQuestions((prev) => {
      const idx = prev.findIndex((q) => q.id === selectedId);
      const next = idx + dir;
      if (idx < 0 || next < 0 || next >= prev.length) return prev;
      const copy = [...prev];
      const [item] = copy.splice(idx, 1);
      copy.splice(next, 0, item);
      return copy;
    });
  }

  if (!templateId) {
    return (
      <EmptyState
        title="No template selected"
        description="Open an assessment template from Campaign Studio → Templates."
      />
    );
  }
  if (loading) return <LoadingState label="Loading assessment editor…" />;
  if (!template) {
    return <EmptyState title="Template not found" description="It may have been deleted." />;
  }

  return (
    <div>
      <PageHeader
        title={template.name}
        description={`${template.assessment_engine_slug} · ${template.mode} · question editor`}
        action={
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={() => navigate("templates")}>
              <ArrowLeft className="mr-1 h-4 w-4" /> Templates
            </Button>
            <Button variant="outline" size="sm" disabled={saving} onClick={createDraft}>
              New draft
            </Button>
            <Button variant="outline" size="sm" disabled={saving || !editable} onClick={saveDraft}>
              <Save className="mr-1 h-4 w-4" /> Save
            </Button>
            <Button size="sm" disabled={saving || !activeVersionId} onClick={publish} className="bg-teal-700 text-white hover:bg-teal-800">
              <Upload className="mr-1 h-4 w-4" /> Publish
            </Button>
          </div>
        }
      />

      <div className="mb-4 flex flex-wrap items-center gap-2 text-sm">
        <span className="text-muted-foreground">Version</span>
        <Select
          value={activeVersionId ?? undefined}
          onValueChange={(id) => {
            setActiveVersionId(id);
            const v = template.versions.find((x) => x.id === id);
            const qs = questionsFromVersionConfig(v?.config, template.assessment_engine_slug);
            setQuestions(qs);
            setSelectedId(qs[0]?.id ?? null);
          }}
        >
          <SelectTrigger className="w-[220px] h-9">
            <SelectValue placeholder="Select version" />
          </SelectTrigger>
          <SelectContent>
            {template.versions.map((v) => (
              <SelectItem key={v.id} value={v.id}>
                v{v.version} · {v.status}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {activeVersion && <StatusBadge label={activeVersion.status} color={activeVersion.status === "published" ? "teal" : "amber"} />}
        {!editable && (
          <span className="text-xs text-muted-foreground">Create a draft to edit questions.</span>
        )}
      </div>

      <div className="grid gap-4 lg:grid-cols-[280px_1fr]">
        <SectionCard
          title="Questions"
          action={
            <Button
              size="sm"
              variant="outline"
              disabled={!editable}
              onClick={() => {
                const q = blankQuestion();
                setQuestions((prev) => [...prev, q]);
                setSelectedId(q.id);
              }}
            >
              <Plus className="h-4 w-4" />
            </Button>
          }
        >
          <div className="space-y-1">
            {questions.map((q, idx) => (
              <button
                key={q.id}
                type="button"
                onClick={() => setSelectedId(q.id)}
                className={`w-full rounded-md border px-3 py-2 text-left text-sm transition ${
                  selectedId === q.id ? "border-teal-300 bg-teal-50" : "hover:bg-muted/40"
                }`}
              >
                <span className="text-xs text-muted-foreground">#{idx + 1} · {q.type}</span>
                <p className="font-medium line-clamp-2">{q.title}</p>
                {q.required ? <span className="text-[10px] uppercase tracking-wide text-teal-700">Required</span> : null}
              </button>
            ))}
            {questions.length === 0 && (
              <p className="text-sm text-muted-foreground">No questions yet.</p>
            )}
          </div>
        </SectionCard>

        <SectionCard title="Question details">
          {!selected ? (
            <p className="text-sm text-muted-foreground">Select a question to edit.</p>
          ) : (
            <div className="space-y-4">
              <div className="flex flex-wrap gap-2">
                <Button size="sm" variant="outline" disabled={!editable} onClick={() => moveSelected(-1)}>
                  <ArrowUp className="h-4 w-4" />
                </Button>
                <Button size="sm" variant="outline" disabled={!editable} onClick={() => moveSelected(1)}>
                  <ArrowDown className="h-4 w-4" />
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={!editable}
                  onClick={() => {
                    setQuestions((prev) => prev.filter((q) => q.id !== selected.id));
                    setSelectedId(null);
                  }}
                >
                  <Trash2 className="mr-1 h-4 w-4" /> Remove
                </Button>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label>Question ID</Label>
                  <Input
                    value={selected.id}
                    disabled={!editable}
                    onChange={(e) => updateSelected({ id: e.target.value.trim() || selected.id })}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Type</Label>
                  <Select
                    value={selected.type}
                    disabled={!editable}
                    onValueChange={(v) => updateSelected({ type: v as EditableQuestionType })}
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {QUESTION_TYPES.map((t) => (
                        <SelectItem key={t} value={t}>{t}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label>Title</Label>
                <Input
                  value={selected.title}
                  disabled={!editable}
                  onChange={(e) => updateSelected({ title: e.target.value })}
                />
              </div>

              <div className="space-y-1.5">
                <Label>Description</Label>
                <Textarea
                  value={selected.desc ?? ""}
                  disabled={!editable}
                  onChange={(e) => updateSelected({ desc: e.target.value })}
                  rows={2}
                />
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label>Stage</Label>
                  <Input
                    value={selected.stage ?? ""}
                    disabled={!editable}
                    onChange={(e) => updateSelected({ stage: e.target.value })}
                  />
                </div>
                <div className="flex items-center justify-between rounded-md border px-3 py-2">
                  <Label>Required</Label>
                  <Switch
                    checked={Boolean(selected.required)}
                    disabled={!editable}
                    onCheckedChange={(checked) => updateSelected({ required: checked })}
                  />
                </div>
              </div>

              {(selected.type === "single" || selected.type === "multi") && (
                <div className="space-y-1.5">
                  <Label>Options (value|label per line)</Label>
                  <Textarea
                    disabled={!editable}
                    rows={5}
                    value={(selected.options ?? []).map((o) => `${o.value}|${o.label}`).join("\n")}
                    onChange={(e) => {
                      const options = e.target.value
                        .split("\n")
                        .map((line) => line.trim())
                        .filter(Boolean)
                        .map((line) => {
                          const [value, ...rest] = line.split("|");
                          return { value: value.trim(), label: (rest.join("|") || value).trim() };
                        });
                      updateSelected({ options });
                    }}
                  />
                </div>
              )}

              <div className="rounded-md border p-3 space-y-2">
                <p className="text-sm font-medium">Conditional display (optional)</p>
                <div className="grid gap-2 sm:grid-cols-3">
                  <Input
                    placeholder="Question ID"
                    disabled={!editable}
                    value={selected.showIf?.questionId ?? ""}
                    onChange={(e) =>
                      updateSelected({
                        showIf: e.target.value
                          ? {
                              questionId: e.target.value,
                              op: selected.showIf?.op ?? "eq",
                              value: selected.showIf?.value ?? "",
                            }
                          : undefined,
                      })
                    }
                  />
                  <Select
                    disabled={!editable || !selected.showIf}
                    value={selected.showIf?.op ?? "eq"}
                    onValueChange={(op) =>
                      updateSelected({
                        showIf: selected.showIf
                          ? { ...selected.showIf, op: op as "eq" | "neq" | "includes" | "truthy" }
                          : undefined,
                      })
                    }
                  >
                    <SelectTrigger><SelectValue placeholder="op" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="eq">equals</SelectItem>
                      <SelectItem value="neq">not equals</SelectItem>
                      <SelectItem value="includes">includes</SelectItem>
                      <SelectItem value="truthy">truthy</SelectItem>
                    </SelectContent>
                  </Select>
                  <Input
                    placeholder="Value"
                    disabled={!editable || !selected.showIf || selected.showIf.op === "truthy"}
                    value={typeof selected.showIf?.value === "string" ? selected.showIf.value : ""}
                    onChange={(e) =>
                      updateSelected({
                        showIf: selected.showIf
                          ? { ...selected.showIf, value: e.target.value }
                          : undefined,
                      })
                    }
                  />
                </div>
              </div>
            </div>
          )}
        </SectionCard>
      </div>
    </div>
  );
}
