/**
 * Conversation reasoning for the live directory-permission call copilot.
 *
 * Design rules (see IMPLEMENTATION_PLAN.md):
 *  - Answer the clinic's LATEST direct question before advancing the checklist.
 *  - Reason over the latest GROUPED clinic turn, not scattered fragments.
 *  - Never falsely infer permission from an unrelated "yes".
 *  - Directory-permission only: never paid acquisition / advertising.
 *  - Cost questions: never Yes-framing.
 */

import type {
  ExtractedClinicFacts,
  QuestionIntent,
  ReasoningPolicy,
} from "./copilot-types";
import { responseForIntent, type CopilotResponseBundle } from "./response-library";
import { applyValidation } from "./suggestion-validator";

export type { ExtractedClinicFacts, QuestionIntent, ReasoningPolicy };
export type TranscriptTurn = { speaker: string; text: string; timestamp?: string };

// ---------------------------------------------------------------------------
// Fragment grouping — merge consecutive same-speaker lines into one turn.
// ---------------------------------------------------------------------------
export function groupTranscriptTurns(lines: TranscriptTurn[]): TranscriptTurn[] {
  const grouped: TranscriptTurn[] = [];
  for (const line of lines) {
    if (line.speaker === "Coach") continue;
    const text = (line.text ?? "").trim();
    if (!text) continue;
    const prev = grouped[grouped.length - 1];
    if (prev && prev.speaker === line.speaker) {
      prev.text = `${prev.text} ${text}`.replace(/\s+/g, " ").trim();
      prev.timestamp = line.timestamp ?? prev.timestamp;
    } else {
      grouped.push({ speaker: line.speaker, text, timestamp: line.timestamp });
    }
  }
  return grouped;
}

/** Parse a "Speaker: text" transcript string into grouped turns. */
export function parseTranscript(transcript: string): TranscriptTurn[] {
  const lines: TranscriptTurn[] = [];
  for (const raw of transcript.split("\n")) {
    const line = raw.trim();
    if (!line) continue;
    const m = line.match(/^(jamil|clinic|coach)\s*:\s*(.*)$/i);
    if (m) {
      lines.push({ speaker: normalizeSpeaker(m[1]), text: m[2].trim() });
    } else {
      lines.push({ speaker: "Clinic", text: line });
    }
  }
  return groupTranscriptTurns(lines);
}

function normalizeSpeaker(s: string): string {
  const l = s.toLowerCase();
  if (l === "jamil") return "Jamil";
  if (l === "coach") return "Coach";
  return "Clinic";
}

