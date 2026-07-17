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

  const systemPrompt = `You are the Novalyte AI live call strategist. Coach the human operator (Jamil) only — Jamil speaks to the clinic; you never speak as the clinic.
${DIRECTORY_ONLY_COPILOT_RULES}
Additional rules:
- Company name is always "Novalyte AI" (never Novolite, NovoLight, etc.)
- Answer the clinic's latest direct question BEFORE asking the next qualification question
- Use ONLY the APPROVED BUSINESS KNOWLEDGE below — do not invent facts, stats, guarantees, HIPAA certs, or partnerships
- Keep suggested_response to ONE natural spoken sentence (max ~35 words)
- Never repeat previousSuggestions verbatim
- Return ONLY valid JSON with keys: suggested_response, response_type, call_stage, reason, knowledge_sources (array of {title, source, section}), suggested_next_action, confidence (0-1), grounding_status`;

  const userPrompt =
    `Clinic: ${sanitize(input.clinicName, 200)}\n` +
    `Clinic context: ${sanitize(input.clinicContext, 1200)}\n` +
    `Call stage: ${sanitize(input.stage ?? "purpose", 100)}\n` +
    `Qualification: ${sanitize(input.qualificationSummary ?? "", 600)}\n` +
    `Missing checklist: ${sanitize(input.missingQualification ?? "", 600)}\n` +
    `Objections: ${sanitize(input.detectedObjections ?? "", 400)}\n` +
    `Previous suggestions (do not repeat): ${sanitize(input.previousSuggestions ?? "", 1200)}\n` +
    `Recent transcript:\n${sanitize(input.transcript, 3000)}\n` +
    `Clinic's latest question/objection: ${sanitize(input.question ?? "", 500)}\n\n` +
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
    const fallbackText = sanitizeCompanyName(generateFieldGuideSuggestion(input.question ?? input.transcript));
    return buildFieldGuideStructuredResponse(fallbackText, input.knowledgeChunks, input.stage);
  }

  let suggested = sanitizeCompanyName(String(parsed.suggested_response).trim());
  if (containsProhibitedCommercialLanguage(suggested)) {
    suggested = sanitizeDirectoryOnlySuggestion(suggested);
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
