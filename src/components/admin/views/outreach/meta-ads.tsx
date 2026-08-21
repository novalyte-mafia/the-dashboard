"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { EmptyState, LoadingState, SectionCard, StatusBadge } from "@/components/admin/shared";
import { META_TRUST_LABELS, VERTICAL_LABELS } from "@/lib/outreach/labels";
import { EMPTY_META_QUERY, META_ADS_LIBRARY_BASE } from "@/lib/outreach/meta-ads";
import { META_PLATFORMS, VERTICALS, type MetaAdActiveStatus, type MetaPlatform, type MetaSearchQuery, type OutreachMetaAdResult, type OutreachMetaSearch, type OutreachResearchJob, type OutreachSavedMetaSearch, type Vertical } from "@/lib/outreach/types";
import { externalLinkProps } from "@/lib/outreach/links";
import * as api from "./api";
import { Field, SafeExternalLink, formatWhen } from "./shared";

export function MetaAdsLibraryView({
  searches,
  results,
  job,
  saved,
  suggested,
  trustMode,
  apiConfigured,
  loading,
  running,
  onSearch,
  onClear,
  onSave,
  onRunSaved,
  onDeleteSaved,
  onAttach,
  onCreateClinic,
  onDismiss,
  onRerun,
  onOpenProspect,
  onAddToQueue,
}: {
  searches: OutreachMetaSearch[];
  results: OutreachMetaAdResult[];
  job: OutreachResearchJob | null;
  saved: OutreachSavedMetaSearch[];
  suggested: Array<{ name: string; query: MetaSearchQuery }>;
  trustMode: string;
  apiConfigured: boolean;
  loading: boolean;
  running: boolean;
  onSearch: (query: MetaSearchQuery, name?: string) => void;
  onClear: () => void;
  onSave: (name: string, query: MetaSearchQuery) => void;
  onRunSaved: (query: MetaSearchQuery, name: string, savedSearchId?: string) => void;
  onDeleteSaved: (id: string) => void;
  onAttach: (id: string) => void;
  onCreateClinic: (id: string) => void;
  onDismiss: (id: string) => void;
  onRerun: (id: string) => void;
  onOpenProspect: (id: string) => void;
  onAddToQueue: (id: string) => void;
}) {
  const [query, setQuery] = useState<MetaSearchQuery>(EMPTY_META_QUERY);
  const [view, setView] = useState<"cards" | "table">("cards");
  const [filter, setFilter] = useState<"all" | "unreviewed" | "matched" | "unmatched">("all");
  const officialPreview = useMemo(() => {
    const terms = [query.advertiser, query.clinicName, query.keyword, query.city, query.state].filter((part) => part.trim()).join(" ");
    const params = new URLSearchParams({
      active_status: query.activeStatus,
      ad_type: "all",
      country: query.country || "US",
      search_type: query.advertiser && !query.keyword ? "page" : "keyword_unordered",
      media_type: "all",
    });
    if (terms) params.set("q", terms);
    return `${META_ADS_LIBRARY_BASE}?${params.toString()}`;
  }, [query]);

  const filtered = results.filter((row) => {
    if (filter === "unreviewed") return !row.dismissed && !row.clinicMatchId;
    if (filter === "matched") return Boolean(row.clinicMatchId);
    if (filter === "unmatched") return !row.clinicMatchId;
    return true;
  });

  const latest = searches[0] ?? null;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <StatusBadge
          label={META_TRUST_LABELS[trustMode as keyof typeof META_TRUST_LABELS] ?? trustMode}
          color={trustMode === "LIVE_META_DATA" ? "green" : "amber"}
        />
        <p className="text-xs text-muted-foreground">
          {apiConfigured
            ? "API key is present. Search will attempt the Ads Archive API and still provide the official library link."
            : "No META_AD_LIBRARY_API_KEY. Search records a job, saves the official library URL, and does not invent ad cards."}
        </p>
      </div>

      <SectionCard title="Search Meta Ads Library" description="Public advertising research only. Results are stored as evidence when Meta returns them or when you attach an advertiser to a clinic.">
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          <Field label="Advertiser / brand name">
            <input className="h-9 rounded-md border px-2 text-sm w-full" value={query.advertiser} onChange={(e) => setQuery({ ...query, advertiser: e.target.value })} />
          </Field>
          <Field label="Keyword search">
            <input className="h-9 rounded-md border px-2 text-sm w-full" value={query.keyword} onChange={(e) => setQuery({ ...query, keyword: e.target.value })} placeholder="TRT clinic" />
          </Field>
          <Field label="Clinic name">
            <input className="h-9 rounded-md border px-2 text-sm w-full" value={query.clinicName} onChange={(e) => setQuery({ ...query, clinicName: e.target.value })} />
          </Field>
          <Field label="City">
            <input className="h-9 rounded-md border px-2 text-sm w-full" value={query.city} onChange={(e) => setQuery({ ...query, city: e.target.value })} />
          </Field>
          <Field label="State">
            <input className="h-9 rounded-md border px-2 text-sm w-full" value={query.state} onChange={(e) => setQuery({ ...query, state: e.target.value })} />
          </Field>
          <Field label="Country">
            <input className="h-9 rounded-md border px-2 text-sm w-full" value={query.country} onChange={(e) => setQuery({ ...query, country: e.target.value })} />
          </Field>
          <Field label="Ad category">
            <input className="h-9 rounded-md border px-2 text-sm w-full" value={query.adCategory} onChange={(e) => setQuery({ ...query, adCategory: e.target.value })} placeholder="all" />
          </Field>
          <Field label="Active status">
            <select className="h-9 rounded-md border px-2 text-sm w-full" value={query.activeStatus} onChange={(e) => setQuery({ ...query, activeStatus: e.target.value as MetaAdActiveStatus })}>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
              <option value="all">All</option>
            </select>
          </Field>
          <Field label="Vertical">
            <select className="h-9 rounded-md border px-2 text-sm w-full" value={query.vertical} onChange={(e) => setQuery({ ...query, vertical: e.target.value as Vertical | "" })}>
              <option value="">Any</option>
              {VERTICALS.map((item) => <option key={item} value={item}>{VERTICAL_LABELS[item]}</option>)}
            </select>
          </Field>
          <Field label="Landing page domain">
            <input className="h-9 rounded-md border px-2 text-sm w-full" value={query.landingPageDomain} onChange={(e) => setQuery({ ...query, landingPageDomain: e.target.value })} placeholder="clinic.com" />
          </Field>
          <Field label="Platforms">
            <div className="flex flex-wrap gap-2 text-xs pt-1">
              {META_PLATFORMS.map((platform) => (
                <label key={platform} className="flex items-center gap-1">
                  <input
                    type="checkbox"
                    checked={query.platforms.includes(platform)}
                    onChange={(e) => {
                      const next = e.target.checked
                        ? [...query.platforms, platform]
                        : query.platforms.filter((item) => item !== platform);
                      setQuery({ ...query, platforms: next as MetaPlatform[] });
                    }}
                  />
                  {platform.replaceAll("_", " ")}
                </label>
              ))}
            </div>
          </Field>
        </div>
        <div className="flex flex-wrap gap-2 mt-4">
          <Button disabled={running} onClick={() => onSearch(query)}>{running ? "Searching…" : "Search Meta Ads"}</Button>
          <Button variant="outline" onClick={() => { setQuery(EMPTY_META_QUERY); onClear(); }}>Clear search</Button>
          <Button
            variant="outline"
            onClick={() => {
              const name = window.prompt("Name this search");
              if (name) onSave(name, query);
            }}
          >
            Save search
          </Button>
          <Button variant="outline" asChild>
            <a {...externalLinkProps(officialPreview)}>Open official Meta Ads Library</a>
          </Button>
        </div>
      </SectionCard>

      {job ? (
        <SectionCard title="Search status" description={`Job ${job.id}`}>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3 text-sm">
            <div><p className="text-xs text-muted-foreground">Stage</p><p className="font-medium">{job.status}</p></div>
            <div><p className="text-xs text-muted-foreground">Progress</p><p className="font-medium">{job.progressCurrent}/{job.progressTotal}</p></div>
            <div><p className="text-xs text-muted-foreground">Started</p><p className="font-medium">{formatWhen(job.startedAt)}</p></div>
            <div><p className="text-xs text-muted-foreground">Duration</p><p className="font-medium">{job.startedAt && job.completedAt ? `${Math.max(0, Math.round((Date.parse(job.completedAt) - Date.parse(job.startedAt)) / 1000))}s` : "—"}</p></div>
          </div>
          {latest ? (
            <p className="text-xs text-muted-foreground mt-2">
              Ads {latest.adsFound} · Advertisers {latest.advertisersFound} · Clinics matched {latest.clinicsMatched} · Unmatched {latest.unmatchedCount}
            </p>
          ) : null}
          {job.errorMessage ? <p className="text-sm text-rose-700 mt-2">{job.errorMessage}</p> : null}
          <ol className="mt-3 space-y-1 text-xs">
            {job.logs.map((log, index) => (
              <li key={`${log.at}-${index}`}><span className="text-muted-foreground">{formatWhen(log.at)}</span> · {log.stage}: {log.message}</li>
            ))}
          </ol>
          {latest ? (
            <div className="flex gap-2 mt-3">
              <Button size="sm" variant="outline" onClick={() => onRerun(latest.id)}>Retry / run again</Button>
              <Button size="sm" variant="outline" asChild>
                <a {...externalLinkProps(latest.officialUrl)}>View official results</a>
              </Button>
            </div>
          ) : null}
        </SectionCard>
      ) : null}

      <div className="grid lg:grid-cols-2 gap-4">
        <SectionCard title="Saved searches" description="Your saved queries. Suggested searches are templates only — they have not been run.">
          {saved.length === 0 ? <p className="text-xs text-muted-foreground">No saved searches yet.</p> : null}
          <div className="space-y-2">
            {saved.map((row) => (
              <div key={row.id} className="rounded-md border p-2 flex items-center justify-between gap-2">
                <div>
                  <p className="text-sm font-medium">{row.name}</p>
                  <p className="text-[11px] text-muted-foreground">Last run {row.lastRunAt ? formatWhen(row.lastRunAt) : "never"} · {row.lastResultsCount} ads</p>
                </div>
                <div className="flex gap-1">
                  <Button size="sm" onClick={() => onRunSaved(row.query, row.name, row.id)}>Run again</Button>
                  <Button size="sm" variant="ghost" onClick={() => onDeleteSaved(row.id)}>Delete</Button>
                </div>
              </div>
            ))}
          </div>
          <p className="text-xs font-medium mt-3 mb-1">Suggested searches</p>
          <div className="flex flex-wrap gap-2">
            {suggested.map((row) => (
              <Button key={row.name} size="sm" variant="outline" onClick={() => { setQuery(row.query); onRunSaved(row.query, row.name); }}>
                {row.name}
              </Button>
            ))}
          </div>
        </SectionCard>
        <SectionCard title="Recent searches">
          {searches.length === 0 ? (
            <EmptyState title="No Meta searches yet" description="Run a search or open the official Ads Library. Empty results mean no live API data — not that clinics have no ads." />
          ) : (
            <ul className="space-y-2 text-sm">
              {searches.slice(0, 8).map((row) => (
                <li key={row.id} className="rounded-md border px-3 py-2">
                  <div className="flex justify-between gap-2">
                    <span className="font-medium">{row.name}</span>
                    <StatusBadge label={META_TRUST_LABELS[row.trustMode]} color="teal" />
                  </div>
                  <p className="text-[11px] text-muted-foreground">{formatWhen(row.lastRunAt)} · {row.adsFound} ads</p>
                </li>
              ))}
            </ul>
          )}
        </SectionCard>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-semibold">Results {filtered.length ? `(${filtered.length})` : ""}</h3>
        <div className="flex flex-wrap gap-2">
          <select className="h-8 rounded-md border px-2 text-xs" value={filter} onChange={(e) => setFilter(e.target.value as typeof filter)}>
            <option value="all">All</option>
            <option value="unreviewed">Unreviewed only</option>
            <option value="matched">Matched to clinic</option>
            <option value="unmatched">Not matched</option>
          </select>
          <Button size="sm" variant={view === "cards" ? "default" : "outline"} onClick={() => setView("cards")}>Cards</Button>
          <Button size="sm" variant={view === "table" ? "default" : "outline"} onClick={() => setView("table")}>Table</Button>
        </div>
      </div>

      {loading ? <LoadingState label="Loading Meta results…" /> : null}
      {!loading && !filtered.length ? (
        <EmptyState
          title="No imported Meta ad cards"
          description={apiConfigured
            ? "The last search did not return Ads Archive rows. Use Open official Meta Ads Library, then attach advertisers to clinics after you review them."
            : "Live Meta data is not configured. Open the official library with your query, then create or match clinics manually. Outreach will not invent ad creatives."}
        />
      ) : null}

      {view === "cards" && filtered.length ? (
        <div className="grid md:grid-cols-2 gap-3">
          {filtered.map((row) => (
            <AdCard
              key={row.id}
              row={row}
              onAttach={() => onAttach(row.id)}
              onCreate={() => onCreateClinic(row.id)}
              onDismiss={() => onDismiss(row.id)}
              onOpenProspect={onOpenProspect}
              onQueue={() => onAddToQueue(row.id)}
            />
          ))}
        </div>
      ) : null}

      {view === "table" && filtered.length ? (
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-xs uppercase text-muted-foreground">
              <tr>{["Advertiser", "Status", "Domain", "Match", "Observed", "Actions"].map((h) => <th key={h} className="px-3 py-2 text-left">{h}</th>)}</tr>
            </thead>
            <tbody className="divide-y">
              {filtered.map((row) => (
                <tr key={row.id}>
                  <td className="px-3 py-2">{row.advertiserName}</td>
                  <td className="px-3 py-2">{row.status}</td>
                  <td className="px-3 py-2">{row.landingDomain || "—"}</td>
                  <td className="px-3 py-2">{row.clinicMatchName || "Unmatched"}</td>
                  <td className="px-3 py-2">{formatWhen(row.observedAt)}</td>
                  <td className="px-3 py-2"><Button size="sm" variant="ghost" asChild><a {...externalLinkProps(row.officialUrl)}>View in Meta</a></Button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </div>
  );
}

function AdCard({
  row,
  onAttach,
  onCreate,
  onDismiss,
  onOpenProspect,
  onQueue,
}: {
  row: OutreachMetaAdResult;
  onAttach: () => void;
  onCreate: () => void;
  onDismiss: () => void;
  onOpenProspect: (id: string) => void;
  onQueue: () => void;
}) {
  return (
    <div className="rounded-lg border p-4 space-y-2">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="font-medium">{row.advertiserName}</p>
          <p className="text-xs text-muted-foreground">{row.pageName || "Page unknown"}</p>
        </div>
        <StatusBadge label={row.status} color={row.status === "ACTIVE" ? "green" : "slate"} />
      </div>
      <p className="text-sm">{row.copyPreview || "No public ad copy was returned by the API."}</p>
      <p className="text-xs text-muted-foreground">
        {row.platforms.join(", ") || "Placements unknown"} · {row.landingDomain || "No landing page"} · {formatWhen(row.startDate || row.observedAt)}
      </p>
      <p className="text-xs">{row.matchExplanation}</p>
      {row.clinicMatchId ? (
        <button className="text-xs text-teal-700 hover:underline" onClick={() => onOpenProspect(row.clinicMatchId!)}>{row.clinicMatchName}</button>
      ) : null}
      <div className="flex flex-wrap gap-1 pt-1">
        <Button size="sm" variant="outline" asChild><a {...externalLinkProps(row.officialUrl)}>View in Meta Ads Library</a></Button>
        {row.clinicMatchId ? null : <Button size="sm" variant="outline" onClick={onAttach}>Attach to clinic</Button>}
        {row.clinicMatchId ? null : <Button size="sm" variant="outline" onClick={onCreate}>Create clinic from advertiser</Button>}
        <Button size="sm" variant="outline" onClick={onQueue}>Add to research queue</Button>
        <Button size="sm" variant="ghost" onClick={onDismiss}>Mark not relevant</Button>
      </div>
    </div>
  );
}

export function promptAttachProspect() {
  const id = window.prompt("Paste the Outreach prospect ID to attach this advertiser.");
  return id?.trim() || null;
}

export function notifyMetaSearch(result: Awaited<ReturnType<typeof api.runMetaSearch>>) {
  toast.message(`Meta search finished (${result.search.trustMode.replaceAll("_", " ").toLowerCase()})`, {
    description: `${result.results.length} ads saved. ${result.search.clinicsMatched} clinic matches. Official library link is available.`,
  });
}
