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
import { extractClinicFacts, suggestFromTranscriptContext } from "@/lib/calls/transcript-context";

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
  const contextHint = suggestFromTranscriptContext({
    transcript: input.transcript,
    latestClinicUtterance: input.question,
    previousSuggestions: (input.previousSuggestions ?? "").split("\n").filter(Boolean),
  });

  const systemPrompt = `You are a silent live-call coach for Jamil (founder of Novalyte AI). Suggest the NEXT sentence he should say out loud.
${DIRECTORY_ONLY_COPILOT_RULES}

CRITICAL BEHAVIOR:
1. Read the full transcript. If the clinic already answered something, ACKNOWLEDGE it — never re-ask.
2. Respond to the clinic's LATEST line first (answer / thank / confirm), then ask at most ONE missing item.
3. Sound like a real person on a phone — short, plain, conversational. No brochure language. No "To make sure we list the clinic accurately…"
4. Prefer contractions: "you're", "we're", "that's", "got it", "perfect", "yep".
5. Max ~28 spoken words. One sentence only.
6. Company name is always "Novalyte AI".
7. Never invent stats, guarantees, HIPAA certs, partnerships, or paid offers.
8. Never repeat previousSuggestions.
9. If FACTS ALREADY COLLECTED lists phone/services/accepting patients, do NOT ask for those again.

Return ONLY valid JSON:
suggested_response, response_type, call_stage, reason, knowledge_sources ([{title,source,section}]), suggested_next_action, confidence (0-1), grounding_status`;

  const userPrompt =
    `Clinic: ${sanitize(input.clinicName, 200)}\n` +
    `Clinic context: ${sanitize(input.clinicContext, 1200)}\n` +
    `Call stage: ${sanitize(input.stage ?? "purpose", 100)}\n` +
    `FACTS ALREADY COLLECTED FROM TRANSCRIPT:\n` +
    `- phone: ${facts.phone ?? "unknown"}\n` +
    `- services: ${facts.services ?? "unknown"}\n` +
    `- accepting new patients: ${facts.acceptingNewPatients === undefined ? "unknown" : facts.acceptingNewPatients ? "yes" : "no"}\n` +
    `- permission: ${facts.permissionGranted ? "granted" : facts.permissionDeclined ? "declined" : "unknown"}\n` +
    `Checklist status: ${sanitize(input.qualificationSummary ?? "", 600)}\n` +
    `Still missing: ${sanitize(input.missingQualification ?? "", 600)}\n` +
    `Objections: ${sanitize(input.detectedObjections ?? "", 400)}\n` +
    `Previous suggestions (do not repeat): ${sanitize(input.previousSuggestions ?? "", 1200)}\n` +
    `Safe next-line hint (prefer adapting this): ${sanitize(contextHint.suggestion, 300)}\n` +
    `Recent transcript:\n${sanitize(input.transcript, 3000)}\n` +
    `Clinic's latest utterance: ${sanitize(input.question ?? "", 500)}\n\n` +
    `APPROVED BUSINESS KNOWLEDGE:\n${sanitize(input.businessKnowledge, 4000)}`;

  const response = await fetch(GLM_URL, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: process.env.GLM_MODEL?.trim() || "glm-5",
      temperature: 0.15,
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
