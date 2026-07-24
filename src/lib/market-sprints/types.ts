/**
 * Market Sprint — concentrated geographic outreach + acquisition.
 * Reusable; Miami is the first active configuration.
 */

export type MarketSprintStatus =
  | "planning"
  | "researching"
  | "active_outreach"
  | "building_coverage"
  | "campaign_ready"
  | "active_campaign"
  | "paused"
  | "completed";

export type MarketCohortStatus =
  | "unreviewed"
  | "research_needed"
  | "researching"
  | "ready_to_call"
  | "calling"
  | "attempted"
  | "follow_up_required"
  | "interested"
  | "permission_granted"
  | "profile_review_pending"
  | "approved"
  | "published"
  | "not_interested"
  | "do_not_call"
  | "invalid"
  | "closed";

export type MarketResearchStatus =
  | "unreviewed"
  | "research_needed"
  | "researching"
  | "complete"
  | "flagged";

export type MarketReadinessStage =
  | "discovery"
  | "outreach"
  | "early_coverage"
  | "directory_ready"
  | "campaign_ready"
  | "active_patient_acquisition";

export type MarketSprint = {
  id: string;
  name: string;
  slug: string;
  primaryCity: string;
  state: string;
  stateAbbreviation: string;
  metroArea?: string | null;
  countyNames: string[];
  includedCities: string[];
  excludedCities: string[];
  zipPatterns: string[];
  timezone: string;
  status: MarketSprintStatus;
  treatmentCategories: string[];
  targetClinicCount?: number | null;
  campaignReadinessThreshold: number;
  minApprovedListings: number;
  minCategoryCoverage: number;
  isDefault: boolean;
  startedAt?: string | null;
  targetCompletionDate?: string | null;
  notes?: string | null;
  createdAt: string;
  updatedAt: string;
};

export type MarketSprintMetrics = {
  totalIdentified: number;
  qualified: number;
  researchComplete: number;
  researchNeeded: number;
  readyToCall: number;
  contacted: number;
  connected: number;
  interested: number;
  permissionGranted: number;
  profilesPrepared: number;
  profilesAwaitingReview: number;
  approved: number;
  published: number;
  followUpsDue: number;
  dnc: number;
  invalid: number;
  closed: number;
  duplicatesFlagged: number;
  contactRate: number;
  permissionRate: number;
  coveragePct: number;
  readinessStage: MarketReadinessStage;
  directoryUrl: string;
};

export type MarketQueueFilter =
  | "ready_to_call"
  | "research_needed"
  | "never_called"
  | "follow_up_due"
  | "attempted"
  | "interested"
  | "permission_granted"
  | "review_pending"
  | "approved"
  | "dnc"
  | "invalid"
  | "all";

export type MarketQueueSort =
  | "priority"
  | "local_time"
  | "research"
  | "last_attempt"
  | "follow_up"
  | "category"
  | "decision_maker";

export const MARKET_STORAGE_KEY = "novalyte.activeMarketSprint";
export const ALL_MARKETS_SLUG = "all";
