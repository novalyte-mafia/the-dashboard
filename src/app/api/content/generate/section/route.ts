import { NextRequest, NextResponse } from "next/server";
import { requireAdminRole } from "@/lib/auth";
import { sectionRequestSchema } from "@/lib/content/generation-types";
import { generateArticleSection } from "@/lib/content/glm-article";
import { recordGenerationProvenance } from "@/lib/content/provenance";

export const maxDuration = 120;

/**
 * POST /api/content/generate/section
 * Regenerates or improves a single article section. Returns the new section
 * for explicit editor accept — the current draft content is never touched.
 */
export async function POST(req: NextRequest) {
  const admin = await requireAdminRole(["admin", "operations"]);
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const parsed = sectionRequestSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request.", details: parsed.error.flatten() }, { status: 400 });
  }
  const input = parsed.data;

  try {
    const { section, meta } = await generateArticleSection(input);

    let provenancePersisted = false;
    if (input.articleId) {
      provenancePersisted = await recordGenerationProvenance(input.articleId, {
        kind: "section",
        provider: "glm",
        model: meta.model,
        promptInputs: {
          articleTitle: input.articleTitle,
          sectionHeading: input.sectionHeading,
          mode: input.mode,
          instruction: input.instruction,
          keyPoints: input.keyPoints,
          audience: input.audience,
          primaryKeyword: input.primaryKeyword,
        },
        status: "succeeded",
        attempts: meta.attempts,
        durationMs: meta.durationMs,
        articleId: input.articleId,
        createdBy: admin.id,
      });
    }

    return NextResponse.json({
      section,
      provenance: { model: meta.model, attempts: meta.attempts, durationMs: meta.durationMs, persisted: provenancePersisted },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Section generation failed.";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
