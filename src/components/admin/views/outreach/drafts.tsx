"use client";

import { Button } from "@/components/ui/button";
import { EmptyState, LoadingState, StatusBadge } from "@/components/admin/shared";
import { DRAFT_STATUS_LABELS } from "@/lib/outreach/labels";
import type { DraftStatus, OutreachProspectRow } from "@/lib/outreach/types";
import { formatWhen } from "./shared";

function color(status: DraftStatus | null) {
  if (status === "VERIFIED_READY") return "green";
  if (status === "NEEDS_REVIEW") return "amber";
  if (status === "SENT" || status === "COPIED") return "teal";
  return "slate";
}

export function DraftsView({
  loading,
  error,
  drafts,
  onOpen,
  onPass1,
  onPass2,
  busyId,
}: {
  loading: boolean;
  error: string | null;
  drafts: OutreachProspectRow[];
  onOpen: (id: string) => void;
  onPass1: (id: string) => void;
  onPass2: (id: string) => void;
  busyId: string | null;
}) {
  if (loading) return <LoadingState label="Loading drafts…" />;
  if (error) return <p className="text-sm text-rose-600">{error}</p>;
  return (
    <div className="space-y-3">
      <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-950">
        Draft step is research-driven and human-sent. Pass 1 writes the first personalized message. Pass 2 re-verifies the contact route and evidence freshness before the console handoff.
      </div>
      {!drafts.length ? (
        <EmptyState title="No research completed yet" description="Run Pass 1 on a real clinic. Sample drafts are not shown." />
      ) : (
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-xs text-muted-foreground">
              <tr>
                {["Clinic", "Location", "Route", "Draft status", "Generated", "Actions"].map((h) => (
                  <th key={h} className="px-3 py-2 text-left font-medium whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y">
              {drafts.map((row) => (
                <tr key={row.id} className="hover:bg-muted/30">
                  <td className="px-3 py-2">
                    <button className="font-medium hover:underline" onClick={() => onOpen(row.id)}>{row.clinicName}</button>
                  </td>
                  <td className="px-3 py-2">{row.location || "—"}</td>
                  <td className="px-3 py-2">{row.contactRouteType}</td>
                  <td className="px-3 py-2">
                    {row.draftStatus ? <StatusBadge label={DRAFT_STATUS_LABELS[row.draftStatus]} color={color(row.draftStatus)} /> : "—"}
                  </td>
                  <td className="px-3 py-2 text-muted-foreground">{formatWhen(row.draftGeneratedAt)}</td>
                  <td className="px-3 py-2 whitespace-nowrap">
                    <Button size="sm" variant="ghost" onClick={() => onOpen(row.id)}>Open draft</Button>
                    <Button size="sm" variant="ghost" disabled={busyId === row.id} onClick={() => onPass1(row.id)}>Pass 1</Button>
                    <Button size="sm" variant="ghost" disabled={busyId === row.id || !row.draftMessage} onClick={() => onPass2(row.id)}>Pass 2</Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
