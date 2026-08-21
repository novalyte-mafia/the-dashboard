"use client";

import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { ConfirmationDialog, EmptyState, LoadingState } from "@/components/admin/shared";
import { CHANNEL_LABELS, CONFIDENCE_LABELS, EVIDENCE_TYPE_LABELS, SOURCE_BADGES } from "@/lib/outreach/labels";
import type { OutreachContactRoute, OutreachEvidence } from "@/lib/outreach/types";
import * as api from "./api";
import {
  AdSignalChip,
  ChannelBadge,
  ConfidenceChip,
  OpenContactFormLink,
  SafeExternalLink,
  SourceBadge,
  StatusChip,
  VerificationChip,
  formatWhen,
  verticalLabel,
} from "./shared";
import { AdvertisingEvidenceModal, ContactRouteModal, EditProspectModal, WebsiteResearchModal } from "./modals";
import { DraftPanel } from "./draft-panel";

export function ProspectDrawer({
  prospectId,
  onClose,
  onChanged,
  initialTab = "overview",
  highlightEvidenceId = null,
}: {
  prospectId: string | null;
  onClose: () => void;
  onChanged: () => void;
  initialTab?: string;
  highlightEvidenceId?: string | null;
}) {
  const [detail, setDetail] = useState<api.ProspectDetailResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState("overview");
  const [adOpen, setAdOpen] = useState(false);
  const [webOpen, setWebOpen] = useState(false);
  const [routeOpen, setRouteOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [note, setNote] = useState("");
  const [confirm, setConfirm] = useState<"archive" | "suppress" | "delete-evidence" | "delete-route" | null>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);

  async function load() {
    if (!prospectId) return;
    setLoading(true);
    setError(null);
    try {
      setDetail(await api.getProspect(prospectId));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load prospect.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    setTab(initialTab);
    setDetail(null);
    if (prospectId) void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prospectId, initialTab]);

  const prospect = detail?.prospect;
  const ready = detail?.researchReady;

  async function afterWrite(message: string) {
    toast.success(message);
    await load();
    onChanged();
  }

  return (
    <Sheet open={Boolean(prospectId)} onOpenChange={(open) => { if (!open) onClose(); }}>
      <SheetContent className="w-full sm:max-w-2xl overflow-y-auto nv-scroll p-0" side="right">
        {loading && !detail ? <LoadingState label="Loading prospect…" /> : null}
        {error ? <p className="p-4 text-sm text-rose-600">{error}</p> : null}
        {prospect ? (
          <>
            <SheetHeader className="border-b px-5 py-4 pr-12 text-left">
              <div className="flex flex-wrap items-center gap-2">
                <SheetTitle className="text-lg">{prospect.clinicName}</SheetTitle>
                <SourceBadge source={prospect.sourceType} />
              </div>
              <SheetDescription className="flex flex-wrap items-center gap-2 text-sm">
                <span>{prospect.location || "Location unknown"}</span>
                <StatusChip status={prospect.status} />
                <ConfidenceChip value={prospect.researchConfidence} />
                <span className="text-xs">Score {prospect.leadScore} · Research {prospect.researchCompleteness}%</span>
              </SheetDescription>
              <p className="text-xs text-muted-foreground mt-1">Next: {prospect.nextBestAction.label} — {prospect.nextBestAction.reason}</p>
              <div className="flex flex-wrap gap-2 pt-2">
                {prospect.websiteUrl ? (
                  <Button size="sm" variant="outline" asChild>
                    <a {...{ href: prospect.websiteUrl, target: "_blank", rel: "noopener noreferrer" }}>Open Website</a>
                  </Button>
                ) : null}
                <Button size="sm" variant="outline" asChild>
                  <a href={`https://www.facebook.com/ads/library/?q=${encodeURIComponent(prospect.clinicName)}&country=US&active_status=active&ad_type=all&search_type=keyword_unordered&media_type=all`} target="_blank" rel="noopener noreferrer">Open Meta Ads Library</a>
                </Button>
                <Button size="sm" variant="outline" onClick={() => setEditOpen(true)}>Edit</Button>
                <Button size="sm" variant="outline" onClick={() => setAdOpen(true)}>Add Evidence</Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={async () => {
                    try {
                      const { job } = await api.startResearch(prospect.id);
                      if (job.status === "NOT_CONFIGURED") {
                        toast.message("Research connector not configured", {
                          description: "Add website research manually. No live results were fabricated.",
                        });
                      } else {
                        toast.success("Research job recorded.");
                      }
                      await load();
                    } catch (err) {
                      toast.error(err instanceof Error ? err.message : "Research failed.");
                    }
                  }}
                >
                  Run Research
                </Button>
                <Button
                  size="sm"
                  disabled={!ready?.allowed}
                  title={ready?.missingRequirements.join(" ") || "Mark Research Ready"}
                  onClick={async () => {
                    try {
                      await api.markResearchReady(prospect.id);
                      await afterWrite("Marked Research Ready.");
                    } catch (err) {
                      toast.error(err instanceof Error ? err.message : "Not research ready.");
                    }
                  }}
                >
                  Mark Research Ready
                </Button>
              </div>
            </SheetHeader>
            <div className="px-5 py-4">
              <Tabs value={tab} onValueChange={setTab}>
                <TabsList className="mb-4 flex flex-wrap h-auto">
                  <TabsTrigger value="overview">Summary</TabsTrigger>
                  <TabsTrigger value="website">Research</TabsTrigger>
                  <TabsTrigger value="ads">Meta Ads</TabsTrigger>
                  <TabsTrigger value="routes">Contact Routes</TabsTrigger>
                  <TabsTrigger value="evidence">Evidence</TabsTrigger>
                  <TabsTrigger value="activity">Notes</TabsTrigger>
                  <TabsTrigger value="draft">Drafts</TabsTrigger>
                  <TabsTrigger value="quality">Data Quality</TabsTrigger>
                </TabsList>

                <TabsContent value="overview" className="space-y-4">
                  {ready && !ready.allowed ? (
                    <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-xs text-amber-950">
                      <p className="font-semibold mb-1">Missing Research Ready requirements</p>
                      <ul className="list-disc pl-4 space-y-0.5">
                        {ready.missingRequirements.map((item) => <li key={item}>{item}</li>)}
                      </ul>
                    </div>
                  ) : null}
                  {ready?.warnings.length ? (
                    <div className="rounded-md border border-slate-200 bg-slate-50 p-3 text-xs text-slate-700">
                      <p className="font-semibold mb-1">Warnings</p>
                      <ul className="list-disc pl-4 space-y-0.5">
                        {ready.warnings.map((item) => <li key={item}>{item}</li>)}
                      </ul>
                    </div>
                  ) : null}
                  <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-3 text-sm">
                    <Row label="Clinic name" value={prospect.clinicName} />
                    <Row label="Website" value={prospect.websiteUrl ? <SafeExternalLink href={prospect.websiteUrl}>{prospect.websiteUrl}</SafeExternalLink> : "—"} />
                    <Row label="Canonical domain" value={prospect.canonicalDomain ?? "—"} />
                    <Row label="Location" value={prospect.location || "—"} />
                    <Row label="Vertical" value={verticalLabel(prospect.vertical)} />
                    <Row label="Business category" value={prospect.businessCategory ?? "—"} />
                    <Row label="Prospect owner" value={prospect.ownerId ?? "Unassigned"} />
                    <Row label="Source type" value={SOURCE_BADGES[prospect.sourceType]} />
                    <Row label="Created" value={formatWhen(prospect.createdAt)} />
                    <Row label="Updated" value={formatWhen(prospect.updatedAt)} />
                    <Row label="Last researched" value={formatWhen(prospect.lastResearchedAt)} />
                    <Row label="Workflow status" value={<StatusChip status={prospect.status} />} />
                    <Row label="Research confidence" value={<ConfidenceChip value={prospect.researchConfidence} />} />
                  </dl>
                  <div>
                    <p className="text-xs font-medium text-muted-foreground mb-1">Notes</p>
                    <p className="text-sm whitespace-pre-wrap">{prospect.notes || "—"}</p>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={() => setConfirm("archive")}>Archive</Button>
                    <Button variant="destructive" size="sm" onClick={() => setConfirm("suppress")}>Suppress</Button>
                  </div>
                </TabsContent>

                <TabsContent value="ads">
                  <div className="flex justify-between mb-3">
                    <p className="text-sm text-muted-foreground">Chronological public advertising evidence.</p>
                    <Button size="sm" onClick={() => setAdOpen(true)}>Add Advertising Evidence</Button>
                  </div>
                  <EvidenceCards
                    items={detail.evidence.filter((row) => row.evidenceType === "ADVERTISING_RECORD")}
                    onDelete={(id) => { setPendingId(id); setConfirm("delete-evidence"); }}
                  />
                </TabsContent>

                <TabsContent value="website">
                  <div className="rounded-md border border-slate-200 bg-slate-50 p-3 text-xs text-slate-700 mb-3">
                    Website research uses Firecrawl when FIRECRAWL_API_KEY is set. If the connector is missing, add page evidence manually. No fabricated crawl results.
                  </div>
                  <div className="flex justify-end mb-3">
                    <Button size="sm" onClick={() => setWebOpen(true)}>Add website research</Button>
                  </div>
                  <EvidenceCards
                    items={detail.evidence.filter((row) => row.evidenceType === "WEBSITE_PAGE" || row.evidenceType === "CONTACT_PAGE" || row.evidenceType === "BUSINESS_PROFILE")}
                    onDelete={(id) => { setPendingId(id); setConfirm("delete-evidence"); }}
                  />
                </TabsContent>

                <TabsContent value="routes">
                  <div className="flex justify-between mb-3">
                    <p className="text-sm text-muted-foreground">Public business-facing contact methods only.</p>
                    <Button size="sm" onClick={() => setRouteOpen(true)}>Add Contact Route</Button>
                  </div>
                  {detail.contactRoutes.length === 0 ? (
                    <EmptyState title="No contact routes" description="Add a published route or explicitly capture No Route Found." />
                  ) : (
                    <div className="space-y-3">
                      {detail.contactRoutes.map((route) => (
                        <ContactRouteCard
                          key={route.id}
                          route={route}
                          onDelete={() => { setPendingId(route.id); setConfirm("delete-route"); }}
                        />
                      ))}
                    </div>
                  )}
                </TabsContent>

                <TabsContent value="evidence">
                  <EvidenceCards
                    items={detail.evidence}
                    onDelete={(id) => { setPendingId(id); setConfirm("delete-evidence"); }}
                  />
                </TabsContent>

                <TabsContent value="quality" className="space-y-2">
                  <p className="text-sm font-medium">Missing or stale data</p>
                  {(prospect.missingFields.length ? prospect.missingFields : ["No blocking gaps recorded"]).map((item) => (
                    <p key={item} className="text-sm rounded-md border px-3 py-2">{item}</p>
                  ))}
                  <p className="text-xs text-muted-foreground">Recommended next action: {prospect.nextBestAction.label}. {prospect.nextBestAction.reason}</p>
                </TabsContent>

                <TabsContent value="draft">
                  <DraftPanel
                    key={`${prospect.id}-${prospect.draftGeneratedAt ?? "none"}`}
                    prospect={prospect}
                    evidence={detail.evidence}
                    highlightEvidenceId={highlightEvidenceId}
                    onChanged={() => { void load(); onChanged(); }}
                  />
                </TabsContent>

                <TabsContent value="activity" className="space-y-3">
                  <div className="flex gap-2">
                    <Textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="Operator note…" rows={2} />
                    <Button
                      onClick={async () => {
                        if (!note.trim()) return;
                        try {
                          await api.addNote(prospect.id, note.trim());
                          setNote("");
                          await afterWrite("Note added.");
                        } catch (err) {
                          toast.error(err instanceof Error ? err.message : "Could not add note.");
                        }
                      }}
                    >
                      Add
                    </Button>
                  </div>
                  <div className="divide-y border rounded-md">
                    {detail.activity.map((item) => (
                      <div key={item.id} className="px-3 py-2.5">
                        <p className="text-sm">{item.description}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {item.eventType} · {item.actorId ?? "system"} · {formatWhen(item.createdAt)}
                        </p>
                      </div>
                    ))}
                  </div>
                </TabsContent>
              </Tabs>
            </div>
          </>
        ) : null}
      </SheetContent>

      {prospect ? (
        <>
          <AdvertisingEvidenceModal
            open={adOpen}
            onOpenChange={setAdOpen}
            onSubmit={async (body) => {
              await api.addEvidence(prospect.id, body);
              await afterWrite("Evidence captured.");
            }}
          />
          <WebsiteResearchModal
            open={webOpen}
            onOpenChange={setWebOpen}
            onSubmit={async (body) => {
              await api.addEvidence(prospect.id, body);
              await afterWrite("Website research saved.");
            }}
          />
          <ContactRouteModal
            open={routeOpen}
            onOpenChange={setRouteOpen}
            onSubmit={async (body) => {
              await api.addContactRoute(prospect.id, body);
              await afterWrite("Contact route saved.");
            }}
          />
          <EditProspectModal
            open={editOpen}
            onOpenChange={setEditOpen}
            clinicName={prospect.clinicName}
            websiteUrl={prospect.websiteUrl ?? ""}
            notes={prospect.notes ?? ""}
            onSubmit={async (body) => {
              await api.patchProspect(prospect.id, body);
              await afterWrite("Prospect updated.");
            }}
          />
        </>
      ) : null}

      <ConfirmationDialog
        open={confirm !== null}
        onOpenChange={(open) => { if (!open) { setConfirm(null); setPendingId(null); } }}
        title={confirm === "suppress" ? "Suppress prospect?" : confirm?.startsWith("delete") ? "Delete record?" : "Archive prospect?"}
        description={
          confirm === "suppress"
            ? "Suppressed prospects stay out of active views and cannot be marked Research Ready."
            : confirm === "archive"
              ? "Archived prospects leave the active research queue. You can restore them later."
              : "This removes the captured record from the prospect. Activity is retained."
        }
        confirmLabel={confirm === "suppress" ? "Suppress" : confirm === "archive" ? "Archive" : "Delete"}
        destructive
        onConfirm={() => {
          void (async () => {
            try {
              if (!prospect) return;
              if (confirm === "archive") {
                await api.archiveProspect(prospect.id);
                toast.success("Prospect archived", {
                  action: {
                    label: "Undo",
                    onClick: () => {
                      void api.restoreProspect(prospect.id).then(() => { void load(); onChanged(); });
                    },
                  },
                });
                onClose();
                onChanged();
              } else if (confirm === "suppress") {
                await api.suppressProspect(prospect.id, "Operator suppressed from drawer");
                toast.success("Prospect suppressed.");
                onClose();
                onChanged();
              } else if (confirm === "delete-evidence" && pendingId) {
                await api.deleteEvidence(pendingId);
                await afterWrite("Evidence deleted.");
              } else if (confirm === "delete-route" && pendingId) {
                await api.deleteContactRoute(pendingId);
                await afterWrite("Contact route deleted.");
              }
            } catch (err) {
              toast.error(err instanceof Error ? err.message : "Action failed.");
            }
          })();
        }}
      />
    </Sheet>
  );
}

