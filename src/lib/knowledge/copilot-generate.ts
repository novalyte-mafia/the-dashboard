import "server-only";

import type { CopilotStructuredResponse, RetrievedKnowledgeChunk } from "@/lib/knowledge/types";
import {
  buildFieldGuideStructuredResponse,
  buildLowConfidenceResponse,
  sanitizeCompanyName,
  validateSuggestionAgainstKnowledge,
} from "@/lib/knowledge/guardrails";
import { generateFieldGuideSuggestion } from "@/lib/providers/glm-field-guide";
import { DIRECTORY_ONLY_COPILOT_RULES, sanitizeDirectoryOnlySuggestion, containsProhibitedCommercialLanguage } from "@/lib/calls/directory-only-guard";
import { extractClinicFacts, suggestFromTranscriptContext, buildReasoningPolicy } from "@/lib/calls/transcript-context";

const GLM_URL = process.env.GLM_API_URL?.trim() || "https://open.bigmodel.cn/api/paas/v4/chat/completions";

function sanitize(value: string, max = 5000) {
  return value
    .slice(0, max)
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, "[redacted email]")
    .replace(/(?:\+?1[ .-]?)?(?:\(\d{3}\)|\d{3})[ .-]?\d{3}[ .-]?\d{4}/g, "[redacted phone]");
}

function parseStructuredResponse(raw: string): Partial<CopilotStructuredResponse> | null {
  const trimmed = raw.trim();
  const jsonMatch = trimmed.match(/\{[\s\S]*\}/);
  if (!jsonMatch) return null;
  try {
    return JSON.parse(jsonMatch[0]) as Partial<CopilotStructuredResponse>;
  } catch {
    return null;
  }
}

