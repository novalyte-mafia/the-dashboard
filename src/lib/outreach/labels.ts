import type {
  AdSignalStatus,
  ContactChannelType,
  ContactVerificationStatus,
  EvidenceType,
  ProspectStatus,
  QueuePriority,
  QueueBucket,
  ResearchConfidence,
  SourceType,
  Vertical,
} from "./types";

export const VERTICAL_LABELS: Record<Vertical, string> = {
  mens_health: "Men’s Health",
  trt_hormone: "TRT / Hormone Optimization",
  weight_management: "Weight Management",
  ed: "Erectile Dysfunction",
  wellness: "Wellness Clinic",
  medspa: "MedSpa",
  primary_care: "Primary Care",
  other: "Other",
};

export const STATUS_LABELS: Record<ProspectStatus, string> = {
  NEW: "New",
  RESEARCHING: "Researching",
  NEEDS_REVIEW: "Needs Review",
  RESEARCH_READY: "Research Ready",
  ARCHIVED: "Archived",
  SUPPRESSED: "Suppressed",
};

export const DRAFT_STATUS_LABELS = {
  DRAFT: "Draft",
  VERIFIED_READY: "Verified — Ready to Send",
  NEEDS_REVIEW: "Needs Review",
  SENT: "Sent (console)",
  COPIED: "Copied for web form",
} as const;

export const CONFIDENCE_LABELS: Record<ResearchConfidence, string> = {
  HIGH: "High",
  MEDIUM: "Medium",
  LOW: "Low",
  NEEDS_REVIEW: "Needs Review",
};

export const SOURCE_BADGES: Record<SourceType, string> = {
  META_AD_LIBRARY: "META",
  GOOGLE_ADS_TRANSPARENCY: "GOOGLE",
  GOOGLE_PLACES: "GOOGLE",
  GOOGLE_SEARCH: "GOOGLE",
  WEBSITE: "WEB",
  EXA: "EXA",
  FIRECRAWL: "FIRECRAWL",
  MANUAL: "MANUAL",
  IMPORT: "IMPORT",
};

export const CHANNEL_BADGES: Record<ContactChannelType, string> = {
  PUBLISHED_EMAIL: "EMAIL",
  CONTACT_FORM: "FORM",
  PUBLIC_PHONE: "PHONE",
  BOOKING_LINK: "BOOKING",
  SOCIAL_PROFILE: "SOCIAL",
  NONE_FOUND: "NONE",
};

export const CHANNEL_LABELS: Record<ContactChannelType, string> = {
  PUBLISHED_EMAIL: "Published business email found",
  CONTACT_FORM: "Contact form found",
  PUBLIC_PHONE: "Public phone",
  BOOKING_LINK: "Booking link",
  SOCIAL_PROFILE: "Social profile",
  NONE_FOUND: "No route found",
};

export const VERIFICATION_LABELS: Record<ContactVerificationStatus, string> = {
  UNVERIFIED: "Unverified",
  SYNTAX_VALID: "Syntax valid",
  DOMAIN_ACCEPTS_MAIL: "Domain accepts mail",
  LIKELY_DELIVERABLE: "Likely deliverable",
  INVALID_FORMAT: "Invalid format",
  DOMAIN_MISSING: "Domain missing",
  BOUNCED: "Bounced",
  SUPPRESSED: "Suppressed",
  DO_NOT_CONTACT: "Do not contact",
};

export const AD_SIGNAL_LABELS: Record<AdSignalStatus, string> = {
  ACTIVE_OBSERVED: "Active Observed",
  PREVIOUSLY_OBSERVED: "Previously Observed",
  UNKNOWN: "Unknown",
  NO_SIGNAL: "No Signal",
};

export const EVIDENCE_TYPE_LABELS: Record<EvidenceType, string> = {
  ADVERTISING_RECORD: "Advertising record",
  WEBSITE_PAGE: "Website page",
  CONTACT_PAGE: "Contact-page evidence",
  BUSINESS_PROFILE: "Business profile",
  NEWS_MENTION: "News mention",
  OPERATOR_NOTE: "Operator note",
  IMPORT_RECORD: "Import record",
};

export const PRIORITY_LABELS: Record<QueuePriority, string> = {
  HIGH: "High — active advertising signal and no contact route found",
  MEDIUM: "Medium — website found but evidence or research is incomplete",
  LOW: "Low — imported or manual prospect awaiting basic enrichment",
  NONE: "None — archived or suppressed",
};

export const QUEUE_BUCKET_LABELS: Record<QueueBucket, string> = {
  new_prospects: "New prospects",
  missing_website: "Missing website",
  missing_contact_route: "Missing contact route",
  has_ads_needs_website: "Has advertising evidence but needs website research",
  has_website_needs_review: "Has website research but needs review",
  ready_to_mark: "Ready to mark Research Ready",
  suppressed_or_dnc: "Suppressed or Do Not Contact",
};

export const JOB_STATUS_LABELS = {
  QUEUED: "Queued",
  RUNNING: "Running",
  COMPLETED: "Complete",
  COMPLETE_WITH_WARNINGS: "Complete with warnings",
  FAILED: "Failed",
  CANCELLED: "Cancelled",
  NEEDS_REVIEW: "Needs review",
  NOT_CONFIGURED: "Not configured",
} as const;

export const META_TRUST_LABELS = {
  LIVE_META_DATA: "Live Meta data",
  IMPORTED_META_RESEARCH: "Imported Meta research",
  OFFICIAL_LINK_OUT: "Official Meta Ads Library link-out",
  NOT_CONFIGURED: "Meta integration not configured",
} as const;

export const SUBVIEW_LABELS = {
  overview: "Overview",
  discover: "Discover",
  "meta-ads": "Meta Ads Library",
  "research-queue": "Research Queue",
  prospects: "Prospects",
  contacts: "Contacts",
  drafts: "Drafts",
  evidence: "Evidence",
  jobs: "Jobs & Activity",
  settings: "Settings",
} as const;

export function statusColor(status: ProspectStatus): string {
  if (status === "NEW" || status === "ARCHIVED") return "slate";
  if (status === "RESEARCHING") return "teal";
  if (status === "NEEDS_REVIEW") return "amber";
  if (status === "RESEARCH_READY") return "green";
  if (status === "SUPPRESSED") return "rose";
  const _exhaustive: never = status;
  return _exhaustive;
}
