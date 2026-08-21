import { emptyDraftFields } from "./draft-fields";
import { leadScore, nextBestAction, researchCompleteness } from "./scoring";
import { canMarkResearchReady } from "./research-ready";
import { connectorStatuses, getAdapterByName } from "./adapters";
import {
  getOutreachStore,
  newId,
  nowIso,
  type OutreachStore,
} from "./store";
import {
  OutreachValidationError,
  domainFromUrl,
  hasResearchIdentity,
  validateContactRouteWrite,
  validateEvidenceWrite,
  validateProspectWrite,
} from "./validation";
import type {
  ActivityEventType,
  AdSignalStatus,
  ContactChannelType,
  OutreachActivity,
  OutreachContactRoute,
  OutreachEvidence,
  OutreachProspect,
  OutreachResearchJob,
  OutreachSavedView,
  OutreachSettings,
  ProspectStatus,
  QueueBucket,
  QueuePriority,
  ResearchConfidence,
  SourceType,
  Vertical,
} from "./types";

export interface ListFilters {
  q?: string;
  status?: ProspectStatus;
  statusGroup?: "active" | "all";
  vertical?: Vertical;
  city?: string;
  state?: string;
  country?: string;
  sourceType?: SourceType;
  adSignal?: AdSignalStatus;
  websiteStatus?: "found" | "missing" | "needs_review";
  contactRoute?: "email" | "form" | "phone" | "multiple" | "none";
  confidence?: ResearchConfidence;
  discoveredFrom?: string;
  discoveredTo?: string;
  researchedFrom?: string;
  researchedTo?: string;
  dataMode?: "live" | "all";
  includeSuppressed?: boolean;
  includeArchived?: boolean;
  ownerId?: string;
}

function actorLabel(actorId?: string | null) {
  return actorId || "operator";
}

export function recordActivity(
  store: OutreachStore,
  prospectId: string | null,
  eventType: ActivityEventType,
  description: string,
  extra?: { actorId?: string | null; entityType?: string; entityId?: string | null; metadata?: Record<string, unknown> },
) {
  const row: OutreachActivity = {
    id: newId("oa"),
    prospectId,
    actorId: extra?.actorId ?? null,
    eventType,
    entityType: extra?.entityType ?? "prospect",
    entityId: extra?.entityId ?? prospectId,
    description,
    metadata: extra?.metadata ?? {},
    createdAt: nowIso(),
  };
  store.activity.unshift(row);
  return row;
}

function evidenceFor(store: OutreachStore, prospectId: string) {
  return [...store.evidence.values()].filter((row) => row.prospectId === prospectId);
}

function routesFor(store: OutreachStore, prospectId: string) {
  return [...store.routes.values()].filter((row) => row.prospectId === prospectId);
}

function adSignalFor(store: OutreachStore, prospectId: string): AdSignalStatus {
  const ads = evidenceFor(store, prospectId).filter((row) => row.evidenceType === "ADVERTISING_RECORD");
  if (ads.some((row) => row.structuredData.signalStatus === "ACTIVE_OBSERVED")) return "ACTIVE_OBSERVED";
  if (ads.some((row) => row.structuredData.signalStatus === "PREVIOUSLY_OBSERVED")) return "PREVIOUSLY_OBSERVED";
  if (ads.length) return "UNKNOWN";
  return "NO_SIGNAL";
}

function contactSummary(store: OutreachStore, prospectId: string) {
  const routes = routesFor(store, prospectId).filter((row) => !row.isDoNotContact && row.channelType !== "NONE_FOUND");
  const types = new Set(routes.map((row) => row.channelType));
  if (types.size > 1) return "multiple" as const;
  if (types.has("PUBLISHED_EMAIL")) return "email" as const;
  if (types.has("CONTACT_FORM")) return "form" as const;
  if (types.has("PUBLIC_PHONE")) return "phone" as const;
  return "none" as const;
}

