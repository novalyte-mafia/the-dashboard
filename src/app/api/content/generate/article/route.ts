import { NextRequest, NextResponse } from "next/server";
import { requireAdminRole } from "@/lib/auth";
import { articleRequestSchema } from "@/lib/content/generation-types";
import { generateArticleFromOutline } from "@/lib/content/glm-article";
import { recordGenerationProvenance } from "@/lib/content/provenance";

// Sectioned long-form generation can legitimately take several minutes.
export const maxDuration = 300;

/**
 * POST /api/content/generate/article
 * Generates the full article body from an editor-approved outline, section by
 * section with graceful partial failure (failed sections are flagged, not
 * fatal). The result is returned to the editor for explicit accept/apply —
 * this route never writes article content itself.
 */
export async function POST(req: NextRequest) {
  const admin = await requireAdminRole(["admin", "operations"]);
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const parsed = articleRequestSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request.", details: parsed.error.flatten() }, { status: 400 });
  }
  const input = parsed.data;

  try {
    const { article, meta } = await generateArticleFromOutline(input);

    let provenancePersisted = false;
    if (input.articleId) {
      provenancePersisted = await recordGenerationProvenance(input.articleId, {
        kind: "article",
        provider: "glm",
        model: meta.model,
        promptInputs: {
          outlineTitle: input.outline.title,
          outlineSections: input.outline.sections.map((s) => s.heading),
          category: input.category,
          audience: input.audience,
          searchIntent: input.searchIntent,
          primaryKeyword: input.primaryKeyword,
          secondaryKeywords: input.secondaryKeywords,
          notes: input.notes,
        },
        status: article.complete ? "succeeded" : "partial",
        attempts: meta.attempts,
        durationMs: meta.durationMs,
        articleId: input.articleId,
        createdBy: admin.id,
      });
    }

    return NextResponse.json({
      article,
      provenance: { model: meta.model, attempts: meta.attempts, durationMs: meta.durationMs, persisted: provenancePersisted },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Article generation failed.";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
