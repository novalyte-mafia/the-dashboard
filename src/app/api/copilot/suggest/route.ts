import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSessionAdmin } from "@/lib/auth";
import { generateKnowledgeAwareCopilot } from "@/lib/knowledge/copilot-generate";
import { buildFieldGuideStructuredResponse } from "@/lib/knowledge/guardrails";
import { formatKnowledgeForPrompt, retrieveKnowledge } from "@/lib/knowledge/retrieval";
import { generateFieldGuideSuggestion } from "@/lib/providers/glm-field-guide";
import { extractClinicFacts } from "@/lib/calls/transcript-context";
import { getClinicIntelligence } from "@/lib/clinic-intelligence";

const schema = z.object({
  clinicName: z.string().min(1).max(200),
  clinicContext: z.string().max(2000).default(""),
  clinicId: z.string().max(120).optional(),
  transcript: z.string().max(6000).default(""),
  question: z.string().max(500).optional(),
  stage: z.string().max(200).optional(),
  qualificationSummary: z.string().max(800).optional(),
  missingQualification: z.string().max(800).optional(),
  detectedObjections: z.string().max(800).optional(),
  previousSuggestions: z.string().max(1600).optional(),
});

function formatClinicIntelligenceForPrompt(profile: Awaited<ReturnType<typeof getClinicIntelligence>>): string {
  if (!profile) return "";
  const facts = (profile.notableFacts || [])
    .filter((f) => f.confidence === "high" || f.confidence === "medium")
    .map((f) => `- ${f.text}`)
    .join("\n");
  return [
    `CLINIC INTELLIGENCE (verified/public only — do not invent beyond this):`,
    `Fit: ${profile.fitStatus} · Category: ${profile.primaryCategory || "unknown"}`,
    `Summary: ${profile.shortSummary || "not verified yet"}`,
    `Services: ${(profile.services || []).slice(0, 8).join(", ") || "unverified"}`,
    `Location: ${[profile.city, profile.state].filter(Boolean).join(", ") || "unverified"}`,
    `Conversation focus: ${profile.conversationFocus || "permission for free directory listing"}`,
    `Missing: ${(profile.missingInformation || []).slice(0, 6).join("; ") || "none listed"}`,
    facts ? `Verified facts:\n${facts}` : "Verified facts: none yet — ask the clinic.",
    `If a detail is unverified, say so and recommend asking the clinic. Never invent clinic facts.`,
  ].join("\n");
}

export async function POST(req: NextRequest) {
  if (!(await getSessionAdmin())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const parsed = schema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "Invalid coaching request." }, { status: 400 });

  const query = parsed.data.question?.trim() || parsed.data.transcript.split("\n").at(-1) || "";
  const retrieval = await retrieveKnowledge({ query, stage: parsed.data.stage, limit: 5 });
  let businessKnowledge = formatKnowledgeForPrompt(retrieval.chunks);

  if (parsed.data.clinicId) {
    try {
      const intel = await getClinicIntelligence(parsed.data.clinicId);
      const intelBlock = formatClinicIntelligenceForPrompt(intel);
      if (intelBlock) businessKnowledge = `${intelBlock}\n\n${businessKnowledge}`;
    } catch {
      /* ignore intelligence load failures */
    }
  }

  const clinicContext = [
    parsed.data.clinicContext,
    parsed.data.clinicId ? `(clinicId ${parsed.data.clinicId})` : "",
  ]
    .filter(Boolean)
    .join(" ")
    .slice(0, 2000);

  try {
    const structured = await generateKnowledgeAwareCopilot({
      ...parsed.data,
      clinicContext,
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
    const fallbackText = generateFieldGuideSuggestion(
      parsed.data.transcript || query,
      (parsed.data.previousSuggestions ?? "").split("\n").filter(Boolean),
    );
    const structured = buildFieldGuideStructuredResponse(fallbackText, retrieval.chunks, parsed.data.stage);
    const facts = extractClinicFacts(parsed.data.transcript || query);
    return NextResponse.json({
      suggestion: structured.suggested_response,
      source: "field_guide",
      structured,
      facts,
      retrieval: {
        categories: retrieval.categories,
        latencyMs: retrieval.latencyMs,
        chunkCount: retrieval.chunks.length,
      },
    });
  }
}
