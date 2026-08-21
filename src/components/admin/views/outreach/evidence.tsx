"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { EmptyState, LoadingState } from "@/components/admin/shared";
import { EVIDENCE_TYPE_LABELS, SOURCE_BADGES } from "@/lib/outreach/labels";
import { EVIDENCE_TYPES, SOURCE_TYPES } from "@/lib/outreach/types";
import { externalLinkProps } from "@/lib/outreach/links";
import type { EvidenceListItem } from "./api";
import * as api from "./api";
import { ConfidenceChip, SafeExternalLink, SourceBadge, formatWhen } from "./shared";

export function EvidenceView({
  loading,
  error,
  evidence,
  onOpenProspect,
  onUseInDraft,
  onReload,
}: {
  loading: boolean;
  error: string | null;
  evidence: EvidenceListItem[];
  onOpenProspect: (id: string) => void;
  onUseInDraft: (prospectId: string, evidenceId: string) => void;
  onReload: () => void;
}) {
  const [type, setType] = useState("");
  const [source, setSource] = useState("");
  const [q, setQ] = useState("");

  const filtered = useMemo(() => evidence.filter((row) => {
    if (type && row.evidenceType !== type) return false;
    if (source && row.sourceType !== source) return false;
    if (q) {
      const hay = `${row.clinicName} ${row.sourceUrl} ${row.excerpt ?? ""}`.toLowerCase();
      if (!hay.includes(q.toLowerCase())) return false;
    }
    return true;
  }), [evidence, type, source, q]);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        <input className="h-8 rounded-md border px-2 text-xs min-w-[180px]" placeholder="Prospect, URL, excerpt…" value={q} onChange={(e) => setQ(e.target.value)} />
        <select className="h-8 rounded-md border px-2 text-xs" value={type} onChange={(e) => setType(e.target.value)}>
          <option value="">Evidence type: Any</option>
          {EVIDENCE_TYPES.map((item) => <option key={item} value={item}>{EVIDENCE_TYPE_LABELS[item]}</option>)}
        </select>
        <select className="h-8 rounded-md border px-2 text-xs" value={source} onChange={(e) => setSource(e.target.value)}>
          <option value="">Source: Any</option>
          {SOURCE_TYPES.map((item) => <option key={item} value={item}>{SOURCE_BADGES[item]}</option>)}
        </select>
      </div>
      {loading ? <LoadingState label="Loading evidence library…" /> : null}
      {error ? <p className="text-sm text-rose-600">{error}</p> : null}
      {!loading && !filtered.length ? <EmptyState title="No research completed yet" description="Evidence appears after Pass 1 on a real clinic. Sample records are not shown." /> : null}
      {!loading && filtered.length ? (
        <div className="grid gap-2">
          {filtered.map((row) => (
            <div key={row.id} className="rounded-lg border p-3 space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <button className="font-medium text-sm hover:underline" onClick={() => onOpenProspect(row.prospectId)}>{row.clinicName}</button>
                <SourceBadge source={row.sourceType} />
                <span className="text-xs text-muted-foreground">{EVIDENCE_TYPE_LABELS[row.evidenceType]}</span>
                <ConfidenceChip value={row.confidence} />
              </div>
              <p className="text-xs"><SafeExternalLink href={row.sourceUrl}>{row.sourceUrl}</SafeExternalLink></p>
              {row.excerpt ? <p className="text-sm text-muted-foreground">{row.excerpt}</p> : null}
              <p className="text-xs text-muted-foreground">
                Observed {formatWhen(row.observedAt)} · Captured {formatWhen(row.capturedAt)} · {row.researcher}
                {row.contentHash ? ` · hash ${row.contentHash}` : ""}
              </p>
              <div className="flex flex-wrap gap-2">
                <Button size="sm" variant="outline" asChild>
                  <a {...externalLinkProps(row.sourceUrl)}>Open source</a>
                </Button>
                <Button size="sm" variant="outline" onClick={() => { void navigator.clipboard.writeText(row.sourceUrl); toast.success("Source URL copied."); }}>
                  Copy source URL
                </Button>
                <Button size="sm" variant="ghost" onClick={() => onOpenProspect(row.prospectId)}>Open prospect</Button>
                <Button size="sm" variant="ghost" onClick={() => onUseInDraft(row.prospectId, row.id)}>Use in draft</Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={async () => {
                    try {
                      await api.deleteEvidence(row.id);
                      toast.success("Evidence deleted.");
                      onReload();
                    } catch (err) {
                      toast.error(err instanceof Error ? err.message : "Delete failed.");
                    }
                  }}
                >
                  Delete
                </Button>
              </div>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
