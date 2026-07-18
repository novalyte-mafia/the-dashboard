import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSessionAdmin } from "@/lib/auth";
import { buildDeterministicCopilotPayload } from "@/lib/calls/transcript-context";
import { buildFieldGuideStructuredResponse } from "@/lib/knowledge/guardrails";
import { formatKnowledgeForPrompt, retrieveKnowledge } from "@/lib/knowledge/retrieval";
import { generateKnowledgeAwareCopilot } from "@/lib/knowledge/copilot-generate";

const schema = z.object({
  clinicName: z.string().min(1).max(200),
  clinicContext: z.string().max(2000).default(""),
  transcript: z.string().max(6000).default(""),
  question: z.string().max(500).optional(),
  stage: z.string().max(200).optional(),
  qualificationSummary: z.string().max(800).optional(),
  missingQualification: z.string().max(800).optional(),
  detectedObjections: z.string().max(800).optional(),
  previousSuggestions: z.string().max(1600).optional(),
  requestSeq: z.number().int().optional(),
  transcriptRevision: z.number().int().optional(),
});

/** Intents that must never be delegated to the model — deterministic only. */
const DETERMINISTIC_ONLY = new Set([
  "confirm_call_purpose",
  "ask_if_free",
  "ask_if_sales",
  "ask_for_email",
  "ask_hipaa",
  "busy_callback",
  "decline",
  "do_not_call",
  "grant_permission",
  "owner_unavailable",
  "ask_what_details",
  "what_is_novalyte",
  "source_of_info",
  "how_directory_works",
  "are_you_google",
  "already_have_website",
  "will_you_change_info",
  "not_accepting_patients",
  "smalltalk_or_greeting",
  "unknown",
  "provide_info",
]);

export async function POST(req: NextRequest) {
  if (!(await getSessionAdmin())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const parsed = schema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "Invalid coaching request." }, { status: 400 });

  const transcript = parsed.data.transcript || "";
  const previousSuggestions = (parsed.data.previousSuggestions ?? "").split("\n").filter(Boolean);
  const query =
    parsed.data.question?.trim() ||
    transcript
      .split("\n")
      .filter((l) => /^clinic\s*:/i.test(l.trim()))
      .at(-1)
      ?.replace(/^clinic\s*:\s*/i, "") ||
    "";

  const retrieval = await retrieveKnowledge({ query, stage: parsed.data.stage, limit: 5 });
  const businessKnowledge = formatKnowledgeForPrompt(retrieval.chunks);

  const deterministic = buildDeterministicCopilotPayload({ transcript, previousSuggestions });

  // Attach retrieved knowledge titles for UI inspection
  const knowledge_sources = retrieval.chunks.slice(0, 3).map((c) => ({
    title: c.title,
    source: c.source,
    section: c.section,
  }));
  deterministic.knowledge_sources = knowledge_sources;

  // Primary path: deterministic for all permission-call intents (GLM disabled for v1 trust)
  if (DETERMINISTIC_ONLY.has(deterministic.intent) || deterministic.policy.unanswered_question_exists) {
    return NextResponse.json({
      suggestion: deterministic.suggested_response,
      shorter: deterministic.shorter_response,
      askNext: deterministic.ask_next,
      doNotSay: deterministic.do_not_say,
      freezeRecovery: deterministic.freeze_recovery,
      reason: deterministic.reason,
      source: "deterministic",
      structured: deterministic,
      policy: deterministic.policy,
      facts: deterministic.facts,
      intent: deterministic.intent,
      requestSeq: parsed.data.requestSeq,
      transcriptRevision: parsed.data.transcriptRevision,
      retrieval: {
        categories: retrieval.categories,
        latencyMs: retrieval.latencyMs,
        chunkCount: retrieval.chunks.length,
      },
    });
  }

  // Secondary: model may personalize acknowledge/provide_info — still policy-guarded
  try {
    const structured = await generateKnowledgeAwareCopilot({
      ...parsed.data,
      businessKnowledge,
      knowledgeChunks: retrieval.chunks,
    });
    return NextResponse.json({
      suggestion: structured.suggested_response,
      source: "ai",
      structured: { ...structured, policy: deterministic.policy, intent: deterministic.intent },
      policy: deterministic.policy,
      facts: deterministic.facts,
      requestSeq: parsed.data.requestSeq,
      transcriptRevision: parsed.data.transcriptRevision,
      retrieval: {
        categories: retrieval.categories,
        latencyMs: retrieval.latencyMs,
        chunkCount: retrieval.chunks.length,
      },
    });
  } catch {
    const structured = buildFieldGuideStructuredResponse(
      deterministic.suggested_response,
      retrieval.chunks,
      parsed.data.stage,
    );
    return NextResponse.json({
      suggestion: structured.suggested_response,
      source: "deterministic_fallback",
      structured: { ...structured, policy: deterministic.policy, intent: deterministic.intent },
      policy: deterministic.policy,
      facts: deterministic.facts,
      requestSeq: parsed.data.requestSeq,
      transcriptRevision: parsed.data.transcriptRevision,
      retrieval: {
        categories: retrieval.categories,
        latencyMs: retrieval.latencyMs,
        chunkCount: retrieval.chunks.length,
      },
    });
  }
}
