export const PROSPECT_STATUSES = [
  "NEW",
  "RESEARCHING",
  "NEEDS_REVIEW",
  "RESEARCH_READY",
  "ARCHIVED",
  "SUPPRESSED",
] as const;
export type ProspectStatus = (typeof PROSPECT_STATUSES)[number];

export const RESEARCH_CONFIDENCES = ["HIGH", "MEDIUM", "LOW", "NEEDS_REVIEW"] as const;
export type ResearchConfidence = (typeof RESEARCH_CONFIDENCES)[number];

export const EVIDENCE_TYPES = [
  "ADVERTISING_RECORD",
  "WEBSITE_PAGE",
  "CONTACT_PAGE",
  "BUSINESS_PROFILE",
  "NEWS_MENTION",
  "OPERATOR_NOTE",
  "IMPORT_RECORD",
] as const;
export type EvidenceType = (typeof EVIDENCE_TYPES)[number];

export const SOURCE_TYPES = [
  "META_AD_LIBRARY",
  "GOOGLE_ADS_TRANSPARENCY",
  "GOOGLE_PLACES",
  "GOOGLE_SEARCH",
  "WEBSITE",
  "EXA",
  "FIRECRAWL",
  "MANUAL",
  "IMPORT",
] as const;
export type SourceType = (typeof SOURCE_TYPES)[number];

export const CONTACT_CHANNEL_TYPES = [
  "PUBLISHED_EMAIL",
  "CONTACT_FORM",
  "PUBLIC_PHONE",
  "BOOKING_LINK",
  "SOCIAL_PROFILE",
  "NONE_FOUND",
] as const;
export type ContactChannelType = (typeof CONTACT_CHANNEL_TYPES)[number];

export const CONTACT_VERIFICATION_STATUSES = [
  "UNVERIFIED",
  "SYNTAX_VALID",
  "DOMAIN_ACCEPTS_MAIL",
  "LIKELY_DELIVERABLE",
  "INVALID_FORMAT",
  "DOMAIN_MISSING",
  "BOUNCED",
  "SUPPRESSED",
  "DO_NOT_CONTACT",
] as const;
export type ContactVerificationStatus = (typeof CONTACT_VERIFICATION_STATUSES)[number];

export const RESEARCH_JOB_STATUSES = [
  "QUEUED",
  "RUNNING",
  "COMPLETED",
  "COMPLETE_WITH_WARNINGS",
  "FAILED",
  "CANCELLED",
  "NEEDS_REVIEW",
  "NOT_CONFIGURED",
] as const;
export type ResearchJobStatus = (typeof RESEARCH_JOB_STATUSES)[number];

export const RESEARCH_JOB_TYPES = [
  "meta_ads_search",
  "meta_advertiser_match",
  "website_research",
  "contact_discovery",
  "csv_import",
  "data_enrichment",
  "draft_generation",
  "duplicate_detection",
  "lead_scoring",
  "export",
  "public_search",
] as const;
export type ResearchJobType = (typeof RESEARCH_JOB_TYPES)[number];

export const META_TRUST_MODES = [
  "LIVE_META_DATA",
  "IMPORTED_META_RESEARCH",
  "OFFICIAL_LINK_OUT",
  "NOT_CONFIGURED",
] as const;
export type MetaTrustMode = (typeof META_TRUST_MODES)[number];

export const META_AD_ACTIVE_STATUSES = ["active", "inactive", "all"] as const;
export type MetaAdActiveStatus = (typeof META_AD_ACTIVE_STATUSES)[number];

export const META_PLATFORMS = ["facebook", "instagram", "messenger", "audience_network"] as const;
export type MetaPlatform = (typeof META_PLATFORMS)[number];

export const META_MATCH_REASONS = [
  "domain_match",
  "advertiser_name_match",
  "clinic_name_match",
  "manual_match",
  "unmatched",
] as const;
export type MetaMatchReason = (typeof META_MATCH_REASONS)[number];

export const VERTICALS = [
  "mens_health",
  "trt_hormone",
  "weight_management",
  "ed",
  "wellness",
  "medspa",
  "primary_care",
  "other",
] as const;
export type Vertical = (typeof VERTICALS)[number];

export const AD_SIGNAL_STATUSES = ["ACTIVE_OBSERVED", "PREVIOUSLY_OBSERVED", "UNKNOWN", "NO_SIGNAL"] as const;
export type AdSignalStatus = (typeof AD_SIGNAL_STATUSES)[number];

export const PAGE_TYPES = ["HOMEPAGE", "CONTACT", "ABOUT", "SERVICES", "LOCATION", "FAQ", "OTHER"] as const;
export type PageType = (typeof PAGE_TYPES)[number];

