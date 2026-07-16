# Novalyte Admin — Platform Expansion Worklog

---
Task ID: F
Agent: Main (Claude)
Task: Foundation — config, types, mocks, services, shared components, Jamil Yakasai identity, new sidebar/shell

Work Log:
- Inspected entire codebase structure and existing architecture
- Fixed founder identity: Jordan Ellis → Jamil Yakasai (JY) across page.tsx, seed.ts, and live DB
- Created src/config/app-config.ts with mockMode flag, brand config (Jamil Yakasai), feature flags
- Created src/types/index.ts with all shared domain types (Clinic, Contact, Call, Deal, PatientLead, MarketData, Campaign, Professional, Job, Product, Order, Article, Automation, etc.)
- Created src/mocks/index.ts with realistic men's-health mock data (16 clinics, 8 calls, 11 follow-ups, 8 deals, 24 patient leads, 13 markets, 6 campaigns, 6 professionals, 4 jobs, 6 products, 6 orders, 8 articles, 6 automations, notifications, activities, audit events, integrations)
- Created src/services/index.ts with service layer (clinicService, callService, followUpService, dealService, directoryService, patientService, demandService, campaignService, workforceService, marketplaceService, contentService, automationService, settingsService, notificationService, activityService, dashboardService) — switches between mock and real API based on appConfig.mockMode
- Created src/components/admin/shared/index.tsx with reusable components: PageHeader, MetricCard, SectionCard, EmptyState, LoadingState, TableSkeleton, FilterBar, DataTable, StatusBadge, PriorityBadge, ScoreBadge, SavedViewSelector, ActivityTimeline, DetailDrawer, ConfirmationDialog, FormSection, ChartCard
- Created src/components/admin/shell/sidebar.tsx with 13 grouped collapsible nav sections (~80 nav items)
- Created src/components/admin/shell/header.tsx with global search (clinic + quick actions), notifications, user menu
- Rewrote src/components/admin/admin-app.tsx with lazy-loaded view registry (~90 views), internal-system indicator bar, updated footer showing mock/live mode

Stage Summary:
- Foundation complete: mock-mode architecture, centralized data, shared component library, grouped sidebar
- All views will be lazy-loaded via React.lazy for code-splitting
- ViewId is now a flexible string — VIEW_MAP routes view IDs to components
- Subagents will build individual view files that import from services/ and shared/
- Key files: config/app-config.ts, types/index.ts, mocks/index.ts, services/index.ts, components/admin/shared/index.tsx, components/admin/shell/sidebar.tsx, components/admin/shell/header.tsx, components/admin/admin-app.tsx

---
Task ID: E-F2
Agent: Views Builder (Patient + Demand + Growth)
Task: Built 17 view components for Patient Operations, Demand Intelligence, and Growth & Advertising modules

Work Log:
- Patient Operations (6 views):
  - patient-leads.tsx → PatientLeadsView — full DataTable with filters (status/treatment/source/state), score badges, detail drawer with "Match with Clinics" CTA
  - assessments.tsx → AssessmentsView — intake submissions table with derived assessment status (new/reviewed/qualified/disqualified), score badges
  - lead-routing.tsx → LeadRoutingView — queue of status='new' leads with Route/Match/Reassign/Disqualify actions and confirmation dialog
  - clinic-matching.tsx → ClinicMatchingView — lead selector + match cards with 6 fit-dimension bars (geographic/treatment/capacity/telehealth/booking/price), Approve/Reject/Route actions; accepts `params.leadId`
  - patient-journey.tsx → PatientJourneyView — 5-stage timeline cards with stage-completion indicators, lifecycle chart, lost-state banner
  - conversion-funnel.tsx → ConversionFunnelView — visual narrowing funnel, stage-transition rates, drop-off hotspot detection, overall conversion metric

- Demand Intelligence (5 views):
  - demand-overview.tsx → DemandOverviewView — KPI cards (volume/CPC/rising/opportunity), top markets table, bar chart
  - geographic-demand.tsx → GeographicDemandView — state heat-map tiles (teal intensity by opp score), drill-down to city-level table, state ranking
  - keyword-clusters.tsx → KeywordClustersView — flattened keywords from mockMarkets, classified by treatment category, grouped sections, competition scores
  - rising-markets.tsx → RisingMarketsView — markets filtered by rising=true, sorted by trend %, ranked cards with stat grids
  - coverage-gaps.tsx → CoverageGapsView — markets sorted by supplyDemandGap desc, demand-vs-supply visual bars, "Find Clinics" action with toast; accepts `params.marketId`