function websiteStatus(prospect: OutreachProspect): "found" | "missing" | "needs_review" {
  if (!prospect.websiteUrl && !prospect.publicBusinessProfileUrl) return "missing";
  if (prospect.researchConfidence === "NEEDS_REVIEW") return "needs_review";
  return "found";
}

function isActiveProspect(prospect: OutreachProspect) {
  return prospect.status !== "ARCHIVED" && prospect.status !== "SUPPRESSED" && !prospect.isSuppressed && !prospect.archivedAt;
}

function matchesFilters(store: OutreachStore, prospect: OutreachProspect, filters: ListFilters) {
  if (filters.statusGroup !== "all") {
    if (!filters.includeSuppressed && (prospect.isSuppressed || prospect.status === "SUPPRESSED")) return false;
    if (!filters.includeArchived && (prospect.archivedAt || prospect.status === "ARCHIVED")) return false;
  }
  if (filters.status && prospect.status !== filters.status) return false;
  if (filters.vertical && prospect.vertical !== filters.vertical) return false;
  if (filters.city && prospect.city?.toLowerCase() !== filters.city.toLowerCase()) return false;
  if (filters.state && prospect.stateOrRegion?.toLowerCase() !== filters.state.toLowerCase()) return false;
  if (filters.country && prospect.country !== filters.country) return false;
  if (filters.sourceType && prospect.sourceType !== filters.sourceType) return false;
  if (filters.confidence && prospect.researchConfidence !== filters.confidence) return false;
  if (filters.ownerId && prospect.ownerId !== filters.ownerId) return false;
  if (filters.adSignal && adSignalFor(store, prospect.id) !== filters.adSignal) return false;
  if (filters.websiteStatus && websiteStatus(prospect) !== filters.websiteStatus) return false;
  if (filters.contactRoute && contactSummary(store, prospect.id) !== filters.contactRoute) return false;
  if (filters.discoveredFrom && prospect.createdAt < filters.discoveredFrom) return false;
  if (filters.discoveredTo && prospect.createdAt > filters.discoveredTo) return false;
  if (filters.researchedFrom && (prospect.lastResearchedAt ?? "") < filters.researchedFrom) return false;
  if (filters.researchedTo && (prospect.lastResearchedAt ?? "") > filters.researchedTo) return false;
  if (filters.q) {
    const hay = [prospect.clinicName, prospect.canonicalDomain, prospect.city, prospect.stateOrRegion, prospect.notes]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
    if (!hay.includes(filters.q.toLowerCase())) return false;
  }
  return true;
}

export type ProspectListItem = ReturnType<typeof serializeProspect>;

export function listProspects(filters: ListFilters = {}, store = getOutreachStore()) {
  const rows = [...store.prospects.values()]
    .filter((row) => matchesFilters(store, row, filters))
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  return rows.map((row) => serializeProspect(store, row));
}

export function serializeProspect(store: OutreachStore, row: OutreachProspect) {
  const routes = routesFor(store, row.id);
  const evidence = evidenceFor(store, row.id);
  const signal = adSignalFor(store, row.id);
  const site = websiteStatus(row);
  const route = contactSummary(store, row.id);
  const completeness = researchCompleteness({
    websiteStatus: site,
    contactRoute: route,
    adSignal: signal,
    evidenceCount: evidence.length,
    contactSearchCompleted: row.contactSearchCompleted,
    verticalSet: Boolean(row.vertical),
  });
  const score = leadScore({
    completeness: completeness.score,
    adSignal: signal,
    contactRoute: route,
    status: row.status,
  });
  return {
    ...row,
    location: [row.city, row.stateOrRegion].filter(Boolean).join(", "),
    adSignal: signal,
    websiteStatus: site,
    contactRoute: route,
    evidenceCount: evidence.length,
    contactRouteCount: routes.filter((item) => item.channelType !== "NONE_FOUND" && !item.isDoNotContact).length,
    dataMode: "live" as const,
    researchCompleteness: completeness.score,
    leadScore: score,
    missingFields: completeness.missing,
    nextBestAction: nextBestAction({
      missing: completeness.missing,
      adSignal: signal,
      contactRoute: route,
      status: row.status,
      draftStatus: row.draftStatus,
    }),
  };
}

