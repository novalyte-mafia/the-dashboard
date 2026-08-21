import { scrapeWebsite } from "@/lib/providers/firecrawl";
import { FirecrawlResearchAdapter } from "./adapters";
import {
  buildOfficialMetaAdsLibraryUrl,
  EMPTY_META_QUERY,
  fetchMetaAdsArchive,
  isMetaApiConfigured,
  landingDomainFromUrl,
  metaSearchTerms,
  metaTrustMode,
  SUGGESTED_META_SEARCHES,
  validateMetaQuery,
} from "./meta-ads";
import {
  addContactRoute,
  addEvidence,
  appendJobLog,
  createProspect,
  getResearchJob,
  listActivity,
  listProspects,
  listResearchJobs,
  metrics,
  recordActivity,
  researchQueue,
  startResearch,
  updateProspect,
} from "./service";
import { getOutreachStore, newId, nowIso, type OutreachStore } from "./store";
import type {
  MetaSearchQuery,
  OutreachMetaAdResult,
  OutreachMetaSearch,
  OutreachProspectRow,
  OutreachResearchJob,
  OutreachSavedMetaSearch,
  ResearchConfidence,
  Vertical,
} from "./types";
import { OutreachValidationError, isPublishedEmailFormat } from "./validation";

function jobById(id: string, store = getOutreachStore()) {
  const job = store.jobs.get(id);
  if (!job) throw new OutreachValidationError("Job not found.", "jobId");
  return job;
}

export function commandCenter(store = getOutreachStore()) {
  const prospects = listProspects({ statusGroup: "active" }, store);
  const jobs = listResearchJobs(store);
  const queue = researchQueue(store);
  const metric = metrics(store);
  const websiteMissing = prospects.filter((row) => row.websiteStatus === "missing").length;
  const adsAwaiting = prospects.filter((row) => row.adSignal === "ACTIVE_OBSERVED" && row.status !== "RESEARCH_READY").length;
  const contactReady = prospects.filter((row) => row.contactRoute !== "none").length;
  const humanResearch = prospects.filter((row) => row.status === "NEW" || row.status === "RESEARCHING" || row.missingFields.length > 0).length;
  const readyReview = prospects.filter((row) => row.status === "NEEDS_REVIEW" || row.draftStatus === "NEEDS_REVIEW").length;
  const failedJobs = jobs.filter((job) => job.status === "FAILED" || job.status === "NOT_CONFIGURED").length;
  const pipeline = {
    imported: prospects.filter((row) => row.sourceType === "IMPORT" || row.status === "NEW").length,
    needsResearch: prospects.filter((row) => row.status === "NEW").length,
    researching: prospects.filter((row) => row.status === "RESEARCHING").length,
    needsReview: prospects.filter((row) => row.status === "NEEDS_REVIEW").length,
    researchReady: prospects.filter((row) => row.status === "RESEARCH_READY").length,
    contacted: prospects.filter((row) => row.draftStatus === "SENT" || row.draftStatus === "COPIED").length,
    followUp: 0,
    won: 0,
    lost: 0,
    archived: [...store.prospects.values()].filter((row) => row.status === "ARCHIVED").length,
  };
  return {
    metrics: metric,
    actionRequired: [
      { key: "website", label: "Clinics need website verification", count: websiteMissing, subview: "discover", filters: { websiteStatus: "missing" } },
      { key: "ads", label: "Clinics have ad signals awaiting review", count: adsAwaiting, subview: "meta-ads", filters: { adSignal: "ACTIVE_OBSERVED" } },
      { key: "routes", label: "Clinics have public contact routes ready", count: contactReady, subview: "contacts", filters: {} },
      { key: "research", label: "Clinics need human research", count: humanResearch, subview: "research-queue", filters: {} },
      { key: "review", label: "Prospects are ready for outreach review", count: readyReview, subview: "drafts", filters: {} },
      { key: "jobs", label: "Jobs failed or need attention", count: failedJobs, subview: "jobs", filters: {} },
    ],
    pipeline,
    queueCounts: Object.fromEntries(Object.entries(queue).map(([key, rows]) => [key, rows.length])),
    runningJobs: jobs.filter((job) => job.status === "QUEUED" || job.status === "RUNNING").slice(0, 8),
    recentJobs: jobs.slice(0, 8),
    activity: listActivity("7d", store).slice(0, 25),
    metaTrustMode: metaTrustMode(isMetaApiConfigured(), false),
    metaApiConfigured: isMetaApiConfigured(),
    firecrawlConfigured: FirecrawlResearchAdapter.isConfigured(),
  };
}