export const ACTIVITY_EVENT_TYPES = [
  "prospect_created",
  "prospect_updated",
  "website_added",
  "evidence_added",
  "evidence_deleted",
  "contact_route_added",
  "contact_route_updated",
  "research_started",
  "research_completed",
  "status_changed",
  "research_confidence_changed",
  "prospect_archived",
  "prospect_restored",
  "prospect_suppressed",
  "operator_note_added",
  "draft_generated",
  "draft_verified",
  "draft_needs_review",
  "draft_copied",
  "console_send_logged",
  "meta_search_started",
  "meta_search_completed",
  "meta_result_attached",
  "meta_clinic_created",
  "job_failed",
  "job_cancelled",
  "bulk_research_started",
] as const;
export type ActivityEventType = (typeof ACTIVITY_EVENT_TYPES)[number];

export const OUTREACH_SUBVIEWS = [
  "overview",
  "discover",
  "meta-ads",
  "research-queue",
  "prospects",
  "contacts",
  "drafts",
  "evidence",
  "jobs",
  "settings",
] as const;
export type OutreachSubview = (typeof OUTREACH_SUBVIEWS)[number];

export const QUEUE_BUCKETS = [
  "new_prospects",
  "missing_website",
  "missing_contact_route",
  "has_ads_needs_website",
  "has_website_needs_review",
  "ready_to_mark",
  "suppressed_or_dnc",
] as const;
export type QueueBucket = (typeof QUEUE_BUCKETS)[number];

export const QUEUE_PRIORITIES = ["HIGH", "MEDIUM", "LOW", "NONE"] as const;
export type QueuePriority = (typeof QUEUE_PRIORITIES)[number];

export const DRAFT_STATUSES = ["DRAFT", "VERIFIED_READY", "NEEDS_REVIEW", "SENT", "COPIED"] as const;
export type DraftStatus = (typeof DRAFT_STATUSES)[number];

export const DRAFT_CONTACT_ROUTE_TYPES = ["email", "web_form", "none"] as const;
export type DraftContactRouteType = (typeof DRAFT_CONTACT_ROUTE_TYPES)[number];

export const DRAFT_FRESHNESS_DAYS = 14;

export interface DraftVerificationResult {
  ok: boolean;
  contactLive: boolean;
  evidenceFresh: boolean;
  failures: string[];
  warnings: string[];
  checkedAt: string;
}

export interface OutreachProspect {
  id: string;
  organizationId: string;
  clinicName: string;
  canonicalDomain: string | null;
  websiteUrl: string | null;
  publicBusinessProfileUrl: string | null;
  city: string | null;
  stateOrRegion: string | null;
  country: string;
  postalCode: string | null;
  latitude: number | null;
  longitude: number | null;
  vertical: Vertical;
  businessCategory: string | null;
  status: ProspectStatus;
  researchConfidence: ResearchConfidence;
  sourceType: SourceType;
  ownerId: string | null;
  notes: string | null;
  isSuppressed: boolean;
  suppressionReason: string | null;
  isDemo: boolean;
  createdAt: string;
  updatedAt: string;
  lastResearchedAt: string | null;
  archivedAt: string | null;
  contactSearchCompleted: boolean;
  draftSubject: string | null;
  draftMessage: string | null;
  draftGeneratedAt: string | null;
  draftEvidenceIds: string[];
  draftStatus: DraftStatus | null;
  draftAngle: string | null;
  contactRouteType: DraftContactRouteType;
  lastVerifiedAt: string | null;
  verificationResult: DraftVerificationResult | null;
}