export function getProspect(id: string, store = getOutreachStore()) {
  const row = store.prospects.get(id);
  if (!row) return null;
  return {
    prospect: serializeProspect(store, row),
    evidence: evidenceFor(store, id).sort((a, b) => b.capturedAt.localeCompare(a.capturedAt)),
    contactRoutes: routesFor(store, id).sort((a, b) => b.capturedAt.localeCompare(a.capturedAt)),
    activity: store.activity.filter((item) => item.prospectId === id),
    researchReady: canMarkResearchReady(row, evidenceFor(store, id), routesFor(store, id)),
  };
}

export function createProspect(
  input: Partial<OutreachProspect> & { clinicName: string },
  actorId: string,
  store = getOutreachStore(),
) {
  validateProspectWrite(input);
  const ts = nowIso();
  const row: OutreachProspect = {
    id: newId("op"),
    organizationId: "novalyte",
    clinicName: input.clinicName.trim(),
    canonicalDomain: domainFromUrl(input.websiteUrl ?? null),
    websiteUrl: input.websiteUrl ?? null,
    publicBusinessProfileUrl: input.publicBusinessProfileUrl ?? null,
    city: input.city ?? null,
    stateOrRegion: input.stateOrRegion ?? null,
    country: input.country ?? "US",
    postalCode: input.postalCode ?? null,
    latitude: input.latitude ?? null,
    longitude: input.longitude ?? null,
    vertical: input.vertical ?? store.settings.defaultVertical,
    businessCategory: input.businessCategory ?? null,
    status: input.status ?? (hasResearchIdentity({
      clinicName: input.clinicName,
      websiteUrl: input.websiteUrl,
      city: input.city,
      publicBusinessProfileUrl: input.publicBusinessProfileUrl,
    }) ? "NEW" : "NEEDS_REVIEW"),
    researchConfidence: input.researchConfidence ?? store.settings.defaultResearchConfidence,
    sourceType: input.sourceType ?? "MANUAL",
    ownerId: input.ownerId ?? store.settings.defaultOwnerId,
    notes: input.notes ?? null,
    isSuppressed: false,
    suppressionReason: null,
    isDemo: false,
    createdAt: ts,
    updatedAt: ts,
    lastResearchedAt: null,
    archivedAt: null,
    contactSearchCompleted: false,
    ...emptyDraftFields(),
  };
  store.prospects.set(row.id, row);
  recordActivity(store, row.id, "prospect_created", `Prospect created: ${row.clinicName}`, { actorId });
  if (row.websiteUrl) recordActivity(store, row.id, "website_added", `Website added: ${row.websiteUrl}`, { actorId });
  return serializeProspect(store, row);
}

export function updateProspect(id: string, patch: Partial<OutreachProspect>, actorId: string, store = getOutreachStore()) {
  const row = store.prospects.get(id);
  if (!row) return null;
  if (patch.clinicName || patch.websiteUrl || patch.status) validateProspectWrite({ ...row, ...patch });
  const next = { ...row, ...patch, id: row.id, updatedAt: nowIso() };
  if (patch.websiteUrl) next.canonicalDomain = domainFromUrl(patch.websiteUrl);
  store.prospects.set(id, next);
  recordActivity(store, id, "prospect_updated", `Prospect updated by ${actorLabel(actorId)}`, { actorId, metadata: patch as Record<string, unknown> });
  if (patch.status && patch.status !== row.status) {
    recordActivity(store, id, "status_changed", `Status changed from ${row.status} to ${patch.status}`, { actorId });
  }
  if (patch.researchConfidence && patch.researchConfidence !== row.researchConfidence) {
    recordActivity(store, id, "research_confidence_changed", `Confidence changed to ${patch.researchConfidence}`, { actorId });
  }
  return serializeProspect(store, next);
}

