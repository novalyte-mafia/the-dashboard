/**
 * Pre- and post-generation validation for founder copilot suggestions.
 */

import { containsProhibitedCommercialLanguage } from "./directory-only-guard";
import type { QuestionIntent } from "./copilot-types";

export type ValidationResult = {
  ok: boolean;
  reasons: string[];
  rewritten?: string;
};

/** Cost / fee questions must not begin with affirmative "Yes". */
export function failsCostPolarity(intent: QuestionIntent, suggestion: string): boolean {
  if (intent !== "ask_if_free") return false;
  const trimmed = suggestion.trim();
  if (/^yes\b/i.test(trimmed)) return true;
  if (/^yep\b|^yeah\b/i.test(trimmed)) return true;
  // "Yes — it's free" style mid-openers
  if (/^yes\s*[—–,.-]/i.test(trimmed)) return true;
  return false;
}

export function isTooLongForLiveDelivery(suggestion: string, maxWords = 42): boolean {
  return suggestion.trim().split(/\s+/).filter(Boolean).length > maxWords;
}

export function validateSuggestion(input: {
  intent: QuestionIntent;
  suggestion: string;
  blockedActions?: string[];
}): ValidationResult {
  const reasons: string[] = [];
  let text = input.suggestion.trim();

  if (!text) {
    return { ok: false, reasons: ["empty_suggestion"] };
  }

  if (containsProhibitedCommercialLanguage(text)) {
    reasons.push("prohibited_commercial_language");
  }

  if (failsCostPolarity(input.intent, text)) {
    reasons.push("cost_polarity_yes_framing");
    text =
      "No — there's no fee and no obligation. The listing is completely free.";
  }

  if (input.intent === "do_not_call") {
    if (/\b(directory|list you|permission|email|phone number to list)\b/i.test(text) && !/don'?t contact|won'?t contact|do not contact|won'?t call|remove/i.test(text)) {
      reasons.push("dnc_continued_pitch");
      text = "Understood. I'll make sure we don't contact you again about this.";
    }
  }

  if (input.intent === "decline") {
    if (/\b(let me explain|just one more|are you sure|perfect time)\b/i.test(text)) {
      reasons.push("decline_persuasion");
      text = "Understood — thanks for your time. I'll close this out and won't push further.";
    }
  }

  if (input.blockedActions?.includes("ask_for_email") && /\bbest email\b/i.test(text)) {
    reasons.push("blocked_ask_for_email");
  }

  if (isTooLongForLiveDelivery(text)) {
    reasons.push("too_long_for_live_delivery");
  }

  const fatal = reasons.some((r) =>
    ["prohibited_commercial_language", "blocked_ask_for_email", "empty_suggestion"].includes(r),
  );

  if (fatal && containsProhibitedCommercialLanguage(input.suggestion)) {
    return {
      ok: false,
      reasons,
      rewritten:
        "This call is only about permission for your free Novalyte AI directory listing — there's no paid service involved today.",
    };
  }

  if (reasons.includes("cost_polarity_yes_framing") || reasons.includes("dnc_continued_pitch") || reasons.includes("decline_persuasion")) {
    return { ok: false, reasons, rewritten: text };
  }

  if (reasons.includes("too_long_for_live_delivery")) {
    return { ok: false, reasons };
  }

  if (reasons.includes("blocked_ask_for_email")) {
    return { ok: false, reasons };
  }

  return { ok: reasons.length === 0, reasons, rewritten: reasons.length ? text : undefined };
}

export function applyValidation(
  intent: QuestionIntent,
  suggestion: string,
  blockedActions: string[] = [],
): { suggestion: string; validation: ValidationResult } {
  const validation = validateSuggestion({ intent, suggestion, blockedActions });
  if (!validation.ok && validation.rewritten) {
    return { suggestion: validation.rewritten, validation };
  }
  if (!validation.ok && validation.reasons.includes("blocked_ask_for_email")) {
    return {
      suggestion:
        "Yes — I'm calling from Novalyte AI about permission to include your clinic in our free men's health directory.",
      validation,
    };
  }
  if (!validation.ok && validation.reasons.includes("too_long_for_live_delivery")) {
    const shortened = suggestion
      .split(/(?<=[.!?])\s+/)
      .slice(0, 2)
      .join(" ")
      .trim();
    return { suggestion: shortened || suggestion, validation };
  }
  return { suggestion, validation };
}
