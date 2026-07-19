"use client";

import { createContext, useContext, useMemo, useState, useCallback, lazy, Suspense } from "react";
import { Sidebar } from "@/components/admin/shell/sidebar";
import { AdminHeader } from "@/components/admin/shell/header";
import { LoadingState } from "@/components/admin/shared";
import { appConfig } from "@/config/app-config";

export type AdminUser = {
  id: string;
  email: string;
  role: string;
  firstName: string;
  lastName: string;
};

export type ViewId = string; // flexible string union — all nav IDs

type NavState = {
  view: ViewId;
  clinicId: string | null;
  params?: Record<string, unknown>;
};

type NavContextValue = {
  navigate: (view: ViewId, clinicId?: string | null, params?: Record<string, unknown>) => void;
  openClinic: (clinicId: string) => void;
  refreshKey: number;
  refresh: () => void;
  admin: AdminUser;
  currentView: ViewId;
};

export const NavContext = createContext<NavContextValue | null>(null);

export function useNav() {
  const ctx = useContext(NavContext);
  if (!ctx) throw new Error("useNav must be used within AdminApp");
  return ctx;
}

// Lazy-load all views for code-splitting
const OverviewView = lazy(() => import("@/components/admin/views/overview").then((m) => ({ default: m.OverviewView })));
const PrioritiesView = lazy(() => import("@/components/admin/views/priorities").then((m) => ({ default: m.PrioritiesView })));
const RevenueOverviewView = lazy(() => import("@/components/admin/views/revenue-overview").then((m) => ({ default: m.RevenueOverviewView })));
const OperationsOverviewView = lazy(() => import("@/components/admin/views/operations-overview").then((m) => ({ default: m.OperationsOverviewView })));
const AlertsView = lazy(() => import("@/components/admin/views/alerts").then((m) => ({ default: m.AlertsView })));
const ActivityView = lazy(() => import("@/components/admin/views/activity").then((m) => ({ default: m.ActivityView })));
const ClinicsView = lazy(() => import("@/components/admin/views/clinics").then((m) => ({ default: m.ClinicsView })));
const ClinicDetailView = lazy(() => import("@/components/admin/views/clinic-detail").then((m) => ({ default: m.ClinicDetailView })));
const CallQueueView = lazy(() => import("@/components/admin/views/call-queue").then((m) => ({ default: m.CallQueueView })));
const CallConsoleView = lazy(() => import("@/components/admin/views/call-console").then((m) => ({ default: m.CallConsoleView })));
const CallsView = lazy(() => import("@/components/admin/views/calls").then((m) => ({ default: m.CallsView })));
const FollowUpsView = lazy(() => import("@/components/admin/views/follow-ups").then((m) => ({ default: m.FollowUpsView })));
const ContactsView = lazy(() => import("@/components/admin/views/contacts").then((m) => ({ default: m.ContactsView })));
const DecisionMakersView = lazy(() => import("@/components/admin/views/decision-makers").then((m) => ({ default: m.DecisionMakersView })));
const CampaignsView = lazy(() => import("@/components/admin/views/campaigns").then((m) => ({ default: m.CampaignsView })));
const CallScriptsView = lazy(() => import("@/components/admin/views/call-scripts").then((m) => ({ default: m.CallScriptsView })));
const MeetingsView = lazy(() => import("@/components/admin/views/meetings").then((m) => ({ default: m.MeetingsView })));
const ImportCenterView = lazy(() => import("@/components/admin/views/import-center").then((m) => ({ default: m.ImportCenterView })));
const DealsView = lazy(() => import("@/components/admin/views/deals").then((m) => ({ default: m.DealsView })));
const PipelineView = lazy(() => import("@/components/admin/views/pipeline").then((m) => ({ default: m.PipelineView })));
const ProposalsView = lazy(() => import("@/components/admin/views/proposals").then((m) => ({ default: m.ProposalsView })));
const ContractsView = lazy(() => import("@/components/admin/views/contracts").then((m) => ({ default: m.ContractsView })));
const RevenueView = lazy(() => import("@/components/admin/views/revenue").then((m) => ({ default: m.RevenueView })));
const PaymentsView = lazy(() => import("@/components/admin/views/payments").then((m) => ({ default: m.PaymentsView })));
const InvoicesView = lazy(() => import("@/components/admin/views/invoices").then((m) => ({ default: m.InvoicesView })));
const ConversionAnalyticsView = lazy(() => import("@/components/admin/views/conversion-analytics").then((m) => ({ default: m.ConversionAnalyticsView })));
const DirectoryView = lazy(() => import("@/components/admin/views/directory").then((m) => ({ default: m.DirectoryView })));
const ClinicOnboardingView = lazy(() => import("@/components/admin/views/clinic-onboarding").then((m) => ({ default: m.ClinicOnboardingView })));
const VerificationQueueView = lazy(() => import("@/components/admin/views/verification-queue").then((m) => ({ default: m.VerificationQueueView })));
const ProvidersView = lazy(() => import("@/components/admin/views/providers").then((m) => ({ default: m.ProvidersView })));
const TreatmentsView = lazy(() => import("@/components/admin/views/treatments").then((m) => ({ default: m.TreatmentsView })));
const DirectoryAnalyticsView = lazy(() => import("@/components/admin/views/directory-analytics").then((m) => ({ default: m.DirectoryAnalyticsView })));
const PatientLeadsView = lazy(() => import("@/components/admin/views/patient-leads").then((m) => ({ default: m.PatientLeadsView })));
const AssessmentsView = lazy(() => import("@/components/admin/views/assessments").then((m) => ({ default: m.AssessmentsView })));
const LeadRoutingView = lazy(() => import("@/components/admin/views/lead-routing").then((m) => ({ default: m.LeadRoutingView })));
const ClinicMatchingView = lazy(() => import("@/components/admin/views/clinic-matching").then((m) => ({ default: m.ClinicMatchingView })));
const PatientJourneyView = lazy(() => import("@/components/admin/views/patient-journey").then((m) => ({ default: m.PatientJourneyView })));
const ConversionFunnelView = lazy(() => import("@/components/admin/views/conversion-funnel").then((m) => ({ default: m.ConversionFunnelView })));
const DemandOverviewView = lazy(() => import("@/components/admin/views/demand-overview").then((m) => ({ default: m.DemandOverviewView })));
const GeographicDemandView = lazy(() => import("@/components/admin/views/geographic-demand").then((m) => ({ default: m.GeographicDemandView })));
const KeywordClustersView = lazy(() => import("@/components/admin/views/keyword-clusters").then((m) => ({ default: m.KeywordClustersView })));
const RisingMarketsView = lazy(() => import("@/components/admin/views/rising-markets").then((m) => ({ default: m.RisingMarketsView })));
const CoverageGapsView = lazy(() => import("@/components/admin/views/coverage-gaps").then((m) => ({ default: m.CoverageGapsView })));
const CampaignDashboardView = lazy(() => import("@/components/admin/views/campaign-dashboard").then((m) => ({ default: m.CampaignDashboardView })));
const CampaignBuilderView = lazy(() => import("@/components/admin/views/campaign-builder").then((m) => ({ default: m.CampaignBuilderView })));
const LandingPagesView = lazy(() => import("@/components/admin/views/landing-pages").then((m) => ({ default: m.LandingPagesView })));
const CreativeLibraryView = lazy(() => import("@/components/admin/views/creative-library").then((m) => ({ default: m.CreativeLibraryView })));
const BudgetManagementView = lazy(() => import("@/components/admin/views/budget-management").then((m) => ({ default: m.BudgetManagementView })));
const LeadAttributionView = lazy(() => import("@/components/admin/views/lead-attribution").then((m) => ({ default: m.LeadAttributionView })));
const WorkforceOverviewView = lazy(() => import("@/components/admin/views/workforce-overview").then((m) => ({ default: m.WorkforceOverviewView })));
const ProfessionalsView = lazy(() => import("@/components/admin/views/professionals").then((m) => ({ default: m.ProfessionalsView })));
const JobsView = lazy(() => import("@/components/admin/views/jobs").then((m) => ({ default: m.JobsView })));
const ApplicationsView = lazy(() => import("@/components/admin/views/applications").then((m) => ({ default: m.ApplicationsView })));
const CredentialsView = lazy(() => import("@/components/admin/views/credentials").then((m) => ({ default: m.CredentialsView })));
const ClinicClaimsView = lazy(() => import("@/components/admin/views/clinic-claims").then((m) => ({ default: m.ClinicClaimsView })));
const WorkforceAnalyticsView = lazy(() => import("@/components/admin/views/workforce-analytics").then((m) => ({ default: m.WorkforceAnalyticsView })));
const MarketplaceOverviewView = lazy(() => import("@/components/admin/views/marketplace-overview").then((m) => ({ default: m.MarketplaceOverviewView })));
const ProductsView = lazy(() => import("@/components/admin/views/products").then((m) => ({ default: m.ProductsView })));
const OrdersView = lazy(() => import("@/components/admin/views/orders").then((m) => ({ default: m.OrdersView })));
const VendorsView = lazy(() => import("@/components/admin/views/vendors").then((m) => ({ default: m.VendorsView })));
const MarketplaceAnalyticsView = lazy(() => import("@/components/admin/views/marketplace-analytics").then((m) => ({ default: m.MarketplaceAnalyticsView })));
const ContentOverviewView = lazy(() => import("@/components/admin/views/content-overview").then((m) => ({ default: m.ContentOverviewView })));
const ArticlesView = lazy(() => import("@/components/admin/views/articles").then((m) => ({ default: m.ArticlesView })));
const EditorialCalendarView = lazy(() => import("@/components/admin/views/editorial-calendar").then((m) => ({ default: m.EditorialCalendarView })));
const ContentStudioView = lazy(() => import("@/components/admin/views/content-studio").then((m) => ({ default: m.ContentStudioView })));
const MediaLibraryView = lazy(() => import("@/components/admin/views/media-library").then((m) => ({ default: m.MediaLibraryView })));
const SeoBriefsView = lazy(() => import("@/components/admin/views/seo-briefs").then((m) => ({ default: m.SeoBriefsView })));
const ContentPerformanceView = lazy(() => import("@/components/admin/views/content-performance").then((m) => ({ default: m.ContentPerformanceView })));
const AutomationOverviewView = lazy(() => import("@/components/admin/views/automation-overview").then((m) => ({ default: m.AutomationOverviewView })));
const AutomationsView = lazy(() => import("@/components/admin/views/automations").then((m) => ({ default: m.AutomationsView })));
const AiAssistantsView = lazy(() => import("@/components/admin/views/ai-assistants").then((m) => ({ default: m.AiAssistantsView })));
const CallCopilotKnowledgeView = lazy(() => import("@/components/admin/views/call-copilot-knowledge").then((m) => ({ default: m.CallCopilotKnowledgeView })));
const CallIntelligenceView = lazy(() => import("@/components/admin/views/call-intelligence").then((m) => ({ default: m.CallIntelligenceView })));
const LeadScoringView = lazy(() => import("@/components/admin/views/lead-scoring").then((m) => ({ default: m.LeadScoringView })));
const FailedJobsView = lazy(() => import("@/components/admin/views/failed-jobs").then((m) => ({ default: m.FailedJobsView })));
const AiCostTrackingView = lazy(() => import("@/components/admin/views/ai-cost-tracking").then((m) => ({ default: m.AiCostTrackingView })));
const ExecutiveAnalyticsView = lazy(() => import("@/components/admin/views/executive-analytics").then((m) => ({ default: m.ExecutiveAnalyticsView })));
const RevenueAnalyticsView = lazy(() => import("@/components/admin/views/revenue-analytics").then((m) => ({ default: m.RevenueAnalyticsView })));
const OutreachAnalyticsView = lazy(() => import("@/components/admin/views/outreach-analytics").then((m) => ({ default: m.OutreachAnalyticsView })));
const CallAnalyticsView = lazy(() => import("@/components/admin/views/call-analytics").then((m) => ({ default: m.CallAnalyticsView })));
const PatientAnalyticsView = lazy(() => import("@/components/admin/views/patient-analytics").then((m) => ({ default: m.PatientAnalyticsView })));
const GeographicAnalyticsView = lazy(() => import("@/components/admin/views/geographic-analytics").then((m) => ({ default: m.GeographicAnalyticsView })));
const TrafficAnalyticsView = lazy(() => import("@/components/admin/views/traffic-analytics").then((m) => ({ default: m.TrafficAnalyticsView })));
const LiveWebsiteActivityView = lazy(() => import("@/components/admin/views/live-website-activity").then((m) => ({ default: m.LiveWebsiteActivityView })));
const SettingsView = lazy(() => import("@/components/admin/views/settings").then((m) => ({ default: m.SettingsView })));
const TeamAccessView = lazy(() => import("@/components/admin/views/team-access").then((m) => ({ default: m.TeamAccessView })));
const IntegrationsView = lazy(() => import("@/components/admin/views/integrations").then((m) => ({ default: m.IntegrationsView })));
const AuditLogsView = lazy(() => import("@/components/admin/views/audit-logs").then((m) => ({ default: m.AuditLogsView })));
const FeatureFlagsView = lazy(() => import("@/components/admin/views/feature-flags").then((m) => ({ default: m.FeatureFlagsView })));
const AppHealthView = lazy(() => import("@/components/admin/views/app-health").then((m) => ({ default: m.AppHealthView })));