- Growth & Advertising (6 views):
  - campaign-dashboard.tsx → CampaignDashboardView — KPI cards (spend/leads/CPL/active), over-budget alerts, platform-spend chart, full campaign table with progress bars
  - campaign-builder.tsx → CampaignBuilderView — 5-step wizard (Details/Targeting/Budget/Creative/Review) with step indicator, state-picker chips, budget estimator, launch confirmation dialog
  - landing-pages.tsx → LandingPagesView — mock landing page table with visits/conversions/conv-rate/bounce-rate, status badges, external URL links
  - creative-library.tsx → CreativeLibraryView — grid/table toggle, creative cards by type (image/video/text/carousel) with thumbnail placeholders and performance metrics
  - budget-management.tsx → BudgetManagementView — accepts `params.campaignId`, platform breakdown bars, over-budget alerts, per-campaign utilization bars with color-coded thresholds
  - lead-attribution.tsx → LeadAttributionView — leads grouped by leadSource, two bar charts (leads/qualified by source), top-3 source cards with stage-by-stage breakdown, auto-generated insights

Stage Summary:
- All 17 views built as separate files in src/components/admin/views/
- All exports match the lazy-imported names in admin-app.tsx (PatientLeadsView, AssessmentsView, LeadRoutingView, ClinicMatchingView, PatientJourneyView, ConversionFunnelView, DemandOverviewView, GeographicDemandView, KeywordClustersView, RisingMarketsView, CoverageGapsView, CampaignDashboardView, CampaignBuilderView, LandingPagesView, CreativeLibraryView, BudgetManagementView, LeadAttributionView)
- Three views (clinic-matching, coverage-gaps, budget-management) accept `params` prop to support deep-linking via navigate(view, null, params)
- All views use the service layer (patientService, demandService, campaignService) — no direct mock imports
- All views use shared component library (PageHeader, MetricCard, SectionCard, FilterBar, DataTable, StatusBadge, ScoreBadge, ChartCard, DetailDrawer, ConfirmationDialog, SavedViewSelector, FormSection)
- All views have loading states (LoadingState) and empty states (EmptyState) — no "Coming Soon" anywhere
- TypeScript clean — 0 errors in any of the 17 view files
- ESLint clean — 0 warnings/errors across all 17 view files
- Toasts via sonner for all action confirmations (route/approve/reject/launch/disqualify)
- Consistent teal-green accent system; no indigo/blue
- Realistic mock data only via services (24 patient leads, 13 markets, 6 campaigns, plus mock landing pages & creatives defined inline)
- All "JY" founder identity preserved; no "Jordan Ellis" / "JE" references introduced

---
Task ID: G-H
Agent: Views Builder (Workforce + Marketplace + Content + Automation)
Task: Built 25 view components for Novalyte Admin Revenue Command Center

Work Log:
- Workforce (Task G, 6 views):
  - workforce-overview.tsx → WorkforceOverviewView (KPIs, recent applications, pipeline health)
  - professionals.tsx → ProfessionalsView (DataTable + filters + detail drawer with licenses/certs)
  - jobs.tsx → JobsView (DataTable + filters + detail drawer with salary/applicants)
  - applications.tsx → ApplicationsView (status pipeline viz + funnel + DataTable)
  - credentials.tsx → CredentialsView (review queue with verify/reject ConfirmationDialog)
  - workforce-analytics.tsx → WorkforceAnalyticsView (4 ChartCards + recent hires)
- Marketplace (Task G cont., 5 views):
  - marketplace-overview.tsx → MarketplaceOverviewView (KPIs, recent orders, low inventory, top products)
  - products.tsx → ProductsView (DataTable + category/status filters + detail drawer)
  - orders.tsx → OrdersView (DataTable + payment/fulfillment filters + detail drawer with timeline)
  - vendors.tsx → VendorsView (derived vendor list with revenue/ratings/status)
  - marketplace-analytics.tsx → MarketplaceAnalyticsView (revenue trend + 3 bar charts + top products table)