export async function executeResearchJob(jobId: string, store = getOutreachStore()) {
  const job = jobById(jobId, store);
  if (job.status === "CANCELLED") return job;
  if (job.status !== "QUEUED" && job.status !== "RUNNING") return job;
  const prospectId = job.prospectId;
  if (!prospectId) {
    job.status = "FAILED";
    job.errorMessage = "This job is not attached to a clinic.";
    job.completedAt = nowIso();
    store.jobs.set(job.id, job);
    return job;
  }
  const prospect = store.prospects.get(prospectId);
  if (!prospect) {
    job.status = "FAILED";
    job.errorMessage = "Prospect no longer exists.";
    job.completedAt = nowIso();
    store.jobs.set(job.id, job);
    return job;
  }
  job.status = "RUNNING";
  appendJobLog(job, "Running", `Starting ${job.adapterName} for ${prospect.clinicName}.`);
  store.jobs.set(job.id, job);
  if (!FirecrawlResearchAdapter.isConfigured() || !prospect.websiteUrl) {
    job.status = FirecrawlResearchAdapter.isConfigured() ? "FAILED" : "NOT_CONFIGURED";
    job.errorMessage = prospect.websiteUrl
      ? "Website research connector is not configured (FIRECRAWL_API_KEY)."
      : "No website URL is on file. Add a website, then retry.";
    job.completedAt = nowIso();
    appendJobLog(job, job.status === "NOT_CONFIGURED" ? "Not configured" : "Failed", job.errorMessage);
    store.jobs.set(job.id, job);
    recordActivity(store, prospectId, "research_completed", job.errorMessage, { entityType: "research_job", entityId: job.id });
    return job;
  }
  try {
    job.progressTotal = 1;
    appendJobLog(job, "Fetching", `Scraping ${prospect.websiteUrl}`);
    const data = await scrapeWebsite(prospect.websiteUrl) as {
      markdown?: string;
      content?: string;
      metadata?: { title?: string; sourceURL?: string };
    };
    const text = String(data.markdown || data.content || "").replace(/\s+/g, " ").trim();
    if (!text) {
      job.status = "COMPLETE_WITH_WARNINGS";
      job.errorMessage = "Website returned no extractable public content.";
      job.completedAt = nowIso();
      job.resultSummary = { pages: 0 };
      appendJobLog(job, "Complete with warnings", job.errorMessage);
      store.jobs.set(job.id, job);
      return job;
    }
    addEvidence(prospectId, {
      evidenceType: "WEBSITE_PAGE",
      sourceType: "FIRECRAWL",
      sourceUrl: prospect.websiteUrl,
      sourceTitle: data.metadata?.title ?? prospect.clinicName,
      excerpt: text.slice(0, 800),
      confidence: "MEDIUM",
    }, job.requestedBy, store);
    const emails = extractSameDomainEmails(text, prospect.canonicalDomain);
    let routes = 0;
    for (const email of emails.slice(0, 3)) {
      addContactRoute(prospectId, {
        channelType: "PUBLISHED_EMAIL",
        value: email,
        isPubliclyPublished: true,
        sourceUrl: prospect.websiteUrl,
        sourceContext: "Extracted from public website page during research job.",
        verificationStatus: "UNVERIFIED",
        confidence: "MEDIUM",
      }, job.requestedBy, store);
      routes += 1;
    }
    const formUrl = extractContactFormUrl(text, prospect.websiteUrl);
    if (formUrl) {
      addContactRoute(prospectId, {
        channelType: "CONTACT_FORM",
        value: formUrl,
        isPubliclyPublished: true,
        sourceUrl: formUrl,
        sourceContext: "Public contact URL observed on website.",
        verificationStatus: "UNVERIFIED",
        confidence: "MEDIUM",
      }, job.requestedBy, store);
      routes += 1;
    }
    updateProspect(prospectId, {
      lastResearchedAt: nowIso(),
      contactSearchCompleted: true,
      status: prospect.status === "NEW" ? "NEEDS_REVIEW" : prospect.status,
    }, job.requestedBy, store);
    job.status = "COMPLETED";
    job.progressCurrent = 1;
    job.completedAt = nowIso();
    job.resultSummary = { pages: 1, excerptChars: text.length, contactRoutesFound: routes, emailsFound: emails.length };
    appendJobLog(job, "Complete", `Saved website evidence${routes ? ` and ${routes} public contact route(s)` : ""}.`);
    store.jobs.set(job.id, job);
    recordActivity(store, prospectId, "research_completed", `Website research completed for ${prospect.clinicName}`, {
      actorId: job.requestedBy,
      entityType: "research_job",
      entityId: job.id,
      metadata: job.resultSummary,
    });
    return job;
  } catch (error) {
    job.status = "FAILED";
    job.errorMessage = error instanceof Error ? error.message : "Website research failed.";
    job.completedAt = nowIso();
    appendJobLog(job, "Failed", job.errorMessage);
    store.jobs.set(job.id, job);
    recordActivity(store, prospectId, "job_failed", job.errorMessage, { entityType: "research_job", entityId: job.id });
    return job;
  }
}