// ---------------------------------------------------------------------------
// Fact extraction
// ---------------------------------------------------------------------------
export function extractClinicFacts(transcript: string): ExtractedClinicFacts {
  const turns = parseTranscript(transcript);
  const clinicTurns = turns.filter((t) => t.speaker === "Clinic");
  const clinicText = clinicTurns.map((t) => t.text).join(" ");
  const lower = clinicText.toLowerCase();

  const phone = extractPhone(clinicText);
  const services = extractServices(clinicText);
  const acceptingNewPatients = extractAccepting(lower);
  const permissionGranted = detectPermissionGranted(turns);
  const permissionDeclined =
    /\b(not interested|no thank|don'?t want|do not (want|list)|don'?t list)\b/i.test(lower) &&
    !/\b(do not call|don'?t call|remove (us|me|our)|take us off|off your list)\b/i.test(lower);
  const doNotCall = /\b(do not call|don'?t call|never call|remove (us|me|our)|take us off|off your list|stop calling)\b/i.test(lower);

  return {
    phone,
    services,
    acceptingNewPatients,
    permissionGranted,
    permissionDeclined: permissionDeclined || doNotCall,
    doNotCall,
    rawClinicText: clinicText,
  };
}

function extractPhone(text: string): string | undefined {
  const direct = text.match(/(?:\+?1[\s.-]?)?\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}/);
  if (direct) {
    const d = direct[0].replace(/\D/g, "").slice(-10);
    if (d.length === 10) return d;
  }
  const spaced = text.match(/(?:\b\d\b[\s.,-]*){7,}/);
  if (spaced) {
    const d = spaced[0].replace(/\D/g, "");
    if (d.length >= 7) return d.slice(-10);
  }
  return undefined;
}

function extractServices(text: string): string | undefined {
  if (!/\b(trt|telehealth|glp-?1|hormone|medical spa|spa treatment|weight loss|hair|testosterone|men'?s health)\b/i.test(text)) {
    return undefined;
  }
  const verb = text.match(/\b(?:offer|provide|do|specialize in|we do)\s+([^.?!]{4,80})/i);
  if (verb?.[1]) return verb[1].trim();
  return text.match(/\b(trt|telehealth|glp-?1|hormone(?:\s+optimization)?|medical spa(?:\s+treatments?)?|weight loss|hair(?:\s+restoration)?|testosterone(?:\s+replacement)?)\b/i)?.[0];
}

function extractAccepting(lower: string): boolean | undefined {
  if (/\b(not accepting|no new patients|waitlist|fully booked|not taking)\b/i.test(lower)) return false;
  if (/\b(yes[,.]?\s+we\s+(do\s+)?accept|we (do|are) accept|accepting new patients|we are taking|taking new patients|we do accept)\b/i.test(lower)) return true;
  return undefined;
}

function detectPermissionGranted(turns: TranscriptTurn[]): boolean {
  const clinicTurns = turns.filter((t) => t.speaker === "Clinic");
  for (const turn of clinicTurns) {
    if (isFreshPermissionGrant(turns, turn)) return true;
  }
  return false;
}

function isFreshPermissionGrant(turns: TranscriptTurn[], latestClinic: TranscriptTurn): boolean {
  const lower = latestClinic.text.toLowerCase();
  if (/\?/.test(latestClinic.text) && /\b(calling|directory|listing)\b/i.test(lower)) return false;

  const affirmative = /\b(yes|sure|okay|ok|of course|absolutely|go ahead|that'?s fine|sounds good|fine by me|no problem)\b/i.test(lower);
  const listingContext = /\b(list|listing|include|directory|publish|add us|sign us up|put us on)\b/i.test(lower);
  if (affirmative && listingContext && !/\?/.test(latestClinic.text)) return true;

  if (/\b(you can|okay to|go ahead and|feel free to)\s+(list|include|add)\b/i.test(lower)) return true;
  if (/\blist us\b/i.test(lower) && /\b(free|no cost|no fee)\b/i.test(lower) && !/\?/.test(latestClinic.text)) return true;

  const isBareAffirmative = /^\s*(yes|sure|okay|ok|of course|absolutely|go ahead|that'?s fine|sounds good|fine|yep|yeah)[.! ]*$/i.test(latestClinic.text.trim());
  if (isBareAffirmative) {
    const idx = turns.indexOf(latestClinic);
    const priorJamil = [...turns.slice(0, idx)].reverse().find((t) => t.speaker === "Jamil");
    if (priorJamil && /\b(permission|list you|include you|add you|directory|publish)\b/i.test(priorJamil.text.toLowerCase())) {
      return true;
    }
  }
  return false;
}

// ---------------------------------------------------------------------------
// Intent detection — latest grouped clinic turn only.
// ---------------------------------------------------------------------------
export function detectLatestIntent(turns: TranscriptTurn[]): {
  intent: QuestionIntent;
  isQuestion: boolean;
  latest: string;
} {
  const clinicTurns = turns.filter((t) => t.speaker === "Clinic");
  const latestClinic = clinicTurns.at(-1);
  const latest = latestClinic?.text ?? "";
  const lower = latest.toLowerCase();
  const isQuestion = /\?/.test(latest) || /^(is|are|do|does|can|could|would|will|what|why|how|who|when|where)\b/i.test(lower.trim());

  // Highest priority: compliance exits
  if (/\b(do not call|don'?t call|never call|stop calling|remove (us|me|our)|take us off|off your list)\b/i.test(lower)) {
    return { intent: "do_not_call", isQuestion: false, latest };
  }
  if (/\b(not interested|no thank|don'?t want|do not want|don'?t list|do not (want|list))\b/i.test(lower)) {
    return { intent: "decline", isQuestion: false, latest };
  }

  if (/\b(busy|bad time|call back|not a good time|in a rush|slammed)\b/i.test(lower)) {
    return { intent: "busy_callback", isQuestion, latest };
  }
  if (/\b(owner|manager|doctor|provider).*(not|unavailable|out|isn'?t|busy)|not (here|available|in)\b/i.test(lower)) {
    return { intent: "owner_unavailable", isQuestion, latest };
  }

  if (latestClinic && isFreshPermissionGrant(turns, latestClinic)) {
    return { intent: "grant_permission", isQuestion: false, latest };
  }

  // Cost / free — include "is the listing free?" and "does it cost?"
  if (
    /\b(does|do|is|any|what).*(cost|fee|charge|pay|price)\b/i.test(lower) ||
    /\bhow much\b/i.test(lower) ||
    /\b(is|are)\s+(this|it|the\s+listing|your\s+directory|the\s+directory)\s+free\b/i.test(lower) ||
    /\b(free|cost|fee|charge|catch|price)\b/i.test(lower)
  ) {
    // Exclude pure grant lines that mention free as a condition without asking
    if (!(latestClinic && isFreshPermissionGrant(turns, latestClinic))) {
      return { intent: "ask_if_free", isQuestion: true, latest };
    }
  }

  if (/\b(selling|sales|are you trying to sell|marketing|solicit)\b/i.test(lower)) {
    return { intent: "ask_if_sales", isQuestion, latest };
  }
  if (/\b(hipaa|patient records|medical records|patient data|phi)\b/i.test(lower)) {
    return { intent: "ask_hipaa", isQuestion, latest };
  }
  if (/\b(google|yelp|healthgrades|are you with)\b/i.test(lower)) {
    return { intent: "are_you_google", isQuestion, latest };
  }
  if (/\bwhat is novalyte|who is novalyte|what'?s novalyte\b/i.test(lower)) {
    return { intent: "what_is_novalyte", isQuestion: true, latest };
  }
  if (/\b(where|how).*(get|find|got|found).*(number|info|information|us|name)|who gave you\b/i.test(lower)) {
    return { intent: "source_of_info", isQuestion: true, latest };
  }
  if (/\bhow (does|do) (the )?directory work|how do patients find\b/i.test(lower)) {
    return { intent: "how_directory_works", isQuestion: true, latest };
  }
  if (/\balready have (a )?website|we have (a )?website\b/i.test(lower)) {
    return { intent: "already_have_website", isQuestion, latest };
  }
  if (/\b(change|edit|modify|alter).*(information|info|details|listing)|will you change\b/i.test(lower)) {
    return { intent: "will_you_change_info", isQuestion, latest };
  }
  if (/\b(not accepting|no new patients|not taking new)\b/i.test(lower)) {
    return { intent: "not_accepting_patients", isQuestion, latest };
  }
  if (/\b(email|send (me|us|it|this)|mail (it|this|me))\b/i.test(lower)) {
    return { intent: "ask_for_email", isQuestion, latest };
  }

  if (
    /\b(calling|call).*(about|regarding|for).*(directory|listing|profile)\b/i.test(lower) ||
    /\b(about|regarding).*(directory|listing)\b/i.test(lower) ||
    /\bwhat.*(this|the) call.*(about|for)\b/i.test(lower) ||
    /\bwhat.*(is this|is it) (about|regarding)\b/i.test(lower) ||
    /\bwhy.*(are you|you) (calling|call)\b/i.test(lower) ||
    /\bhow can i (help|assist)\b/i.test(lower) ||
    /\bwhat is this regarding\b/i.test(lower) ||
    /\bwhat (listing|directory|service) is this\b/i.test(lower) ||
    /\bwhat is this\b/i.test(lower)
  ) {
    return { intent: "confirm_call_purpose", isQuestion: true, latest };
  }

  if (
    /\b(what|which) (details|info|information)\b/i.test(lower) ||
    /\bwhat do you need\b/i.test(lower) ||
    /\bwhat.*(need|collect|require)\b/i.test(lower)
  ) {
    return { intent: "ask_what_details", isQuestion: true, latest };
  }

  const facts = extractClinicFacts(turns.map((t) => `${t.speaker}: ${t.text}`).join("\n"));
  if (facts.phone || facts.services || facts.acceptingNewPatients !== undefined) {
    return { intent: "provide_info", isQuestion, latest };
  }

  if (/\b(hear you|can hear|hello|hi|good morning|good afternoon|speaking)\b/i.test(lower)) {
    return { intent: "smalltalk_or_greeting", isQuestion, latest };
  }

  return { intent: "unknown", isQuestion, latest };
}

export function buildReasoningPolicy(transcript: string): ReasoningPolicy {
  const turns = parseTranscript(transcript);
  const lastTurn = turns.at(-1);
  const { intent, isQuestion, latest } = detectLatestIntent(turns);
  const latestSpeaker = lastTurn?.speaker === "Jamil" ? "jamil" : lastTurn ? "clinic" : "none";

  const directQuestionIntents: QuestionIntent[] = [
    "confirm_call_purpose",
    "ask_if_free",
    "ask_if_sales",
    "ask_for_email",
    "ask_hipaa",
    "ask_what_details",
    "what_is_novalyte",
    "source_of_info",
    "how_directory_works",
    "are_you_google",
    "already_have_website",
    "will_you_change_info",
  ];

  const isDirectQuestion = latestSpeaker === "clinic" && (isQuestion || directQuestionIntents.includes(intent));
  const unanswered =
    isDirectQuestion ||
    intent === "busy_callback" ||
    intent === "decline" ||
    intent === "do_not_call" ||
    intent === "owner_unavailable" ||
    intent === "not_accepting_patients";

  let allowed: ReasoningPolicy["allowed_next_action"] = "collect_next_field";
  if (directQuestionIntents.includes(intent)) allowed = "answer_question";
  else if (intent === "busy_callback" || intent === "owner_unavailable" || intent === "not_accepting_patients") {
    allowed = "handle_objection";
  } else if (intent === "decline" || intent === "do_not_call") allowed = "close_call";
  else if (intent === "grant_permission" || intent === "provide_info") allowed = "acknowledge_and_verify";

  const blocked =
    allowed === "answer_question" || intent === "do_not_call" || intent === "decline"
      ? ["ask_for_email", "ask_for_phone", "ask_for_booking_url", "advance_checklist"]
      : [];

  return {
    latest_speaker: latestSpeaker,
    latest_utterance: latest,
    is_direct_question: isDirectQuestion,
    question_intent: intent,
    unanswered_question_exists: unanswered,
    allowed_next_action: allowed,
    blocked_actions: blocked,
  };
}

export type SuggestionResult = {
  suggestion: string;
  shorter: string;
  askNext: string | null;
  doNotSay: string[];
  freezeRecovery: string;
  reason: string;
  intent: QuestionIntent;
  policy: ReasoningPolicy;
  facts: ExtractedClinicFacts;
  source: "deterministic";
  bundle: CopilotResponseBundle;
  validationReasons: string[];
};

export function intentToCallStage(intent: QuestionIntent): string {
  switch (intent) {
    case "confirm_call_purpose":
    case "ask_if_sales":
    case "what_is_novalyte":
    case "smalltalk_or_greeting":
    case "are_you_google":
    case "source_of_info":
    case "how_directory_works":
    case "already_have_website":
      return "purpose_confirmation";
    case "ask_if_free":
    case "ask_hipaa":
    case "will_you_change_info":
      return "purpose";
    case "grant_permission":
    case "provide_info":
    case "ask_what_details":
    case "not_accepting_patients":
      return "verification";
    case "ask_for_email":
    case "busy_callback":
    case "owner_unavailable":
      return "follow_up";
    case "decline":
    case "do_not_call":
      return "closing";
    default:
      return "purpose";
  }
}

export function buildDeterministicCopilotPayload(input: {
  transcript: string;
  previousSuggestions?: string[];
}) {
  const result = suggestFromTranscriptContext(input);
  return {
    suggested_response: result.suggestion,
    shorter_response: result.shorter,
    ask_next: result.askNext,
    do_not_say: result.doNotSay,
    freeze_recovery: result.freezeRecovery,
    response_type: result.policy.is_direct_question ? ("direct_answer" as const) : ("question" as const),
    call_stage: intentToCallStage(result.intent),
    reason: result.reason,
    knowledge_sources: [] as Array<{ title: string; source: string; section: string }>,
    suggested_next_action:
      result.policy.allowed_next_action === "answer_question"
        ? "wait_for_clinic_response"
        : result.policy.allowed_next_action === "acknowledge_and_verify"
          ? "continue_verification"
          : result.policy.allowed_next_action === "close_call"
            ? "end_call_respectfully"
            : "continue_verification",
    confidence: result.policy.is_direct_question || result.intent === "do_not_call" ? 0.98 : 0.9,
    grounding_status: "grounded" as const,
    policy: result.policy,
    facts: result.facts,
    intent: result.intent,
    source: "deterministic" as const,
    validation_reasons: result.validationReasons,
  };
}

export function suggestFromTranscriptContext(input: {
  transcript: string;
  latestClinicUtterance?: string;
  previousSuggestions?: string[];
}): SuggestionResult {
  const transcript = input.transcript;
  const policy = buildReasoningPolicy(transcript);
  const facts = extractClinicFacts(transcript);
  const previous = input.previousSuggestions ?? [];

  const bundle = responseForIntent(policy.question_intent, facts, previous);
  const validated = applyValidation(policy.question_intent, bundle.primary, policy.blocked_actions);

  return {
    suggestion: validated.suggestion,
    shorter: bundle.shorter,
    askNext: bundle.askNext,
    doNotSay: bundle.doNotSay,
    freezeRecovery: bundle.freezeRecovery,
    reason: bundle.reason,
    intent: policy.question_intent,
    policy,
    facts,
    source: "deterministic",
    bundle: { ...bundle, primary: validated.suggestion },
    validationReasons: validated.validation.reasons,
  };
}
