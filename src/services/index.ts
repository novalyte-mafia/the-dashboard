/**
 * Novalyte Admin — Service Layer
 *
 * Central data-access abstraction. When appConfig.mockMode is true,
 * these functions return mock data. When false, they will call the
 * real backend API routes (already built at /api/*) — Codex connects
 * Supabase behind those routes without touching the UI.
 *
 * Pages and components import from HERE, never from mocks/ directly.
 */
import { appConfig } from "@/config/app-config";
import * as mocks from "@/mocks";
import type {
  AdminMember, Clinic, CallSession, FollowUpTask, Deal, DirectoryProfile,
  PatientLead, ClinicMatch, MarketData, Campaign, Professional, ProfessionalDocument,
  JobListing, JobApplication, ClinicClaim, Product, Order, Article, Automation, AIUsageRecord,
  Integration, AuditEvent, NotificationItem, ActivityEvent, KPIMetric,
} from "@/types";

// Helper: simulate async fetch latency for realism in mock mode
function mockAsync<T>(data: T, ms = 120): Promise<T> {
  return new Promise((resolve) => setTimeout(() => resolve(data), ms));
}

function markDemo<T>(records: T[]): (T & { dataSource: "demo" })[] {
  return records.map((record) => ({ ...(record as object), dataSource: "demo" as const }) as T & { dataSource: "demo" });
}

async function workforceJson<T>(input: RequestInfo, init?: RequestInit): Promise<T> {
  const r = await fetch(input, init);
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(data.error ?? "Workforce request failed.");
  return data as T;
}

// ---------------------------------------------------------------------------
// Admin Service
// ---------------------------------------------------------------------------
export const adminService = {
  getCurrent(): Promise<AdminMember> {
    if (appConfig.mockMode) return mockAsync(mocks.mockAdmins[0]);
    return fetch("/api/auth/session").then((r) => r.json()).then((d) => d.admin);
  },
  list(): Promise<AdminMember[]> {
    return mockAsync(mocks.mockAdmins);
  },
};

// ---------------------------------------------------------------------------
// Clinic Service
// ---------------------------------------------------------------------------
export const clinicService = {
  list(filters?: Record<string, unknown>): Promise<{ clinics: Clinic[]; total: number }> {
    if (!appConfig.liveClinics) {
      let clinics = [...mocks.mockClinics];
      if (filters?.q) {
        const q = String(filters.q).toLowerCase();
        clinics = clinics.filter((c) =>
          c.name.toLowerCase().includes(q) ||
          c.city?.toLowerCase().includes(q) ||
          c.state?.toLowerCase().includes(q) ||
          c.primaryPhone?.includes(q) ||
          c.generalEmail?.toLowerCase().includes(q)
        );
      }
      if (filters?.stage) clinics = clinics.filter((c) => c.pipelineStage === filters.stage);
      if (filters?.priority) clinics = clinics.filter((c) => c.priority === filters.priority);
      if (filters?.state) clinics = clinics.filter((c) => c.state === filters.state);
      if (filters?.directoryStatus) clinics = clinics.filter((c) => c.directoryStatus === filters.directoryStatus);
      if (filters?.interested) clinics = clinics.filter((c) => c.interested);
      if (filters?.paid) clinics = clinics.filter((c) => c.paid);
      if (filters?.doNotCall) clinics = clinics.filter((c) => c.doNotCall);
      if (filters?.hasDecisionMaker) clinics = clinics.filter((c) => c.contacts.some((ct) => ct.isDecisionMaker));
      if (filters?.neverContacted) clinics = clinics.filter((c) => !c.lastContactedAt);
      return mockAsync({ clinics, total: clinics.length });
    }
    const qs = new URLSearchParams(filters as Record<string, string>).toString();
    return fetch(`/api/clinics?${qs}`).then((r) => r.json());
  },
  queue(): Promise<{ queue: Clinic[] }> {
    if (!appConfig.liveClinics) return mockAsync({ queue: mocks.mockClinics.filter((c) => ["ready_to_call", "attempted", "connected", "follow_up_required"].includes(c.pipelineStage)) });
    return fetch("/api/call-queue").then((r) => { if (!r.ok) throw new Error("Unable to load call queue"); return r.json(); });
  },
  getById(id: string): Promise<{ clinic: Clinic }> {
    if (!appConfig.liveClinics) {
      const clinic = mocks.mockClinics.find((c) => c.id === id);
      return mockAsync({ clinic: clinic as Clinic });
    }
    return fetch(`/api/clinics/${id}`).then((r) => r.json());
  },
  search(q: string): Promise<{ results: { id: string; name: string; city?: string; state?: string; primaryPhone?: string; generalEmail?: string }[] }> {
    if (!appConfig.liveClinics) {
      const query = q.toLowerCase();
      const results = mocks.mockClinics
        .filter((c) => c.name.toLowerCase().includes(query) || c.city?.toLowerCase().includes(query) || c.primaryPhone?.includes(query) || c.generalEmail?.toLowerCase().includes(query))
        .slice(0, 10)
        .map((c) => ({ id: c.id, name: c.name, city: c.city, state: c.state, primaryPhone: c.primaryPhone, generalEmail: c.generalEmail }));
      return mockAsync({ results });
    }
    return fetch(`/api/clinics/search?q=${encodeURIComponent(q)}`).then((r) => r.json());
  },
};

