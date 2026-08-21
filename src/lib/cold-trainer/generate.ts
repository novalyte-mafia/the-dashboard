import "server-only";

import { COLD_TRAINER_SYSTEM_PROMPT } from "./prompt";
import { fallbackFromTranscript, fallbackForGoal } from "./fallbacks";
import { parseCoachJson, sanitizeCoachSuggestion } from "./guardrails";
import { generateGeminiText, getGeminiApiKey } from "@/lib/providers/gemini";
import type { ClinicContextPayload, CoachStage, CoachSuggestion, PrepFields, TalkListenMetrics, TranscriptTurn } from "./types";

function sanitize(value: string, max = 5000) {
  return value.slice(0, max);
}

function formatTurns(turns: TranscriptTurn[]): string {
  if (!turns.length) return "(no transcript yet — call is just starting)";
  return turns
    .slice(-18)
    .map((t) => {
      const who = t.speaker === "founder" ? "Founder" : t.speaker === "prospect" ? "Prospect" : "Unknown";
      const mark = t.confident ? "" : " [uncertain]";
      return `${who}${mark}: ${t.text}`;
    })
    .join("\n");
}

export async function generateColdTrainerCoach(input: {
  clinic: ClinicContextPayload;
  turns: TranscriptTurn[];
  callGoal: ClinicContextPayload["call_goal"];
  currentStage: CoachStage;
  metrics: TalkListenMetrics;
  prep: PrepFields;
  stuck?: boolean;
}): Promise<CoachSuggestion> {
  const latest = [...input.turns].reverse().find((t) => t.speaker !== "founder")?.text
    ?? [...input.turns].reverse()[0]?.text
    ?? "";

  if (input.stuck) {
    return sanitizeCoachSuggestion(
      {
        stage: "reset",
        say_next: "Pause. Take one slow breath. Who usually handles your online listings or marketing?",
        delivery_cue: "Breathe. Then one question.",
        reason: "Founder asked for a reset — hand the floor back.",
        risk_flag: "none",
        next_action: "ask_question",
        source: "fallback",
      },
      input.clinic,
    );
  }

  if (!getGeminiApiKey()) {
    return sanitizeCoachSuggestion(fallbackFromTranscript(latest, input.clinic, input.currentStage), input.clinic);
  }

  const userPrompt = [
    `Clinic payload:\n${sanitize(JSON.stringify(input.clinic), 3500)}`,
    `Call goal: ${input.callGoal}`,
    `Current stage: ${input.currentStage}`,
    `Founder prep: ${sanitize(JSON.stringify(input.prep), 1200)}`,
    `Talk metrics: talk/listen cue="${input.metrics.supportiveCue}"; longest monologue ${Math.round(input.metrics.longestFounderMonologueMs / 1000)}s; questions=${input.metrics.questionCount}; WPM=${input.metrics.wordsPerMinute}; fillers=${input.metrics.fillerCount}; talking_too_long=${input.metrics.talkingTooLong}`,
    `Transcript:\n${sanitize(formatTurns(input.turns), 4000)}`,
    `Latest non-founder line: ${sanitize(latest || "(none)", 500)}`,
    "Return JSON only matching the schema. Never invent clinic facts.",
  ].join("\n\n");

  try {
    const content = await generateGeminiText({
      system: COLD_TRAINER_SYSTEM_PROMPT,
      user: userPrompt,
      temperature: 0.2,
      maxOutputTokens: 512,
      json: true,
      thinkingLevel: "minimal",
    });
    const parsed = parseCoachJson(content);
    if (!parsed?.say_next) throw new Error("Gemini returned no JSON.");
    return sanitizeCoachSuggestion({ ...parsed, source: "gemini" }, input.clinic);
  } catch {
    const fallback = input.turns.length === 0
      ? fallbackForGoal(input.callGoal)
      : fallbackFromTranscript(latest, input.clinic, input.currentStage);
    return sanitizeCoachSuggestion(fallback, input.clinic);
  }
}

const POST_CALL_SYSTEM_PROMPT = `You are C‑Cold Trainer giving private post-call feedback to a founder after a business outreach call for Novalyte.

Be supportive. Never give a numeric grade. Never shame. Never invent clinic facts, emails, phones, or contacts that are not in the transcript.

Return JSON only:
{
  "outcome": "connected|no_answer|gatekeeper|call_back_requested|information_requested|not_interested|permission_granted|other",
  "decisionMakerStatus": "short status",
  "contactName": "",
  "contactRole": "",
  "contactEmail": "",
  "verifiedDetails": "only facts from the transcript",
  "permissions": "",
  "objections": "",
  "promisedFollowUp": "",
  "nextAction": "one clear next step",
  "notes": "short call note",
  "scorecard": {
    "whatWentWell": "one specific supportive observation",
    "oneImprovement": "one thing to try next time",
    "shorterPhrase": "a shorter version of a long founder line, or the recommended opening",
    "nextCallOpening": "the exact first sentence for the next call",
    "coachSummary": "2-3 supportive sentences. No grade."
  }
}`;

export async function generatePostCallFeedback(input: {
  clinic: ClinicContextPayload;
  turns: TranscriptTurn[];
  metrics: TalkListenMetrics;
  prep: PrepFields;
  callGoal: ClinicContextPayload["call_goal"];
}): Promise<Record<string, unknown> | null> {
  if (!getGeminiApiKey()) return null;

  const userPrompt = [
    `Clinic: ${sanitize(JSON.stringify(input.clinic), 2500)}`,
    `Call goal: ${input.callGoal}`,
    `Prep: ${sanitize(JSON.stringify(input.prep), 800)}`,
    `Metrics: questions=${input.metrics.questionCount}; longest_monologue_s=${Math.round(input.metrics.longestFounderMonologueMs / 1000)}; WPM=${input.metrics.wordsPerMinute}; fillers=${input.metrics.fillerCount}; cue=${input.metrics.supportiveCue}`,
    `Transcript:\n${sanitize(formatTurns(input.turns), 5000)}`,
    "Write private post-call coaching. Supportive. No numeric grade. Never invent facts.",
  ].join("\n\n");

  try {
    const content = await generateGeminiText({
      system: POST_CALL_SYSTEM_PROMPT,
      user: userPrompt,
      temperature: 0.3,
      maxOutputTokens: 2048,
      json: true,
      thinkingLevel: "low",
    });
    const parsed = parseCoachJson(content);
    return parsed && typeof parsed === "object" ? (parsed as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}