- Content & Journal (Task H-a, 7 views):
  - content-overview.tsx → ContentOverviewView (KPIs, recent articles, review queue, publishing queue, performance)
  - articles.tsx → ArticlesView (SavedViewSelector + DataTable + filters)
  - editorial-calendar.tsx → EditorialCalendarView (week grid + month overview + upcoming)
  - content-studio.tsx → ContentStudioView (rich form: title/slug/excerpt/body/SEO/categorization + live SEO & readability scores + preview tab + AI generate)
  - media-library.tsx → MediaLibraryView (grid of media cards + upload area + type filter)
  - seo-briefs.tsx → SeoBriefsView (DataTable + brief generator + detail drawer with outline/competitors)
  - content-performance.tsx → ContentPerformanceView (KPIs + traffic trend + views by article + ranked table)
- Automation & AI (Task H-b, 7 views):
  - automation-overview.tsx → AutomationOverviewView (KPIs, failed automations alert, recent runs, AI capabilities)
  - automations.tsx → AutomationsView (DataTable + Switch toggle + detail drawer with trigger/actions config)
  - ai-assistants.tsx → AiAssistantsView (6 assistant cards with model/capabilities/usage + detail drawer)
  - call-intelligence.tsx → CallIntelligenceView (AI-extracted sentiment/topics/objections/next actions + transcript snippets + talk ratio)
  - lead-scoring.tsx → LeadScoringView (scoring factor sliders + model performance + sample scored leads table)
  - failed-jobs.tsx → FailedJobsView (expandable error details with stack traces + retry button)
  - ai-cost-tracking.tsx → AiCostTrackingView (KPIs + cost trend + cost by model/feature + usage table + optimization tips)

Stage Summary:
- All 25 view components built as separate files in src/components/admin/views/
- Every file: "use client"; at top, named export matching admin-app.tsx VIEW_MAP imports
- Imports use shared components from @/components/admin/shared/index (PageHeader, MetricCard, SectionCard, DataTable, FilterBar, DetailDrawer, ConfirmationDialog, ChartCard, StatusBadge, ScoreBadge, SavedViewSelector, EmptyState, LoadingState, FormSection)
- Data flows through services: workforceService, marketplaceService, contentService, automationService, callService
- All toast notifications use sonner; mock AI flows (Generate with AI, Retrain model, etc.) are toast-mocked per spec
- Light UI with teal-green accents throughout; no indigo/blue; no "Jordan Ellis" (only Jamil Yakasai/JY)
- Use nav() hook for navigation between views (e.g. articles → content-studio with articleId param)
- responsive: hideOnMobile columns + grid breakpoints (2/4 cols mobile → 4/5 desktop)
- Loading states use LoadingState component; empty states use EmptyState with relevant icons
- Type-checks cleanly against src/types/index.ts (Professional, JobListing, JobApplication, Product, Order, Article, Automation, AIUsageRecord, CallSession)
- Editorial calendar uses week grid + mini month overview; content studio has live SEO score heuristic + readability via avg words/sentence
- Failed jobs view shows full stack traces in monospace; ai-cost-tracking has cost-by-day line chart + cost-by-model/feature bar charts
- Pre-existing type errors in mocks/index.ts and other foundation files remain (not in scope)
- All 25 view files: 0 TypeScript errors

---
Task ID: I-J
Agent: Views Builder (Analytics + System Admin + Directory + Acquisition)
Task: Built 23 view components

Work Log:
- Foundation patch: updated `src/components/admin/shared.tsx` to re-export the new shared component library from `./shared/index` (PageHeader, MetricCard, SectionCard, EmptyState, LoadingState, TableSkeleton, FilterBar, DataTable, StatusBadge, PriorityBadge, ScoreBadge, SavedViewSelector, ActivityTimeline, DetailDrawer, ConfirmationDialog, FormSection, ChartCard) while preserving legacy display components (LogoMark, StatCard, StageBadge, DealStageBadge, DirectoryStageBadge, ReadinessScore, Pill, fetchJson) so existing views continue to compile.

