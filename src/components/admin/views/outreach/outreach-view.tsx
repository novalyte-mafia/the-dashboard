"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { useNav } from "@/components/admin/admin-app";
import { ConfirmationDialog } from "@/components/admin/shared";
import { Button } from "@/components/ui/button";
import { clinicService } from "@/services";
import { OUTREACH_MAX_ENRICH, OUTREACH_PAGE_SIZE } from "@/lib/outreach/accounts";
import { SUBVIEW_LABELS } from "@/lib/outreach/labels";
import { type OutreachActivity, type OutreachMetaAdResult, type OutreachMetaSearch, type OutreachProspectRow, type OutreachQueueCard, type OutreachResearchJob, type OutreachSavedMetaSearch, type OutreachSavedView, type OutreachSubview, type ProspectStatus, type QueueBucket } from "@/lib/outreach/types";
import { OUTREACH_WORKSPACE_NAME, resolveOutreachSubview } from "@/lib/outreach/routing";
import type { Clinic } from "@/types";
import * as api from "./api";
import { EMPTY_FILTERS, type ProspectFilterState } from "./api";
import { DraftsView } from "./drafts";
import { ContactsView } from "./contacts";
import { DiscoverView } from "./discover";
import { EvidenceView } from "./evidence";
import { JobsActivityView } from "./jobs";
import { MetaAdsLibraryView, notifyMetaSearch, promptAttachProspect } from "./meta-ads";
import { AddProspectModal, ImportListModal } from "./modals";
import { OverviewCommandCenter } from "./overview";
import { ProspectDrawer } from "./prospect-drawer";
import { ProspectsView } from "./prospects";
import { ResearchQueueView } from "./research-queue";
import { SettingsView } from "./settings-view";
import { HumanReviewNote, SafetyBanner } from "./shared";

const PRIMARY_TABS: OutreachSubview[] = ["overview", "discover", "meta-ads", "research-queue"];
const SECONDARY_TABS: OutreachSubview[] = ["prospects", "contacts", "drafts", "evidence", "jobs", "settings"];

