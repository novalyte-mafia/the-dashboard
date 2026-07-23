/**
 * Demand Intelligence → Campaign Studio opportunity contract (admin).
 * Volume/CPC/competition are admin-only and must never render on public ads pages.
 */

export type DemandTrendDirection = "rising" | "stable" | "declining" | "unknown";
export type DemandSearchIntent =
  | "cost"
  | "provider-search"
  | "insurance"
  | "telehealth"
  | "eligibility"
  | "consultation"
  | "testing"
  | "treatment-process"
  | "comparison"
  | "informational"
  | "transactional"
  | "navigational";

export type DemandContentStatus = "detected" | "drafted" | "in_review" | "approved" | "rejected";
export type DemandComplianceStatus = "unchecked" | "flagged" | "cleared";
export type DemandPublicationStatus =
  | "not_ready"
  | "ready_to_publish"
  | "published"
  | "paused"
  | "archived";

export type DemandCampaignOpportunity = {
  id: string;
  query: string;
  keywordCluster?: string;
  treatmentSlug: string;
  city?: string;
  state?: string;
  stateAbbreviation?: string;
  zipCode?: string;
  searchVolume?: number | null;
  cpc?: number | null;
  competition?: number | null;
  trendDirection?: DemandTrendDirection;
  searchIntent?: DemandSearchIntent;
  risingLocation?: boolean;
  suggestedCampaignSlug?: string;
  suggestedPath?: string;
  suggestedHeroHeading?: string;
  suggestedEyebrow?: string;
  suggestedShortAnswerQuestions?: string[];
  suggestedAssessmentSlug?: string;
  suggestedDirectoryFilters?: Record<string, string>;
  contentStatus: DemandContentStatus;
  complianceStatus: DemandComplianceStatus;
  publicationStatus: DemandPublicationStatus;
  lastReviewed?: string | null;
  reviewedByAdminId?: string | null;
  notes?: string;
  createdAt: string;
  updatedAt: string;
};

export function canPublishFromDemandOpportunity(opp: DemandCampaignOpportunity): boolean {
  return (
    opp.contentStatus === "approved" &&
    opp.complianceStatus === "cleared" &&
    opp.publicationStatus === "ready_to_publish" &&
    Boolean(opp.suggestedAssessmentSlug || opp.suggestedPath) &&
    Boolean(opp.lastReviewed)
  );
}

export function suggestedAdsPublicUrl(opp: DemandCampaignOpportunity): string | null {
  if (opp.suggestedPath?.startsWith("/")) {
    return `https://ads.novalyte.io${opp.suggestedPath.replace(/^\/ads/, "")}`;
  }
  if (opp.suggestedCampaignSlug) {
    return `https://ads.novalyte.io/campaign/${opp.suggestedCampaignSlug}`;
  }
  if (opp.treatmentSlug && opp.city && opp.stateAbbreviation) {
    const city = opp.city.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
    return `https://ads.novalyte.io/${opp.treatmentSlug}/${city}-${opp.stateAbbreviation.toLowerCase()}`;
  }
  return null;
}