function extractSameDomainEmails(text: string, domain: string | null) {
  const found = text.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi) ?? [];
  const unique = [...new Set(found.map((item) => item.toLowerCase()))];
  return unique.filter((email) => {
    if (!isPublishedEmailFormat(email)) return false;
    if (!domain) return !email.endsWith("@gmail.com") && !email.endsWith("@yahoo.com");
    return email.endsWith(`@${domain}`) || email.endsWith(`@www.${domain}`);
  });
}

function extractContactFormUrl(text: string, websiteUrl: string) {
  try {
    const origin = new URL(websiteUrl).origin;
    if (/\/contact(?:-us)?/i.test(text) || /contact us/i.test(text)) return `${origin}/contact`;
  } catch {
    return null;
  }
  return null;
}

export function retryResearchJob(id: string, actorId: string, store = getOutreachStore()) {
  const previous = jobById(id, store);
  if (!previous.prospectId) throw new OutreachValidationError("This job cannot be retried without a clinic.", "prospectId");
  return startResearch(previous.prospectId, previous.adapterName, actorId, `${previous.idempotencyKey ?? previous.id}_retry_${Date.now()}`, store);
}

export async function runMetaSearch(input: {
  query: Partial<MetaSearchQuery>;
  name?: string;
  actorId: string;
  savedSearchId?: string;
}, store = getOutreachStore()) {
  const query: MetaSearchQuery = { ...EMPTY_META_QUERY, ...input.query, country: input.query.country || "US" };
  const invalid = validateMetaQuery(query);
  if (invalid) throw new OutreachValidationError(invalid, "query");
  const officialUrl = buildOfficialMetaAdsLibraryUrl(query);
  const ts = nowIso();
  const searchId = newId("oms");
  const job: OutreachResearchJob = {
    id: newId("orj"),
    prospectId: null,
    jobType: "meta_ads_search",
    adapterName: "meta_ad_library",
    status: "RUNNING",
    requestedBy: input.actorId,
    startedAt: ts,
    completedAt: null,
    errorMessage: null,
    resultSummary: {},
    logs: [{ at: ts, stage: "Running", message: `Meta Ads Library search: ${metaSearchTerms(query) || query.landingPageDomain}` }],
    progressCurrent: 0,
    progressTotal: 3,
    source: "meta_ad_library",
    scope: metaSearchTerms(query) || query.landingPageDomain,
    isDemo: false,
    idempotencyKey: null,
    createdAt: ts,
    updatedAt: ts,
  };
  store.jobs.set(job.id, job);
  recordActivity(store, null, "meta_search_started", `Meta search started: ${job.scope}`, {
    actorId: input.actorId,
    entityType: "meta_search",
    entityId: searchId,
    metadata: { officialUrl },
  });
  appendJobLog(job, "Fetching", isMetaApiConfigured()
    ? "Calling Meta Ads Archive API."
    : "No Meta API key. Official Ads Library link-out is available; live ads will not be fabricated.");
  job.progressCurrent = 1;
  const fetched = await fetchMetaAdsArchive(query);
  appendJobLog(job, "Matching", fetched.usedApi
    ? `API returned ${fetched.ads.length} ad(s).`
    : "Skipping live fetch. Constructed official Meta Ads Library URL.");
  job.progressCurrent = 2;
  const results: OutreachMetaAdResult[] = [];
  for (const ad of fetched.ads) {
    const destination = ad.ad_creative_link_captions?.[0] ?? null;
    const landing = landingDomainFromUrl(destination?.startsWith("http") ? destination : null);
    const match = matchAdvertiserToProspect({
      advertiserName: ad.page_name ?? "",
      landingDomain: landing,
      store,
    });
    const row: OutreachMetaAdResult = {
      id: newId("oma"),
      searchId,
      advertiserName: ad.page_name || "Unknown advertiser",
      pageName: ad.page_name ?? null,
      pageId: ad.page_id ?? null,
      adArchiveId: ad.id ?? null,
      status: "UNKNOWN",
      platforms: ad.publisher_platforms ?? [],
      startDate: ad.ad_delivery_start_time ?? null,
      observedAt: ts,
      copyPreview: ad.ad_creative_bodies?.[0]?.slice(0, 280) ?? null,
      ctaText: ad.ad_creative_link_titles?.[0] ?? null,
      destinationUrl: destination,
      landingDomain: landing,
      snapshotUrl: ad.ad_snapshot_url ?? null,
      officialUrl: ad.ad_snapshot_url || officialUrl,
      vertical: (query.vertical || "") as Vertical | "",
      clinicMatchId: match.prospect?.id ?? null,
      clinicMatchName: match.prospect?.clinicName ?? null,
      matchReason: match.reason,
      matchExplanation: match.explanation,
      dismissed: false,
      imported: Boolean(ad.id),
      confidence: match.prospect ? "MEDIUM" : "NEEDS_REVIEW",
      raw: { page_id: ad.page_id, id: ad.id },
    };
    store.metaResults.set(row.id, row);
    results.push(row);
    if (match.prospect) {
      addEvidence(match.prospect.id, {
        evidenceType: "ADVERTISING_RECORD",
        sourceType: "META_AD_LIBRARY",
        sourceUrl: row.officialUrl,
        sourceTitle: row.advertiserName,
        excerpt: row.copyPreview,
        structuredData: { signalStatus: "ACTIVE_OBSERVED", matchReason: match.reason, searchId },
        observedAt: ts,
        confidence: "MEDIUM",
      }, input.actorId, store);
    }
  }
  const trust = fetched.ok && results.length > 0
    ? "LIVE_META_DATA"
    : metaTrustMode(isMetaApiConfigured(), false);
  const search: OutreachMetaSearch = {
    id: searchId,
    name: input.name?.trim() || job.scope,
    query,
    officialUrl,
    trustMode: trust === "NOT_CONFIGURED" && fetched.usedApi ? "NOT_CONFIGURED" : trust,
    jobId: job.id,
    createdBy: input.actorId,
    createdAt: ts,
    lastRunAt: ts,
    adsFound: results.length,
    advertisersFound: new Set(results.map((row) => row.advertiserName)).size,
    clinicsMatched: results.filter((row) => row.clinicMatchId).length,
    unmatchedCount: results.filter((row) => !row.clinicMatchId).length,
    errorMessage: fetched.error,
  };
  if (fetched.error && !fetched.ok) {
    job.status = results.length ? "COMPLETE_WITH_WARNINGS" : "FAILED";
    job.errorMessage = fetched.error;
    appendJobLog(job, job.status === "FAILED" ? "Failed" : "Complete with warnings", fetched.error);
  } else if (!fetched.usedApi) {
    job.status = "COMPLETED";
    job.errorMessage = null;
    appendJobLog(job, "Complete", "Link-out only. Open the official Meta Ads Library to review ads. No fabricated ad cards were created.");
  } else {
    job.status = "COMPLETED";
    appendJobLog(job, "Complete", `Saved ${results.length} live ad result(s).`);
  }
  job.progressCurrent = 3;
  job.completedAt = nowIso();
  job.resultSummary = {
    trustMode: search.trustMode,
    officialUrl,
    adsFound: results.length,
    clinicsMatched: search.clinicsMatched,
    unmatched: search.unmatchedCount,
  };
  store.jobs.set(job.id, job);
  store.metaSearches.set(search.id, search);
  if (input.savedSearchId) {
    const saved = store.savedMetaSearches.get(input.savedSearchId);
    if (saved) {
      saved.lastRunAt = ts;
      saved.lastResultsCount = results.length;
      saved.updatedAt = ts;
      store.savedMetaSearches.set(saved.id, saved);
    }
  }
  recordActivity(store, null, "meta_search_completed", `Meta search completed: ${search.name} (${results.length} ads)`, {
    actorId: input.actorId,
    entityType: "meta_search",
    entityId: search.id,
    metadata: job.resultSummary,
  });
  return { search, job, results, officialUrl };
}

