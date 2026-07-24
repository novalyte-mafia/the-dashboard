export type IntelligenceResearchStatus =
  | "not_started"
  | "queued"
  | "researching"
  | "needs_review"
  | "verified"
  | "failed"
  | "stale";

export type FitStatus =
  | "strong_fit"
  | "possible_fit"
  | "research_required"
  | "not_relevant"
  | "duplicate"
  | "invalid";

export type OutreachPriority = "high" | "medium" | "low" | "exclude";

export type NotableFact = {
  text: string;
  sourceUrl?: string;
  confidence?: "high" | "medium" | "low" | "unverified";
};

export type TalkTrackVariants = {
  frontDesk?: string;
  decisionMaker?: string;
  gatekeeper?: string;
  voicemail?: string;
  followUp?: string;
  emailTransition?: string;
  relevanceStatement?: string;
  permissionRequest?: string;
};

export type ClinicIntelligenceProfile = {
  id: string;
  clinicId: string;
  researchStatus: IntelligenceResearchStatus;
  fitStatus: FitStatus;
  fitScore?: number | null;
  priority: OutreachPriority;
  shortSummary?: string | null;
  detailedSummary?: string | null;
  primaryCategory?: string | null;
  secondaryCategories: string[];
  services: string[];
  audience: string[];
  careDelivery: string[];
  address?: string | null;
  city?: string | null;
  state?: string | null;
  postalCode?: string | null;
  county?: string | null;
  serviceArea: string[];
  websiteUrl?: string | null;
  bookingUrl?: string | null;
  contactUrl?: string | null;
  phoneNumbers: string[];
  emailAddresses: string[];
  providers: Array<{ name?: string; title?: string }>;
  leadership: Array<{ name?: string; title?: string }>;
  likelyDecisionMakers: Array<{ name?: string; title?: string; email?: string }>;
  differentiators: string[];
  notableFacts: NotableFact[];
  accreditations: string[];
  yearsInBusiness?: string | null;
  novalyteFitReason?: string | null;
  recommendedDirectoryCategories: string[];
  relevantCampaigns: string[];
  conversationFocus?: string | null;
  personalizedOpening?: string | null;
  relevanceStatement?: string | null;
  verificationQuestions: string[];
  objectionPreparation: string[];
  recommendedOutcome?: string | null;
  recommendedNextAction?: string | null;
  talkTrack: TalkTrackVariants;
  missingInformation: string[];
  warnings: string[];
  researchCompleteness: number;
  researchConfidence?: number | null;
  lastResearchedAt?: string | null;
  lastVerifiedAt?: string | null;
  lockedFields: string[];
  generatedBy?: string | null;
  reviewedBy?: string | null;
  reviewedAt?: string | null;
  lastError?: string | null;
  sources?: ClinicIntelligenceSource[];
};

export type ClinicIntelligenceSource = {
  id: string;
  sourceUrl: string;
  pageTitle?: string | null;
  sourceType: string;
  retrievedAt: string;
  excerpt?: string | null;
  confidence: "high" | "medium" | "low" | "unverified";
  isOfficial: boolean;
  humanReviewed: boolean;
};

export type ExtractedClinicIntelligence = {
  shortSummary?: string;
  detailedSummary?: string;
  primaryCategory?: string;
  secondaryCategories?: string[];
  services?: string[];
  audience?: string[];
  careDelivery?: Array<"in_person" | "telehealth" | "hybrid">;
  address?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  county?: string;
  serviceArea?: string[];
  bookingUrl?: string;
  contactUrl?: string;
  phoneNumbers?: string[];
  emailAddresses?: string[];
  providers?: Array<{ name?: string; title?: string }>;
  leadership?: Array<{ name?: string; title?: string }>;
  likelyDecisionMakers?: Array<{ name?: string; title?: string }>;
  differentiators?: string[];
  notableFacts?: NotableFact[];
  accreditations?: string[];
  yearsInBusiness?: string;
  businessType?: string;
  appearsClosed?: boolean;
  fitStatus?: FitStatus;
  fitReason?: string;
  directoryCategories?: string[];
  conversationFocus?: string;
  missingInformation?: string[];
  warnings?: string[];
  confidence?: number;
};
