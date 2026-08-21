"use client";

import { useMemo } from "react";
import { Building2, FileText, Flag, Globe, Mail, Megaphone, Search, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { EmptyState, LoadingState, MetricCard, StageBadge } from "@/components/admin/shared";
import { OUTREACH_MAX_ENRICH, OUTREACH_PAGE_SIZE } from "@/lib/outreach/accounts";
import {
  AD_SIGNAL_LABELS,
  CONFIDENCE_LABELS,
  SOURCE_BADGES,
  STATUS_LABELS,
  VERTICAL_LABELS,
} from "@/lib/outreach/labels";
import {
  AD_SIGNAL_STATUSES,
  PROSPECT_STATUSES,
  RESEARCH_CONFIDENCES,
  SOURCE_TYPES,
  VERTICALS,
  type OutreachProspectRow,
} from "@/lib/outreach/types";
import type { Clinic } from "@/types";
import type { ProspectFilterState } from "./api";
import {
  AdSignalChip,
  ConfidenceChip,
  ContactRouteSummaryBadge,
  SafeExternalLink,
  SourceBadge,
  StatusChip,
  formatWhen,
  verticalLabel,
} from "./shared";

function publicUrl(value?: string | null) {
  if (!value) return null;
  if (/^https?:\/\//i.test(value)) return value;
  return `https://${value}`;
}

export function DiscoverView({
  loading,
  error,
  metrics,
  prospects,
  clinics,
  clinicTotal = 0,
  clinicPage = 1,
  clinicLoading,
  clinicError,
  filters,
  onFiltersChange,
  selected,
  onSelect,
  onEdit,
  onArchive,
  onOpenAccount,
  onClinicPageChange,
  onEnrich: _onEnrich,
  enriching,
  onGoMeta,
  onImport,
  onAdd,
  onResearchMode,
  firecrawlConfigured,
  metaConfigured,
}: {
  loading: boolean;
  error: string | null;
  metrics: {
    prospectsDiscovered: number;
    activeAdSignals: number;
    publicEmailRoutes: number;
    contactFormsFound: number;
    researchReady: number;
    needsReview: number;
  } | null;
  prospects: OutreachProspectRow[];
  clinics: Clinic[];
  clinicTotal?: number;
  clinicPage?: number;
  clinicLoading: boolean;
  clinicError: string | null;
  filters: ProspectFilterState;
  onFiltersChange: (next: ProspectFilterState) => void;
  selected: Set<string>;
  onSelect: (clinic: Clinic, checked: boolean) => void;
  onEdit: (id: string) => void;
  onArchive: (id: string) => void;
  onOpenAccount: (clinicId: string) => void;
  onClinicPageChange: (page: number) => void;
  onEnrich: () => void;
  enriching: boolean;
  onGoMeta?: () => void;
  onImport?: () => void;
  onAdd?: () => void;
  onResearchMode?: (mode: "meta" | "website" | "contacts" | "full" | "score") => void;
  firecrawlConfigured?: boolean;
  metaConfigured?: boolean;
}) {
  const kpis = useMemo(() => ([
    { key: "discovered", label: "Prospects discovered", value: metrics?.prospectsDiscovered ?? 0, hint: "Last 30 days", icon: Building2, tone: "default" as const, apply: () => onFiltersChange({ ...filters, status: "" }) },
    { key: "ads", label: "Active ad signals", value: metrics?.activeAdSignals ?? 0, hint: "Last 30 days", icon: Megaphone, tone: "teal" as const, apply: () => onFiltersChange({ ...filters, adSignal: "ACTIVE_OBSERVED" }) },
    { key: "email", label: "Public email routes", value: metrics?.publicEmailRoutes ?? 0, hint: "Published business email found", icon: Mail, tone: "green" as const, apply: () => onFiltersChange({ ...filters, contactRoute: "email" }) },
    { key: "forms", label: "Contact forms found", value: metrics?.contactFormsFound ?? 0, hint: "Open in a new tab only", icon: FileText, tone: "violet" as const, apply: () => onFiltersChange({ ...filters, contactRoute: "form" }) },
    { key: "ready", label: "Research ready", value: metrics?.researchReady ?? 0, hint: "Last 30 days", icon: Flag, tone: "green" as const, apply: () => onFiltersChange({ ...filters, status: "RESEARCH_READY" }) },
    { key: "review", label: "Needs review", value: metrics?.needsReview ?? 0, hint: "Last 30 days", icon: Search, tone: "amber" as const, apply: () => onFiltersChange({ ...filters, status: "NEEDS_REVIEW" }) },
  ]), [metrics, filters, onFiltersChange]);

  const total = Number(clinicTotal ?? 0);
  const page = Number(clinicPage ?? 1);
  const clinicPages = Math.max(1, Math.ceil(total / OUTREACH_PAGE_SIZE));
  const researchPageRows = prospects.slice(0, OUTREACH_PAGE_SIZE);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3">
        {kpis.map((card) => (
          <MetricCard key={card.key} label={card.label} value={card.value} hint={card.hint} icon={card.icon} tone={card.tone} onClick={card.apply} />
        ))}
      </div>
      <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-3">
        {[
          {
            title: "Meta Ads Library",
            source: metaConfigured ? "Live Ads Archive API + official library link" : "Official Meta Ads Library link-out",
            output: "Search jobs, official URL, matched advertisers when the API returns rows",
            live: metaConfigured ? "API configured" : "Link-out only",
            action: "Search Meta Ads",
            onClick: onGoMeta ?? (() => undefined),
            icon: Megaphone,
          },
          {
            title: "CSV import",
            source: "Operator-uploaded clinic list",
            output: "Outreach prospect records for human research",
            live: "Available",
            action: "Import CSV",
            onClick: onImport ?? (() => undefined),
            icon: Upload,
          },
          {
            title: "Manual clinic entry",
            source: "Operator",
            output: "A single prospect with source = Manual",
            live: "Available",
            action: "Add clinic",
            onClick: onAdd ?? (() => undefined),
            icon: Building2,
          },
          {
            title: "Website / domain research",
            source: firecrawlConfigured ? "Firecrawl" : "FIRECRAWL_API_KEY not set",
            output: "Page evidence and published contact routes when a scrape succeeds",
            live: firecrawlConfigured ? "Live" : "Not configured",
            action: "Research websites",
            onClick: () => onResearchMode?.("website"),
            icon: Globe,
          },
          {
            title: "Public search discovery",
            source: "Exa / Google Search when configured",
            output: "News and public-web evidence, never fabricated hits",
            live: "See Settings",
            action: "Open Settings",
            onClick: () => onResearchMode?.("full"),
            icon: Search,
          },
          {
            title: "Similar clinic discovery",
            source: "Coming next",
            output: "Lookalike clinics from confirmed vertical + geography",
            live: "Not configured",
            action: "Not configured",
            onClick: () => onResearchMode?.("score"),
            icon: Flag,
          },
        ].map((card) => (
          <button key={card.title} className="rounded-lg border p-4 text-left hover:bg-muted/30" onClick={card.onClick}>
            <div className="flex items-center gap-2">
              <card.icon className="size-4 text-teal-700" />
              <p className="text-sm font-semibold">{card.title}</p>
            </div>
            <p className="text-xs text-muted-foreground mt-2">{card.source}</p>
            <p className="text-xs mt-1">{card.output}</p>
            <p className="text-[11px] mt-2 uppercase tracking-wide text-muted-foreground">{card.live} · {card.action}</p>
          </button>
        ))}
      </div>

      <DiscoverFilters filters={filters} onChange={onFiltersChange} />

      <div className="rounded-md border border-teal-200 bg-teal-50 px-3 py-2 text-xs text-teal-950">
        All clinic accounts are available from Outreach. This page shows {OUTREACH_PAGE_SIZE} accounts at a time. Select up to {OUTREACH_MAX_ENRICH} clinics to enrich, then use Next for page 2.
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <div>
          <h2 className="text-sm font-semibold">Clinic accounts</h2>
          <p className="text-xs text-muted-foreground">
            {total.toLocaleString()} accounts · page {page} of {clinicPages} · {selected.size}/{OUTREACH_MAX_ENRICH} selected
          </p>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button size="sm" disabled={enriching || selected.size === 0}>
              {enriching ? "Running research…" : `Run research on selected (${selected.size}/${OUTREACH_MAX_ENRICH})`}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => onResearchMode?.("meta")}>Check Meta Ads Library</DropdownMenuItem>
            <DropdownMenuItem onClick={() => onResearchMode?.("website")}>Verify websites</DropdownMenuItem>
            <DropdownMenuItem onClick={() => onResearchMode?.("contacts")}>Find public contact routes</DropdownMenuItem>
            <DropdownMenuItem onClick={() => onResearchMode?.("full")}>Run full public research</DropdownMenuItem>
            <DropdownMenuItem onClick={() => onResearchMode?.("score")}>Recalculate lead scores</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {clinicLoading ? <LoadingState label="Loading clinic accounts…" /> : null}
      {clinicError ? <p className="text-sm text-rose-600">{clinicError}</p> : null}
      {!clinicLoading && !clinics.length ? (
        <EmptyState title="No clinic accounts on this page" description="Try another search or go to the next page." />
      ) : null}
      {!clinicLoading && clinics.length ? (
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="w-8 px-3 py-2" />
                {["Clinic", "Location", "Website", "Phone", "Published email", "Stage", "Next action", "Source", "Actions"].map((h) => (
                  <th key={h} className="px-3 py-2 text-left font-medium whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y">
              {clinics.map((clinic) => {
                const site = publicUrl(clinic.website);
                return (
                  <tr key={clinic.id} className="hover:bg-muted/30">
                    <td className="px-3 py-2">
                      <Checkbox
                        checked={selected.has(clinic.id)}
                        onCheckedChange={(v) => onSelect(clinic, Boolean(v))}
                      />
                    </td>
                    <td className="px-3 py-2">
                      <button className="text-left font-medium hover:underline" onClick={() => onOpenAccount(clinic.id)}>
                        {clinic.name}
                      </button>
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap">{[clinic.city, clinic.state].filter(Boolean).join(", ") || "—"}</td>
                    <td className="px-3 py-2">
                      {site ? <SafeExternalLink href={site}>{clinic.website}</SafeExternalLink> : "—"}
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap">{clinic.primaryPhone || "—"}</td>
                    <td className="px-3 py-2">{clinic.generalEmail || "—"}</td>
                    <td className="px-3 py-2"><StageBadge stage={clinic.pipelineStage} /></td>
                    <td className="px-3 py-2 text-xs text-muted-foreground">Open account, then start research</td>
                    <td className="px-3 py-2 text-xs text-muted-foreground">{clinic.source || "CRM"}</td>
                    <td className="px-3 py-2 whitespace-nowrap">
                      <Button size="sm" variant="ghost" onClick={() => onOpenAccount(clinic.id)}>Open account</Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : null}

      <div className="flex items-center justify-between gap-2">
        <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => onClinicPageChange(page - 1)}>
          Previous
        </Button>
        <span className="text-xs text-muted-foreground">
          Page {page} of {clinicPages} · {OUTREACH_PAGE_SIZE} accounts per page
        </span>
        <Button size="sm" disabled={page >= clinicPages} onClick={() => onClinicPageChange(page + 1)}>
          Next
        </Button>
      </div>

      <h2 className="text-sm font-semibold pt-2">Outreach research records</h2>
      {loading ? <LoadingState label="Loading research records…" /> : null}
      {error ? <p className="text-sm text-rose-600">{error}</p> : null}
      {!loading && !researchPageRows.length ? (
        <EmptyState
          title="No research has been run for these clinics yet"
          description="Start by selecting clinics and choosing a research action, or search the Meta Ads Library to discover active advertisers. Outreach will not substitute sample clinics."
        />
      ) : null}
      {!loading && researchPageRows.length ? (
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                {["Clinic", "Location", "Vertical", "Website", "Ad signal", "Ad source", "Contact route", "Completeness", "Lead score", "Stage", "Next best action", "Updated", "Actions"].map((h) => (
                  <th key={h} className="px-3 py-2 text-left font-medium whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y">
              {researchPageRows.map((row) => (
                <tr key={row.id} className="hover:bg-muted/30">
                  <td className="px-3 py-2">
                    <button className="text-left font-medium hover:underline" onClick={() => onEdit(row.id)}>{row.clinicName}</button>
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap">{row.location || "—"}</td>
                  <td className="px-3 py-2 whitespace-nowrap">{verticalLabel(row.vertical)}</td>
                  <td className="px-3 py-2">
                    {row.websiteUrl ? <SafeExternalLink href={row.websiteUrl}>{row.canonicalDomain ?? "Website"}</SafeExternalLink> : "—"}
                  </td>
                  <td className="px-3 py-2"><AdSignalChip value={row.adSignal} /></td>
                  <td className="px-3 py-2"><SourceBadge source={row.sourceType} /></td>
                  <td className="px-3 py-2">
                    <ContactRouteSummaryBadge summary={row.contactRoute} />
                  </td>
                  <td className="px-3 py-2 tabular-nums">{row.researchCompleteness}%</td>
                  <td className="px-3 py-2 tabular-nums">{row.leadScore}</td>
                  <td className="px-3 py-2"><StatusChip status={row.status} /></td>
                  <td className="px-3 py-2 text-xs">{row.nextBestAction.label}</td>
                  <td className="px-3 py-2 whitespace-nowrap text-muted-foreground">{formatWhen(row.updatedAt)}</td>
                  <td className="px-3 py-2 whitespace-nowrap">
                    <Button size="sm" variant="ghost" onClick={() => onEdit(row.id)}>View</Button>
                    <Button size="sm" variant="ghost" onClick={() => onArchive(row.id)}>Archive</Button>
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

function DiscoverFilters({
  filters,
  onChange,
}: {
  filters: ProspectFilterState;
  onChange: (next: ProspectFilterState) => void;
}) {
  const set = <K extends keyof ProspectFilterState>(key: K, value: ProspectFilterState[K]) => onChange({ ...filters, [key]: value });
  return (
    <div className="rounded-lg border bg-card p-3 space-y-2">
      <input
        className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
        placeholder="Search clinics, domains, locations, advertiser names..."
        value={filters.q}
        onChange={(e) => set("q", e.target.value)}
      />
      <div className="flex flex-wrap gap-2">
        <select className="h-8 rounded-md border px-2 text-xs" value={filters.status} onChange={(e) => set("status", e.target.value as ProspectFilterState["status"])}>
          <option value="">Status: Any</option>
          {PROSPECT_STATUSES.map((s) => <option key={s} value={s}>{STATUS_LABELS[s]}</option>)}
        </select>
        <select className="h-8 rounded-md border px-2 text-xs" value={filters.vertical} onChange={(e) => set("vertical", e.target.value as ProspectFilterState["vertical"])}>
          <option value="">Vertical: Any</option>
          {VERTICALS.map((s) => <option key={s} value={s}>{VERTICAL_LABELS[s]}</option>)}
        </select>
        <input className="h-8 w-28 rounded-md border px-2 text-xs" placeholder="City" value={filters.city} onChange={(e) => set("city", e.target.value)} />
        <input className="h-8 w-20 rounded-md border px-2 text-xs" placeholder="State" value={filters.state} onChange={(e) => set("state", e.target.value)} />
        <input className="h-8 w-20 rounded-md border px-2 text-xs" placeholder="Country" value={filters.country} onChange={(e) => set("country", e.target.value)} />
        <select className="h-8 rounded-md border px-2 text-xs" value={filters.sourceType} onChange={(e) => set("sourceType", e.target.value as ProspectFilterState["sourceType"])}>
          <option value="">Advertising source: Any</option>
          {SOURCE_TYPES.map((s) => <option key={s} value={s}>{SOURCE_BADGES[s]}</option>)}
        </select>
        <select className="h-8 rounded-md border px-2 text-xs" value={filters.adSignal} onChange={(e) => set("adSignal", e.target.value as ProspectFilterState["adSignal"])}>
          <option value="">Ad signal: Any</option>
          {AD_SIGNAL_STATUSES.map((s) => <option key={s} value={s}>{AD_SIGNAL_LABELS[s]}</option>)}
        </select>
        <select className="h-8 rounded-md border px-2 text-xs" value={filters.websiteStatus} onChange={(e) => set("websiteStatus", e.target.value as ProspectFilterState["websiteStatus"])}>
          <option value="">Website: Any</option>
          <option value="found">Website Found</option>
          <option value="missing">Website Missing</option>
          <option value="needs_review">Needs Review</option>
        </select>
        <select className="h-8 rounded-md border px-2 text-xs" value={filters.contactRoute} onChange={(e) => set("contactRoute", e.target.value as ProspectFilterState["contactRoute"])}>
          <option value="">Contact route: Any</option>
          <option value="email">Published Email</option>
          <option value="form">Contact Form</option>
          <option value="phone">Public Phone</option>
          <option value="multiple">Multiple Routes</option>
          <option value="none">No Route Found</option>
        </select>
        <select className="h-8 rounded-md border px-2 text-xs" value={filters.confidence} onChange={(e) => set("confidence", e.target.value as ProspectFilterState["confidence"])}>
          <option value="">Confidence: Any</option>
          {RESEARCH_CONFIDENCES.map((s) => <option key={s} value={s}>{CONFIDENCE_LABELS[s]}</option>)}
        </select>
        <input className="h-8 rounded-md border px-2 text-xs" type="date" value={filters.discoveredFrom} onChange={(e) => set("discoveredFrom", e.target.value)} title="Date discovered" />
        <input className="h-8 rounded-md border px-2 text-xs" type="date" value={filters.researchedFrom} onChange={(e) => set("researchedFrom", e.target.value)} title="Date last researched" />
      </div>
    </div>
  );
}