function matchAdvertiserToProspect(input: {
  advertiserName: string;
  landingDomain: string | null;
  store: OutreachStore;
}): { prospect: OutreachProspectRow | null; reason: OutreachMetaAdResult["matchReason"]; explanation: string } {
  const prospects = listProspects({ statusGroup: "active" }, input.store);
  if (input.landingDomain) {
    const domainHit = prospects.find((row) => row.canonicalDomain && (row.canonicalDomain === input.landingDomain || input.landingDomain.endsWith(row.canonicalDomain)));
    if (domainHit) {
      return { prospect: domainHit, reason: "domain_match", explanation: `Landing-page domain ${input.landingDomain} matches clinic website ${domainHit.canonicalDomain}.` };
    }
  }
  const name = input.advertiserName.trim().toLowerCase();
  if (name.length >= 4) {
    const nameHit = prospects.find((row) => row.clinicName.toLowerCase() === name || row.clinicName.toLowerCase().includes(name) || name.includes(row.clinicName.toLowerCase()));
    if (nameHit) {
      return { prospect: nameHit, reason: "advertiser_name_match", explanation: `Advertiser name “${input.advertiserName}” matches clinic “${nameHit.clinicName}”.` };
    }
  }
  return { prospect: null, reason: "unmatched", explanation: "No existing clinic matched this advertiser. Review before creating a prospect." };
}