export function OutreachView({ params }: { params?: Record<string, unknown> }) {
  const { navigate, admin, openClinic } = useNav();
  const subview = resolveOutreachSubview(typeof params?.outreachSubview === "string" ? params.outreachSubview : null);
  const [filters, setFilters] = useState<ProspectFilterState>(EMPTY_FILTERS);
  const [prospects, setProspects] = useState<OutreachProspectRow[]>([]);
  const [metrics, setMetrics] = useState<api.MetricsResponse["metrics"] | null>(null);
  const [queue, setQueue] = useState<Record<QueueBucket, OutreachQueueCard[]> | null>(null);
  const [contacts, setContacts] = useState<api.ContactListItem[]>([]);
  const [drafts, setDrafts] = useState<OutreachProspectRow[]>([]);
  const [draftBusyId, setDraftBusyId] = useState<string | null>(null);
  const [evidence, setEvidence] = useState<api.EvidenceListItem[]>([]);
  const [views, setViews] = useState<OutreachSavedView[]>([]);
  const [settings, setSettings] = useState<api.SettingsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [drawerTab, setDrawerTab] = useState("overview");
  const [highlightEvidenceId, setHighlightEvidenceId] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [selectedClinics, setSelectedClinics] = useState<Map<string, Clinic>>(new Map());
  const [clinics, setClinics] = useState<Clinic[]>([]);
  const [clinicTotal, setClinicTotal] = useState(0);
  const [clinicPage, setClinicPage] = useState(1);
  const [clinicLoading, setClinicLoading] = useState(false);
  const [clinicError, setClinicError] = useState<string | null>(null);
  const [enriching, setEnriching] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [activeView, setActiveView] = useState("All Active");
  const [contactChannel, setContactChannel] = useState("");
  const [contactVerification, setContactVerification] = useState("");
  const [includeSuppressedContacts, setIncludeSuppressedContacts] = useState(false);
  const [confirmExport, setConfirmExport] = useState(false);
  const [tick, setTick] = useState(0);
  const [command, setCommand] = useState<api.CommandCenterResponse | null>(null);
  const [jobs, setJobs] = useState<OutreachResearchJob[]>([]);
  const [activity, setActivity] = useState<OutreachActivity[]>([]);
  const [activityRange, setActivityRange] = useState<"today" | "7d" | "30d" | "all">("7d");
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
  const [metaSearches, setMetaSearches] = useState<OutreachMetaSearch[]>([]);
  const [metaResults, setMetaResults] = useState<OutreachMetaAdResult[]>([]);
  const [metaJob, setMetaJob] = useState<OutreachResearchJob | null>(null);
  const [savedMeta, setSavedMeta] = useState<OutreachSavedMetaSearch[]>([]);
  const [suggestedMeta, setSuggestedMeta] = useState<Array<{ name: string; query: import("@/lib/outreach/types").MetaSearchQuery }>>([]);
  const [metaRunning, setMetaRunning] = useState(false);
  const [pendingResearch, setPendingResearch] = useState<{ mode: "website" | "contacts" | "full"; count: number } | null>(null);
  const searchKey = `${filters.q}|${filters.city}|${filters.state}`;
  const searchKeyRef = useRef(searchKey);

  const go = (next: OutreachSubview, extra?: Record<string, unknown>) => {
    if (extra?.importOpen) setImportOpen(true);
    if (extra?.addOpen) setAddOpen(true);
    if (extra?.filters && typeof extra.filters === "object") {
      const nextFilters = extra.filters as Record<string, string>;
      setFilters((prev) => ({
        ...prev,
        ...(nextFilters.websiteStatus ? { websiteStatus: nextFilters.websiteStatus as ProspectFilterState["websiteStatus"] } : {}),
        ...(nextFilters.adSignal ? { adSignal: nextFilters.adSignal as ProspectFilterState["adSignal"] } : {}),
      }));
    }
    navigate("outreach", null, { outreachSubview: next });
  };

  const openProspect = (id: string, tab = "overview", evidenceId: string | null = null) => {
    setDrawerTab(tab);
    setHighlightEvidenceId(evidenceId);
    setSelectedId(id);
  };

  const loadCore = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const query = api.filtersToQuery(filters);
      if (activeView === "Suppressed") query.includeSuppressed = "true";
      const [list, metric] = await Promise.all([api.listProspects(query), api.getMetrics()]);
      setProspects(list.prospects);
      setMetrics(metric.metrics);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load Outreach.");
    } finally {
      setLoading(false);
    }
  }, [filters, activeView]);

  useEffect(() => {
    void loadCore();
  }, [loadCore, tick]);

  useEffect(() => {
    if (searchKeyRef.current !== searchKey) {
      searchKeyRef.current = searchKey;
      setClinicPage(1);
    }
  }, [searchKey]);

  useEffect(() => {
    if (subview !== "discover") return;
    let cancelled = false;
    setClinicLoading(true);
    setClinicError(null);
    clinicService.list({
      ...( [filters.q, filters.city].filter(Boolean).join(" ") ? { q: [filters.q, filters.city].filter(Boolean).join(" ") } : {}),
      ...(filters.state ? { state: filters.state } : {}),
      page: String(clinicPage),
      pageSize: String(OUTREACH_PAGE_SIZE),
    }).then((data) => {
      if (cancelled) return;
      const all = data.clinics ?? [];
      const total = data.total ?? all.length;
      const rows = total === all.length
        ? all.slice((clinicPage - 1) * OUTREACH_PAGE_SIZE, clinicPage * OUTREACH_PAGE_SIZE)
        : all.slice(0, OUTREACH_PAGE_SIZE);
      setClinics(rows);
      setClinicTotal(total);
    }).catch((err) => {
      if (cancelled) return;
      setClinicError(err instanceof Error ? err.message : "Failed to load clinic accounts.");
    }).finally(() => {
      if (!cancelled) setClinicLoading(false);
    });
    return () => { cancelled = true; };
  }, [subview, filters.q, filters.city, filters.state, clinicPage, tick]);

  function selectClinic(clinic: Clinic, checked: boolean) {
    setSelectedClinics((prev) => {
      const next = new Map(prev);
      if (!checked) {
        next.delete(clinic.id);
        return next;
      }
      if (next.has(clinic.id)) return next;
      if (next.size >= OUTREACH_MAX_ENRICH) {
        toast.error(`You can enrich at most ${OUTREACH_MAX_ENRICH} clinics at a time.`);
        return prev;
      }
      next.set(clinic.id, clinic);
      return next;
    });
  }

  async function researchSelectedClinics(mode: "website" | "contacts" | "full") {
    const batch = [...selectedClinics.values()].slice(0, OUTREACH_MAX_ENRICH);
    if (!batch.length) {
      toast.message("Select clinics first.", { description: `Choose up to ${OUTREACH_MAX_ENRICH} clinic accounts, then pick a research action.` });
      return;
    }
    setEnriching(true);
    try {
      const created = await Promise.all(batch.map((clinic) => {
        const website = clinic.website
          ? (/^https?:\/\//i.test(clinic.website) ? clinic.website : `https://${clinic.website}`)
          : null;
        return api.createProspect({
          clinicName: clinic.name,
          websiteUrl: website,
          city: clinic.city ?? null,
          stateOrRegion: clinic.state ?? null,
          country: clinic.country || "US",
          notes: `Imported from clinic account ${clinic.id} for public-source research.`,
          sourceType: "IMPORT",
          ownerId: admin.id,
        });
      }));
      const ids = created.map((row) => row.prospect.id);
      if (mode === "full") {
        const drafted = await Promise.allSettled(ids.map((id) => api.runDraftPass1(id)));
        const ok = drafted.filter((row) => row.status === "fulfilled").length;
        toast.success(`Full public research finished for ${ok}/${ids.length} clinics. Drafts stay unsent.`);
        go("drafts");
      } else {
        const jobsRes = await api.bulkResearch(ids, "website_research");
        const failed = jobsRes.jobs.filter((job) => job.status === "FAILED" || job.status === "NOT_CONFIGURED").length;
        toast.success(
          failed
            ? `Research jobs recorded. ${jobsRes.jobs.length - failed} completed; ${failed} need configuration or retry. Open Jobs & Activity for logs.`
            : `Website research completed for ${jobsRes.jobs.length} clinic${jobsRes.jobs.length === 1 ? "" : "s"}.`,
        );
        go("jobs");
      }
      setSelectedClinics(new Map());
      setTick((n) => n + 1);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not run research on selected clinics.");
    } finally {
      setEnriching(false);
      setPendingResearch(null);
    }
  }

  useEffect(() => {
    if (subview !== "research-queue") return;
    api.getQueue().then((res) => setQueue(res.queue)).catch((err) => setError(err instanceof Error ? err.message : "Queue failed."));
  }, [subview, tick]);

  useEffect(() => {
    if (subview !== "contacts") return;
    api.getContacts({
      channelType: contactChannel || undefined,
      includeSuppressed: includeSuppressedContacts ? "true" : undefined,
    }).then((res) => {
      const rows = contactVerification
        ? res.contacts.filter((row) => row.verificationStatus === contactVerification)
        : res.contacts;
      setContacts(rows);
    }).catch((err) => setError(err instanceof Error ? err.message : "Contacts failed."));
  }, [subview, contactChannel, contactVerification, includeSuppressedContacts, tick]);

  useEffect(() => {
    if (subview !== "drafts") return;
    api.listDrafts().then((res) => setDrafts(res.drafts)).catch((err) => setError(err instanceof Error ? err.message : "Drafts failed."));
  }, [subview, tick]);

  useEffect(() => {
    if (subview !== "evidence") return;
    api.getEvidenceLibrary().then((res) => setEvidence(res.evidence)).catch((err) => setError(err instanceof Error ? err.message : "Evidence failed."));
  }, [subview, tick]);

  useEffect(() => {
    api.getSettings().then(setSettings).catch(() => undefined);
    api.getCommandCenter().then(setCommand).catch(() => undefined);
    api.listJobs().then((res) => setJobs(res.jobs)).catch(() => undefined);
    api.getActivity(activityRange).then((res) => setActivity(res.activity)).catch(() => undefined);
  }, [tick, activityRange]);

  useEffect(() => {
    api.getSavedViews().then((res) => setViews(res.views)).catch(() => undefined);
  }, [tick]);

  useEffect(() => {
    if (subview !== "meta-ads" && subview !== "overview") return;
    api.listMetaSearches().then((res) => setMetaSearches(res.searches)).catch(() => undefined);
    api.listMetaResults().then((res) => setMetaResults(res.results)).catch(() => undefined);
    api.listSavedMetaSearches().then((res) => {
      setSavedMeta(res.saved);
      setSuggestedMeta(res.suggested);
    }).catch(() => undefined);
  }, [subview, tick]);

  function applySavedView(name: string) {
    setActiveView(name);
    const view = views.find((item) => item.name === name);
    const next = { ...EMPTY_FILTERS };
    const f = view?.filters ?? {};
    if (typeof f.status === "string") next.status = f.status as ProspectFilterState["status"];
    if (typeof f.adSignal === "string") next.adSignal = f.adSignal as ProspectFilterState["adSignal"];
    if (typeof f.contactRoute === "string") next.contactRoute = f.contactRoute as ProspectFilterState["contactRoute"];
    if (name === "Suppressed") next.includeSuppressed = true;
    setFilters(next);
  }

  async function bulkArchive() {
    const ids = [...selected];
    try {
      await Promise.all(ids.map((id) => api.archiveProspect(id)));
      toast.success(`Archived ${ids.length} prospect(s)`, {
        action: {
          label: "Undo",
          onClick: () => { void Promise.all(ids.map((id) => api.restoreProspect(id))).then(() => setTick((n) => n + 1)); },
        },
      });
      setSelected(new Set());
      setTick((n) => n + 1);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Archive failed.");
    }
  }

  async function exportCsv(includeSuppressed: boolean) {
    if (includeSuppressed) {
      setConfirmExport(true);
      return;
    }
    try {
      const csv = await api.exportProspectsCsv(false, false);
      downloadCsv(csv);
      toast.success("Export ready.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Export failed.");
    }
  }

  const firecrawlConfigured = Boolean(settings?.connectors.find((row) => row.key === "firecrawl" || row.key === "website_research")?.configured);
  const metaConfigured = Boolean(settings?.connectors.find((row) => row.key === "meta_ad_library")?.configured);
  const selectedJob = jobs.find((job) => job.id === selectedJobId) ?? null;

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3">
        <p className="text-[11px] font-semibold tracking-[0.14em] text-muted-foreground uppercase">{OUTREACH_WORKSPACE_NAME}</p>
        <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold tracking-tight">{OUTREACH_WORKSPACE_NAME}</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Discover clinics, verify public advertising and contact signals, prepare research-backed outreach, and track every next step.
            </p>
            <div className="mt-2"><HumanReviewNote /></div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => go("meta-ads")}>Search Meta Ads Library</Button>
            <Button variant="outline" onClick={() => setAddOpen(true)}>Add clinic</Button>
            <Button variant="outline" onClick={() => setImportOpen(true)}>Import list</Button>
            <Button variant="outline" onClick={() => go("jobs")}>Jobs & activity</Button>
          </div>
        </div>
        <SafetyBanner />
      </div>

      <div className="space-y-1">
        <div className="flex flex-wrap gap-1">
          {PRIMARY_TABS.map((item) => (
            <Button key={item} size="sm" variant={subview === item ? "default" : "outline"} onClick={() => go(item)}>
              {SUBVIEW_LABELS[item]}
            </Button>
          ))}
        </div>
        <div className="flex flex-wrap gap-1 border-b pb-2">
          {SECONDARY_TABS.map((item) => (
            <Button key={item} size="sm" variant={subview === item ? "default" : "ghost"} onClick={() => go(item)}>
              {SUBVIEW_LABELS[item]}
            </Button>
          ))}
        </div>
      </div>

      {subview === "overview" ? (
        <OverviewCommandCenter
          data={command}
          onGo={go}
          onOpenJob={(id) => { setSelectedJobId(id); go("jobs"); }}
          onOpenProspect={(id) => openProspect(id)}
        />
      ) : null}

      {subview === "discover" ? (
        <DiscoverView
          loading={loading}
          error={error}
          metrics={metrics}
          prospects={prospects}
          clinics={clinics}
          clinicTotal={clinicTotal}
          clinicPage={clinicPage}
          clinicLoading={clinicLoading}
          clinicError={clinicError}
          filters={filters}
          onFiltersChange={(next) => { setFilters(next); }}
          selected={new Set(selectedClinics.keys())}
          onSelect={selectClinic}
          onEdit={(id) => openProspect(id)}
          onArchive={(id) => {
            void api.archiveProspect(id).then(() => {
              toast.success("Prospect archived", {
                action: { label: "Undo", onClick: () => { void api.restoreProspect(id).then(() => setTick((n) => n + 1)); } },
              });
              setTick((n) => n + 1);
            }).catch((err) => toast.error(err instanceof Error ? err.message : "Archive failed."));
          }}
          onOpenAccount={openClinic}
          onClinicPageChange={setClinicPage}
          onEnrich={() => setPendingResearch({ mode: "full", count: selectedClinics.size })}
          enriching={enriching}
          onGoMeta={() => go("meta-ads")}
          onImport={() => setImportOpen(true)}
          onAdd={() => setAddOpen(true)}
          onResearchMode={(mode) => {
            if (mode === "meta") {
              go("meta-ads");
              return;
            }
            if (mode === "score") {
              toast.message("Lead scores recalculated from current evidence.", {
                description: "Scores are a transparent heuristic: completeness, ad signal, and contact route. Nothing was fabricated.",
              });
              setTick((n) => n + 1);
              return;
            }
            if (!selectedClinics.size) {
              toast.message("Select clinics first.", { description: `Choose up to ${OUTREACH_MAX_ENRICH} accounts, then run research.` });
              return;
            }
            setPendingResearch({ mode, count: selectedClinics.size });
          }}
          firecrawlConfigured={firecrawlConfigured}
          metaConfigured={metaConfigured}
        />
      ) : null}

      {subview === "meta-ads" ? (
        <MetaAdsLibraryView
          searches={metaSearches}
          results={metaResults}
          job={metaJob}
          saved={savedMeta}
          suggested={suggestedMeta}
          trustMode={command?.metaTrustMode ?? (metaConfigured ? "NOT_CONFIGURED" : "OFFICIAL_LINK_OUT")}
          apiConfigured={metaConfigured}
          loading={false}
          running={metaRunning}
          onSearch={(query, name) => {
            setMetaRunning(true);
            void api.runMetaSearch({ query, name }).then((res) => {
              setMetaJob(res.job);
              setMetaSearches((prev) => [res.search, ...prev.filter((row) => row.id !== res.search.id)]);
              setMetaResults(res.results);
              notifyMetaSearch(res);
              setTick((n) => n + 1);
            }).catch((err) => toast.error(err instanceof Error ? err.message : "Meta search failed.")).finally(() => setMetaRunning(false));
          }}
          onClear={() => { setMetaResults([]); setMetaJob(null); }}
          onSave={(name, query) => {
            void api.saveMetaSearchPreset({ name, query }).then(() => {
              toast.success("Search saved.");
              setTick((n) => n + 1);
            }).catch((err) => toast.error(err instanceof Error ? err.message : "Could not save search."));
          }}
          onRunSaved={(query, name, savedSearchId) => {
            setMetaRunning(true);
            void api.runMetaSearch({ query, name, savedSearchId }).then((res) => {
              setMetaJob(res.job);
              setMetaResults(res.results);
              notifyMetaSearch(res);
              setTick((n) => n + 1);
            }).catch((err) => toast.error(err instanceof Error ? err.message : "Meta search failed.")).finally(() => setMetaRunning(false));
          }}
          onDeleteSaved={(id) => {
            void api.deleteSavedMetaSearch(id).then(() => setTick((n) => n + 1));
          }}
          onAttach={(id) => {
            const prospectId = promptAttachProspect();
            if (!prospectId) return;
            void api.attachMetaResult(id, prospectId).then(() => {
              toast.success("Advertiser attached. Evidence saved on the clinic.");
              setTick((n) => n + 1);
            }).catch((err) => toast.error(err instanceof Error ? err.message : "Attach failed."));
          }}
          onCreateClinic={(id) => {
            void api.createClinicFromMeta(id).then((res) => {
              toast.success(`Created ${res.prospect.clinicName}. Review before outreach.`);
              openProspect(res.prospect.id);
              setTick((n) => n + 1);
            }).catch((err) => toast.error(err instanceof Error ? err.message : "Could not create clinic."));
          }}
          onDismiss={(id) => {
            void api.dismissMetaResult(id).then(() => setTick((n) => n + 1));
          }}
          onRerun={(id) => {
            setMetaRunning(true);
            void api.rerunMetaSearch(id).then((res) => {
              setMetaResults(res.results);
              toast.success("Search ran again.");
              setTick((n) => n + 1);
            }).catch((err) => toast.error(err instanceof Error ? err.message : "Rerun failed.")).finally(() => setMetaRunning(false));
          }}
          onOpenProspect={(id) => openProspect(id)}
          onAddToQueue={(id) => {
            void api.createClinicFromMeta(id).then((res) => {
              toast.success("Added to research queue as a Meta-sourced prospect.");
              go("research-queue");
              openProspect(res.prospect.id);
              setTick((n) => n + 1);
            }).catch((err) => toast.error(err instanceof Error ? err.message : "Could not queue advertiser."));
          }}
        />
      ) : null}

      {subview === "jobs" ? (
        <JobsActivityView
          jobs={jobs}
          activity={activity}
          selected={selectedJob}
          range={activityRange}
          onRange={setActivityRange}
          onSelect={setSelectedJobId}
          onRetry={(id) => {
            void api.retryJob(id).then((res) => {
              toast.message(`Retry ${res.job.status}`, { description: res.job.errorMessage ?? "Job recorded." });
              setTick((n) => n + 1);
            }).catch((err) => toast.error(err instanceof Error ? err.message : "Retry failed."));
          }}
          onCancel={(id) => {
            void api.cancelJob(id).then(() => {
              toast.success("Job cancelled.");
              setTick((n) => n + 1);
            }).catch((err) => toast.error(err instanceof Error ? err.message : "Cancel failed."));
          }}
          onOpenProspect={(id) => openProspect(id)}
        />
      ) : null}

      {subview === "research-queue" ? (
        <ResearchQueueView loading={loading && !queue} error={error} queue={queue} onOpen={(id) => openProspect(id)} />
      ) : null}

      {subview === "prospects" ? (
        <ProspectsView
          prospects={prospects}
          views={views}
          activeView={activeView}
          onView={applySavedView}
          onOpen={(id) => openProspect(id)}
          selected={selected}
          onSelect={(id, checked) => setSelected((prev) => {
            const next = new Set(prev);
            if (checked) next.add(id); else next.delete(id);
            return next;
          })}
          onSelectAll={(checked) => setSelected(checked ? new Set(prospects.map((row) => row.id)) : new Set())}
          onBulkArchive={() => void bulkArchive()}
          onBulkStatus={(status) => {
            void Promise.all([...selected].map((id) => api.patchProspect(id, { status }))).then(() => {
              toast.success("Status updated.");
              setSelected(new Set());
              setTick((n) => n + 1);
            });
          }}
          onBulkOwner={(ownerId) => {
            void Promise.all([...selected].map((id) => api.patchProspect(id, { ownerId }))).then(() => {
              toast.success("Owner assigned.");
              setSelected(new Set());
              setTick((n) => n + 1);
            });
          }}
          onExport={exportCsv}
        />
      ) : null}

      {subview === "drafts" ? (
        <DraftsView
          loading={false}
          error={error}
          drafts={drafts}
          onOpen={(id) => openProspect(id, "draft")}
          busyId={draftBusyId}
          onPass1={(id) => {
            setDraftBusyId(id);
            void api.runDraftPass1(id).then(() => {
              toast.success("Pass 1 complete — first draft saved.");
              setTick((n) => n + 1);
            }).catch((err) => toast.error(err instanceof Error ? err.message : "Pass 1 failed.")).finally(() => setDraftBusyId(null));
          }}
          onPass2={(id) => {
            setDraftBusyId(id);
            void api.runDraftPass2(id).then((res) => {
              toast.success(res.ready ? "Verified — Ready to Send." : "Verification failed. Flagged Needs Review.");
              setTick((n) => n + 1);
            }).catch((err) => toast.error(err instanceof Error ? err.message : "Pass 2 failed.")).finally(() => setDraftBusyId(null));
          }}
        />
      ) : null}

      {subview === "contacts" ? (
        <ContactsView
          loading={false}
          error={error}
          contacts={contacts}
          channelType={contactChannel}
          verification={contactVerification}
          includeSuppressed={includeSuppressedContacts}
          onChannelType={setContactChannel}
          onVerification={setContactVerification}
          onIncludeSuppressed={setIncludeSuppressedContacts}
          onOpenDraft={(id) => openProspect(id, "draft")}
          onSendFromConsole={(id) => {
            void api.logConsoleSend(id).then(() => {
              toast.success("Logged as sent from console. No automated email was sent.");
              setTick((n) => n + 1);
            }).catch((err) => toast.error(err instanceof Error ? err.message : "Could not log send."));
          }}
          onCopyMessage={(id, text) => {
            void navigator.clipboard.writeText(text);
            void api.logFormCopy(id).then(() => {
              toast.success("Copied. Paste into the clinic’s public form — do not submit from Outreach.");
              setTick((n) => n + 1);
            }).catch((err) => toast.error(err instanceof Error ? err.message : "Could not log copy."));
          }}
        />
      ) : null}

      {subview === "evidence" ? (
        <EvidenceView
          loading={false}
          error={error}
          evidence={evidence}
          onOpenProspect={(id) => openProspect(id)}
          onUseInDraft={(id, evidenceId) => openProspect(id, "draft", evidenceId)}
          onReload={() => setTick((n) => n + 1)}
        />
      ) : null}

      {subview === "settings" ? (
        <SettingsView data={settings} onReload={() => setTick((n) => n + 1)} />
      ) : null}

      <ProspectDrawer
        prospectId={selectedId}
        initialTab={drawerTab}
        highlightEvidenceId={highlightEvidenceId}
        onClose={() => {
          setSelectedId(null);
          setDrawerTab("overview");
          setHighlightEvidenceId(null);
        }}
        onChanged={() => setTick((n) => n + 1)}
      />

      <AddProspectModal
        open={addOpen}
        onOpenChange={setAddOpen}
        onSubmit={async (body) => {
          await api.createProspect({ ...body, ownerId: admin.id });
          toast.success("Prospect created.");
          setTick((n) => n + 1);
        }}
      />
      <ImportListModal
        open={importOpen}
        onOpenChange={setImportOpen}
        onImport={async (rows) => {
          await Promise.all(rows.map((row) => api.createProspect(row)));
          toast.success(`Imported ${rows.length} prospect(s).`);
          setTick((n) => n + 1);
        }}
      />
      <ConfirmationDialog
        open={Boolean(pendingResearch)}
        onOpenChange={(open) => { if (!open) setPendingResearch(null); }}
        title={`Run ${pendingResearch?.mode === "full" ? "full public research" : "website research"} on ${pendingResearch?.count ?? 0} clinic${(pendingResearch?.count ?? 0) === 1 ? "" : "s"}?`}
        description="This creates Outreach research records from the selected CRM accounts, then runs the chosen public-source job. No emails are sent and no contact forms are submitted."
        confirmLabel="Start research jobs"
        onConfirm={() => {
          if (pendingResearch) void researchSelectedClinics(pendingResearch.mode);
        }}
      />
      <ConfirmationDialog
        open={confirmExport}
        onOpenChange={setConfirmExport}
        title="Include suppressed contacts?"
        description="Suppressed records are excluded from standard exports. Confirm to include them in this CSV."
        confirmLabel="Include suppressed"
        destructive
        onConfirm={() => {
          void api.exportProspectsCsv(true, true).then((csv) => {
            downloadCsv(csv);
            toast.success("Export includes suppressed records.");
          }).catch((err) => toast.error(err instanceof Error ? err.message : "Export failed."));
        }}
      />
    </div>
  );
}

function downloadCsv(csv: string) {
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "outreach-prospects.csv";
  a.click();
  URL.revokeObjectURL(url);
}
