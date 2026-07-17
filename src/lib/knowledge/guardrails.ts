import { sanitizeDirectoryOnlySuggestion, containsProhibitedCommercialLanguage } from "@/lib/calls/directory-only-guard";
import type { CopilotStructuredResponse, RetrievedKnowledgeChunk } from "./types";

const PROHIBITED_CLAIM_PATTERNS = [
  /\bguarantee(s|d)?\b.*\b(patients?|leads?|revenue|bookings?)\b/i,
  /\b\d+\s*(patients?|leads?|bookings?)\s*(per|a)\s*(month|week)\b/i,
  /\bhipaa\s*certified\b/i,
  /\bofficial\s*partner(ship)?\b/i,
  /\bnovolite\b/i,
  /\bnovolight\b/i,
];

export function sanitizeCompanyName(text: string): string {
  return text
    .replace(/\bNovolite\b/gi, "Novalyte AI")
    .replace(/\bNovoLight\b/gi, "Novalyte AI")
    .replace(/\bNovolyte\b/gi, "Novalyte AI")
    .replace(/\bNovalyte\b(?!\s*AI)/gi, "Novalyte AI");
}

export function validateSuggestionAgainstKnowledge(
  suggestion: string,
  chunks: RetrievedKnowledgeChunk[],
): { ok: boolean; reason?: string } {
  for (const pattern of PROHIBITED_CLAIM_PATTERNS) {
    if (pattern.test(suggestion)) {
      return { ok: false, reason: "Suggestion contains a prohibited claim pattern." };
    }
  }

  if (/guarantee/i.test(suggestion) && !chunks.some((c) => c.category === "compliance")) {
    return { ok: false, reason: "Guarantee language without compliance grounding." };
  }

  return { ok: true };
}

export function buildLowConfidenceResponse(chunks: RetrievedKnowledgeChunk[]): CopilotStructuredResponse {
  return {
    suggested_response:
      "I want to make sure I give you the correct information — let me confirm that and follow up with you by email.",
    response_type: "clarification",
    call_stage: "follow_up",
    reason: chunks.length ? "Partial knowledge match — safer to confirm in writing." : "No approved knowledge matched this question.",
    knowledge_sources: chunks.map((c) => ({ title: c.title, source: c.source, section: c.section })),
    suggested_next_action: "Confirm by email",
    confidence: 0.35,
    grounding_status: chunks.length ? "partial" : "no_knowledge",
  };
}

export function buildFieldGuideStructuredResponse(
  suggestion: string,
  chunks: RetrievedKnowledgeChunk[],
  stage?: string,
): CopilotStructuredResponse {
  const cleaned = sanitizeCompanyName(suggestion);
  if (containsProhibitedCommercialLanguage(cleaned)) {
    return buildFieldGuideStructuredResponse(sanitizeDirectoryOnlySuggestion(cleaned), chunks, stage);
  }
  const validation = validateSuggestionAgainstKnowledge(cleaned, chunks);
  if (!validation.ok) return buildLowConfidenceResponse(chunks);

  return {
    suggested_response: cleaned,
    response_type: /^\s*(yes|no|of course|absolutely)/i.test(cleaned) ? "answer" : "question",
    call_stage: (stage as CopilotStructuredResponse["call_stage"]) ?? "purpose",
    reason: "Matched approved field guide / retrieved knowledge.",
    knowledge_sources: chunks.slice(0, 3).map((c) => ({ title: c.title, source: c.source, section: c.section })),
    suggested_next_action: "Continue directory verification",
    confidence: chunks.length ? 0.75 : 0.55,
    grounding_status: chunks.length >= 2 ? "grounded" : "partial",
  };
}