export function listMetaSearches(store = getOutreachStore()) {
  return [...store.metaSearches.values()].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function getMetaSearch(id: string, store = getOutreachStore()) {
  const search = store.metaSearches.get(id);
  if (!search) return null;
  const results = [...store.metaResults.values()].filter((row) => row.searchId === id);
  return { search, results, job: getResearchJob(search.jobId, store) };
}

export function listMetaResults(filters: {
  searchId?: string;
  unmatched?: boolean;
  matched?: boolean;
  unreviewed?: boolean;
} = {}, store = getOutreachStore()) {
  return [...store.metaResults.values()].filter((row) => {
    if (filters.searchId && row.searchId !== filters.searchId) return false;
    if (filters.unmatched && row.clinicMatchId) return false;
    if (filters.matched && !row.clinicMatchId) return false;
    if (filters.unreviewed && (row.dismissed || row.clinicMatchId)) return false;
    return true;
  }).sort((a, b) => b.observedAt.localeCompare(a.observedAt));
}

export function attachMetaResult(resultId: string, prospectId: string, actorId: string, store = getOutreachStore()) {
  const result = store.metaResults.get(resultId);
  if (!result) throw new OutreachValidationError("Ad result not found.", "resultId");
  const prospect = store.prospects.get(prospectId);
  if (!prospect) throw new OutreachValidationError("Clinic not found.", "prospectId");
  result.clinicMatchId = prospect.id;
  result.clinicMatchName = prospect.clinicName;
  result.matchReason = "manual_match";
  result.matchExplanation = `Manually attached to ${prospect.clinicName}.`;
  store.metaResults.set(result.id, result);
  addEvidence(prospect.id, {
    evidenceType: "ADVERTISING_RECORD",
    sourceType: "META_AD_LIBRARY",
    sourceUrl: result.officialUrl,
    sourceTitle: result.advertiserName,
    excerpt: result.copyPreview,
    structuredData: { signalStatus: "ACTIVE_OBSERVED", matchReason: "manual_match", resultId: result.id },
    observedAt: result.observedAt,
    confidence: "HIGH" as ResearchConfidence,
  }, actorId, store);
  recordActivity(store, prospect.id, "meta_result_attached", `Meta ad attached: ${result.advertiserName}`, {
    actorId,
    entityType: "meta_ad_result",
    entityId: result.id,
  });
  return result;
}

export function createClinicFromMetaResult(resultId: string, actorId: string, store = getOutreachStore()) {
  const result = store.metaResults.get(resultId);
  if (!result) throw new OutreachValidationError("Ad result not found.", "resultId");
  const website = result.destinationUrl && result.destinationUrl.startsWith("http") ? result.destinationUrl : result.landingDomain ? `https://${result.landingDomain}` : null;
  const prospect = createProspect({
    clinicName: result.advertiserName,
    websiteUrl: website,
    sourceType: "META_AD_LIBRARY",
    vertical: result.vertical || "other",
    notes: `Created from Meta Ads Library advertiser. Match reason pending human review.`,
  }, actorId, store);
  attachMetaResult(resultId, prospect.id, actorId, store);
  recordActivity(store, prospect.id, "meta_clinic_created", `Clinic created from Meta advertiser ${result.advertiserName}`, {
    actorId,
    entityType: "prospect",
    entityId: prospect.id,
  });
  return { prospect, result: store.metaResults.get(resultId) };
}

export function dismissMetaResult(resultId: string, store = getOutreachStore()) {
  const result = store.metaResults.get(resultId);
  if (!result) throw new OutreachValidationError("Ad result not found.", "resultId");
  result.dismissed = true;
  store.metaResults.set(result.id, result);
  return result;
}

export function saveMetaSearchPreset(input: { name: string; query: MetaSearchQuery; actorId: string }, store = getOutreachStore()) {
  const row: OutreachSavedMetaSearch = {
    id: newId("omss"),
    name: input.name.trim(),
    query: { ...EMPTY_META_QUERY, ...input.query },
    createdBy: input.actorId,
    lastRunAt: null,
    lastResultsCount: 0,
    createdAt: nowIso(),
    updatedAt: nowIso(),
  };
  store.savedMetaSearches.set(row.id, row);
  return row;
}

export function listSavedMetaSearches(store = getOutreachStore()) {
  return {
    saved: [...store.savedMetaSearches.values()].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)),
    suggested: SUGGESTED_META_SEARCHES.map((row) => ({
      ...row,
      query: { ...EMPTY_META_QUERY, ...row.query },
    })),
  };
}