// ---------------------------------------------------------------------------
// Call Service
// ---------------------------------------------------------------------------
export const callService = {
  listByClinic(clinicId: string): Promise<{ calls: CallSession[] }> {
    if (!appConfig.liveClinics) {
      const calls = mocks.mockCalls.filter((c) => c.clinicId === clinicId);
      return mockAsync({ calls });
    }
    return fetch(`/api/clinics/${clinicId}/calls`).then((r) => r.json());
  },
  listAll(): Promise<{ calls: CallSession[] }> {
    if (!appConfig.liveClinics) {
      return mockAsync({ calls: mocks.mockCalls });
    }
    return fetch("/api/calls?limit=100").then((r) => r.json());
  },
};

// ---------------------------------------------------------------------------
// Follow-up Service
// ---------------------------------------------------------------------------
export const followUpService = {
  list(view?: string): Promise<{ tasks: FollowUpTask[] }> {
    if (appConfig.demoOperations) {
      const startOfToday = new Date();
      startOfToday.setHours(0, 0, 0, 0);
      const endOfToday = new Date();
      endOfToday.setHours(23, 59, 59, 999);
      let tasks = [...mocks.mockFollowUps];
      if (view === "today") tasks = tasks.filter((t) => t.status === "open" || t.status === "in_progress").filter((t) => t.dueDate && new Date(t.dueDate) >= startOfToday && new Date(t.dueDate) <= endOfToday);
      else if (view === "overdue") tasks = tasks.filter((t) => (t.status === "open" || t.status === "in_progress") && t.dueDate && new Date(t.dueDate) < startOfToday);
      else if (view === "upcoming") tasks = tasks.filter((t) => (t.status === "open" || t.status === "in_progress") && t.dueDate && new Date(t.dueDate) > endOfToday);
      else if (view === "completed") tasks = tasks.filter((t) => t.status === "completed");
      return mockAsync({ tasks });
    }
    return fetch(`/api/follow-ups?view=${view ?? "all"}`).then((r) => r.json());
  },
};

// ---------------------------------------------------------------------------
// Deal Service
// ---------------------------------------------------------------------------
export const dealService = {
  list(view?: string): Promise<{ deals: Deal[]; metrics: { openPipeline: number; weightedPipeline: number; wonRevenue: number; mrr: number; avgDealValue: number; count: number } }> {
    if (appConfig.demoOperations) {
      let deals = [...mocks.mockDeals];
      if (view === "won") deals = deals.filter((d) => d.stage === "active" || d.stage === "won");
      else if (view === "lost") deals = deals.filter((d) => d.stage === "lost");
      else if (view === "proposals") deals = deals.filter((d) => d.stage === "proposal_sent");
      else deals = deals.filter((d) => d.stage !== "won" && d.stage !== "lost");
      const openPipeline = mocks.mockDeals.filter((d) => d.stage !== "won" && d.stage !== "lost").reduce((s, d) => s + d.estimatedTotalValue, 0);
      const weightedPipeline = mocks.mockDeals.filter((d) => d.stage !== "won" && d.stage !== "lost").reduce((s, d) => s + d.estimatedTotalValue * (d.probability / 100), 0);
      const wonRevenue = mocks.mockDeals.filter((d) => d.stage === "active" || d.stage === "won").reduce((s, d) => s + d.estimatedTotalValue, 0);
      const mrr = mocks.mockDeals.filter((d) => d.stage === "active" || d.stage === "won").reduce((s, d) => s + d.estimatedMonthlyValue, 0);
      return mockAsync({ deals, metrics: { openPipeline, weightedPipeline, wonRevenue, mrr, avgDealValue: Math.round(openPipeline / mocks.mockDeals.length), count: mocks.mockDeals.length } });
    }
    return fetch(`/api/deals?view=${view ?? "open"}`).then((r) => r.json());
  },
};