export function archiveProspect(id: string, actorId: string, store = getOutreachStore()) {
  const row = store.prospects.get(id);
  if (!row) return null;
  const next = { ...row, status: "ARCHIVED" as const, archivedAt: nowIso(), updatedAt: nowIso() };
  store.prospects.set(id, next);
  recordActivity(store, id, "prospect_archived", "Prospect archived", { actorId });
  return serializeProspect(store, next);
}

export function restoreProspect(id: string, actorId: string, store = getOutreachStore()) {
  const row = store.prospects.get(id);
  if (!row) return null;
  const next = { ...row, status: "NEW" as const, archivedAt: null, updatedAt: nowIso() };
  store.prospects.set(id, next);
  recordActivity(store, id, "prospect_restored", "Prospect restored", { actorId });
  return serializeProspect(store, next);
}

export function suppressProspect(id: string, reason: string, actorId: string, store = getOutreachStore()) {
  const row = store.prospects.get(id);
  if (!row) return null;
  const next = {
    ...row,
    status: "SUPPRESSED" as const,
    isSuppressed: true,
    suppressionReason: reason,
    updatedAt: nowIso(),
  };
  store.prospects.set(id, next);
  store.suppressions.set(newId("os"), {
    id: newId("os"),
    prospectId: id,
    contactRouteId: null,
    reason,
    source: "operator",
    createdBy: actorId,
    createdAt: nowIso(),
    expiresAt: null,
  });
  recordActivity(store, id, "prospect_suppressed", `Prospect suppressed: ${reason}`, { actorId });
  return serializeProspect(store, next);
}

export function markResearchReady(id: string, actorId: string, store = getOutreachStore()) {
  const row = store.prospects.get(id);
  if (!row) return { error: "not_found" as const };
  const result = canMarkResearchReady(row, evidenceFor(store, id), routesFor(store, id));
  if (!result.allowed) return { error: "not_ready" as const, result };
  const next = { ...row, status: "RESEARCH_READY" as const, updatedAt: nowIso(), lastResearchedAt: nowIso() };
  store.prospects.set(id, next);
  recordActivity(store, id, "status_changed", "Marked Research Ready", { actorId });
  return { prospect: serializeProspect(store, next), result };
}

export function addEvidence(
  prospectId: string,
  input: Partial<OutreachEvidence> & { sourceUrl: string; evidenceType: OutreachEvidence["evidenceType"]; sourceType: OutreachEvidence["sourceType"] },
  actorId: string,
  store = getOutreachStore(),
) {
  if (!store.prospects.has(prospectId)) throw new OutreachValidationError("Prospect not found.", "prospectId");
  validateEvidenceWrite(input, true);
  const ts = nowIso();
  const row: OutreachEvidence = {
    id: newId("oe"),
    prospectId,
    evidenceType: input.evidenceType,
    sourceType: input.sourceType,
    sourceUrl: input.sourceUrl.trim(),
    sourceTitle: input.sourceTitle ?? null,
    excerpt: input.excerpt ?? null,
    structuredData: input.structuredData ?? {},
    observedAt: input.observedAt ?? ts,
    capturedAt: input.capturedAt ?? ts,
    confidence: input.confidence ?? "NEEDS_REVIEW",
    contentHash: input.contentHash ?? null,
    capturedBy: actorId,
    isDemo: false,
    createdAt: ts,
    updatedAt: ts,
  };
  store.evidence.set(row.id, row);
  recordActivity(store, prospectId, "evidence_added", `Evidence added (${row.evidenceType})`, { actorId, entityType: "evidence", entityId: row.id });
  return row;
}

export function updateEvidence(id: string, patch: Partial<OutreachEvidence>, actorId: string, store = getOutreachStore()) {
  const row = store.evidence.get(id);
  if (!row) return null;
  validateEvidenceWrite({ ...row, ...patch }, true);
  const next = { ...row, ...patch, id: row.id, prospectId: row.prospectId, updatedAt: nowIso() };
  store.evidence.set(id, next);
  recordActivity(store, row.prospectId, "prospect_updated", `Evidence metadata updated by ${actorLabel(actorId)}`, { actorId, entityType: "evidence", entityId: id });
  return next;
}