const VIEW_MAP: Record<string, React.ComponentType<any>> = {
  "overview": OverviewView,
  "priorities": PrioritiesView,
  "revenue-overview": RevenueOverviewView,
  "operations-overview": OperationsOverviewView,
  "alerts": AlertsView,
  "activity": ActivityView,
  "clinics": ClinicsView,
  "clinic-detail": ClinicDetailView,
  "call-queue": CallQueueView,
  "call-console": CallConsoleView,
  "calls": CallsView,
  "follow-ups": FollowUpsView,
  "contacts": ContactsView,
  "decision-makers": DecisionMakersView,
  "campaigns": CampaignsView,
  "call-scripts": CallScriptsView,
  "meetings": MeetingsView,
  "import-center": ImportCenterView,
  "deals": DealsView,
  "pipeline": PipelineView,
  "proposals": ProposalsView,
  "contracts": ContractsView,
  "revenue": RevenueView,
  "payments": PaymentsView,
  "invoices": InvoicesView,
  "conversion-analytics": ConversionAnalyticsView,
  "directory": DirectoryView,
  "clinic-onboarding": ClinicOnboardingView,
  "verification-queue": VerificationQueueView,
  "providers": ProvidersView,
  "treatments": TreatmentsView,
  "directory-analytics": DirectoryAnalyticsView,
  "patient-leads": PatientLeadsView,
  "assessments": AssessmentsView,
  "lead-routing": LeadRoutingView,
  "clinic-matching": ClinicMatchingView,
  "patient-journey": PatientJourneyView,
  "conversion-funnel": ConversionFunnelView,
  "demand-overview": DemandOverviewView,
  "geographic-demand": GeographicDemandView,
  "keyword-clusters": KeywordClustersView,
  "rising-markets": RisingMarketsView,
  "coverage-gaps": CoverageGapsView,
  "campaign-dashboard": CampaignDashboardView,
  "campaign-builder": CampaignBuilderView,
  "landing-pages": LandingPagesView,
  "creative-library": CreativeLibraryView,
  "budget-management": BudgetManagementView,
  "lead-attribution": LeadAttributionView,
  "workforce-overview": WorkforceOverviewView,
  "professionals": ProfessionalsView,
  "jobs": JobsView,
  "applications": ApplicationsView,
  "credentials": CredentialsView,
  "clinic-claims": ClinicClaimsView,
  "workforce-analytics": WorkforceAnalyticsView,
  "marketplace-overview": MarketplaceOverviewView,
  "products": ProductsView,
  "orders": OrdersView,
  "vendors": VendorsView,
  "marketplace-analytics": MarketplaceAnalyticsView,
  "content-overview": ContentOverviewView,
  "articles": ArticlesView,
  "editorial-calendar": EditorialCalendarView,
  "content-studio": ContentStudioView,
  "media-library": MediaLibraryView,
  "seo-briefs": SeoBriefsView,
  "content-performance": ContentPerformanceView,
  "automation-overview": AutomationOverviewView,
  "automations": AutomationsView,
  "ai-assistants": AiAssistantsView,
  "call-copilot-knowledge": CallCopilotKnowledgeView,
  "call-intelligence": CallIntelligenceView,
  "lead-scoring": LeadScoringView,
  "failed-jobs": FailedJobsView,
  "ai-cost-tracking": AiCostTrackingView,
  "executive-analytics": ExecutiveAnalyticsView,
  "revenue-analytics": RevenueAnalyticsView,
  "outreach-analytics": OutreachAnalyticsView,
  "call-analytics": CallAnalyticsView,
  "patient-analytics": PatientAnalyticsView,
  "geographic-analytics": GeographicAnalyticsView,
  "traffic-analytics": TrafficAnalyticsView,
  "live-website-activity": LiveWebsiteActivityView,
  "settings": SettingsView,
  "team-access": TeamAccessView,
  "integrations": IntegrationsView,
  "audit-logs": AuditLogsView,
  "feature-flags": FeatureFlagsView,
  "app-health": AppHealthView,
};

