"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { StatusBadge } from "@/components/admin/shared";
import { DRAFT_STATUS_LABELS } from "@/lib/outreach/labels";
import type { DraftStatus, OutreachEvidence, OutreachProspectRow } from "@/lib/outreach/types";
import * as api from "./api";
import { SafeExternalLink, formatWhen } from "./shared";

function draftColor(status: DraftStatus | null) {
  if (status === "VERIFIED_READY") return "green";
  if (status === "NEEDS_REVIEW") return "amber";
  if (status === "SENT" || status === "COPIED") return "teal";
  return "slate";
}

export function DraftPanel({
  prospect,
  evidence,
  onChanged,
  highlightEvidenceId = null,
}: {
  prospect: OutreachProspectRow;
  evidence: OutreachEvidence[];
  onChanged: () => void;
  highlightEvidenceId?: string | null;
}) {
  const [subject, setSubject] = useState(prospect.draftSubject ?? "");
  const [message, setMessage] = useState(prospect.draftMessage ?? "");
  const [busy, setBusy] = useState(false);
  const linked = evidence.filter((row) => prospect.draftEvidenceIds.includes(row.id));
  const status = prospect.draftStatus;

  async function wrap(label: string, fn: () => Promise<void>) {
    setBusy(true);
    try {
      await fn();
      toast.success(label);
      onChanged();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Draft action failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-3">
      <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-950">
        Human-reviewed drafting only. This workspace does not auto-send email or submit contact forms.
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {status ? <StatusBadge label={DRAFT_STATUS_LABELS[status]} color={draftColor(status)} /> : <StatusBadge label="No draft yet" color="slate" />}
        <span className="text-xs text-muted-foreground">Route: {prospect.contactRouteType}</span>
        {prospect.lastVerifiedAt ? <span className="text-xs text-muted-foreground">Verified {formatWhen(prospect.lastVerifiedAt)}</span> : null}
      </div>
      {prospect.draftAngle ? <p className="text-sm"><span className="text-muted-foreground">Angle: </span>{prospect.draftAngle}</p> : null}
      {prospect.verificationResult && !prospect.verificationResult.ok ? (
        <div className="rounded-md border border-rose-200 bg-rose-50 p-3 text-xs text-rose-900">
          <p className="font-semibold mb-1">Pre-send verification failed</p>
          <ul className="list-disc pl-4">{prospect.verificationResult.failures.map((item) => <li key={item}>{item}</li>)}</ul>
        </div>
      ) : null}
      <div className="grid gap-2">
        <input className="h-9 rounded-md border px-3 text-sm" value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Subject" />
        <Textarea value={message} onChange={(e) => setMessage(e.target.value)} rows={16} className="font-sans leading-relaxed" placeholder="Personalized draft appears here after Pass 1." />
      </div>
      <div className="flex flex-wrap gap-2">
        <Button size="sm" disabled={busy} onClick={() => void wrap("Pass 1 complete — first draft saved.", () => api.runDraftPass1(prospect.id).then(() => undefined))}>
          Pass 1: Research + draft
        </Button>
        <Button size="sm" variant="outline" disabled={busy || !prospect.draftMessage} onClick={() => void wrap("Pass 2 complete.", async () => {
          const res = await api.runDraftPass2(prospect.id);
          if (!res.ready) throw new Error("Verification failed. Flagged Needs Review.");
        })}>
          Pass 2: Verify before send
        </Button>
        <Button size="sm" variant="outline" disabled={busy} onClick={() => void wrap("Draft edits saved.", () => api.saveDraftEdits(prospect.id, { draftSubject: subject, draftMessage: message }).then(() => undefined))}>
          Save edits
        </Button>
        {prospect.contactRouteType === "email" ? (
          <Button
            size="sm"
            disabled={busy || status !== "VERIFIED_READY"}
            onClick={() => void wrap("Logged as sent from console. No automated email was sent.", () => api.logConsoleSend(prospect.id).then(() => undefined))}
          >
            Send from console
          </Button>
        ) : null}
        {prospect.contactRouteType === "web_form" ? (
          <Button
            size="sm"
            variant="outline"
            disabled={busy || !prospect.draftMessage}
            onClick={() => {
              void navigator.clipboard.writeText(`${subject}\n\n${message}`);
              void wrap("Copied. Paste into the clinic’s public form — do not submit from Outreach.", () => api.logFormCopy(prospect.id).then(() => undefined));
            }}
          >
            Copy message
          </Button>
        ) : null}
      </div>
      <div>
        <p className="text-xs font-medium text-muted-foreground mb-1">Source evidence linked to this draft</p>
        {linked.length === 0 ? <p className="text-xs text-muted-foreground">Run Pass 1 to attach sourced evidence.</p> : (
          <ul className="space-y-1">
            {linked.map((row) => (
              <li key={row.id} className={`text-xs ${highlightEvidenceId === row.id ? "rounded bg-amber-50 p-1" : ""}`}>
                {row.sourceTitle || row.evidenceType} · <SafeExternalLink href={row.sourceUrl}>{row.sourceUrl}</SafeExternalLink>
              </li>
            ))}
          </ul>
        )}
        {highlightEvidenceId && !linked.some((row) => row.id === highlightEvidenceId) ? (
          <p className="text-xs text-amber-800 mt-2">This evidence is linked to the prospect. Run Pass 1 to include it in the next draft.</p>
        ) : null}
      </div>
    </div>
  );
}