export function deleteEvidence(id: string, actorId: string, store = getOutreachStore()) {
  const row = store.evidence.get(id);
  if (!row) return false;
  store.evidence.delete(id);
  recordActivity(store, row.prospectId, "evidence_deleted", "Evidence deleted", { actorId, entityType: "evidence", entityId: id });
  return true;
}

export function addContactRoute(
  prospectId: string,
  input: Partial<OutreachContactRoute> & { channelType: ContactChannelType; value: string },
  actorId: string,
  store = getOutreachStore(),
) {
  if (!store.prospects.has(prospectId)) throw new OutreachValidationError("Prospect not found.", "prospectId");
  validateContactRouteWrite(input, store.settings.requireSourceUrlForContactRoute);
  const ts = nowIso();
  const row: OutreachContactRoute = {
    id: newId("ocr"),
    prospectId,
    channelType: input.channelType,
    value: input.value.trim(),
    isPubliclyPublished: input.isPubliclyPublished ?? true,
    sourceUrl: input.sourceUrl ?? null,
    sourceContext: input.sourceContext ?? null,
    verificationStatus: input.verificationStatus ?? "UNVERIFIED",
    verificationNotes: input.verificationNotes ?? null,
    confidence: input.confidence ?? "NEEDS_REVIEW",
    isDoNotContact: input.isDoNotContact ?? false,
    suppressionReason: input.suppressionReason ?? null,
    isManualRecord: Boolean(input.isManualRecord),
    capturedAt: input.capturedAt ?? ts,
    lastReviewedAt: ts,
    createdAt: ts,
    updatedAt: ts,
  };
  store.routes.set(row.id, row);
  if (row.channelType === "NONE_FOUND") {
    const prospect = store.prospects.get(prospectId);
    if (prospect) store.prospects.set(prospectId, { ...prospect, contactSearchCompleted: true, updatedAt: ts });
  }
  recordActivity(store, prospectId, "contact_route_added", `Contact route added (${row.channelType})`, { actorId, entityType: "contact_route", entityId: row.id });
  return row;
}

export function updateContactRoute(id: string, patch: Partial<OutreachContactRoute>, actorId: string, store = getOutreachStore()) {
  const row = store.routes.get(id);
  if (!row) return null;
  validateContactRouteWrite({ ...row, ...patch }, store.settings.requireSourceUrlForContactRoute);
  const next = { ...row, ...patch, id: row.id, prospectId: row.prospectId, updatedAt: nowIso(), lastReviewedAt: nowIso() };
  store.routes.set(id, next);
  recordActivity(store, row.prospectId, "contact_route_updated", "Contact route updated", { actorId, entityType: "contact_route", entityId: id });
  return next;
}

export function deleteContactRoute(id: string, actorId: string, store = getOutreachStore()) {
  const row = store.routes.get(id);
  if (!row) return false;
  store.routes.delete(id);
  recordActivity(store, row.prospectId, "contact_route_updated", "Contact route deleted", { actorId, entityType: "contact_route", entityId: id });
  return true;
}

export function addNote(prospectId: string, body: string, actorId: string, store = getOutreachStore()) {
  if (!store.prospects.has(prospectId)) return null;
  const row = recordActivity(store, prospectId, "operator_note_added", body, { actorId, entityType: "note" });
  return row;
}

