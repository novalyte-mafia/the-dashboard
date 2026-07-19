import { NextRequest, NextResponse } from "next/server";
import { requireAdminRole } from "@/lib/auth";
import { outlineRequestSchema } from "@/lib/content/generation-types";
import { generateArticleOutline } from "@/lib/content/glm-article";
import { recordGenerationProvenance } from "@/lib/content/provenance";

export const maxDuration = 120;

/**
 * POST /api/content/generate/outline
 * Generates a long-form article outline for editor approval. Never writes
 * article content — the editor applies the outline explicitly.
 */
export async function POST(req: NextRequest) {
  const admin = await requireAdminRole(["admin", "operations"]);
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const parsed = outlineRequestSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request.", details: parsed.error.flatten() }, { status: 400 });
  }
  const input = parsed.data;

  try {
    const { outline, meta } = await generateArticleOutline(input);

    let provenancePersisted = false;
    if (input.articleId) {
      provenancePersisted = await recordGenerationProvenance(input.articleId, {
        kind: "outline",
        provider: "glm",
        model: meta.model,
        promptInputs: {
          topic: input.topic,
          category: input.category,
          audience: input.audience,
          searchIntent: input.searchIntent,
          primaryKeyword: input.primaryKeyword,
          secondaryKeywords: input.secondaryKeywords,
          notes: input.notes,
          targetWordCount: input.targetWordCount,
        },
        status: "succeeded",
        attempts: meta.attempts,
        durationMs: meta.durationMs,
        articleId: input.articleId,
        createdBy: admin.id,
      });
    }

    return NextResponse.json({
      outline,
      provenance: { model: meta.model, attempts: meta.attempts, durationMs: meta.durationMs, persisted: provenancePersisted },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Outline generation failed.";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
