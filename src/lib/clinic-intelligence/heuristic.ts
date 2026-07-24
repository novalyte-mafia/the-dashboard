import type { ExtractedClinicIntelligence, FitStatus } from "./types";

const SERVICE_PATTERNS: Array<{ re: RegExp; label: string; category: string }> = [
  { re: /\b(hair\s*transplant|hair\s*restoration|fue|fut)\b/i, label: "Hair restoration", category: "Hair Restoration" },
  { re: /\b(testosterone|trt|hormone\s*replacement|hrt)\b/i, label: "TRT / hormone therapy", category: "TRT / Hormone Therapy" },
  { re: /\b(erectile|ed\s*treatment|sexual\s*health|peyronie)\b/i, label: "Men's sexual health", category: "Sexual Health" },
  { re: /\b(glp-?1|semaglutide|tirzepatide|weight\s*loss|weight\s*management)\b/i, label: "Medical weight management", category: "Weight Management" },
  { re: /\b(peptide|peptides)\b/i, label: "Peptide therapy", category: "Peptides" },
  { re: /\b(longevity|anti-?aging|preventive)\b/i, label: "Longevity / preventive care", category: "Longevity" },
  { re: /\b(iv\s*therapy|vitamin\s*infusion)\b/i, label: "IV therapy", category: "IV Therapy" },
  { re: /\b(concierge\s*medicine|concierge\s*care)\b/i, label: "Concierge medicine", category: "Concierge" },
];

const NOT_RELEVANT_RE =
  /\b(diagnostic\s*imaging|radiology\s*center|mri\s*center|labcorp|quest\s*diagnostics|drug\s*testing|toxicology)\b/i;

function uniq(items: string[]) {
  return Array.from(new Set(items.filter(Boolean)));
}

export function heuristicExtractFromMarkdown(input: {
  clinicName: string;
  city?: string | null;
  state?: string | null;
  website: string;
  notes?: string | null;
  markdown: string;
  pageTitle?: string | null;
}): ExtractedClinicIntelligence {
  const text = `${input.pageTitle || ""}\n${input.notes || ""}\n${input.markdown}`;
  const lower = text.toLowerCase();

  if (NOT_RELEVANT_RE.test(text)) {
    return {
      shortSummary: `${input.clinicName} appears to be a laboratory, imaging, or testing facility based on public page language. It is likely not a Novalyte treatment-clinic fit.`,
      primaryCategory: "Laboratory / Diagnostics",
      services: [],
      fitStatus: "not_relevant",
      fitReason: "Public content indicates lab/imaging/testing rather than a treatment clinic.",
      conversationFocus: `Do not pitch a directory listing until confirming this is not a lab or imaging facility.`,
      missingInformation: ["Confirm business type with a human"],
      warnings: ["Heuristic classified as not relevant — review before excluding"],
      confidence: 0.45,
      notableFacts: [],
    };
  }

  const hits = SERVICE_PATTERNS.filter((p) => p.re.test(text));
  const services = uniq(hits.map((h) => h.label));
  const category = hits[0]?.category;

  const telehealth = /\b(telehealth|telemedicine|virtual\s*consult|online\s*consult)\b/i.test(text);
  const inPerson = /\b(in-?person|office\s*visit|clinic\s*location|miami)\b/i.test(text);
  const careDelivery: Array<"in_person" | "telehealth" | "hybrid"> = [];
  if (telehealth && inPerson) careDelivery.push("hybrid");
  else if (telehealth) careDelivery.push("telehealth");
  else if (inPerson) careDelivery.push("in_person");

  const bookingMatch = text.match(/https?:\/\/[^\s)]+(?:book|schedul|consult|appoint)[^\s)]*/i);
  const bookingUrl = bookingMatch?.[0];

  const city = input.city || undefined;
  const state = input.state || undefined;

  let fitStatus: FitStatus = "research_required";
  let fitReason = "Insufficient clear service signals on the public page.";
  if (services.length >= 1) {
    fitStatus = "strong_fit";
    fitReason = `Public website/import signals align with ${services.slice(0, 2).join(", ")}.`;
  } else if (/\b(clinic|medical|health|wellness)\b/i.test(text)) {
    fitStatus = "possible_fit";
    fitReason = "Appears to be a healthcare clinic; service mix needs verification.";
  }

  const notableFacts = [
    services[0]
      ? {
          text: `${input.clinicName} publicly references ${services[0].toLowerCase()}.`,
          sourceUrl: input.website,
          confidence: "medium" as const,
        }
      : null,
    city
      ? {
          text: `The record places the clinic in ${city}${state ? `, ${state}` : ""}.`,
          sourceUrl: input.website,
          confidence: "medium" as const,
        }
      : null,
    telehealth
      ? {
          text: "Public pages mention telehealth or virtual consultation options.",
          sourceUrl: input.website,
          confidence: "medium" as const,
        }
      : null,
    bookingUrl
      ? {
          text: "A booking or consultation link appears on the clinic website.",
          sourceUrl: bookingUrl,
          confidence: "medium" as const,
        }
      : null,
  ].filter(Boolean) as ExtractedClinicIntelligence["notableFacts"];

  const shortSummary = services.length
    ? `${input.clinicName} is a ${category || "specialty"} practice${city ? ` in ${city}` : ""}${
        state ? `, ${state}` : ""
      }. Public materials reference ${services.slice(0, 3).join(", ").toLowerCase()}. Verify booking destination and reviewer on the call.`
    : `${input.clinicName} is listed${city ? ` in ${city}` : ""}${
        state ? `, ${state}` : ""
      }. Public service details are limited — confirm what the clinic offers before making specific claims.`;

  return {
    shortSummary,
    primaryCategory: category,
    secondaryCategories: uniq(hits.slice(1).map((h) => h.category)),
    services,
    careDelivery,
    city,
    state,
    bookingUrl,
    differentiators: services.slice(0, 2),
    notableFacts,
    fitStatus,
    fitReason,
    directoryCategories: category ? [category] : [],
    conversationFocus: services[0]
      ? `Lead with ${input.clinicName}'s focus on ${services[0].toLowerCase()} and explain that Novalyte is building concentrated Miami directory coverage for patients exploring that care.`
      : `Lead with verifying the clinic's public services and explain that Novalyte is building concentrated Miami directory coverage.`,
    missingInformation: [
      ...(services.length ? [] : ["Primary services"]),
      ...(bookingUrl ? [] : ["Booking link"]),
      "Decision-maker",
      ...(telehealth || inPerson ? [] : ["Telehealth / in-person status"]),
    ],
    warnings: ["Structured extraction used website heuristics because model extraction was unavailable or rate-limited."],
    confidence: services.length ? 0.55 : 0.35,
  };
}