export function startResearch(prospectId: string, adapterName: string, actorId: string, idempotencyKey?: string, store = getOutreachStore()) {
  const prospect = store.prospects.get(prospectId);
  if (!prospect) throw new OutreachValidationError("Prospect not found.", "prospectId");
  if (!hasResearchIdentity(prospect)) {
    throw new OutreachValidationError("Needs Verification: clinic name plus a website, city, or public profile is required before research.", "identity");
  }
  if (idempotencyKey) {
    const existing = [...store.jobs.values()].find((job) => job.prospectId === prospectId && job.idempotencyKey === idempotencyKey);
    if (existing) return existing;
  }
  const adapter = getAdapterByName(adapterName);
  const ts = nowIso();
  const job: OutreachResearchJob = {
    id: newId("orj"),
    prospectId,
    jobType: adapterName === "meta_ad_library" ? "meta_ads_search" : "website_research",
    adapterName: adapter?.name ?? adapterName,
    status: "QUEUED",
    requestedBy: actorId,
    startedAt: ts,
    completedAt: null,
    errorMessage: null,
    resultSummary: {},
    logs: [{ at: ts, stage: "Queued", message: `Research requested via ${adapter?.name ?? adapterName}` }],
    progressCurrent: 0,
    progressTotal: 1,
    source: adapter?.name ?? adapterName,
    scope: prospect.clinicName,
    isDemo: false,
    idempotencyKey: idempotencyKey ?? null,
    createdAt: ts,
    updatedAt: ts,
  };
  recordActivity(store, prospectId, "research_started", `Research requested via ${job.adapterName}`, { actorId, entityType: "research_job", entityId: job.id });
  if (!adapter || !adapter.isConfigured()) {
    job.status = "NOT_CONFIGURED";
    job.completedAt = nowIso();
    job.errorMessage = "Research connector not configured.";
    job.resultSummary = { status: "NOT_CONFIGURED", adapterName: job.adapterName };
    store.jobs.set(job.id, job);
    recordActivity(store, prospectId, "research_completed", "Research connector not configured — no live results were fabricated.", { actorId, entityType: "research_job", entityId: job.id });
    return job;
  }
  job.status = "QUEUED";
  job.resultSummary = { status: "QUEUED" };
  store.jobs.set(job.id, job);
  return job;
}

export function getResearchJob(id: string, store = getOutreachStore()) {
  return store.jobs.get(id) ?? null;
}

export function cancelResearchJob(id: string, actorId: string, store = getOutreachStore()) {
  const job = store.jobs.get(id);
  if (!job) return null;
  if (job.status !== "QUEUED" && job.status !== "RUNNING") {
    throw new OutreachValidationError("Only queued or running jobs can be cancelled.", "status");
  }
  job.status = "CANCELLED";
  job.completedAt = nowIso();
  job.updatedAt = nowIso();
  appendJobLog(job, "Cancelled", "Operator cancelled this job.");
  store.jobs.set(id, job);
  recordActivity(store, job.prospectId, "job_cancelled", `Job cancelled: ${job.jobType}`, {
    actorId,
    entityType: "research_job",
    entityId: job.id,
  });
  return job;
}

export function appendJobLog(job: OutreachResearchJob, stage: string, message: string) {
  job.logs.push({ at: nowIso(), stage, message });
  job.updatedAt = nowIso();
}

