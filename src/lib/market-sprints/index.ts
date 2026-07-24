import type { MarketCohortStatus, MarketReadinessStage, MarketResearchStatus, MarketSprint } from "./types";

type DbSprint = {
  id: string;
  name: string;
  slug: string;
  primary_city: string;
  state: string;
  state_abbreviation: string;
  metro_area?: string | null;
  county_names?: string[] | null;
  included_cities?: string[] | null;
  excluded_cities?: string[] | null;
  zip_patterns?: string[] | null;
  timezone: string;
  status: MarketSprint["status"];
  treatment_categories?: string[] | null;
  target_clinic_count?: number | null;
  campaign_readiness_threshold?: number | null;
  min_approved_listings?: number | null;
  min_category_coverage?: number | null;
  is_default?: boolean | null;
  started_at?: string | null;
  target_completion_date?: string | null;
  notes?: string | null;
  created_at: string;
  updated_at: string;
};

export function mapDbSprint(row: DbSprint): MarketSprint {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    primaryCity: row.primary_city,
    state: row.state,
    stateAbbreviation: row.state_abbreviation,
    metroArea: row.metro_area,
    countyNames: row.county_names ?? [],
    includedCities: row.included_cities ?? [],
    excludedCities: row.excluded_cities ?? [],
    zipPatterns: row.zip_patterns ?? [],
    timezone: row.timezone,
    status: row.status,
    treatmentCategories: row.treatment_categories ?? [],
    targetClinicCount: row.target_clinic_count,
    campaignReadinessThreshold: row.campaign_readiness_threshold ?? 15,
    minApprovedListings: row.min_approved_listings ?? 8,
    minCategoryCoverage: row.min_category_coverage ?? 3,
    isDefault: Boolean(row.is_default),
    startedAt: row.started_at,
    targetCompletionDate: row.target_completion_date,
    notes: row.notes,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function normalizeCity(city?: string | null): string {
  return (city ?? "")
    .toLowerCase()
    .trim()
    .replace(/\s+/g, " ")
    .replace(/^ft\.?\s+/, "fort ");
}

export function normalizeZip5(zip?: string | null): string {
  return (zip ?? "").replace(/\D/g, "").slice(0, 5);
}

export function normalizePhoneDigits(phone?: string | null): string {
  const digits = (phone ?? "").replace(/\D/g, "");
  if (digits.length === 11 && digits.startsWith("1")) return digits.slice(1);
  return digits.slice(0, 10);
}

export function clinicMatchesMarket(
  clinic: { city?: string | null; state?: string | null; zip?: string | null },
  sprint: Pick<MarketSprint, "includedCities" | "excludedCities" | "stateAbbreviation" | "state" | "zipPatterns">,
): { match: boolean; confidence: "city" | "zip" | null; reason: string | null } {
  const state = (clinic.state ?? "").trim().toUpperCase();
  const abbr = sprint.stateAbbreviation.toUpperCase();
  const stateOk =
    state === abbr ||
    (abbr === "FL" && (state === "FL" || state === "FLORIDA")) ||
    state === sprint.state.toUpperCase();
  if (!stateOk) {
    return { match: false, confidence: null, reason: null };
  }

  const city = normalizeCity(clinic.city);
  if (sprint.excludedCities.map(normalizeCity).includes(city)) {
    return { match: false, confidence: null, reason: null };
  }

  if (sprint.includedCities.map(normalizeCity).includes(city)) {
    return { match: true, confidence: "city", reason: "Matched included city" };
  }

  const zip5 = normalizeZip5(clinic.zip);
  for (const pattern of sprint.zipPatterns) {
    try {
      if (new RegExp(pattern).test(zip5)) {
        return { match: true, confidence: "zip", reason: "Matched market ZIP pattern" };
      }
    } catch {
      // ignore bad patterns
    }
  }

  return { match: false, confidence: null, reason: null };
}

export function deriveCohortStatus(clinic: {
  doNotCall?: boolean;
  operatingStatus?: string | null;
  pipelineStage?: string | null;
  directoryStatus?: string | null;
  interested?: boolean;
}): MarketCohortStatus {
  if (clinic.doNotCall || clinic.pipelineStage === "do_not_call") return "do_not_call";
  if (clinic.operatingStatus === "closed") return "closed";
  if (clinic.pipelineStage === "invalid") return "invalid";
  if (clinic.pipelineStage === "not_interested") return "not_interested";
  if (clinic.directoryStatus === "published") return "published";
  if (clinic.directoryStatus === "approved" || clinic.pipelineStage === "directory_approved") return "approved";
  if (clinic.pipelineStage === "interested" || clinic.interested) return "interested";
  if (clinic.pipelineStage === "follow_up_required") return "follow_up_required";
  if (["attempted", "connected", "decision_maker_reached"].includes(clinic.pipelineStage ?? "")) return "attempted";
  if (clinic.pipelineStage === "ready_to_call" || clinic.pipelineStage === "research_complete") return "ready_to_call";
  if (["imported", "needs_research"].includes(clinic.pipelineStage ?? "")) return "research_needed";
  return "unreviewed";
}

export function deriveResearchStatus(clinic: {
  primaryPhone?: string | null;
  website?: string | null;
  pipelineStage?: string | null;
}): MarketResearchStatus {
  const phone = normalizePhoneDigits(clinic.primaryPhone);
  if (!phone || phone.length < 10) return "research_needed";
  if (!clinic.website) return "research_needed";
  if (["imported", "needs_research"].includes(clinic.pipelineStage ?? "")) return "research_needed";
  return "complete";
}

export function computeReadinessStage(input: {
  qualified: number;
  approved: number;
  published: number;
  contacted: number;
  targetClinicCount: number;
  campaignReadinessThreshold: number;
  minApprovedListings: number;
}): MarketReadinessStage {
  const { qualified, approved, published, contacted, targetClinicCount, campaignReadinessThreshold, minApprovedListings } =
    input;
  if (published >= minApprovedListings && approved >= campaignReadinessThreshold) {
    return "active_patient_acquisition";
  }
  if (approved >= minApprovedListings && published >= Math.ceil(minApprovedListings / 2)) {
    return "campaign_ready";
  }
  if (approved >= Math.min(3, minApprovedListings) || published >= 1) {
    return "directory_ready";
  }
  if (contacted >= Math.max(5, Math.floor(targetClinicCount * 0.15))) {
    return "early_coverage";
  }
  if (contacted > 0 || qualified > 0) return "outreach";
  return "discovery";
}

export function directoryUrlForMarket(sprint: Pick<MarketSprint, "primaryCity" | "stateAbbreviation">): string {
  const city = encodeURIComponent(sprint.primaryCity);
  const state = encodeURIComponent(sprint.stateAbbreviation);
  return `https://novalyte.io/directory?city=${city}&state=${state}`;
}
