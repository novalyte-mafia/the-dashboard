import type { CallGoal, CoachStage, CoachSuggestion, ClinicContextPayload } from "./types";

export const OPENING_LINE =
  "Hi, this is Jamil with Novalyte. I’m calling briefly about your clinic’s online profile. Who is the best person to speak with about that?";

export const RESET_LINE =
  "Pause. Take one slow breath. You do not need to fill the silence.";

export const RESET_SAY_NEXT =
  "Sorry, let me say that more clearly. I’m calling from Novalyte about your clinic’s online profile.";

const FALLBACKS: Record<string, CoachSuggestion> = {
  opening: {
    stage: "opening",
    say_next: OPENING_LINE,
    delivery_cue: "Pause after the question.",
    reason: "Open simply and ask who handles this.",
    risk_flag: "none",
    next_action: "ask_question",
    tone: "Calm",
    source: "fallback",
    alternate:
      "Hi, this is Jamil with Novalyte — I’m calling about your clinic’s online profile. Who should I speak with?",
  },
  receptionist: {
    stage: "routing",
    say_next:
      "We help keep clinic information accurate where people are researching local care. I just want to confirm the right person to speak with.",
    delivery_cue: "Slow. Then stop talking.",
    reason: "Receptionist asked what this is regarding.",
    risk_flag: "none",
    next_action: "ask_question",
    tone: "Warm",
    source: "fallback",
  },
  decision_maker: {
    stage: "relevance",
    say_next:
      "Thanks for taking a moment. We’re verifying clinic information for an online profile, and I wanted to make sure we have the right details and permissions.",
    delivery_cue: "Warm, then one pause.",
    reason: "Decision-maker is on the line — keep it brief.",
    risk_flag: "none",
    next_action: "ask_question",
    tone: "Warm",
    source: "fallback",
  },
  discovery: {
    stage: "discovery",
    say_next: "Is online listings or marketing something you handle directly?",
    delivery_cue: "Ask, then listen.",
    reason: "One discovery question, then stop.",
    risk_flag: "none",
    next_action: "ask_question",
    tone: "Calm",
    source: "fallback",
    alternate: "What is the best email for a short verification note?",
  },
  busy: {
    stage: "objection",
    say_next: "I understand—what is the best email or time for a brief follow-up?",
    delivery_cue: "Respect it. Stop after.",
    reason: "They are busy — honor that immediately.",
    risk_flag: "none",
    next_action: "schedule_followup",
    tone: "Calm",
    source: "fallback",
  },
  not_interested: {
    stage: "objection",
    say_next:
      "No problem at all. Before I let you go, can I confirm who handles your online listings in case accuracy updates are needed later?",
    delivery_cue: "No pressure. One question.",
    reason: "Acknowledge and route, never argue.",
    risk_flag: "none",
    next_action: "ask_question",
    tone: "Calm",
    source: "fallback",
  },
  wrong_person: {
    stage: "routing",
    say_next: "Thank you. Who would be the best person to contact, and may I have their email?",
    delivery_cue: "Write it down. Pause.",
    reason: "Wrong person — get a name and email.",
    risk_flag: "handoff_needed",
    next_action: "handoff",
    tone: "Warm",
    source: "fallback",
  },
  close: {
    stage: "wrap_up",
    say_next: "Perfect, thank you. I’ll send a short note and keep it simple. Have a good day.",
    delivery_cue: "Smile. Keep it short.",
    reason: "Close cleanly after a next step.",
    risk_flag: "none",
    next_action: "wrap_up",
    tone: "Warm",
    source: "fallback",
  },
  missing_facts: {
    stage: "routing",
    say_next:
      "I don’t want to assume anything — who is the best person to confirm a few basic details about the clinic?",
    delivery_cue: "Verify. Do not invent.",
    reason: "Clinic phone, services, or contacts are unknown.",
    risk_flag: "unverified_claim",
    next_action: "ask_question",
    tone: "Calm",
    source: "fallback",
  },
  sensitive: {
    stage: "ask",
    say_next:
      "I want to make sure I give you an accurate answer. May I send that by email after I confirm it?",
    delivery_cue: "Do not guess. Offer email.",
    reason: "Question is outside verified context.",
    risk_flag: "sensitive_question",
    next_action: "schedule_followup",
    tone: "Direct",
    source: "fallback",
  },
  reset: {
    stage: "reset",
    say_next: RESET_SAY_NEXT,
    delivery_cue: "Breathe. Then one line.",
    reason: "Emergency reset — recover calmly.",
    risk_flag: "none",
    next_action: "pause",
    tone: "Calm",
    source: "reset",
  },
};

export function fallbackForGoal(goal: CallGoal): CoachSuggestion {
  if (goal === "Book follow-up") return { ...FALLBACKS.busy };
  if (goal === "Verify listing") return { ...FALLBACKS.discovery };
  if (goal === "Request permission") return { ...FALLBACKS.decision_maker };
  if (goal === "Re-engage") return { ...FALLBACKS.opening, say_next: "Hi, this is Jamil with Novalyte — we spoke briefly about your clinic’s online profile. Is now a bad time, or who should I reconnect with?" };
  return { ...FALLBACKS.opening };
}

export function fallbackFromTranscript(
  latest: string,
  clinic: ClinicContextPayload,
  stage: CoachStage,
): CoachSuggestion {
  const text = latest.toLowerCase();
  if (clinic.missing_facts.length > 0 && (stage === "opening" || stage === "routing" || stage === "relevance")) {
    return { ...FALLBACKS.missing_facts };
  }
  if (/\b(busy|in a meeting|can'?t talk|call back|no time)\b/.test(text)) return { ...FALLBACKS.busy };
  if (/\b(not interested|no thanks|remove|stop calling|don'?t call)\b/.test(text)) return { ...FALLBACKS.not_interested };
  if (/\b(wrong (person|number)|not me|you want|transfer)\b/.test(text)) return { ...FALLBACKS.wrong_person };
  if (/\b(regarding|what.?s this about|who is this|sales call)\b/.test(text)) return { ...FALLBACKS.receptionist };
  if (/\b(rank|traffic|leads?|guarantee|hipaa|compliant|how much|price|contract)\b/.test(text)) {
    return { ...FALLBACKS.sensitive };
  }
  if (stage === "wrap_up" || /\b(thanks|send (it|that)|email me)\b/.test(text)) return { ...FALLBACKS.close };
  if (stage === "discovery" || stage === "ask") return { ...FALLBACKS.discovery };
  if (stage === "reset") return { ...FALLBACKS.reset };
  return fallbackForGoal(clinic.call_goal);
}

export function recoveryLineForStage(stage: CoachStage): string {
  switch (stage) {
    case "opening":
      return "Sorry, let me say that more clearly. I’m calling from Novalyte about your clinic’s online profile.";
    case "routing":
      return "The short version is, we are verifying a few details so your information is accurate.";
    case "relevance":
      return "The short version is, we are verifying a few details so your information is accurate.";
    case "discovery":
      return "Who usually handles your online listings or marketing?";
    case "objection":
      return "That makes sense. Before I let you go, can I confirm who the right person would be for this?";
    case "ask":
      return "Would a short email be easier than covering this now?";
    case "wrap_up":
      return "I’ll keep it simple and send a short note. What’s the best email?";
    case "reset":
      return RESET_SAY_NEXT;
    default: {
      const _exhaustive: never = stage;
      return _exhaustive;
    }
  }
}

export { FALLBACKS };