export function listResearchJobs(store = getOutreachStore()) {
  return [...store.jobs.values()].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function listActivity(range: "today" | "7d" | "30d" | "all" = "all", store = getOutreachStore()) {
  const now = Date.now();
  const cutoff =
    range === "today" ? now - 24 * 36e5
      : range === "7d" ? now - 7 * 24 * 36e5
        : range === "30d" ? now - 30 * 24 * 36e5
          : 0;
  return store.activity.filter((row) => Date.parse(row.createdAt) >= cutoff);
}

function queuePriority(store: OutreachStore, prospect: OutreachProspect): { priority: QueuePriority; rationale: string; missing: string } {
  if (prospect.status === "ARCHIVED" || prospect.status === "SUPPRESSED" || prospect.isSuppressed) {
    return { priority: "NONE", rationale: "Archived or suppressed.", missing: "Not in active research." };
  }
  const signal = adSignalFor(store, prospect.id);
  const route = contactSummary(store, prospect.id);
  const site = websiteStatus(prospect);
  if (signal === "ACTIVE_OBSERVED" && route === "none") {
    return { priority: "HIGH", rationale: "Active advertising signal observed and no contact route found.", missing: "Public contact route" };
  }
  if (site === "found" && (evidenceFor(store, prospect.id).length === 0 || prospect.status === "NEEDS_REVIEW")) {
    return { priority: "MEDIUM", rationale: "Website found but evidence or research is incomplete.", missing: site === "found" ? "Research review" : "Website" };
  }
  if (prospect.sourceType === "IMPORT" || prospect.sourceType === "MANUAL") {
    return { priority: "LOW", rationale: "Imported or manual prospect awaiting basic enrichment.", missing: "Enrichment" };
  }
  return { priority: "LOW", rationale: "Imported or manual prospect awaiting basic enrichment.", missing: "Enrichment" };
}

export function researchQueue(store = getOutreachStore()) {
  const buckets: Record<QueueBucket, ReturnType<typeof serializeProspect>[]> = {
    new_prospects: [],
    missing_website: [],
    missing_contact_route: [],
    has_ads_needs_website: [],
    has_website_needs_review: [],
    ready_to_mark: [],
    suppressed_or_dnc: [],
  };
  for (const prospect of store.prospects.values()) {
    const serialized = {
      ...serializeProspect(store, prospect),
      ...queuePriority(store, prospect),
      ageHours: Math.max(0, Math.round((Date.now() - Date.parse(prospect.createdAt)) / 36e5)),
    };
    const ready = canMarkResearchReady(prospect, evidenceFor(store, prospect.id), routesFor(store, prospect.id));
    if (prospect.isSuppressed || prospect.status === "SUPPRESSED") buckets.suppressed_or_dnc.push(serialized);
    else if (prospect.status === "ARCHIVED") continue;
    else if (prospect.status === "NEW") buckets.new_prospects.push(serialized);
    if (!prospect.isSuppressed && prospect.status !== "ARCHIVED" && websiteStatus(prospect) === "missing") {
      buckets.missing_website.push(serialized);
    }
    if (!prospect.isSuppressed && prospect.status !== "ARCHIVED" && contactSummary(store, prospect.id) === "none" && !prospect.contactSearchCompleted) {
      buckets.missing_contact_route.push(serialized);
    }
    if (adSignalFor(store, prospect.id) !== "NO_SIGNAL" && websiteStatus(prospect) !== "found") {
      buckets.has_ads_needs_website.push(serialized);
    }
    if (websiteStatus(prospect) === "found" && prospect.status === "NEEDS_REVIEW") {
      buckets.has_website_needs_review.push(serialized);
    }
    if (ready.allowed && prospect.status !== "RESEARCH_READY" && !prospect.isSuppressed) {
      buckets.ready_to_mark.push(serialized);
    }
  }
  return buckets;
}

export function listContacts(filters: { channelType?: ContactChannelType; includeSuppressed?: boolean } = {}, store = getOutreachStore()) {
  return [...store.routes.values()]
    .filter((row) => {
      if (!filters.includeSuppressed && (row.isDoNotContact || row.verificationStatus === "DO_NOT_CONTACT" || row.verificationStatus === "SUPPRESSED")) {
        return false;
      }
      const prospect = store.prospects.get(row.prospectId);
      if (prospect && (prospect.isSuppressed || prospect.status === "SUPPRESSED") && !filters.includeSuppressed) return false;
      if (filters.channelType && row.channelType !== filters.channelType) return false;
      return true;
    })
    .map((row) => {
      const prospect = store.prospects.get(row.prospectId);
      return {
        ...row,
        clinicName: prospect?.clinicName ?? "Unknown",
        location: [prospect?.city, prospect?.stateOrRegion].filter(Boolean).join(", "),
        isDemo: prospect?.isDemo ?? false,
        researchConfidence: prospect?.researchConfidence ?? "NEEDS_REVIEW",
        draftStatus: prospect?.draftStatus ?? null,
        draftSubject: prospect?.draftSubject ?? null,
        draftMessage: prospect?.draftMessage ?? null,
        contactRouteType: prospect?.contactRouteType ?? "none",
      };
    });
}

export function listEvidenceLibrary(store = getOutreachStore()) {
  return [...store.evidence.values()]
    .sort((a, b) => b.capturedAt.localeCompare(a.capturedAt))
    .map((row) => {
      const prospect = store.prospects.get(row.prospectId);
      return {
        ...row,
        clinicName: prospect?.clinicName ?? "Unknown",
        researcher: row.capturedBy,
      };
    });
}

export function metrics(store = getOutreachStore()) {
  const active = [...store.prospects.values()].filter(isActiveProspect);
  const ads = active.filter((row) => adSignalFor(store, row.id) === "ACTIVE_OBSERVED").length;
  const emails = active.filter((row) => contactSummary(store, row.id) === "email" || contactSummary(store, row.id) === "multiple").length;
  const forms = [...store.routes.values()].filter((row) => row.channelType === "CONTACT_FORM" && !row.isDoNotContact).length;
  const ready = active.filter((row) => row.status === "RESEARCH_READY").length;
  const review = active.filter((row) => row.status === "NEEDS_REVIEW").length;
  return {
    prospectsDiscovered: active.length,
    activeAdSignals: ads,
    publicEmailRoutes: emails,
    contactFormsFound: forms,
    researchReady: ready,
    needsReview: review,
  };
}

export function listSavedViews(store = getOutreachStore()) {
  return [...store.savedViews.values()];
}

export function upsertSavedView(input: Partial<OutreachSavedView> & { name: string; userId: string }, store = getOutreachStore()) {
  const ts = nowIso();
  const row: OutreachSavedView = {
    id: input.id ?? newId("osv"),
    userId: input.userId,
    name: input.name,
    route: input.route ?? "prospects",
    filters: input.filters ?? {},
    sort: input.sort ?? { field: "updatedAt", dir: "desc" },
    visibleColumns: input.visibleColumns ?? [],
    isDefault: Boolean(input.isDefault),
    createdAt: input.createdAt ?? ts,
    updatedAt: ts,
  };
  store.savedViews.set(row.id, row);
  return row;
}

export function deleteSavedView(id: string, store = getOutreachStore()) {
  return store.savedViews.delete(id);
}

export function getSettings(store = getOutreachStore()) {
  return {
    settings: store.settings,
    connectors: connectorStatuses().map((row) => ({
      ...row,
      lastSync: store.settings.lastSyncByAdapter[row.key] ?? null,
    })),
    hybridMode: "Live production data only. Demo fixtures are not loaded.",
    enforced: {
      onlyPublicBusinessContactRoutes: true,
      noAutomatedSending: true,
      noAutomatedFormSubmission: true,
    },
  };
}

export function patchSettings(patch: Partial<OutreachSettings>, store = getOutreachStore()) {
  store.settings = {
    ...store.settings,
    ...patch,
    demoDataEnabled: false,
    lastSyncByAdapter: { ...store.settings.lastSyncByAdapter, ...(patch.lastSyncByAdapter ?? {}) },
    enabledConnectors: { ...store.settings.enabledConnectors, ...(patch.enabledConnectors ?? {}) },
    onlyPublicBusinessContactRoutes: true,
    noAutomatedSending: true,
    noAutomatedFormSubmission: true,
  };
  return getSettings(store);
}

export function testConnector(name: string) {
  const adapter = getAdapterByName(name);
  if (!adapter) return { status: "NOT_CONFIGURED" as const, adapterName: name };
  if (!adapter.isConfigured()) return { status: "NOT_CONFIGURED" as const, adapterName: adapter.name };
  return { status: "ok" as const, adapterName: adapter.name, note: "Configured. Live fetch is not run from this test." };
}

export function csvExport(includeSuppressed: boolean, store = getOutreachStore()) {
  const rows = listProspects({ statusGroup: includeSuppressed ? "all" : "active", includeSuppressed }, store);
  const header = ["clinicName", "city", "state", "vertical", "status", "websiteUrl", "sourceType"];
  const lines = [header.join(",")];
  for (const row of rows) {
    lines.push([row.clinicName, row.city, row.stateOrRegion, row.vertical, row.status, row.websiteUrl, row.sourceType]
      .map((value) => `"${String(value ?? "").replaceAll('"', '""')}"`)
      .join(","));
  }
  return lines.join("\n");
}
