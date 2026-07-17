import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSessionAdmin } from "@/lib/auth";
import { generateKnowledgeAwareCopilot } from "@/lib/knowledge/copilot-generate";
import { buildFieldGuideStructuredResponse } from "@/lib/knowledge/guardrails";
import { formatKnowledgeForPrompt, retrieveKnowledge } from "@/lib/knowledge/retrieval";
import { generateFieldGuideSuggestion } from "@/lib/providers/glm-field-guide";

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
});

export async function POST(req: NextRequest) {
  if (!(await getSessionAdmin())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const parsed = schema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "Invalid coaching request." }, { status: 400 });

  const query = parsed.data.question?.trim() || parsed.data.transcript.split("\n").at(-1) || "";
  const retrieval = await retrieveKnowledge({ query, stage: parsed.data.stage, limit: 5 });
  const businessKnowledge = formatKnowledgeForPrompt(retrieval.chunks);

  try {
    const structured = await generateKnowledgeAwareCopilot({
      ...parsed.data,
      businessKnowledge,
      knowledgeChunks: retrieval.chunks,
    });

    return NextResponse.json({
      suggestion: structured.suggested_response,
      source: "ai",
      structured,
      retrieval: {
        categories: retrieval.categories,
        latencyMs: retrieval.latencyMs,
        chunkCount: retrieval.chunks.length,
      },
    });
  } catch {
    const fallbackText = generateFieldGuideSuggestion(query || parsed.data.transcript);
    const structured = buildFieldGuideStructuredResponse(fallbackText, retrieval.chunks, parsed.data.stage);
    return NextResponse.json({
      suggestion: structured.suggested_response,
      source: "field_guide",
      structured,
      retrieval: {
        categories: retrieval.categories,
        latencyMs: retrieval.latencyMs,
        chunkCount: retrieval.chunks.length,
      },
    });
  }
}
