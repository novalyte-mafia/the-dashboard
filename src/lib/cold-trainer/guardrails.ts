import type { ClinicContextPayload, CoachNextAction, CoachStage, CoachSuggestion, RiskFlag } from "./types";
import { COACH_STAGES, NEXT_ACTIONS, RISK_FLAGS } from "./types";
import { FALLBACKS } from "./fallbacks";

const UNVERIFIED_CLAIM_PATTERNS = [
  /\b(rank(?:ing)?s?|#1|top[- ]rated|best clinic)\b/i,
  /\b(traffic|pageviews?|impressions?)\b/i,
  /\b(\d[\d,]*\+?\s*(patients?|leads?|bookings?))\b/i,
  /\b(endorsed|official partner|in partnership with)\b/i,
  /\b(guaranteed?|guarantee)\b/i,
  /\b(hipaa[- ]compliant|soc 2|certified)\b/i,
  /\b(cure|treat(?:ment)? outcomes?|clinical results?)\b/i,
  /\b(we already work with you|existing (client|customer))\b/i,
];

function sentenceCap(text: string, max = 2): string {
  const cleaned = text.replace(/\s+/g, " ").trim();
  if (!cleaned) return cleaned;
  const parts = cleaned.match(/[^.!?]+[.!?]+|[^.!?]+$/g) ?? [cleaned];
  return parts.slice(0, max).join(" ").trim();
}

function isStage(value: string): value is CoachStage {
  return (COACH_STAGES as readonly string[]).includes(value);
}

function isRisk(value: string): value is RiskFlag {
  return (RISK_FLAGS as readonly string[]).includes(value);
}

function isNext(value: string): value is CoachNextAction {
  return (NEXT_ACTIONS as readonly string[]).includes(value);
}

export function stripUnverifiedClaims(text: string): { text: string; stripped: boolean } {
  let next = text;
  let stripped = false;
  for (const pattern of UNVERIFIED_CLAIM_PATTERNS) {
    if (pattern.test(next)) {
      stripped = true;
      next = next.replace(pattern, "").replace(/\s{2,}/g, " ").trim();
    }
  }
  if (stripped && (!next || next.length < 12)) {
    return {
      stripped: true,
      text: "I want to make sure I give you an accurate answer. May I send that by email after I confirm it?",
    };
  }
  return { text: next, stripped };
}

export function clinicHasMissingFacts(clinic: Pick<ClinicContextPayload, "phone" | "known_services" | "contact_name">): boolean {
  const phone = clinic.phone.trim();
  const services = clinic.known_services.trim();
  const contact = clinic.contact_name.trim();
  const emptyPhone = !phone || phone === "—" || phone.toLowerCase() === "unknown";
  const emptyServices = !services || services === "—" || /^unknown|none|unverified$/i.test(services);
  const emptyContact = !contact || contact === "—" || contact.toLowerCase() === "unknown";
  return emptyPhone || emptyServices || emptyContact;
}

export function sanitizeCoachSuggestion(
  raw: Partial<CoachSuggestion> | null | undefined,
  clinic: ClinicContextPayload,
): CoachSuggestion {
  const base = FALLBACKS.opening;
  const stage = raw?.stage && isStage(raw.stage) ? raw.stage : "opening";
  const risk = raw?.risk_flag && isRisk(raw.risk_flag) ? raw.risk_flag : "none";
  const nextAction = raw?.next_action && isNext(raw.next_action) ? raw.next_action : "ask_question";
  const capped = sentenceCap(String(raw?.say_next ?? base.say_next), 2);
  const claims = stripUnverifiedClaims(capped);
  let sayNext = claims.text;
  let riskFlag: RiskFlag = claims.stripped ? "unverified_claim" : risk;
  let resolvedStage: CoachStage = stage;

  if (clinicHasMissingFacts(clinic) && (stage === "opening" || stage === "relevance" || stage === "discovery")) {
    resolvedStage = "routing";
    if (!/\b(who|confirm|verify|right person|email|best person)\b/i.test(sayNext)) {
      sayNext = FALLBACKS.missing_facts.say_next;
      riskFlag = "unverified_claim";
    }
  }

  const cue = String(raw?.delivery_cue ?? "Pause after the question.")
    .split(/\s+/)
    .slice(0, 8)
    .join(" ");

  return {
    stage: resolvedStage,
    say_next: sayNext,
    delivery_cue: cue || "Pause after the question.",
    reason: String(raw?.reason ?? "Keep it short and ask one question.").slice(0, 180),
    risk_flag: riskFlag,
    next_action: nextAction,
    tone: raw?.tone,
    alternate: raw?.alternate ? sentenceCap(raw.alternate, 2) : undefined,
    source: raw?.source ?? "glm",
  };
}

export function parseCoachJson(raw: string): Partial<CoachSuggestion> | null {
  const match = raw.trim().match(/\{[\s\S]*\}/);
  if (!match) return null;
  try {
    return JSON.parse(match[0]) as Partial<CoachSuggestion>;
  } catch {
    return null;
  }
}
