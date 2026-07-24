import type { ExtractedClinicIntelligence, TalkTrackVariants } from "./types";

function clean(value?: string | null): string {
  return (value ?? "").trim();
}

function has(value?: string | null): boolean {
  return Boolean(clean(value));
}

export function buildTalkTrack(input: {
  clinicName: string;
  city?: string | null;
  state?: string | null;
  category?: string | null;
  primaryService?: string | null;
  differentiator?: string | null;
  conversationFocus?: string | null;
  previousOutcome?: string | null;
}): TalkTrackVariants & {
  personalizedOpening: string;
  relevanceStatement: string;
  permissionRequest: string;
  conversationFocus: string;
} {
  const name = clean(input.clinicName) || "your clinic";
  const city = clean(input.city) || "the Miami area";
  const category = clean(input.category);
  const service = clean(input.primaryService) || category;
  const differentiator = clean(input.differentiator);

  const focus =
    clean(input.conversationFocus) ||
    (service
      ? `Lead with ${name}'s focus on ${service.toLowerCase()} and explain that Novalyte is building concentrated Miami directory coverage for patients exploring that care.`
      : `Lead with verifying the clinic's public services and explain that Novalyte is building concentrated Miami directory coverage for patients exploring specialized care.`);

  const sawDetail = service
    ? `I came across ${name} while researching ${service.toLowerCase()} providers in ${city}`
    : `I came across ${name} while researching healthcare providers in ${city}`;

  const sawExtra = differentiator ? ` I noticed ${differentiator}.` : "";

  const frontDesk = `Hi, my name is Jamil, and I'm calling from Novalyte AI. ${sawDetail}.${sawExtra} We're building concentrated directory coverage for patients exploring specialized care in Miami, and I wanted to find out who handles partnerships, marketing, or your online clinic profile.`;

  const decisionMaker = `Hi, my name is Jamil, and I'm the founder of Novalyte AI. ${sawDetail}.${sawExtra} We would like to create a complimentary profile that directs interested patients to your existing consultation or booking process.`;

  const gatekeeper = `Hi, this is Jamil from Novalyte AI. Quick question — who handles marketing or your online clinic listing for ${name}?`;

  const voicemail = `Hi, this is Jamil, founder of Novalyte AI. ${sawDetail}. I'm calling about a free directory profile — no fee, and nothing publishes without your review. You can reach me back at this number, or I'll follow up by email. Thank you.`;

  const followUp = input.previousOutcome
    ? `Hi, this is Jamil from Novalyte AI following up with ${name}. We spoke previously about a complimentary directory profile. I wanted to check whether you'd had a chance to review, or if there's a better person for me to speak with.`
    : `Hi, this is Jamil from Novalyte AI following up with ${name} about the complimentary Miami directory profile we discussed.`;

  const emailTransition =
    "Of course — what's the best email, and whose attention should I put it to? I'll send a short overview of the free listing and how the clinic can review it before anything is published.";

  const relevanceStatement =
    "We are not replacing your website or scheduling system. The profile would present verified information about your services and direct interested patients to the destination your clinic approves.";

  const permissionRequest =
    "There is no listing fee, contract, or obligation. Nothing would be published without your approval. Would you be open to reviewing a profile for possible inclusion?";

  const personalizedOpening = has(input.previousOutcome) ? followUp : frontDesk;

  return {
    frontDesk,
    decisionMaker,
    gatekeeper,
    voicemail,
    followUp,
    emailTransition,
    relevanceStatement,
    permissionRequest,
    personalizedOpening,
    conversationFocus: focus,
  };
}

export function verificationQuestionsForCategory(category?: string | null): string[] {
  const c = (category ?? "").toLowerCase();
  if (c.includes("hair")) {
    return [
      "Do you offer surgical hair transplantation, nonsurgical restoration, or both?",
      "Is this your only South Florida location?",
      "Do patients begin with an in-person or virtual consultation?",
      "Which booking or consultation link should appear in the directory?",
      "Who should review the profile before publication?",
    ];
  }
  if (c.includes("trt") || c.includes("hormone") || c.includes("testosterone")) {
    return [
      "Do you currently provide testosterone or hormone consultations?",
      "Are services offered in person, by telehealth, or both?",
      "Do you require laboratory testing before consultation?",
      "Which patient-booking destination should be used?",
      "Who should approve the listing information?",
    ];
  }
  if (c.includes("sexual") || c.includes("ed ") || c.includes("erectile")) {
    return [
      "Which men's sexual-health services should be represented publicly?",
      "Are consultations available privately by telehealth?",
      "Which location serves Miami-area patients?",
      "What is the preferred patient contact route?",
      "Who should review the profile?",
    ];
  }
  if (c.includes("weight") || c.includes("glp")) {
    return [
      "Do you provide clinician-led medical weight-management programs?",
      "Are GLP-1 consultations currently available?",
      "Is care offered in person, virtually, or both?",
      "Which booking destination should be listed?",
      "Who approves public clinic information?",
    ];
  }
  if (c.includes("longevity") || c.includes("anti-aging") || c.includes("concierge")) {
    return [
      "Which longevity or preventive services should be highlighted publicly?",
      "Do you offer in-person visits, telehealth, or both?",
      "What is the preferred patient destination — website, phone, or booking link?",
      "Who should review the directory profile before publication?",
    ];
  }
  return [
    "What are the main services you want patients to know about?",
    "Do you offer care in person, by telehealth, or both?",
    "Which booking or contact destination should appear in the directory?",
    "Who should review the profile before publication?",
  ];
}

