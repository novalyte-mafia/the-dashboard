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
  PatientLead, ClinicMatch, MarketData, Campaign, Professional, JobListing,
  JobApplication, Product, Order, Article, Automation, AIUsageRecord,
  Integration, AuditEvent, NotificationItem, ActivityEvent, KPIMetric,
} from "@/types";

// Helper: simulate async fetch latency for realism in mock mode
function mockAsync<T>(data: T, ms = 120): Promise<T> {
  return new Promise((resolve) => setTimeout(() => resolve(data), ms));
}

function markDemo<T>(records: T[]): (T & { dataSource: "demo" })[] {
  return records.map((record) => ({ ...(record as object), dataSource: "demo" as const }) as T & { dataSource: "demo" });
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
    return mockAsync({ calls: mocks.mockCalls });
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
export const patientService = {
  listLeads(status?: string): Promise<{ leads: PatientLead[] }> {
    let leads = [...mocks.mockPatientLeads];
    if (status) leads = leads.filter((l) => l.status === status);
    return mockAsync({ leads });
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
    if (appConfig.dataMode === "demo") return mockAsync({ professionals: markDemo(mocks.mockProfessionals) as Professional[] });
    return fetch("/api/workforce?resource=professionals").then((r) => { if (!r.ok) throw new Error("Unable to load professionals"); return r.json(); }).then((live) => appConfig.hybridMode ? { professionals: [...live.professionals, ...markDemo(mocks.mockProfessionals)] } : live);
  },
  listJobs(): Promise<{ jobs: JobListing[] }> {
    if (appConfig.dataMode === "demo") return mockAsync({ jobs: markDemo(mocks.mockJobs) as JobListing[] });
    return fetch("/api/workforce?resource=jobs").then((r) => { if (!r.ok) throw new Error("Unable to load jobs"); return r.json(); }).then((live) => appConfig.hybridMode ? { jobs: [...live.jobs, ...markDemo(mocks.mockJobs)] } : live);
  },
  listApplications(): Promise<{ applications: JobApplication[] }> {
    if (appConfig.dataMode === "demo") return mockAsync({ applications: markDemo(mocks.mockApplications) as JobApplication[] });
    return fetch("/api/workforce?resource=applications").then((r) => { if (!r.ok) throw new Error("Unable to load applications"); return r.json(); }).then((live) => appConfig.hybridMode ? { applications: [...live.applications, ...markDemo(mocks.mockApplications)] } : live);
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
export const contentService = {
  listArticles(status?: string): Promise<{ articles: Article[] }> {
    if (appConfig.dataMode === "demo") {
      let articles = [...mocks.mockArticles];
      if (status) articles = articles.filter((a) => a.status === status);
      return mockAsync({ articles });
    }
    const qs = status ? `?status=${encodeURIComponent(status)}` : "";
    return fetch(`/api/content/articles${qs}`).then((r) => { if (!r.ok) throw new Error("Unable to load articles"); return r.json(); }).then((live) => appConfig.hybridMode ? { articles: [...live.articles, ...mocks.mockArticles] } : live);
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
    return mockAsync({ events: mocks.mockAuditEvents });
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