export function deleteSavedMetaSearch(id: string, store = getOutreachStore()) {
  return store.savedMetaSearches.delete(id);
}

export function previewOfficialMetaUrl(query: Partial<MetaSearchQuery>) {
  const full = { ...EMPTY_META_QUERY, ...query };
  return {
    url: buildOfficialMetaAdsLibraryUrl(full),
    trustMode: metaTrustMode(isMetaApiConfigured(), false),
    apiConfigured: isMetaApiConfigured(),
    terms: metaSearchTerms(full),
  };
}

export function integrationHealth(store = getOutreachStore()) {
  const jobs = listResearchJobs(store);
  const lastMeta = jobs.find((job) => job.jobType === "meta_ads_search");
  const lastWeb = jobs.find((job) => job.jobType === "website_research");
  return {
    meta: {
      status: isMetaApiConfigured() ? "connected" : "link_out_only",
      apiConfigured: isMetaApiConfigured(),
      lastSuccessfulRun: lastMeta?.status === "COMPLETED" ? lastMeta.completedAt : null,
      lastFailure: lastMeta?.status === "FAILED" ? lastMeta.completedAt : null,
      env: "META_AD_LIBRARY_API_KEY",
      docs: "https://www.facebook.com/ads/library/api/",
      capability: isMetaApiConfigured()
        ? "Live Ads Archive API will be attempted. If Meta rejects the token or the query is outside approved access, results stay empty and the official library link is still provided."
        : "No API key. Search constructs an official Meta Ads Library URL. Ads are not imported automatically.",
    },
    website: {
      status: FirecrawlResearchAdapter.isConfigured() ? "connected" : "not_configured",
      env: "FIRECRAWL_API_KEY",
      lastSuccessfulRun: lastWeb?.status === "COMPLETED" ? lastWeb.completedAt : null,
      lastFailure: lastWeb?.status === "FAILED" ? lastWeb.completedAt : null,
    },
    publicSearch: {
      status: Boolean(process.env.EXA_API_KEY?.trim()) ? "connected" : "not_configured",
      env: "EXA_API_KEY",
    },
    drafts: {
      status: Boolean(process.env.GEMINI_API_KEY?.trim()) ? "connected" : "not_configured",
      env: "GEMINI_API_KEY",
    },
  };
}

export function serializeJob(job: OutreachResearchJob) {
  return job;
}