function Row({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="mt-0.5">{value}</dd>
    </div>
  );
}

function EvidenceCards({ items, onDelete }: { items: OutreachEvidence[]; onDelete: (id: string) => void }) {
  if (!items.length) return <EmptyState title="No evidence captured" description="Add a public source URL to store verifiable evidence." />;
  return (
    <div className="space-y-3">
      {items.map((item) => {
        const signal = typeof item.structuredData.signalStatus === "string" ? item.structuredData.signalStatus : null;
        const facts = Array.isArray(item.structuredData.keyFacts) ? item.structuredData.keyFacts.filter((f): f is string => typeof f === "string") : [];
        const pageType = typeof item.structuredData.pageType === "string" ? item.structuredData.pageType : null;
        return (
          <div key={item.id} className="rounded-lg border p-3 space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <SourceBadge source={item.sourceType} />
              <span className="text-xs text-muted-foreground">{EVIDENCE_TYPE_LABELS[item.evidenceType]}</span>
              {signal === "ACTIVE_OBSERVED" || signal === "PREVIOUSLY_OBSERVED" || signal === "UNKNOWN" || signal === "NO_SIGNAL" ? (
                <AdSignalChip value={signal} />
              ) : null}
              <ConfidenceChip value={item.confidence} />
            </div>
            <p className="text-sm font-medium">{item.sourceTitle || "Untitled source"}</p>
            {pageType ? <p className="text-xs text-muted-foreground">Page type: {pageType}</p> : null}
            <p className="text-xs">
              Source: <SafeExternalLink href={item.sourceUrl}>{item.sourceUrl}</SafeExternalLink>
            </p>
            <p className="text-xs text-muted-foreground">Observed {formatWhen(item.observedAt)} · Captured {formatWhen(item.capturedAt)}</p>
            {item.excerpt ? <p className="text-sm text-muted-foreground">{item.excerpt}</p> : null}
            {facts.length ? (
              <ul className="list-disc pl-4 text-xs text-muted-foreground">
                {facts.map((fact) => <li key={fact}>{fact}</li>)}
              </ul>
            ) : null}
            {item.contentHash ? <p className="text-[11px] font-mono text-muted-foreground">hash {item.contentHash}</p> : null}
            <div className="flex gap-2">
              <Button size="sm" variant="outline" asChild>
                <a href={item.sourceUrl} target="_blank" rel="noopener noreferrer">Open Original Source</a>
              </Button>
              <Button size="sm" variant="ghost" onClick={() => onDelete(item.id)}>Delete</Button>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function ContactRouteCard({ route, onDelete }: { route: OutreachContactRoute; onDelete: () => void }) {
  const isForm = route.channelType === "CONTACT_FORM";
  return (
    <div className={`rounded-lg border p-3 space-y-2 ${route.isDoNotContact ? "border-rose-300 bg-rose-50" : ""}`}>
      <div className="flex flex-wrap items-center gap-2">
        <ChannelBadge channel={route.channelType} />
        <span className="text-sm font-medium">{CHANNEL_LABELS[route.channelType]}</span>
        {route.isPubliclyPublished ? <span className="text-[10px] uppercase tracking-wide text-teal-700">Publicly published</span> : null}
        {route.isDoNotContact ? <span className="text-[10px] uppercase tracking-wide text-rose-700">Do not contact</span> : null}
      </div>
      <p className="text-sm font-mono break-all">{route.value}</p>
      {route.sourceUrl ? (
        <p className="text-xs">Source: <SafeExternalLink href={route.sourceUrl}>{route.sourceUrl}</SafeExternalLink></p>
      ) : (
        <p className="text-xs text-muted-foreground">Manual operator record — no source URL.</p>
      )}
      {route.sourceContext ? <p className="text-xs text-muted-foreground">{route.sourceContext}</p> : null}
      <div className="flex flex-wrap gap-2">
        <VerificationChip status={route.verificationStatus} />
        <ConfidenceChip value={route.confidence} />
      </div>
      {route.verificationNotes ? <p className="text-xs">{route.verificationNotes}</p> : null}
      <p className="text-xs text-muted-foreground">Captured {formatWhen(route.capturedAt)} · Last reviewed {formatWhen(route.lastReviewedAt)}</p>
      <div className="flex gap-2">
        {isForm && /^https?:/i.test(route.value) ? <OpenContactFormLink href={route.value} /> : null}
        <Button size="sm" variant="ghost" onClick={onDelete}>Delete</Button>
      </div>
    </div>
  );
}
