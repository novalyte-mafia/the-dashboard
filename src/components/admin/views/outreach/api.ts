import type {
  AdSignalStatus,
  ContactChannelType,
  ContactVerificationStatus,
  EvidenceType,
  OutreachActivity,
  OutreachContactRoute,
  OutreachEvidence,
  OutreachProspectRow,
  OutreachQueueCard,
  OutreachSavedView,
  OutreachSettings,
  OutreachSubview,
  ProspectStatus,
  QueueBucket,
  ResearchConfidence,
  ResearchReadyResult,
  SourceType,
  Vertical,
} from "@/lib/outreach/types";

export class OutreachApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly payload?: unknown,
  ) {
    super(message);
    this.name = "OutreachApiError";
  }
}

async function outreachRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`/api/outreach/${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
  if (res.headers.get("content-type")?.includes("text/csv")) {
    const text = await res.text();
    if (!res.ok) throw new OutreachApiError(text || "Export failed.", res.status);
    return text as T;
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new OutreachApiError(
      typeof data.error === "string" ? data.error : "Outreach request failed.",
      res.status,
      data,
    );
  }
  return data as T;
}

export interface ProspectListResponse {
  prospects: OutreachProspectRow[];
  total: number;
}

export interface ProspectDetailResponse {
  prospect: OutreachProspectRow;
  evidence: OutreachEvidence[];
  contactRoutes: OutreachContactRoute[];
  activity: OutreachActivity[];
  researchReady: ResearchReadyResult;
}

export interface MetricsResponse {
  metrics: {
    prospectsDiscovered: number;
    activeAdSignals: number;
    publicEmailRoutes: number;
    contactFormsFound: number;
    researchReady: number;
    needsReview: number;
  };
}

export interface QueueResponse {
  queue: Record<QueueBucket, OutreachQueueCard[]>;
}

export interface ContactListItem extends OutreachContactRoute {
  clinicName: string;
  location: string;
  isDemo: boolean;
  researchConfidence: ResearchConfidence;
  draftStatus: string | null;
  draftSubject: string | null;
  draftMessage: string | null;
  contactRouteType: string;
}

export interface EvidenceListItem extends OutreachEvidence {
  clinicName: string;
  researcher: string;
}

export interface ConnectorStatus {
  key: string;
  label: string;
  configured: boolean;
  status: string;
  env: string;
  lastSync: string | null;
}

export interface SettingsResponse {
  settings: OutreachSettings;
  connectors: ConnectorStatus[];
  hybridMode: string;
  enforced: {
    onlyPublicBusinessContactRoutes: true;
    noAutomatedSending: true;
    noAutomatedFormSubmission: true;
  };
}

export function listProspects(query: Record<string, string | undefined> = {}) {
  const sp = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value) sp.set(key, value);
  }
  const suffix = sp.toString() ? `?${sp.toString()}` : "";
  return outreachRequest<ProspectListResponse>(`prospects${suffix}`);
}

export function getProspect(id: string) {
  return outreachRequest<ProspectDetailResponse>(`prospects/${id}`);
}

export function createProspect(body: Record<string, unknown>) {
  return outreachRequest<{ prospect: OutreachProspectRow }>("prospects", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export function patchProspect(id: string, body: Record<string, unknown>) {
  return outreachRequest<{ prospect: OutreachProspectRow }>(`prospects/${id}`, {
    method: "PATCH",
    body: JSON.stringify(body),
  });
}

export function archiveProspect(id: string) {
  return outreachRequest<{ prospect: OutreachProspectRow }>(`prospects/${id}/archive`, { method: "POST" });
}

export function restoreProspect(id: string) {
  return outreachRequest<{ prospect: OutreachProspectRow }>(`prospects/${id}/restore`, { method: "POST" });
}

export function suppressProspect(id: string, reason: string) {
  return outreachRequest<{ prospect: OutreachProspectRow }>(`prospects/${id}/suppress`, {
    method: "POST",
    body: JSON.stringify({ reason }),
  });
}

export function markResearchReady(id: string) {
  return outreachRequest<{ prospect: OutreachProspectRow; result: ResearchReadyResult }>(
    `prospects/${id}/mark-research-ready`,
    { method: "POST" },
  );
}

export function addEvidence(prospectId: string, body: Record<string, unknown>) {
  return outreachRequest<{ evidence: OutreachEvidence }>(`prospects/${prospectId}/evidence`, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export function patchEvidence(id: string, body: Record<string, unknown>) {
  return outreachRequest<{ evidence: OutreachEvidence }>(`evidence/${id}`, {
    method: "PATCH",
    body: JSON.stringify(body),
  });
}

export function deleteEvidence(id: string) {
  return outreachRequest<{ ok: boolean }>(`evidence/${id}`, { method: "DELETE" });
}

export function addContactRoute(prospectId: string, body: Record<string, unknown>) {
  return outreachRequest<{ contactRoute: OutreachContactRoute }>(`prospects/${prospectId}/contact-routes`, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export function patchContactRoute(id: string, body: Record<string, unknown>) {
  return outreachRequest<{ contactRoute: OutreachContactRoute }>(`contact-routes/${id}`, {
    method: "PATCH",
    body: JSON.stringify(body),
  });
}

export function deleteContactRoute(id: string) {
  return outreachRequest<{ ok: boolean }>(`contact-routes/${id}`, { method: "DELETE" });
}

export function addNote(prospectId: string, body: string) {
  return outreachRequest<{ activity: OutreachActivity }>(`prospects/${prospectId}/notes`, {
    method: "POST",
    body: JSON.stringify({ body }),
  });
}

export function startResearch(prospectId: string, adapterName = "website_research") {
  return outreachRequest<{ job: { id: string; status: string; errorMessage: string | null } }>(
    `prospects/${prospectId}/research`,
    { method: "POST", body: JSON.stringify({ adapterName, idempotencyKey: `ui_${prospectId}_${adapterName}` }) },
  );
}

export function runDraftPass1(prospectId: string) {
  return outreachRequest<{ prospect: OutreachProspectRow; pass: 1; model: string; evidenceCount: number }>(
    `prospects/${prospectId}/draft`,
    { method: "POST" },
  );
}

export function runDraftPass2(prospectId: string) {
  return outreachRequest<{ prospect: OutreachProspectRow | null; verification: unknown; pass: 2; ready: boolean }>(
    `prospects/${prospectId}/verify-draft`,
    { method: "POST" },
  );
}

export function saveDraftEdits(prospectId: string, body: { draftSubject?: string; draftMessage?: string }) {
  return outreachRequest<{ prospect: OutreachProspectRow }>(`prospects/${prospectId}/draft`, {
    method: "PATCH",
    body: JSON.stringify(body),
  });
}

export function logConsoleSend(prospectId: string) {
  return outreachRequest<{ prospect: OutreachProspectRow }>(`prospects/${prospectId}/log-send`, { method: "POST" });
}

export function logFormCopy(prospectId: string) {
  return outreachRequest<{ prospect: OutreachProspectRow }>(`prospects/${prospectId}/log-copy`, { method: "POST" });
}

export function listDrafts() {
  return outreachRequest<{ drafts: OutreachProspectRow[] }>("drafts");
}

export function runDraftBatch(ids: string[], pass: 1 | 2) {
  return outreachRequest<{ results: unknown[] }>("drafts/batch", {
    method: "POST",
    body: JSON.stringify({ ids, pass }),
  });
}

export function getMetrics() {
  return outreachRequest<MetricsResponse>("metrics");
}

export function getCommandCenter() {
  return outreachRequest<CommandCenterResponse>("command-center");
}

export function getActivity(range: "today" | "7d" | "30d" | "all" = "7d") {
  return outreachRequest<{ activity: OutreachActivity[] }>(`activity?range=${range}`);
}

export function listJobs() {
  return outreachRequest<{ jobs: import("@/lib/outreach/types").OutreachResearchJob[] }>("jobs");
}

export function getJob(id: string) {
  return outreachRequest<{ job: import("@/lib/outreach/types").OutreachResearchJob }>(`jobs/${id}`);
}

export function retryJob(id: string) {
  return outreachRequest<{ job: import("@/lib/outreach/types").OutreachResearchJob }>(`jobs/${id}/retry`, { method: "POST" });
}

export function cancelJob(id: string) {
  return outreachRequest<{ job: import("@/lib/outreach/types").OutreachResearchJob }>(`jobs/${id}/cancel`, { method: "POST" });
}

export function bulkResearch(ids: string[], adapterName: string) {
  return outreachRequest<{ jobs: import("@/lib/outreach/types").OutreachResearchJob[] }>("bulk-research", {
    method: "POST",
    body: JSON.stringify({ ids, adapterName }),
  });
}

export function runMetaSearch(body: Record<string, unknown>) {
  return outreachRequest<{
    search: import("@/lib/outreach/types").OutreachMetaSearch;
    job: import("@/lib/outreach/types").OutreachResearchJob;
    results: import("@/lib/outreach/types").OutreachMetaAdResult[];
    officialUrl: string;
  }>("meta-searches", { method: "POST", body: JSON.stringify(body) });
}

export function listMetaSearches() {
  return outreachRequest<{ searches: import("@/lib/outreach/types").OutreachMetaSearch[] }>("meta-searches");
}

export function getMetaSearch(id: string) {
  return outreachRequest<{
    search: import("@/lib/outreach/types").OutreachMetaSearch;
    results: import("@/lib/outreach/types").OutreachMetaAdResult[];
    job: import("@/lib/outreach/types").OutreachResearchJob | null;
  }>(`meta-searches/${id}`);
}

export function rerunMetaSearch(id: string) {
  return outreachRequest<{
    search: import("@/lib/outreach/types").OutreachMetaSearch;
    results: import("@/lib/outreach/types").OutreachMetaAdResult[];
    officialUrl: string;
  }>(`meta-searches/${id}/rerun`, { method: "POST" });
}

export function listMetaResults(query: Record<string, string | undefined> = {}) {
  const sp = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) if (value) sp.set(key, value);
  const suffix = sp.toString() ? `?${sp.toString()}` : "";
  return outreachRequest<{ results: import("@/lib/outreach/types").OutreachMetaAdResult[] }>(`meta-results${suffix}`);
}

export function attachMetaResult(id: string, prospectId: string) {
  return outreachRequest<{ result: import("@/lib/outreach/types").OutreachMetaAdResult }>(`meta-results/${id}/attach`, {
    method: "POST",
    body: JSON.stringify({ prospectId }),
  });
}

export function createClinicFromMeta(id: string) {
  return outreachRequest<{ prospect: OutreachProspectRow; result: import("@/lib/outreach/types").OutreachMetaAdResult }>(
    `meta-results/${id}/create-clinic`,
    { method: "POST" },
  );
}

export function dismissMetaResult(id: string) {
  return outreachRequest<{ result: import("@/lib/outreach/types").OutreachMetaAdResult }>(`meta-results/${id}/dismiss`, { method: "POST" });
}

export function listSavedMetaSearches() {
  return outreachRequest<{
    saved: import("@/lib/outreach/types").OutreachSavedMetaSearch[];
    suggested: Array<{ name: string; query: import("@/lib/outreach/types").MetaSearchQuery }>;
  }>("meta-saved-searches");
}

export function saveMetaSearchPreset(body: Record<string, unknown>) {
  return outreachRequest<{ search: import("@/lib/outreach/types").OutreachSavedMetaSearch }>("meta-saved-searches", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export function deleteSavedMetaSearch(id: string) {
  return outreachRequest<{ ok: boolean }>(`meta-saved-searches/${id}`, { method: "DELETE" });
}

export function getIntegrations() {
  return outreachRequest<IntegrationHealthResponse>("integrations");
}

export interface CommandCenterResponse {
  metrics: MetricsResponse["metrics"];
  actionRequired: Array<{ key: string; label: string; count: number; subview: OutreachSubview; filters: Record<string, string> }>;
  pipeline: Record<string, number>;
  queueCounts: Record<string, number>;
  runningJobs: import("@/lib/outreach/types").OutreachResearchJob[];
  recentJobs: import("@/lib/outreach/types").OutreachResearchJob[];
  activity: OutreachActivity[];
  metaTrustMode: import("@/lib/outreach/types").MetaTrustMode;
  metaApiConfigured: boolean;
  firecrawlConfigured: boolean;
}

export interface IntegrationHealthResponse {
  meta: { status: string; apiConfigured: boolean; lastSuccessfulRun: string | null; lastFailure: string | null; env: string; docs: string; capability: string };
  website: { status: string; env: string; lastSuccessfulRun: string | null; lastFailure: string | null };
  publicSearch: { status: string; env: string };
  drafts: { status: string; env: string };
}

export function getQueue() {
  return outreachRequest<QueueResponse>("queue");
}

export function getContacts(query: Record<string, string | undefined> = {}) {
  const sp = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value) sp.set(key, value);
  }
  const suffix = sp.toString() ? `?${sp.toString()}` : "";
  return outreachRequest<{ contacts: ContactListItem[] }>(`contacts${suffix}`);
}

export function getEvidenceLibrary() {
  return outreachRequest<{ evidence: EvidenceListItem[] }>("evidence");
}

export function getSavedViews() {
  return outreachRequest<{ views: OutreachSavedView[] }>("saved-views");
}

export function upsertSavedView(body: Record<string, unknown>) {
  return outreachRequest<{ view: OutreachSavedView }>("saved-views", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export function getSettings() {
  return outreachRequest<SettingsResponse>("settings");
}

export function patchSettings(body: Record<string, unknown>) {
  return outreachRequest<SettingsResponse>("settings", {
    method: "PATCH",
    body: JSON.stringify(body),
  });
}

export function testConnector(name: string) {
  return outreachRequest<{ status: string; adapterName: string; note?: string }>("settings/test-connector", {
    method: "POST",
    body: JSON.stringify({ name }),
  });
}

export function exportProspectsCsv(includeSuppressed: boolean, confirmSuppressed: boolean) {
  const sp = new URLSearchParams({ format: "csv" });
  if (includeSuppressed) {
    sp.set("includeSuppressed", "true");
    sp.set("statusGroup", "all");
    if (confirmSuppressed) sp.set("confirmSuppressed", "true");
  }
  return outreachRequest<string>(`prospects?${sp.toString()}`);
}

export type ProspectFilterState = {
  q: string;
  status: ProspectStatus | "";
  vertical: Vertical | "";
  city: string;
  state: string;
  country: string;
  sourceType: SourceType | "";
  adSignal: AdSignalStatus | "";
  websiteStatus: "found" | "missing" | "needs_review" | "";
  contactRoute: "email" | "form" | "phone" | "multiple" | "none" | "";
  confidence: ResearchConfidence | "";
  discoveredFrom: string;
  discoveredTo: string;
  researchedFrom: string;
  researchedTo: string;
  dataMode: "live" | "all";
  includeSuppressed: boolean;
  includeArchived: boolean;
};

export const EMPTY_FILTERS: ProspectFilterState = {
  q: "",
  status: "",
  vertical: "",
  city: "",
  state: "",
  country: "",
  sourceType: "",
  adSignal: "",
  websiteStatus: "",
  contactRoute: "",
  confidence: "",
  discoveredFrom: "",
  discoveredTo: "",
  researchedFrom: "",
  researchedTo: "",
  dataMode: "all",
  includeSuppressed: false,
  includeArchived: false,
};

export function filtersToQuery(filters: ProspectFilterState) {
  return {
    q: filters.q || undefined,
    status: filters.status || undefined,
    vertical: filters.vertical || undefined,
    city: filters.city || undefined,
    state: filters.state || undefined,
    country: filters.country || undefined,
    sourceType: filters.sourceType || undefined,
    adSignal: filters.adSignal || undefined,
    websiteStatus: filters.websiteStatus || undefined,
    contactRoute: filters.contactRoute || undefined,
    confidence: filters.confidence || undefined,
    discoveredFrom: filters.discoveredFrom || undefined,
    discoveredTo: filters.discoveredTo || undefined,
    researchedFrom: filters.researchedFrom || undefined,
    researchedTo: filters.researchedTo || undefined,
    dataMode: filters.dataMode === "all" ? undefined : filters.dataMode,
    includeSuppressed: filters.includeSuppressed ? "true" : undefined,
    includeArchived: filters.includeArchived ? "true" : undefined,
  };
}

export type { OutreachSubview };
