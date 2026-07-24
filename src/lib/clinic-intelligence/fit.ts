import type { ExtractedClinicIntelligence, FitStatus, OutreachPriority } from "./types";

const STRONG_KEYWORDS = [
  "trt",
  "testosterone",
  "hormone",
  "men's health",
  "mens health",
  "erectile",
  "ed treatment",
  "sexual health",
  "peptide",
  "glp-1",
  "glp1",
  "weight loss",
  "weight management",
  "hair restoration",
  "hair transplant",
  "longevity",
  "anti-aging",
  "anti aging",
  "concierge",
  "iv therapy",
  "semaglutide",
  "tirzepatide",
];

const NOT_RELEVANT_KEYWORDS = [
  "diagnostic imaging",
  "radiology",
  "mri center",
  "ct scan",
  "labcorp",
  "quest diagnostics",
  "drug testing",
  "toxicology",
  "blood draw only",
  "standalone laboratory",
  "imaging center",
  "x-ray center",
];

function haystack(parts: Array<string | null | undefined | string[]>): string {
  return parts
    .flatMap((p) => (Array.isArray(p) ? p : [p ?? ""]))
    .join(" ")
    .toLowerCase();
}

export function classifyFit(input: {
  clinicName: string;
  notes?: string | null;
  website?: string | null;
  extracted?: ExtractedClinicIntelligence | null;
  isDuplicateSecondary?: boolean;
  doNotCall?: boolean;
  operatingStatus?: string | null;
}): { fitStatus: FitStatus; fitScore: number; priority: OutreachPriority; reason: string } {
  if (input.doNotCall) {
    return { fitStatus: "invalid", fitScore: 0, priority: "exclude", reason: "Clinic is marked Do Not Call." };
  }
  if (input.operatingStatus === "closed" || input.extracted?.appearsClosed) {
    return { fitStatus: "invalid", fitScore: 0, priority: "exclude", reason: "Business appears closed." };
  }
  if (input.isDuplicateSecondary) {
    return { fitStatus: "duplicate", fitScore: 10, priority: "exclude", reason: "Duplicate of another cohort record." };
  }

  if (input.extracted?.fitStatus && ["strong_fit", "possible_fit", "not_relevant", "invalid"].includes(input.extracted.fitStatus)) {
    const status = input.extracted.fitStatus;
    const score = status === "strong_fit" ? 85 : status === "possible_fit" ? 55 : status === "not_relevant" ? 15 : 5;
    return {
      fitStatus: status,
      fitScore: score,
      priority: status === "strong_fit" ? "high" : status === "possible_fit" ? "medium" : "exclude",
      reason: input.extracted.fitReason || `Model classified as ${status.replace(/_/g, " ")}.`,
    };
  }

  const text = haystack([
    input.clinicName,
    input.notes,
    input.extracted?.primaryCategory,
    input.extracted?.shortSummary,
    input.extracted?.services,
    input.extracted?.businessType,
  ]);

  if (NOT_RELEVANT_KEYWORDS.some((k) => text.includes(k))) {
    return {
      fitStatus: "not_relevant",
      fitScore: 12,
      priority: "exclude",
      reason: "Record appears to be a lab, imaging, or unrelated facility rather than a treatment clinic.",
    };
  }

  const strongHits = STRONG_KEYWORDS.filter((k) => text.includes(k));
  if (strongHits.length >= 1 && (input.extracted?.services?.length || input.website)) {
    return {
      fitStatus: "strong_fit",
      fitScore: Math.min(95, 70 + strongHits.length * 5),
      priority: "high",
      reason: `Aligned services detected (${strongHits.slice(0, 3).join(", ")}).`,
    };
  }

  if (!input.website && !input.extracted?.shortSummary) {
    return {
      fitStatus: "research_required",
      fitScore: 30,
      priority: "low",
      reason: "Insufficient public information to classify fit.",
    };
  }

  if (text.includes("clinic") || text.includes("medical") || text.includes("health")) {
    return {
      fitStatus: "possible_fit",
      fitScore: 50,
      priority: "medium",
      reason: "Healthcare business detected; service mix needs verification on the call.",
    };
  }

  return {
    fitStatus: "research_required",
    fitScore: 35,
    priority: "low",
    reason: "Fit is unclear from available public information.",
  };
}