export interface OutreachEvidence {
  id: string;
  prospectId: string;
  evidenceType: EvidenceType;
  sourceType: SourceType;
  sourceUrl: string;
  sourceTitle: string | null;
  excerpt: string | null;
  structuredData: Record<string, unknown>;
  observedAt: string | null;
  capturedAt: string;
  confidence: ResearchConfidence;
  contentHash: string | null;
  capturedBy: string;
  isDemo: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface OutreachContactRoute {
  id: string;
  prospectId: string;
  channelType: ContactChannelType;
  value: string;
  isPubliclyPublished: boolean;
  sourceUrl: string | null;
  sourceContext: string | null;
  verificationStatus: ContactVerificationStatus;
  verificationNotes: string | null;
  confidence: ResearchConfidence;
  isDoNotContact: boolean;
  suppressionReason: string | null;
  isManualRecord: boolean;
  capturedAt: string;
  lastReviewedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface OutreachJobLog {
  at: string;
  stage: string;
  message: string;
}

export interface OutreachResearchJob {
  id: string;
  prospectId: string | null;
  jobType: string;
  adapterName: string;
  status: ResearchJobStatus;
  requestedBy: string;
  startedAt: string | null;
  completedAt: string | null;
  errorMessage: string | null;
  resultSummary: Record<string, unknown>;
  logs: OutreachJobLog[];
  progressCurrent: number;
  progressTotal: number;
  source: string;
  scope: string;
  isDemo: boolean;
  idempotencyKey: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface MetaSearchQuery {
  advertiser: string;
  keyword: string;
  clinicName: string;
  city: string;
  state: string;
  country: string;
  adCategory: string;
  activeStatus: MetaAdActiveStatus;
  platforms: MetaPlatform[];
  dateFrom: string;
  dateTo: string;
  landingPageDomain: string;
  vertical: Vertical | "";
}

export interface OutreachMetaSearch {
  id: string;
  name: string;
  query: MetaSearchQuery;
  officialUrl: string;
  trustMode: MetaTrustMode;
  jobId: string;
  createdBy: string;
  createdAt: string;
  lastRunAt: string | null;
  adsFound: number;
  advertisersFound: number;
  clinicsMatched: number;
  unmatchedCount: number;
  errorMessage: string | null;
}

export interface OutreachMetaAdResult {
  id: string;
  searchId: string;
  advertiserName: string;
  pageName: string | null;
  pageId: string | null;
  adArchiveId: string | null;
  status: "ACTIVE" | "INACTIVE" | "UNKNOWN";
  platforms: string[];
  startDate: string | null;
  observedAt: string;
  copyPreview: string | null;
  ctaText: string | null;
  destinationUrl: string | null;
  landingDomain: string | null;
  snapshotUrl: string | null;
  officialUrl: string;
  vertical: Vertical | "";
  clinicMatchId: string | null;
  clinicMatchName: string | null;
  matchReason: MetaMatchReason;
  matchExplanation: string;
  dismissed: boolean;
  imported: boolean;
  confidence: ResearchConfidence;
  raw: Record<string, unknown>;
}

export interface OutreachSavedMetaSearch {
  id: string;
  name: string;
  query: MetaSearchQuery;
  createdBy: string;
  lastRunAt: string | null;
  lastResultsCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface OutreachActivity {
  id: string;
  prospectId: string | null;
  actorId: string | null;
  eventType: ActivityEventType;
  entityType: string;
  entityId: string | null;
  description: string;
  metadata: Record<string, unknown>;
  createdAt: string;
}

export interface OutreachSavedView {
  id: string;
  userId: string;
  name: string;
  route: OutreachSubview | "discover";
  filters: Record<string, unknown>;
  sort: { field: string; dir: "asc" | "desc" };
  visibleColumns: string[];
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface OutreachSuppression {
  id: string;
  prospectId: string | null;
  contactRouteId: string | null;
  reason: string;
  source: string;
  createdBy: string;
  createdAt: string;
  expiresAt: string | null;
}

export interface OutreachSettings {
  demoDataEnabled: boolean;
  liveConnectorsEnabled: boolean;
  defaultVertical: Vertical;
  defaultGeography: string;
  defaultResearchConfidence: ResearchConfidence;
  defaultOwnerId: string | null;
  sourceRetentionDays: number;
  websiteRecheckDays: number;
  requireSourceUrlForContactRoute: boolean;
  requireEvidenceBeforeResearchReady: boolean;
  onlyPublicBusinessContactRoutes: true;
  noAutomatedSending: true;
  noAutomatedFormSubmission: true;
  suppressionPolicy: string;
  lastSyncByAdapter: Record<string, string | null>;
  enabledConnectors: Record<string, boolean>;
}

export interface ResearchReadyResult {
  allowed: boolean;
  missingRequirements: string[];
  warnings: string[];
  summary: {
    clinicName: boolean;
    publicLink: boolean;
    evidence: boolean;
    contactSearch: boolean;
    notSuppressed: boolean;
    notArchived: boolean;
  };
}

export interface AdapterNotConfigured {
  status: "NOT_CONFIGURED";
  adapterName: string;
}

export type AdapterResult<T> =
  | { status: "ok"; data: T }
  | AdapterNotConfigured
  | { status: "error"; message: string };

export interface OutreachProspectRow extends OutreachProspect {
  location: string;
  adSignal: AdSignalStatus;
  websiteStatus: "found" | "missing" | "needs_review";
  contactRoute: "email" | "form" | "phone" | "multiple" | "none";
  evidenceCount: number;
  contactRouteCount: number;
  dataMode: "live";
  researchCompleteness: number;
  leadScore: number;
  missingFields: string[];
  nextBestAction: { key: string; label: string; reason: string };
}

export interface OutreachQueueCard extends OutreachProspectRow {
  priority: QueuePriority;
  rationale: string;
  missing: string;
  ageHours: number;
}

export const SAFETY_NOTICE =
  "Public-source research only. Drafts are verified here; sending and web-form paste stay manual. No messages are sent or forms submitted from Outreach.";

export const HUMAN_REVIEW_NOTICE =
  "Human-reviewed research workspace — drafts are prepared here, but no messages are sent from this module.";