- Analytics (Task I — 6 views):
  - executive-analytics.tsx → ExecutiveAnalyticsView — date-range Select, 8 MetricCards (revenue/MRR/pipeline/weighted/clinics/interested/leads/calls), revenue trend line chart, pipeline movement bar chart, clinic acquisition funnel, patient growth line chart, conversion-rates grid (8 funnel rates), top priorities panel; uses dashboardService + dealService
  - revenue-analytics.tsx → RevenueAnalyticsView — 4 MetricCards, revenue-by-month line chart, MRR trend line chart, deal-stage distribution bar chart, revenue summary panel, "revenue by clinic" DataTable with sortable columns (deal count, monthly, total); uses dealService.list()
  - outreach-analytics.tsx → OutreachAnalyticsView — 4 MetricCards (total/connect rate/meetings/avg duration), calls-per-day bar, connect-rate trend line, calls-by-outcome bar with per-outcome colors, top-performers leaderboard, recent-calls DataTable; uses callService.listAll()
  - call-analytics.tsx → CallAnalyticsView — 4 MetricCards, dial-to-connect funnel chart, calls-by-outcome chart, best-call-times-by-hour chart, funnel-conversion table, calls-by-admin DataTable with connect-rate badges; uses callService.listAll()
  - patient-analytics.tsx → PatientAnalyticsView — 4 MetricCards (total/qualification/routing/booking rates), leads-by-source chart with palette colors, leads-by-treatment chart, lead-volume line chart, lead-funnel visualization with 4 stages, recent-leads DataTable; uses patientService.listLeads()
  - geographic-analytics.tsx → GeographicAnalyticsView — 4 MetricCards, patient-demand-by-state bar, revenue-by-state bar, top-markets heatmap cards (rose/amber/teal intensity), clinics-by-state DataTable with bars, market-demand-intelligence DataTable; uses demandService.listMarkets() + clinicService.list() + dealService.list()

- System Administration (Task J — 6 views):
  - settings.tsx → SettingsView — Jamil Yakasai profile (from appConfig.brand.founder) with avatar (JY initials), 4 tabs (Account/Business/Notifications/Integrations). Account: profile fields + password change (toast mock). Business: calling hours config + 8 read-only config lists (pipeline stages, call outcomes, follow-up types, deal stages, services, priorities, directory stages, contact types). Notifications: channel status + alert-type toggles (Switch). Integrations: grid of integration cards with status badges & last-sync time; uses settingsService.listIntegrations()
  - team-access.tsx → TeamAccessView — DataTable of admin members (avatar, name/email, role badge with role-tinted color, status, last-login, joined date), "Invite Member" toast-mock button, read-only 12-row permission matrix across 5 roles; uses adminService.list()
  - integrations.tsx → IntegrationsView — 10 integration cards in 3-col grid with per-integration icons (Database, Cloud, MessageSquare, Mail, Calendar, Sparkles, Phone, CreditCard, Megaphone), color-coded status badges (connected=green, not_connected=slate, configuration_required=amber, error=rose), last-sync time, Configure/Connect/Set Up buttons, sync-now action for connected integrations; uses settingsService.listIntegrations()
  - audit-logs.tsx → AuditLogsView — action-type filter Select, DataTable (timestamp/actor/action-with-tone-badge/resource/IP) with sort & pagination; uses settingsService.listAuditEvents()
  - feature-flags.tsx → FeatureFlagsView — 3 environment columns (Production/Staging/Development), 3 real flags from appConfig.features (callConsoleLiveAudio, aiCallCopilot, liveTranscripts) marked "config" badge + 8 mock flags, per-flag Switch toggles with toast feedback, info card explaining config-vs-mock distinction
  - app-health.tsx → AppHealthView — overall-status pulse indicator (green/amber/red), 8 service MetricCards (API/Database/Queue/Connections/Error Rate/Storage/Jobs/Uptime), API-response-time line chart, error-rate bar chart, service-status list with health icons, recent-errors panel (4 mock errors with severity), recent system activity timeline; uses activityService.list()