export function AdminApp({ admin }: { admin: AdminUser }) {
  const [nav, setNav] = useState<NavState>({ view: "overview", clinicId: null });
  const [refreshKey, setRefreshKey] = useState(0);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(true);

  const navigate = useCallback((view: ViewId, clinicId: string | null = null, params?: Record<string, unknown>) => {
    setNav({ view, clinicId, params });
    if (typeof window !== "undefined") window.scrollTo({ top: 0 });
  }, []);

  const openClinic = useCallback((clinicId: string) => {
    setNav({ view: "clinic-detail", clinicId });
    if (typeof window !== "undefined") window.scrollTo({ top: 0 });
  }, []);

  const refresh = useCallback(() => setRefreshKey((k) => k + 1), []);

  const ctx = useMemo(
    () => ({ navigate, openClinic, refreshKey, refresh, admin, currentView: nav.view }),
    [navigate, openClinic, refreshKey, refresh, admin, nav.view]
  );

  const ViewComponent = VIEW_MAP[nav.view] ?? OverviewView;

  return (
    <NavContext.Provider value={ctx}>
      <div className="min-h-screen flex flex-col bg-background">
        {/* Internal system indicator bar */}
        <div className="bg-amber-50 border-b border-amber-200 text-amber-800 text-[11px] py-1 px-4 text-center font-medium">
          Private Internal System — Authorized Access Only · noindex · nofollow
        </div>
        {appConfig.dataMode !== "live" && (
          <div className="bg-slate-900 text-white text-[11px] py-1.5 px-4 text-center font-medium">
            {appConfig.dataMode === "demo"
              ? "DEMO MODE — records are local fixtures; operational actions are disabled."
              : "HYBRID MODE — live records and demo fixtures are intentionally separated."}
          </div>
        )}
        <div className="flex flex-1 min-h-0">
          <Sidebar
            collapsed={sidebarCollapsed}
            onCollapsedChange={setSidebarCollapsed}
            currentView={nav.view}
          />
          <div className="flex-1 flex flex-col min-w-0">
            <AdminHeader
              admin={admin}
              onOpenLogCall={() => navigate("calls")}
            />
            <main className="flex-1 overflow-y-auto nv-scroll">
              <div className="mx-auto max-w-[1400px] px-4 sm:px-6 py-6">
                <Suspense fallback={<LoadingState label="Loading module…" />}>
                  <ViewComponent clinicId={nav.clinicId} params={nav.params} />
                </Suspense>
              </div>
            </main>
          </div>
        </div>
        <footer className="border-t border-border/70 bg-card/50 py-3 px-6">
          <div className="mx-auto max-w-[1400px] flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-muted-foreground">
            <span>Novalyte Admin · Revenue Command Center · {appConfig.dataMode === "hybrid" ? "Hybrid Mode (Live + Demo)" : appConfig.mockMode ? "Demo Mode" : "Live Mode"}</span>
            <span className="flex items-center gap-3">
              <span>© {new Date().getFullYear()} Novalyte AI</span>
            </span>
          </div>
        </footer>

      </div>
    </NavContext.Provider>
  );
}
