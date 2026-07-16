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
    if (appConfig.mockMode) {
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
  getById(id: string): Promise<{ clinic: Clinic }> {
    if (appConfig.mockMode) {
      const clinic = mocks.mockClinics.find((c) => c.id === id);
      return mockAsync({ clinic: clinic as Clinic });
    }
    return fetch(`/api/clinics/${id}`).then((r) => r.json());
  },
  search(q: string): Promise<{ results: { id: string; name: string; city?: string; state?: string; primaryPhone?: string; generalEmail?: string }[] }> {
    if (appConfig.mockMode) {
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
    if (appConfig.mockMode) {
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
    if (appConfig.mockMode) {
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
    if (appConfig.mockMode) {
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
    let profiles = [...mocks.mockDirectory];
    if (stage) profiles = profiles.filter((p) => p.listingStatus === stage);
    return mockAsync({ profiles });
  },
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
    return mockAsync({ professionals: mocks.mockProfessionals });
  },
  listJobs(): Promise<{ jobs: JobListing[] }> {
    return mockAsync({ jobs: mocks.mockJobs });
  },
  listApplications(): Promise<{ applications: JobApplication[] }> {
    return mockAsync({ applications: mocks.mockApplications });
  },
};

// ---------------------------------------------------------------------------
// Marketplace Service
// ---------------------------------------------------------------------------
export const marketplaceService = {
  listProducts(): Promise<{ products: Product[] }> {
    return mockAsync({ products: mocks.mockProducts });
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
    let articles = [...mocks.mockArticles];
    if (status) articles = articles.filter((a) => a.status === status);
    return mockAsync({ articles });
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
    return mockAsync({ integrations: mocks.mockIntegrations });
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
    return mockAsync({ notifications: mocks.mockNotifications });
  },
};

// ---------------------------------------------------------------------------
// Activity Service
// ---------------------------------------------------------------------------
export const activityService = {
  list(entityType?: string): Promise<{ activities: ActivityEvent[] }> {
    let activities = [...mocks.mockActivities];
    if (entityType) activities = activities.filter((a) => a.entityType === entityType);
    return mockAsync({ activities });
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

    return mockAsync({
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
    });
  },
};

// Re-export KPIMetric type for convenience
export type { KPIMetric };