- Directory Network (6 views):
  - directory.tsx → DirectoryView — listing-status filter Select, profile cards with completeness bar, 7-field completeness grid (services/providers/location/hours/pricing/images/booking), claim/verification/publication badges, status-change Select per card; uses directoryService.list() + clinicService.list()
  - clinic-onboarding.tsx → ClinicOnboardingView — onboarding clinics (directory_approved + pilot_proposed + pilot_active stages), per-clinic checklist cards (Profile Complete, Services Verified, Providers Added, Booking Link, Contract Signed) with progress bar and "Mark done" actions, "Ready for pilot" status badge at 100%; uses clinicService + directoryService
  - verification-queue.tsx → VerificationQueueView — pending profiles (identity_review + claim_requested + information_required), per-profile verification grid (Business License, Medical Director, Address, Phone), contact info strip, Approve/Reject/View actions, ConfirmationDialog for reject; uses directoryService + clinicService
  - providers.tsx → ProvidersView — DataTable of 14 mock providers (avatar initials, name, specialty, clinic link, license #, years, status badge); maps providers to real clinics for click-through navigation
  - treatments.tsx → TreatmentsView — 4 MetricCards (total/offerings/most-offered/clinics), grid of 14 treatment cards from SERVICE_CATALOG with per-treatment clinic count + progress bar (teal for core, slate for other)
  - directory-analytics.tsx → DirectoryAnalyticsView — 4 MetricCards (total/published/verified/avg completeness), listings-by-status bar chart, quality-breakdown section (4 completeness buckets), top-clinics-by-completeness DataTable with score badges; uses directoryService.list()

- Clinic Acquisition (2 NEW views, 4 UPDATED):
  - call-console.tsx → CallConsoleView — CRITICAL 3-column layout. LEFT: clinic queue (within-hours dot, priority badge, local time). CENTER: live call workspace with clinic summary, contact info grid (phone/email/website/local-time with calling-hours warning), decision-maker banner, animated CallStateIndicator (idle/dialing/ringing/connected/on_hold/ended/failed), working call timer, dial pad toggle, mute/hold/end controls, live notes textarea. RIGHT: coaching panel with outcome Select, 6-item qualification checklist, next-action input, follow-up date picker, 6-item expandable objection library, quick actions. Uses clinicService for queue + useState for call state; respects isWithinCallingHours gating
  - clinics.tsx → ClinicsView (UPDATED) — refactored from /api/clinics to clinicService.list(filters), saved-views bar (DEFAULT_SAVED_VIEWS), FilterBar + flag checkboxes (interested/has DM/never contacted), DataTable with sortable columns (clinic/stage/priority/readiness/last-activity/calls/deal-value)
  - call-queue.tsx → CallQueueView (UPDATED) — refactored from /api/call-queue to clinicService.list({ stage: ... }) union across ready_to_call/attempted/connected/follow_up_required, within-hours-only toggle, state/timezone/priority filters, per-clinic card with DM info, calling-hours warning, Log Call / Open / Not Interested / DNC actions
  - follow-ups.tsx → FollowUpsView (UPDATED) — refactored from /api/follow-ups to followUpService.list(view), 5 tabs (Today/Overdue/Upcoming/Completed/All), per-task complete button + reschedule button, overdue badges, task-type & priority badges
  - clinic-detail.tsx → ClinicDetailView (UPDATED) — signature now `{ clinicId?: string | null }`, refactored from /api/clinics/[id] to parallel service calls (clinicService.getById + callService.listByClinic + followUpService.list + dealService.list + directoryService.list + activityService.list), 7 tabs (Overview/Contacts/Calls/Follow-Ups/Deals/Directory/Activity), stage-change Select with toast, notes textarea with save, services & scores panel
  - settings.tsx & directory.tsx — already covered above (rebuilt rather than updated)

Stage Summary:
- All 23 views built/updated as separate files in src/components/admin/views/
- All named exports match the lazy-imported names in admin-app.tsx (ExecutiveAnalyticsView, RevenueAnalyticsView, OutreachAnalyticsView, CallAnalyticsView, PatientAnalyticsView, GeographicAnalyticsView, SettingsView, TeamAccessView, IntegrationsView, AuditLogsView, FeatureFlagsView, AppHealthView, DirectoryView, ClinicOnboardingView, VerificationQueueView, ProvidersView, TreatmentsView, DirectoryAnalyticsView, CallConsoleView, CallQueueView, ClinicsView, FollowUpsView, ClinicDetailView)
- All views use the service layer (dashboardService, dealService, callService, patientService, demandService, clinicService, directoryService, settingsService, activityService, adminService, followUpService) — no direct /api or mock imports
- All views use the shared component library (PageHeader, MetricCard, SectionCard, ChartCard, DataTable, StatusBadge, PriorityBadge, ScoreBadge, LoadingState, EmptyState, ConfirmationDialog, ActivityTimeline, FilterBar, SavedViewSelector, plus legacy StageBadge/ReadinessScore/DealStageBadge/DirectoryStageBadge for compatibility)
- All views have proper loading states (LoadingState) and empty states (EmptyState) — no "Coming Soon" anywhere
- Analytics views each have a date-range Select (Last 7 / 30 / 90 days) as required
- Toasts via sonner for all action confirmations (toggle/configure/approve/reject/save-call/mark-done/reschedule/stage-change)
- Jamil Yakasai / JY identity preserved throughout (settings profile, audit logs actor names, queue owner names); no "Jordan Ellis"/"JE" introduced
- TypeScript clean — `npx tsc --noEmit` shows 0 errors in any of the 23 view files (remaining TS errors are pre-existing in mocks/index.ts, lib/data.ts, and other agents' view files like campaigns.tsx, content-studio.tsx, deals.tsx, meetings.tsx, revenue.tsx, seo-briefs.tsx)
- Consistent teal-green accent system; no indigo/blue
- CallConsole is a rich interactive page with working mock call state machine (idle → dialing → ringing → connected → ended), live timer, mute/hold toggles, live notes, outcome selector, objection library, and qualification checklist

---
Task ID: A-C
Agent: Views Builder (Command Center + Sales + Acquisition extras)
Task: Built 20 view components for Command Center, Sales & Revenue, and Clinic Acquisition extras

Work Log:
- Consolidated shared modules: added legacy components (LogoMark, StatCard alias, StageBadge, DealStageBadge, DirectoryStageBadge, ReadinessScore, Pill, fetchJson) to shared/index.tsx and made shared.tsx re-export from index so both paths resolve to the same component set
- overview.tsx — Executive command center with 12 primary MetricCards (Ready to Call, Calls Today, Follow-Ups Due, Overdue, Interested, Meetings Booked, Proposals Outstanding, Active Deals, Pipeline Value, Revenue Won, Patient Leads, Qualified Leads), conversion metrics row (Dial→Connect, Connect→Interest, Interest→Meeting, Meeting→Proposal, Proposal→Close, Lead→Booking, Avg Deal Value, Avg Sales Cycle), Today's Priorities, Pipeline Snapshot bar chart, Next Best Call card with calling-hours awareness + DM info, Deal Risk Alerts, Patient Demand Alerts, Recent Calls list, Recent Activity timeline. All MetricCards clickable to relevant views.
- priorities.tsx — Today's Priorities checklist: 4 MetricCards, priority checklist (clickable), overdue tasks list with checkbox + dismiss, today's task checklist with completion tracking.
- revenue-overview.tsx — Revenue overview with 6 MetricCards (Open Pipeline, Weighted, Won Revenue, MRR, Avg Deal, Total), Tabs (Open/Proposals/Won/Lost), monthly revenue trend line chart, stage distribution bar chart, Top Deals by Value, Closing This Month.
- operations-overview.tsx — Operations health: 6 MetricCards (Active Automations, Failed Jobs, Directory Live, New Patient Leads, Healthy Integrations, Content Published), Automation Status list, Recent Failures, Directory Onboarding with progress stats, Patient Lead Queue, Integration Health, Content Publishing Queue.
- alerts.tsx — Grouped alerts (Critical/High/Normal) with FilterBar (category, priority, status), dismissable rows, dismiss-all action, 4 MetricCards.
- activity.tsx (UPDATED) — Migrated from fetch to activityService.list(entityType), preserved entity-type filter, action icons, admin attribution.
- deals.tsx (UPDATED) — Migrated from fetch to dealService.list(view), added optimistic stage movement with toast feedback (works in mock mode), board/table layout toggle, 6 MetricCards, Tabs (Open/Proposals/Won/Lost), DataTable for table layout.
- pipeline.tsx — Full-width kanban with all open DEAL_STAGES as columns, sticky column headers with stage value + weighted value, deal cards show name/clinic/value/probability/expected-close, Select dropdown to move stages (optimistic + toast).
- proposals.tsx — Outstanding proposals table: 4 MetricCards (Proposals Out, Total Value, Avg Days Out, Overdue), days-outstanding highlighting (>5d = red), DataTable with deal/clinic/contact/value/monthly/age/next-action, quick-action buttons.
- contracts.tsx — Contracts derived from deals: 5 MetricCards (Drafting, In Review, Signed, Rejected, Signed Value), status filter tabs, DataTable with status icons.
- revenue.tsx — Revenue dashboard: 4 MetricCards (MRR, ARR, Total Revenue, Avg per Clinic), monthly MRR line chart, Top Revenue Clinics leaderboard, Active Revenue Contracts DataTable.
- payments.tsx — Mock payment records derived from deals: 4 MetricCards (Total Paid, Pending, Overdue, Failed), DataTable with invoice#/clinic/amount/method/date/status, status badges.
- invoices.tsx — Mock invoices derived from deals: 4 MetricCards (Outstanding, Collected, Overdue, Draft), DataTable with invoice#/clinic/amount/issued/due/status + PDF download button (toast).
- conversion-analytics.tsx — Sales funnel viz: 6 conversion-rate cards (Dial→Connect through Lead→Booking), funnel visualization with drop-off %, funnel-by-volume bar chart, cycle metrics (Avg Deal Value, Avg Sales Cycle, Follow-Up Completion, Connect→Conversation), stage-by-stage breakdown table with health indicators.
- contacts.tsx — All contacts flattened from clinicService.list(): 4 MetricCards (Total, Decision-Makers, Primary, With Phone), FilterBar (type/clinic/DM), DataTable with DM/Primary badges, search.
- decision-makers.tsx — DM-focused contacts: 4 MetricCards (Decision-Makers, Callable Now, High Priority, Avg Readiness), FilterBar (priority/stage/callable-now), DataTable with readiness score, calling-hours indicator, log-call action, high-priority DM spotlight.
- campaigns.tsx — Campaign metrics table: 6 MetricCards (Active, Total Budget, Total Leads, Avg CPL, Impressions, Avg CTR), FilterBar (status/platform), DataTable with budget/spent/impressions/clicks/CTR/leads/CPL/CVR.
- call-scripts.tsx — Expandable script library: 7 inline mock scripts (Cold Intro, Permission-to-List, Objection Handling ×2, Voicemail ×2, Post-Meeting Follow-Up), master-detail layout with category filter, copy-to-clipboard, expandable sections.
- meetings.tsx — Scheduled meetings from follow-ups where taskType='meeting': 4 MetricCards (Scheduled, This Week, Completed, Overdue), FilterBar (status/format), grouped DataTables (Upcoming / Past / Cancelled-Rescheduled-Overdue).
- import-center.tsx — CSV import UI: 4 MetricCards (Total Imports, Clinics Imported, Import Errors, Success Rate), file upload area with hidden input, column-mapping preview table with editable target dropdowns + sample values, mock import history DataTable with status/rows/imported/skipped/errors/duration, template download (toast).

Stage Summary:
- All 20 views implemented as "use client" components in src/components/admin/views/, each exporting the named component imported by admin-app.tsx
- Every view follows the architecture: services from @/services, types from @/types, shared components from @/components/admin/shared, format helpers from @/lib/format, constants from @/lib/constants
- All views use useEffect+useState with refreshKey for data fetching; loading and empty states throughout
- Teal/green brand accent palette only — no indigo/blue
- MetricCards clickable to navigate to relevant detail views; DataTable rows clickable to open clinic detail where applicable
- Optimistic updates with toast feedback for deal stage changes (works seamlessly in mock mode)
- All 20 views typecheck cleanly (npx tsc --noEmit shows zero errors in view files) and pass ESLint
- Shared module consolidation ensures both `@/components/admin/shared` and `@/components/admin/shared/index` resolve to identical component sets (legacy StatCard/StageBadge/DealStageBadge preserved alongside new MetricCard/DataTable/etc.)
- Existing pre-existing mock type errors (missing `archived` on Deal, missing `followUpRequired` on CallSession, `title`/`contactType` on contact seeds, "warning" priority) are in mocks/index.ts and were left untouched as foundation responsibility