export async function generateKnowledgeAwareCopilot(input: {
  clinicName: string;
  clinicContext: string;
  transcript: string;
  question?: string;
  stage?: string;
  qualificationSummary?: string;
  missingQualification?: string;
  detectedObjections?: string;
  previousSuggestions?: string;
  businessKnowledge: string;
  knowledgeChunks: RetrievedKnowledgeChunk[];
}): Promise<CopilotStructuredResponse> {
  const apiKey = process.env.GLM_API_KEY?.trim();
  if (!apiKey) throw new Error("GLM_API_KEY is not configured.");

  const facts = extractClinicFacts(input.transcript);
  const policy = buildReasoningPolicy(input.transcript);
  const contextHint = suggestFromTranscriptContext({
    transcript: input.transcript,
    latestClinicUtterance: input.question,
    previousSuggestions: (input.previousSuggestions ?? "").split("\n").filter(Boolean),
  });

  const systemPrompt = `You are a silent live-call coach for Jamil (founder of Novalyte AI). Suggest the NEXT sentence he should say out loud during a REAL, unscripted phone call that can go anywhere.
${DIRECTORY_ONLY_COPILOT_RULES}

HOW TO THINK (this is a live, dynamic conversation — not a script):
- The call is open-ended. The clinic may ask anything, change topic, get skeptical, or go off on a tangent. Follow the conversation naturally wherever it goes, while keeping the goal (free directory-listing permission) in mind.
- ALWAYS handle the clinic's LATEST message first. If it's a question, answer it directly. If it's an objection, address it. If it's a statement, acknowledge it. Only after that, gently move one step toward the goal.
- You are given a REASONING POLICY computed from the transcript. Treat "allowed_next_action" and "blocked_actions" as hard rules. If an action is blocked, do NOT do it, even if the checklist is incomplete.
- Never ask for a missing field while an unanswered direct question is still open.

VOICE & STYLE:
1. Sound like a real person on the phone — short, plain, warm, conversational. No brochure/marketing language.
2. Use contractions: "you're", "we're", "that's", "got it", "perfect", "yep".
3. Usually one sentence, max ~30 spoken words. Two short sentences only if genuinely needed to answer + nudge.
4. Company name is always "Novalyte AI".
5. Never invent stats, guarantees, HIPAA certs, partnerships, or paid offers.
6. Never repeat anything in previousSuggestions — say it a fresh way.
7. If FACTS ALREADY COLLECTED lists phone/services/accepting patients, do NOT ask for those again — acknowledge them.
8. If you genuinely don't know something factual, offer to confirm and follow up by email rather than guessing.

Return ONLY valid JSON:
suggested_response, response_type, call_stage, reason, knowledge_sources ([{title,source,section}]), suggested_next_action, confidence (0-1), grounding_status`;

  const reasoningBlock =
    `REASONING POLICY (obey this):\n` +
    `- latest_speaker: ${policy.latest_speaker}\n` +
    `- latest_utterance: ${sanitize(policy.latest_utterance, 400)}\n` +
    `- is_direct_question: ${policy.is_direct_question}\n` +
    `- question_intent: ${policy.question_intent}\n` +
    `- unanswered_question_exists: ${policy.unanswered_question_exists}\n` +
    `- allowed_next_action: ${policy.allowed_next_action}\n` +
    `- blocked_actions: ${policy.blocked_actions.join(", ") || "none"}\n`;

  const userPrompt =
    `Clinic: ${sanitize(input.clinicName, 200)}\n` +
    `Clinic context: ${sanitize(input.clinicContext, 1200)}\n` +
    `Call stage: ${sanitize(input.stage ?? "purpose", 100)}\n\n` +
    `${reasoningBlock}\n` +
    `FACTS ALREADY COLLECTED FROM TRANSCRIPT:\n` +
    `- phone: ${facts.phone ?? "unknown"}\n` +
    `- services: ${facts.services ?? "unknown"}\n` +
    `- accepting new patients: ${facts.acceptingNewPatients === undefined ? "unknown" : facts.acceptingNewPatients ? "yes" : "no"}\n` +
    `- permission: ${facts.permissionGranted ? "granted" : facts.permissionDeclined ? "declined" : "unknown"}\n` +
    `Checklist status: ${sanitize(input.qualificationSummary ?? "", 600)}\n` +
    `Still missing: ${sanitize(input.missingQualification ?? "", 600)}\n` +
    `Objections: ${sanitize(input.detectedObjections ?? "", 400)}\n` +
    `Previous suggestions (do not repeat): ${sanitize(input.previousSuggestions ?? "", 1200)}\n` +
    `Safe fallback line for this exact moment (use ONLY if you can't do better): ${sanitize(contextHint.suggestion, 300)}\n` +
    `Full recent transcript (oldest to newest):\n${sanitize(input.transcript, 6000)}\n` +
    `Clinic's latest utterance: ${sanitize(input.question ?? policy.latest_utterance, 500)}\n\n` +
    `APPROVED BUSINESS KNOWLEDGE:\n${sanitize(input.businessKnowledge, 4000)}`;

  const response = await fetch(GLM_URL, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: process.env.GLM_MODEL?.trim() || "glm-5",
      temperature: 0.3,
      max_tokens: 320,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
    }),
    signal: AbortSignal.timeout(25000),
    cache: "no-store",
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(`GLM request failed (${response.status}).`);

  const raw = payload.choices?.[0]?.message?.content ?? "";
  const parsed = parseStructuredResponse(raw);

  if (!parsed?.suggested_response) {
    const fallbackText = sanitizeCompanyName(
      generateFieldGuideSuggestion(
        input.transcript || input.question || "",
        (input.previousSuggestions ?? "").split("\n").filter(Boolean),
      ),
    );
    return buildFieldGuideStructuredResponse(fallbackText, input.knowledgeChunks, input.stage);
  }

  let suggested = sanitizeCompanyName(String(parsed.suggested_response).trim());
  if (containsProhibitedCommercialLanguage(suggested)) {
    suggested = sanitizeDirectoryOnlySuggestion(suggested);
  }

  // Policy guard: if there is an unanswered direct question but the model skipped
  // straight to a checklist ask (email/phone/booking) without addressing it,
  // fall back to the deterministic answer for that exact question.
  if (policy.allowed_next_action === "answer_question" && policy.blocked_actions.length) {
    const looksLikeFieldAsk =
      /\b(what'?s|what is|could i (get|grab)|can i (get|grab)|best) (the )?(email|phone|number|booking|website|address)\b/i.test(
        suggested,
      ) || /^(great|perfect|thanks|thank you)[.,!]*\s*(what'?s|and )/i.test(suggested);
    const addressesQuestion = /^(yes|no|sure|absolutely|of course|it'?s|we|that'?s|for the)\b/i.test(suggested);
    if (looksLikeFieldAsk && !addressesQuestion) {
      suggested = sanitizeCompanyName(contextHint.suggestion);
    }
  }

  // Block re-asking facts the clinic already gave
  const reaskPhone = /\b(phone|number)\b/i.test(suggested) && Boolean(facts.phone);
  const reaskServices = /\bservices?\b/i.test(suggested) && Boolean(facts.services);
  const reaskAccepting = /\baccepting new patients\b/i.test(suggested) && facts.acceptingNewPatients !== undefined;
  if (reaskPhone || reaskServices || reaskAccepting) {
    suggested = sanitizeCompanyName(contextHint.suggestion);
  }

  const validation = validateSuggestionAgainstKnowledge(suggested, input.knowledgeChunks);
  if (!validation.ok || !suggested) {
    return buildLowConfidenceResponse(input.knowledgeChunks);
  }

  const sources =
    Array.isArray(parsed.knowledge_sources) && parsed.knowledge_sources.length
      ? parsed.knowledge_sources.map((s: any) => ({
          title: String(s.title ?? "Knowledge"),
          source: String(s.source ?? "approved-knowledge"),
          section: String(s.section ?? ""),
        }))
      : input.knowledgeChunks.slice(0, 3).map((c) => ({ title: c.title, source: c.source, section: c.section }));

  return {
    suggested_response: suggested,
    response_type: (parsed.response_type as CopilotStructuredResponse["response_type"]) ?? "answer",
    call_stage: (parsed.call_stage as CopilotStructuredResponse["call_stage"]) ?? "purpose",
    reason: String(parsed.reason ?? "Grounded in approved Novalyte AI knowledge."),
    knowledge_sources: sources,
    suggested_next_action: String(parsed.suggested_next_action ?? "Continue verification"),
    confidence: Math.min(1, Math.max(0, Number(parsed.confidence ?? 0.8))),
    grounding_status:
      (parsed.grounding_status as CopilotStructuredResponse["grounding_status"]) ??
      (input.knowledgeChunks.length >= 2 ? "grounded" : "partial"),
  };
}
