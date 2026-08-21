"use client";

import { Button } from "@/components/ui/button";
import { EmptyState, LoadingState } from "@/components/admin/shared";
import { CHANNEL_LABELS, VERIFICATION_LABELS } from "@/lib/outreach/labels";
import { CONTACT_CHANNEL_TYPES, CONTACT_VERIFICATION_STATUSES } from "@/lib/outreach/types";
import type { ContactListItem } from "./api";
import { ChannelBadge, ConfidenceChip, OpenContactFormLink, SafeExternalLink, VerificationChip, formatWhen } from "./shared";

export function ContactsView({
  loading,
  error,
  contacts,
  channelType,
  verification,
  includeSuppressed,
  onChannelType,
  onVerification,
  onIncludeSuppressed,
  onOpenDraft,
  onSendFromConsole,
  onCopyMessage,
}: {
  loading: boolean;
  error: string | null;
  contacts: ContactListItem[];
  channelType: string;
  verification: string;
  includeSuppressed: boolean;
  onChannelType: (value: string) => void;
  onVerification: (value: string) => void;
  onIncludeSuppressed: (value: boolean) => void;
  onOpenDraft: (prospectId: string) => void;
  onSendFromConsole: (prospectId: string) => void;
  onCopyMessage: (prospectId: string, text: string) => void;
}) {
  return (
    <div className="space-y-3">
      <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-950">
        Only public business contact routes are displayed. This module does not send messages or submit forms.
      </div>
      <div className="flex flex-wrap gap-2">
        <select className="h-8 rounded-md border px-2 text-xs" value={channelType} onChange={(e) => onChannelType(e.target.value)}>
          <option value="">Contact type: Any</option>
          {CONTACT_CHANNEL_TYPES.map((item) => <option key={item} value={item}>{CHANNEL_LABELS[item]}</option>)}
        </select>
        <select className="h-8 rounded-md border px-2 text-xs" value={verification} onChange={(e) => onVerification(e.target.value)}>
          <option value="">Verification: Any</option>
          {CONTACT_VERIFICATION_STATUSES.map((item) => <option key={item} value={item}>{VERIFICATION_LABELS[item]}</option>)}
        </select>
        <label className="flex items-center gap-2 text-xs">
          <input type="checkbox" checked={includeSuppressed} onChange={(e) => onIncludeSuppressed(e.target.checked)} />
          Include suppressed / Do Not Contact
        </label>
      </div>
      {loading ? <LoadingState label="Loading contact routes…" /> : null}
      {error ? <p className="text-sm text-rose-600">{error}</p> : null}
      {!loading && !contacts.length ? <EmptyState title="No verified email — web form/manual route needed." description="Incomplete clinics stay listed. Outreach does not invent contact routes." /> : null}
      {!loading && contacts.length ? (
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-xs text-muted-foreground">
              <tr>
                {["Clinic", "Contact type", "Contact value", "Publicly published", "Source URL", "Verification", "Do Not Contact", "Last reviewed", "Research confidence", "Draft"].map((h) => (
                  <th key={h} className="px-3 py-2 text-left font-medium whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y">
              {contacts.map((row) => (
                <tr key={row.id} className={row.isDoNotContact ? "bg-rose-50" : undefined}>
                  <td className="px-3 py-2">
                    <div className="font-medium">{row.clinicName}</div>
                  </td>
                  <td className="px-3 py-2"><ChannelBadge channel={row.channelType} /></td>
                  <td className="px-3 py-2">
                    <div className="font-mono text-xs break-all">{row.value}</div>
                    {row.channelType === "CONTACT_FORM" && /^https?:/i.test(row.value) ? (
                      <div className="mt-1"><OpenContactFormLink href={row.value} /></div>
                    ) : null}
                  </td>
                  <td className="px-3 py-2">{row.isPubliclyPublished ? "Yes" : "No"}</td>
                  <td className="px-3 py-2">{row.sourceUrl ? <SafeExternalLink href={row.sourceUrl}>{row.sourceUrl}</SafeExternalLink> : "Manual"}</td>
                  <td className="px-3 py-2"><VerificationChip status={row.verificationStatus} /></td>
                  <td className="px-3 py-2">{row.isDoNotContact ? "Yes" : "No"}</td>
                  <td className="px-3 py-2 text-muted-foreground">{formatWhen(row.lastReviewedAt)}</td>
                  <td className="px-3 py-2"><ConfidenceChip value={row.researchConfidence} /></td>
                  <td className="px-3 py-2 whitespace-nowrap">
                    <Button size="sm" variant="ghost" onClick={() => onOpenDraft(row.prospectId)}>Draft</Button>
                    {row.contactRouteType === "email" && row.draftStatus === "VERIFIED_READY" ? (
                      <Button size="sm" variant="ghost" onClick={() => onSendFromConsole(row.prospectId)}>Send from console</Button>
                    ) : null}
                    {row.channelType === "CONTACT_FORM" && row.draftMessage ? (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => onCopyMessage(row.prospectId, `${row.draftSubject ?? ""}\n\n${row.draftMessage}`)}
                      >
                        Copy message
                      </Button>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </div>
  );
}
