"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { EmptyState, LoadingState, SectionCard, StatusBadge } from "@/components/admin/shared";
import { QUEUE_BUCKET_LABELS } from "@/lib/outreach/labels";
import { QUEUE_BUCKETS, type OutreachQueueCard, type QueueBucket, type QueuePriority } from "@/lib/outreach/types";

function priorityColor(priority: QueuePriority) {
  switch (priority) {
    case "HIGH":
      return "rose";
    case "MEDIUM":
      return "amber";
    case "LOW":
      return "teal";
    case "NONE":
      return "slate";
    default: {
      const _exhaustive: never = priority;
      return _exhaustive;
    }
  }
}

export function ResearchQueueView({
  loading,
  error,
  queue,
  onOpen,
}: {
  loading: boolean;
  error: string | null;
  queue: Record<QueueBucket, OutreachQueueCard[]> | null;
  onOpen: (id: string) => void;
}) {
  const [active, setActive] = useState<OutreachQueueCard | null>(null);
  if (loading) return <LoadingState label="Loading research queue…" />;
  if (error) return <p className="text-sm text-rose-600">{error}</p>;
  if (!queue) return <EmptyState title="Queue unavailable" />;
  const items = QUEUE_BUCKETS.flatMap((bucket) => (queue[bucket] ?? []).map((card) => ({ ...card, bucket })));

  return (
    <div className="grid lg:grid-cols-[280px_1fr_280px] gap-4">
      <SectionCard title="Queue" description="Human review tasks, highest priority first.">
        {items.length === 0 ? (
          <EmptyState title="Queue is empty" description="Import clinics or run a Meta search. Items appear here when a clinic still needs a human research step." />
        ) : (
          <div className="space-y-2 max-h-[70vh] overflow-y-auto nv-scroll">
            {items.map((card) => (
              <button
                key={`${card.bucket}-${card.id}`}
                className="w-full rounded-md border p-2 text-left hover:bg-muted/40"
                onClick={() => { setActive(card); onOpen(card.id); }}
              >
                <div className="flex items-center gap-2">
                  <p className="text-sm font-medium truncate">{card.clinicName}</p>
                  <StatusBadge label={card.priority} color={priorityColor(card.priority)} />
                </div>
                <p className="text-[11px] text-muted-foreground mt-1">{QUEUE_BUCKET_LABELS[card.bucket]} · {card.missing}</p>
              </button>
            ))}
          </div>
        )}
      </SectionCard>
      <SectionCard title={active?.clinicName ?? "Select a clinic"} description={active ? active.rationale : "Open a queue item to see why it is here and what to do next."}>
        {active ? (
          <div className="space-y-2 text-sm">
            <p><span className="text-muted-foreground">Task:</span> {active.nextBestAction.label}</p>
            <p><span className="text-muted-foreground">Why queued:</span> {active.rationale}</p>
            <p><span className="text-muted-foreground">Missing:</span> {active.missing}</p>
            <p><span className="text-muted-foreground">Evidence:</span> {active.evidenceCount} · Routes {active.contactRouteCount} · Age {active.ageHours}h</p>
            <p><span className="text-muted-foreground">Estimated time:</span> 8–15 minutes</p>
            <div className="flex flex-wrap gap-2 pt-2">
              <Button size="sm" onClick={() => onOpen(active.id)}>Claim / open workspace</Button>
              <Button size="sm" variant="outline" onClick={() => setActive(null)}>Defer</Button>
            </div>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">Choose a left-rail item. Completing research happens in the clinic workspace; sending stays manual.</p>
        )}
      </SectionCard>
      <SectionCard title="Evidence / notes" description="Source viewer">
        {active ? (
          <div className="text-sm space-y-2">
            {active.missingFields.map((item) => <p key={item} className="rounded-md border px-2 py-1 text-xs">{item}</p>)}
            {active.websiteUrl ? <p className="text-xs break-all">{active.websiteUrl}</p> : <p className="text-xs text-muted-foreground">No website on file.</p>}
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">Select an item to see missing fields and the public website.</p>
        )}
      </SectionCard>
    </div>
  );
}
