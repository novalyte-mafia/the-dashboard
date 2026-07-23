"use client";

import { useMemo, useState } from "react";
import { useNav } from "@/components/admin/admin-app";
import {
  PageHeader, SectionCard, StatusBadge, EmptyState,
} from "@/components/admin/shared";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { mockCampaignOpportunities } from "@/lib/demand/mock-opportunities";
import {
  canPublishFromDemandOpportunity,
  suggestedAdsPublicUrl,
  type DemandCampaignOpportunity,
  type DemandComplianceStatus,
  type DemandContentStatus,
  type DemandPublicationStatus,
} from "@/lib/demand/opportunities";
import { formatCurrency } from "@/lib/format";

function statusColor(status: string): string {
  if (status === "approved" || status === "cleared" || status === "ready_to_publish" || status === "published") {
    return "teal";
  }
  if (status === "flagged" || status === "rejected") return "rose";
  if (status === "in_review" || status === "drafted") return "amber";
  return "slate";
}

export function CampaignOpportunitiesView() {
  const { navigate } = useNav();
  const [items, setItems] = useState<DemandCampaignOpportunity[]>(mockCampaignOpportunities);
  const [selectedId, setSelectedId] = useState<string | null>(items[0]?.id ?? null);
  const selected = items.find((i) => i.id === selectedId) ?? null;

  const readyCount = useMemo(
    () => items.filter((i) => canPublishFromDemandOpportunity(i)).length,
    [items],
  );

  function patchSelected(patch: Partial<DemandCampaignOpportunity>) {
    if (!selected) return;
    setItems((prev) =>
      prev.map((item) =>
        item.id === selected.id
          ? { ...item, ...patch, updatedAt: new Date().toISOString() }
          : item,
      ),
    );
  }

  function approveContent() {
    patchSelected({
      contentStatus: "approved" as DemandContentStatus,
      lastReviewed: new Date().toISOString().slice(0, 10),
    });
    toast.success("Content marked approved");
  }

  function clearCompliance() {
    patchSelected({
      complianceStatus: "cleared" as DemandComplianceStatus,
      lastReviewed: new Date().toISOString().slice(0, 10),
    });
    toast.success("Compliance cleared");
  }

  function markReady() {
    if (!selected) return;
    const next: DemandCampaignOpportunity = {
      ...selected,
      publicationStatus: "ready_to_publish",
      lastReviewed: selected.lastReviewed ?? new Date().toISOString().slice(0, 10),
      updatedAt: new Date().toISOString(),
    };
    if (!canPublishFromDemandOpportunity(next)) {
      toast.error("Approve content and clear compliance before marking ready.");
      return;
    }
    patchSelected({ publicationStatus: "ready_to_publish" as DemandPublicationStatus });
    toast.success("Ready for Campaign Studio draft");
  }

  function openWizard() {
    if (!selected) return;
    if (!canPublishFromDemandOpportunity(selected)) {
      toast.error("Opportunity must pass the publish gate first.");
      return;
    }
    navigate("campaign-wizard", null, {
      fromOpportunityId: selected.id,
      treatmentSlug: selected.treatmentSlug,
      city: selected.city,
      state: selected.stateAbbreviation,
      suggestedPath: selected.suggestedPath,
      assessmentSlug: selected.suggestedAssessmentSlug,
    });
    toast.message("Opening Campaign Wizard with opportunity context");
  }

  if (items.length === 0) {
    return <EmptyState title="No opportunities" description="Demand signals will appear here." />;
  }

  return (
    <div>
      <PageHeader
        title="Campaign Opportunities"
        description="Demand signals reviewed for Campaign Studio — never auto-published. CPC and volume stay admin-only."
      />

      <div className="mb-4 grid gap-3 sm:grid-cols-3">
        <div className="rounded-lg border p-3">
          <p className="text-xs text-muted-foreground">Opportunities</p>
          <p className="text-2xl font-semibold">{items.length}</p>
        </div>
        <div className="rounded-lg border p-3">
          <p className="text-xs text-muted-foreground">Ready to draft</p>
          <p className="text-2xl font-semibold">{readyCount}</p>
        </div>
        <div className="rounded-lg border p-3">
          <p className="text-xs text-muted-foreground">Rising locations</p>
          <p className="text-2xl font-semibold">{items.filter((i) => i.risingLocation).length}</p>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
        <SectionCard title="Opportunity queue">
          <div className="space-y-2">
            {items.map((item) => {
              const ready = canPublishFromDemandOpportunity(item);
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setSelectedId(item.id)}
                  className={`w-full rounded-lg border p-3 text-left transition ${
                    selectedId === item.id ? "border-teal-300 bg-teal-50/60" : "hover:bg-muted/30"
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-medium">{item.query}</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {item.treatmentSlug}
                        {item.city ? ` · ${item.city}, ${item.stateAbbreviation ?? item.state}` : ""}
                      </p>
                    </div>
                    {ready ? <StatusBadge label="ready" color="teal" /> : null}
                  </div>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    <StatusBadge label={item.contentStatus} color={statusColor(item.contentStatus)} />
                    <StatusBadge label={item.complianceStatus} color={statusColor(item.complianceStatus)} />
                    <StatusBadge label={item.publicationStatus} color={statusColor(item.publicationStatus)} />
                  </div>
                </button>
              );
            })}
          </div>
        </SectionCard>

        <SectionCard title="Review & handoff">
          {!selected ? (
            <p className="text-sm text-muted-foreground">Select an opportunity.</p>
          ) : (
            <div className="space-y-4 text-sm">
              <div>
                <p className="font-semibold text-foreground">{selected.query}</p>
                <p className="text-muted-foreground mt-1">
                  Intent: {selected.searchIntent ?? "—"} · Trend: {selected.trendDirection ?? "—"}
                </p>
              </div>

              <div className="grid grid-cols-3 gap-2 rounded-md border bg-muted/20 p-3 text-xs">
                <div>
                  <p className="text-muted-foreground">Volume</p>
                  <p className="font-semibold">{selected.searchVolume ?? "—"}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">CPC</p>
                  <p className="font-semibold">
                    {selected.cpc != null ? formatCurrency(selected.cpc) : "—"}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground">Competition</p>
                  <p className="font-semibold">
                    {selected.competition != null ? selected.competition.toFixed(2) : "—"}
                  </p>
                </div>
              </div>

              <div className="space-y-1">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Suggested lander</p>
                <p className="font-mono text-xs break-all">
                  {suggestedAdsPublicUrl(selected) ?? selected.suggestedPath ?? "—"}
                </p>
                <p className="text-muted-foreground">
                  Assessment: {selected.suggestedAssessmentSlug ?? "—"}
                </p>
                {selected.suggestedHeroHeading ? (
                  <p className="text-foreground">{selected.suggestedHeroHeading}</p>
                ) : null}
              </div>

              {selected.suggestedShortAnswerQuestions?.length ? (
                <ul className="list-disc pl-4 text-muted-foreground space-y-1">
                  {selected.suggestedShortAnswerQuestions.map((q) => (
                    <li key={q}>{q}</li>
                  ))}
                </ul>
              ) : null}

              <div className="space-y-1.5">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Notes</p>
                <Textarea
                  rows={3}
                  value={selected.notes ?? ""}
                  onChange={(e) => patchSelected({ notes: e.target.value })}
                />
              </div>

              <div className="flex flex-wrap gap-2">
                <Button size="sm" variant="outline" onClick={approveContent}>
                  Approve content
                </Button>
                <Button size="sm" variant="outline" onClick={clearCompliance}>
                  Clear compliance
                </Button>
                <Button size="sm" variant="outline" onClick={markReady}>
                  Mark ready
                </Button>
                <Button
                  size="sm"
                  className="bg-teal-700 text-white hover:bg-teal-800"
                  disabled={!canPublishFromDemandOpportunity(selected)}
                  onClick={openWizard}
                >
                  Create Studio draft
                </Button>
              </div>

              <p className="text-xs text-muted-foreground">
                Gate: content approved + compliance cleared + ready_to_publish + assessment/path + last reviewed.
                Raw AI drafts never auto-publish.
              </p>
            </div>
          )}
        </SectionCard>
      </div>
    </div>
  );
}