export function safeScriptVars(profile: {
  clinicName: string;
  city?: string | null;
  primaryCategory?: string | null;
  services?: string[];
  differentiators?: string[];
  conversationFocus?: string | null;
  decisionMakerName?: string | null;
  previousCallOutcome?: string | null;
}) {
  const primaryService = profile.services?.[0] || profile.primaryCategory || null;
  return {
    clinicName: profile.clinicName || "your clinic",
    primaryCity: profile.city || "Miami",
    primaryCategory: profile.primaryCategory || "specialized care",
    primaryService: primaryService || "your services",
    notableService: primaryService || null,
    differentiator: profile.differentiators?.[0] || null,
    conversationFocus: profile.conversationFocus || null,
    relevantDirectoryCategory: profile.primaryCategory || null,
    relevantPatientIntent: primaryService ? `${primaryService} in Miami` : "specialized care in Miami",
    decisionMakerName: profile.decisionMakerName || null,
    previousCallOutcome: profile.previousCallOutcome || null,
  };
}

export function computeResearchCompleteness(p: {
  websiteUrl?: string | null;
  shortSummary?: string | null;
  services?: string[];
  city?: string | null;
  phoneNumbers?: string[];
  bookingUrl?: string | null;
  providers?: unknown[];
  leadership?: unknown[];
  likelyDecisionMakers?: unknown[];
  fitStatus?: string | null;
  conversationFocus?: string | null;
  talkTrack?: TalkTrackVariants | null;
  sourcesCount?: number;
}): { completeness: number; missing: string[] } {
  const checks: Array<{ ok: boolean; label: string; weight: number }> = [
    { ok: Boolean(p.shortSummary), label: "Clinic identity summary", weight: 12 },
    { ok: Boolean(p.websiteUrl), label: "Official website", weight: 12 },
    { ok: (p.services?.length ?? 0) > 0, label: "Primary services", weight: 12 },
    { ok: Boolean(p.city), label: "Location verified", weight: 10 },
    { ok: (p.phoneNumbers?.length ?? 0) > 0, label: "Phone verified", weight: 8 },
    { ok: Boolean(p.bookingUrl), label: "Booking route", weight: 10 },
    {
      ok:
        (p.providers?.length ?? 0) > 0 ||
        (p.leadership?.length ?? 0) > 0 ||
        (p.likelyDecisionMakers?.length ?? 0) > 0,
      label: "Provider or leadership",
      weight: 10,
    },
    { ok: Boolean(p.fitStatus) && p.fitStatus !== "research_required", label: "Novalyte fit determined", weight: 10 },
    { ok: Boolean(p.conversationFocus), label: "Conversation focus", weight: 8 },
    { ok: Boolean(p.talkTrack?.frontDesk || p.talkTrack?.decisionMaker), label: "Talk track", weight: 8 },
  ];
  if ((p.sourcesCount ?? 0) > 0) {
    checks.push({ ok: true, label: "Sources stored", weight: 0 });
  } else {
    checks.push({ ok: false, label: "Sources stored", weight: 0 });
  }

  const earned = checks.reduce((sum, c) => sum + (c.ok ? c.weight : 0), 0);
  const total = checks.reduce((sum, c) => sum + c.weight, 0) || 1;
  const missing = checks.filter((c) => !c.ok).map((c) => c.label);
  return { completeness: Math.round((earned / total) * 100), missing };
}

export function mergeExtractedWithClinic(
  clinic: { name: string; city?: string | null; state?: string | null; website?: string | null; primaryPhone?: string | null; notes?: string | null },
  extracted: ExtractedClinicIntelligence | null,
) {
  return {
    clinicName: clinic.name,
    city: extracted?.city || clinic.city,
    state: extracted?.state || clinic.state,
    category: extracted?.primaryCategory || null,
    primaryService: extracted?.services?.[0] || extracted?.primaryCategory || null,
    differentiator: extracted?.differentiators?.[0] || extracted?.notableFacts?.[0]?.text || null,
    conversationFocus: extracted?.conversationFocus || null,
  };
}