// ---------------------------------------------------------------------------
// Directory Service
// ---------------------------------------------------------------------------
export const directoryService = {
  list(stage?: string): Promise<{ profiles: DirectoryProfile[] }> {
    if (appConfig.mockMode) {
      let profiles = [...mocks.mockDirectory];
      if (stage) profiles = profiles.filter((p) => p.listingStatus === stage);
      return mockAsync({ profiles });
    }
    const qs = stage ? `?stage=${stage}` : "";
    return fetch(`/api/directory${qs}`).then((r) => r.json());
  },
  update(id: string, data: Record<string, unknown>): Promise<{ profile: DirectoryProfile }> {
    if (appConfig.mockMode) {
      const idx = mocks.mockDirectory.findIndex((p) => p.id === id);
      if (idx !== -1) {
        mocks.mockDirectory[idx] = { ...mocks.mockDirectory[idx], ...data } as any;
      }
      return mockAsync({ profile: mocks.mockDirectory[idx] as any });
    }
    return fetch(`/api/directory/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data)
    }).then((r) => {
      if (!r.ok) throw new Error("Failed to update status");
      return r.json();
    });
  }
};

// ---------------------------------------------------------------------------
// Patient Service
// ---------------------------------------------------------------------------
type DbPatientLeadRow = {
  id: string;
  first_name?: string | null;
  last_name?: string | null;
  email?: string | null;
  phone?: string | null;
  city?: string | null;
  state?: string | null;
  zip?: string | null;
  treatment_interest?: string | null;
  symptoms?: string | null;
  preferred_contact?: string | null;
  insurance_preference?: string | null;
  telehealth_preference?: string | null;
  consent_contact?: boolean | null;
  lead_source?: string | null;
  source?: string | null;
  campaign_source?: string | null;
  qualification_score?: number | null;
  urgency_score?: number | null;
  status?: string | null;
  notes?: string | null;
  created_at?: string | null;
  active_assignment?: {
    clinic_id: string;
    status?: string | null;
    Clinic?: { id: string; name: string } | null;
  } | null;
};

async function patientJson<T>(input: RequestInfo, init?: RequestInit): Promise<T> {
  const r = await fetch(input, init);
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(data.error ?? "Patient leads request failed.");
  return data as T;
}

function normalizePreferredContact(value?: string | null): PatientLead["preferredContact"] {
  const v = (value ?? "phone").toLowerCase();
  if (v === "email" || v === "sms" || v === "phone") return v;
  if (v.includes("email")) return "email";
  if (v.includes("sms") || v.includes("text")) return "sms";
  return "phone";
}

function normalizeInsurance(value?: string | null): PatientLead["insurancePreference"] {
  const v = (value ?? "").toLowerCase();
  if (v.includes("self") || v.includes("cash")) return "self_pay";
  if (v.includes("insur")) return "insurance";
  return "unsure";
}

function parseTelehealthPreference(value?: string | null): boolean {
  if (!value) return false;
  const v = value.toLowerCase();
  return v === "true" || v === "yes" || v === "1" || v.includes("telehealth") || v.includes("remote");
}

function mapDbPatientLead(row: DbPatientLeadRow): PatientLead {
  const name = `${row.first_name?.trim() ?? ""} ${row.last_name?.trim() ?? ""}`.trim() || "Unknown";
  const clinic = row.active_assignment?.Clinic;

  return {
    id: row.id,
    name,
    email: row.email ?? undefined,
    phone: row.phone ?? undefined,
    city: row.city ?? undefined,
    state: row.state ?? undefined,
    zip: row.zip ?? undefined,
    treatmentInterest: row.treatment_interest ?? "unknown",
    symptoms: row.symptoms ?? undefined,
    preferredContact: normalizePreferredContact(row.preferred_contact),
    insurancePreference: normalizeInsurance(row.insurance_preference),
    telehealthPreference: parseTelehealthPreference(row.telehealth_preference),
    consentStatus: row.consent_contact ? "opted_in" : "unknown",
    leadSource: row.lead_source ?? row.source ?? "direct",
    campaignSource: row.campaign_source ?? undefined,
    qualificationScore: row.qualification_score ?? 0,
    urgencyScore: row.urgency_score ?? 0,
    status: (row.status ?? "new") as PatientLead["status"],
    assignedClinicId: clinic?.id ?? row.active_assignment?.clinic_id,
    assignedClinicName: clinic?.name,
    referralStatus: row.active_assignment?.status ?? undefined,
    notes: row.notes ?? undefined,
    createdAt: row.created_at ?? new Date().toISOString(),
  };
}

export const patientService = {
  listLeads(status?: string): Promise<{ leads: PatientLead[] }> {
    const qs = status ? `?status=${encodeURIComponent(status)}` : "";
    return patientJson<{ leads: DbPatientLeadRow[] }>(`/api/patient-leads${qs}`).then((data) => ({
      leads: (data.leads ?? []).map(mapDbPatientLead),
    }));
  },
  assignLead(leadId: string, clinicId: string, explanation?: string) {
    return patientJson<{ ok: boolean; message?: string }>(
      `/api/patient-leads/${encodeURIComponent(leadId)}/assign`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clinicId, explanation: explanation ?? null }),
      },
    );
  },
  getMatches(leadId: string): Promise<{ matches: ClinicMatch[] }> {
    const matches = mocks.mockClinicMatches.filter((m) => m.patientLeadId === leadId);
    return mockAsync({ matches });
  },
};

// ---------------------------------------------------------------------------
// Demand Intelligence Service
// ---------------------------------------------------------------------------
export const demandService = {
  listMarkets(type?: string): Promise<{ markets: MarketData[] }> {
    let markets = [...mocks.mockMarkets];
    if (type) markets = markets.filter((m) => m.type === type);
    return mockAsync({ markets });
  },
};

// ---------------------------------------------------------------------------
// Campaign Service
// ---------------------------------------------------------------------------
export const campaignService = {
  list(status?: string): Promise<{ campaigns: Campaign[] }> {
    let campaigns = [...mocks.mockCampaigns];
    if (status) campaigns = campaigns.filter((c) => c.status === status);
    return mockAsync({ campaigns });
  },
};

// ---------------------------------------------------------------------------
// Workforce Service
// ---------------------------------------------------------------------------
export const workforceService = {
  listProfessionals(): Promise<{ professionals: Professional[] }> {
    if (!appConfig.liveWorkforce) return mockAsync({ professionals: markDemo(mocks.mockProfessionals) as Professional[] });
    return workforceJson<{ professionals: Professional[] }>("/api/workforce?resource=professionals");
  },
  listDocuments(): Promise<{ documents: ProfessionalDocument[] }> {
    if (!appConfig.liveWorkforce) return mockAsync({ documents: [] });
    return workforceJson<{ documents: ProfessionalDocument[] }>("/api/workforce?resource=documents");
  },
  listJobs(): Promise<{ jobs: JobListing[] }> {
    if (!appConfig.liveWorkforce) return mockAsync({ jobs: markDemo(mocks.mockJobs) as JobListing[] });
    return workforceJson<{ jobs: JobListing[] }>("/api/workforce?resource=jobs");
  },
  listApplications(): Promise<{ applications: JobApplication[] }> {
    if (!appConfig.liveWorkforce) return mockAsync({ applications: markDemo(mocks.mockApplications) as JobApplication[] });
    return workforceJson<{ applications: JobApplication[] }>("/api/workforce?resource=applications");
  },
  listClinicClaims(): Promise<{ claims: ClinicClaim[] }> {
    if (!appConfig.liveWorkforce) return mockAsync({ claims: [] });
    return workforceJson<{ claims: ClinicClaim[] }>("/api/workforce?resource=clinic-claims");
  },
  setProfessionalReviewStatus(profileId: string, reviewStatus: string, reason?: string) {
    return workforceJson<{ profile: unknown }>(`/api/workforce/professionals/${encodeURIComponent(profileId)}/review`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reviewStatus, reason }),
    });
  },
  setDocumentVerification(documentId: string, status: "pending" | "verified" | "rejected", reason?: string) {
    return workforceJson<{ document: unknown }>(`/api/workforce/documents/${encodeURIComponent(documentId)}/verification`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status, reason }),
    });
  },
  reviewProfessionalCredentials(profileId: string, action: "verify" | "reject", reason?: string) {
    return workforceJson<{ documents: unknown[]; updatedCount: number }>(
      `/api/workforce/professionals/${encodeURIComponent(profileId)}/credentials`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, reason }),
      },
    );
  },
  reviewClinicClaim(claimId: string, action: "approve" | "reject" | "revoke", notes?: string) {
    return workforceJson<{ claim: ClinicClaim }>(`/api/workforce/clinic-claims/${encodeURIComponent(claimId)}/review`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, notes }),
    });
  },
};

// ---------------------------------------------------------------------------
// Marketplace Service
// ---------------------------------------------------------------------------
export const marketplaceService = {
  listProducts(): Promise<{ products: Product[] }> {
    if (appConfig.dataMode === "demo") return mockAsync({ products: markDemo(mocks.mockProducts) as Product[] });
    return fetch("/api/marketplace/products").then((r) => { if (!r.ok) throw new Error("Unable to load products"); return r.json(); }).then((live) => appConfig.hybridMode ? { products: [...live.products, ...markDemo(mocks.mockProducts)] } : live);
  },
  listOrders(): Promise<{ orders: Order[] }> {
    return mockAsync({ orders: mocks.mockOrders });
  },
};

// ---------------------------------------------------------------------------
// Content Service
// ---------------------------------------------------------------------------
async function contentJson<T>(input: RequestInfo, init?: RequestInit): Promise<T> {
  const r = await fetch(input, init);
  const data = await r.json().catch(() => ({}));
  if (!r.ok) {
    const err = new Error(data.error ?? "Content request failed.") as Error & {
      status?: number;
      conflict?: boolean;
      article?: unknown;
    };
    err.status = r.status;
    err.conflict = Boolean(data.conflict);
    err.article = data.article;
    throw err;
  }
  return data as T;
}

export const contentService = {
  listArticles(status?: string): Promise<{ articles: Article[] }> {
    if (appConfig.dataMode === "demo") {
      let articles = [...mocks.mockArticles];
      if (status) articles = articles.filter((a) => a.status === status);
      return mockAsync({ articles });
    }
    const qs = status ? `?status=${encodeURIComponent(status)}` : "";
    return contentJson<{ articles: Article[] }>(`/api/content/articles${qs}`).then((live) =>
      appConfig.hybridMode
        ? { articles: [...live.articles, ...mocks.mockArticles] }
        : live,
    );
  },

  getArticle(id: string) {
    return contentJson<{
      article: import("@/lib/journal-article-v1").JournalArticleV1;
      seo: { score: number; checks: { id: string; label: string; ok: boolean }[] };
    }>(`/api/content/articles/${id}`);
  },

  createArticle(input: Record<string, unknown>) {
    return contentJson<{ article: import("@/lib/journal-article-v1").JournalArticleV1 }>(
      "/api/content/articles",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      },
    );
  },

  updateArticle(id: string, input: Record<string, unknown>) {
    return contentJson<{
      article: import("@/lib/journal-article-v1").JournalArticleV1;
      seo: { score: number; checks: { id: string; label: string; ok: boolean }[] };
    }>(`/api/content/articles/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
  },

  /** Optimistic autosave; uses dedicated route that stamps changeSummary=Autosave. */
  autosaveArticle(id: string, input: Record<string, unknown>) {
    return contentJson<{
      article: import("@/lib/journal-article-v1").JournalArticleV1;
      seo: { score: number; checks: { id: string; label: string; ok: boolean }[] };
    }>(`/api/content/articles/${id}/autosave`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
  },

  articleAction(
    id: string,
    body:
      | { action: "publish" | "unpublish" | "archive" | "review" | "approve"; rowVersion?: number }
      | { action: "schedule"; scheduledFor: string; rowVersion?: number }
      | { action: "duplicate" },
  ) {
    return contentJson<{ article: import("@/lib/journal-article-v1").JournalArticleV1 }>(
      `/api/content/articles/${id}/actions`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      },
    );
  },

  listRevisions(id: string) {
    return contentJson<{
      revisions: Array<{
        id: string;
        revision_number: number;
        row_version: number;
        change_summary: string | null;
        created_at: string;
      }>;
    }>(`/api/content/articles/${id}/revisions`);
  },

  restoreRevision(id: string, revisionId: string) {
    return contentJson<{ article: import("@/lib/journal-article-v1").JournalArticleV1 }>(
      `/api/content/articles/${id}/revisions`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ revisionId }),
      },
    );
  },

  createPreviewToken(id: string, ttlSeconds?: number) {
    return contentJson<{ previewUrl: string; expiresInSeconds: number }>(
      `/api/content/articles/${id}/preview-token`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ttlSeconds }),
      },
    );
  },

  listMedia(articleId?: string) {
    const qs = articleId ? `?articleId=${encodeURIComponent(articleId)}` : "";
    return contentJson<{ media: Array<Record<string, unknown>> }>(`/api/content/media${qs}`);
  },

  async uploadMedia(form: FormData) {
    return contentJson<{ media: Record<string, unknown> }>("/api/content/media", {
      method: "POST",
      body: form,
    });
  },

  attachMedia(input: {
    articleId: string;
    mediaId: string;
    role?: "hero" | "inline" | "social" | "attachment";
  }) {
    return contentJson<{ ok: boolean }>("/api/content/media/attach", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
  },

  researchKeywords(input: {
    seedKeyword: string;
    additionalKeywords?: string[];
    topic?: string;
    locationName?: string;
    languageCode?: string;
    limit?: number;
  }) {
    return contentJson<{
      provider: "dataforseo" | "ai";
      providerLabel: string;
      metricsAvailable: boolean;
      keywords: {
        primary: string | null;
        secondary: string[];
      };
      suggestions?: Array<Record<string, unknown>>;
      notice?: string | null;
    }>("/api/content/keywords", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
  },
};

// ---------------------------------------------------------------------------
// Content Generation Service (GLM long-form)
// ---------------------------------------------------------------------------
export interface GenerationProvenanceSummary {
  model: string;
  attempts: number;
  durationMs: number;
  /** True when the event was persisted onto the draft's provenance log. */
  persisted: boolean;
}

async function postGeneration<T>(path: string, payload: unknown): Promise<T> {
  const r = await fetch(`/api/content/generate/${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(data.error ?? "Generation request failed.");
  return data as T;
}

/**
 * GLM long-form generation. Always live (no mock mode) and always
 * non-destructive: results are returned for the editor to explicitly apply;
 * nothing here writes draft content.
 */
export const contentGenerationService = {
  generateOutline(input: import("@/lib/content/generation-types").OutlineRequest) {
    return postGeneration<{
      outline: import("@/lib/content/generation-types").GeneratedOutline;
      provenance: GenerationProvenanceSummary;
    }>("outline", input);
  },
  generateArticle(input: import("@/lib/content/generation-types").ArticleRequest) {
    return postGeneration<{
      article: import("@/lib/content/generation-types").GeneratedArticle;
      provenance: GenerationProvenanceSummary;
    }>("article", input);
  },
  generateSection(input: import("@/lib/content/generation-types").SectionRequest) {
    return postGeneration<{
      section: import("@/lib/content/generation-types").GeneratedSectionResult;
      provenance: GenerationProvenanceSummary;
    }>("section", input);
  },
  suggestSeo(input: import("@/lib/content/generation-types").SeoRequest) {
    return postGeneration<{
      seo: import("@/lib/content/generation-types").SeoSuggestions;
      provenance: GenerationProvenanceSummary;
    }>("seo", input);
  },
};

// ---------------------------------------------------------------------------
// Automation Service
// ---------------------------------------------------------------------------
export const automationService = {
  list(): Promise<{ automations: Automation[] }> {
    return mockAsync({ automations: mocks.mockAutomations });
  },
  listAIUsage(): Promise<{ records: AIUsageRecord[] }> {
    return mockAsync({ records: mocks.mockAIUsage });
  },
};

// ---------------------------------------------------------------------------
// Settings / System Service
// ---------------------------------------------------------------------------
export const settingsService = {
  listIntegrations(): Promise<{ integrations: Integration[] }> {
    if (appConfig.mockMode) return mockAsync({ integrations: mocks.mockIntegrations });
    return fetch("/api/settings").then((r) => r.json());
  },
  listAuditEvents(): Promise<{ events: AuditEvent[] }> {
    if (appConfig.mockMode) return mockAsync({ events: mocks.mockAuditEvents });
    return fetch("/api/activity?limit=100")
      .then((r) => r.json())
      .then((payload) => {
        const rows = Array.isArray(payload.activities) ? payload.activities : [];
        const events: AuditEvent[] = rows.map((row: Record<string, unknown>) => {
          const admin = (row.admin as { firstName?: string; lastName?: string } | null) ?? null;
          const actor =
            [admin?.firstName, admin?.lastName].filter(Boolean).join(" ").trim() ||
            (typeof row.adminId === "string" ? row.adminId : "System");
          return {
            id: String(row.id),
            actorName: actor,
            action: String(row.summary || row.action || "activity"),
            resourceType: String(row.entityType || "unknown"),
            resourceId: row.entityId ? String(row.entityId) : undefined,
            timestamp: String(row.timestamp || new Date().toISOString()),
            metadata:
              row.metadata && typeof row.metadata === "object"
                ? (row.metadata as Record<string, unknown>)
                : undefined,
          };
        });
        return { events };
      });
  },
};

// ---------------------------------------------------------------------------
// Notification Service
// ---------------------------------------------------------------------------
export const notificationService = {
  list(): Promise<{ notifications: NotificationItem[] }> {
    if (appConfig.mockMode) return mockAsync({ notifications: mocks.mockNotifications });
    return fetch("/api/notifications").then((r) => r.json());
  },
};

// ---------------------------------------------------------------------------
// Activity Service
// ---------------------------------------------------------------------------
export const activityService = {
  list(entityType?: string): Promise<{ activities: ActivityEvent[] }> {
    if (appConfig.mockMode) {
      let activities = [...mocks.mockActivities];
      if (entityType) activities = activities.filter((a) => a.entityType === entityType);
      return mockAsync({ activities });
    }
    const qs = entityType ? `?entityType=${entityType}` : "";
    return fetch(`/api/activity${qs}`).then((r) => r.json());
  },
};

// ---------------------------------------------------------------------------
// Dashboard / KPI Service
// ---------------------------------------------------------------------------
export const dashboardService = {
  getOverview(): Promise<{
    metrics: Record<string, number>;
    conversionMetrics: Record<string, number>;
    priorities: { label: string; count: number; href: string; tone: string }[];
    pipelineSnapshot: { stage: string; label: string; count: number }[];
    todayFollowUps: FollowUpTask[];
    overdueTasks: FollowUpTask[];
    recentActivity: ActivityEvent[];
    recentCalls: CallSession[];
    dealAlerts: { id: string; name: string; risk: string }[];
    patientDemandAlerts: { id: string; text: string }[];
    nextBestCall: Clinic | null;
  }> {
    if (appConfig.demoOperations) {
      const readyToCall = mocks.mockClinics.filter((c) => c.pipelineStage === "ready_to_call").length;
      const interested = mocks.mockClinics.filter((c) => c.interested).length;
      const meetingsBooked = mocks.mockClinics.filter((c) => c.pipelineStage === "meeting_booked").length;
      const proposalsOutstanding = mocks.mockDeals.filter((d) => d.stage === "proposal_sent").length;
      const activeDeals = mocks.mockDeals.filter((d) => d.stage !== "won" && d.stage !== "lost").length;
      const pipelineValue = mocks.mockDeals.filter((d) => d.stage !== "won" && d.stage !== "lost").reduce((s, d) => s + d.estimatedTotalValue, 0);
      const revenueWon = mocks.mockDeals.filter((d) => d.stage === "active" || d.stage === "won").reduce((s, d) => s + d.estimatedTotalValue, 0);
      const patientLeads = mocks.mockPatientLeads.length;
      const qualifiedLeads = mocks.mockPatientLeads.filter((l) => l.status === "qualified" || l.status === "routed" || l.status === "booked").length;
      const followUpsDue = mocks.mockFollowUps.filter((t) => t.status === "open" || t.status === "in_progress").filter((t) => t.dueDate && new Date(t.dueDate).toDateString() === new Date().toDateString()).length;
      const overdueFollowUps = mocks.mockFollowUps.filter((t) => (t.status === "open" || t.status === "in_progress") && t.dueDate && new Date(t.dueDate) < new Date(new Date().setHours(0, 0, 0, 0))).length;
      const decisionMakers = mocks.mockClinics.reduce((s, c) => s + c.contacts.filter((ct) => ct.isDecisionMaker).length, 0);
      const callsCompletedToday = mocks.mockCalls.filter((c) => c.answered && new Date(c.startedAt).toDateString() === new Date().toDateString()).length;

      const overview = {
        metrics: {
          readyToCall, callsCompletedToday: 3, followUpsDue, overdueFollowUps,
          decisionMakersReached: decisionMakers, meetingsBooked, interestedClinics: interested,
          activeOpportunities: activeDeals, proposalsOutstanding, estimatedPipelineValue: pipelineValue,
          revenueWon, patientLeads, qualifiedPatientLeads: qualifiedLeads, clinicCount: mocks.mockClinics.length,
        },
        conversionMetrics: {
          dialToConnect: 42, connectToConversation: 68, conversationToInterest: 35,
          interestToMeeting: 55, meetingToProposal: 72, proposalToClose: 48,
          leadToBooking: 28, followUpCompletion: 81, avgDealValue: 61800, avgSalesCycle: 21,
        },
        priorities: [
          { label: "Call ready-to-call clinics", count: readyToCall, href: "call-queue", tone: "teal" },
          { label: "Complete overdue follow-ups", count: overdueFollowUps, href: "follow-ups", tone: "rose" },
          { label: "Complete today's follow-ups", count: followUpsDue, href: "follow-ups", tone: "amber" },
          { label: "Review interested clinics", count: interested, href: "clinics", tone: "teal" },
          { label: "Send requested proposals", count: proposalsOutstanding, href: "deals", tone: "amber" },
          { label: "Route unassigned patient leads", count: 6, href: "patient-leads", tone: "violet" },
          { label: "Review failed automations", count: 1, href: "automation", tone: "rose" },
        ],
        pipelineSnapshot: [
          { stage: "ready_to_call", label: "Ready to Call", count: 2 },
          { stage: "attempted", label: "Attempted", count: 1 },
          { stage: "connected", label: "Connected", count: 1 },
          { stage: "follow_up_required", label: "Follow-Up Required", count: 1 },
          { stage: "meeting_booked", label: "Meeting Booked", count: 1 },
          { stage: "interested", label: "Interested", count: 1 },
          { stage: "proposal_sent", label: "Proposal Sent", count: 1 },
          { stage: "paid", label: "Paid", count: 1 },
        ],
        todayFollowUps: mocks.mockFollowUps.filter((t) => t.dueDate && new Date(t.dueDate).toDateString() === new Date().toDateString()),
        overdueTasks: mocks.mockFollowUps.filter((t) => (t.status === "open" || t.status === "in_progress") && t.dueDate && new Date(t.dueDate) < new Date(new Date().setHours(0, 0, 0, 0))),
        recentActivity: mocks.mockActivities.slice(0, 8),
        recentCalls: mocks.mockCalls.slice(0, 5),
        dealAlerts: [
          { id: "deal_1", name: "Summit Vitality — Annual Partnership", risk: "Proposal outstanding 2 days" },
          { id: "deal_7", name: "Rocky Mountain — Directory Trial", risk: "Negotiation stalled 8 days" },
        ],
        patientDemandAlerts: [
          { id: "pa1", text: "Miami, FL — 94 demand / 5 supply (gap: 89)" },
          { id: "pa2", text: "75201 ZIP — Rising 34% in search volume" },
        ],
        nextBestCall: mocks.mockClinics.find((c) => c.pipelineStage === "ready_to_call" && c.priority === "high") ?? mocks.mockClinics.find((c) => c.pipelineStage === "ready_to_call") ?? null,
      };
      if (appConfig.liveClinics) {
        return Promise.all([
          clinicService.list({ page: 1, pageSize: 1 }),
          clinicService.list({ stage: "ready_to_call", page: 1, pageSize: 1 }),
        ]).then(([all, ready]) => ({
          ...overview,
          metrics: { ...overview.metrics, clinicCount: all.total, readyToCall: ready.total },
          priorities: [
            ...(ready.total ? [{ label: "Call real clinic accounts", count: ready.total, href: "call-queue", tone: "teal" }] : []),
            ...overview.priorities.filter((p) => p.href !== "call-queue"),
          ],
          pipelineSnapshot: overview.pipelineSnapshot.map((stage) =>
            stage.stage === "ready_to_call" ? { ...stage, count: ready.total } : stage
          ),
          nextBestCall: ready.clinics[0] ?? null,
        }));
      }
      return mockAsync(overview);
    }
    return fetch("/api/dashboard").then((r) => r.json());
  },
};

// Re-export KPIMetric type for convenience
export type { KPIMetric };
