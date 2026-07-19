import { NextRequest, NextResponse } from "next/server";
import { requireAdminRole } from "@/lib/auth";
import { seoRequestSchema } from "@/lib/content/generation-types";
import { generateSeoSuggestions } from "@/lib/content/glm-article";
import { recordGenerationProvenance } from "@/lib/content/provenance";

export const maxDuration = 60;

/**
 * POST /api/content/generate/seo
 * Suggests SEO metadata (title, description, slug, qualitative keyword ideas).
 * Keyword suggestions are labeled `keywordSource: "ai_suggestion"` and never
 * include invented volume/CPC/difficulty metrics.
 */
export async function POST(req: NextRequest) {
  const admin = await requireAdminRole(["admin", "operations"]);
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const parsed = seoRequestSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request.", details: parsed.error.flatten() }, { status: 400 });
  }
  const input = parsed.data;

  try {
    const { seo, meta } = await generateSeoSuggestions(input);

    let provenancePersisted = false;
    if (input.articleId) {
      provenancePersisted = await recordGenerationProvenance(input.articleId, {
        kind: "seo",
        provider: "glm",
        model: meta.model,
        promptInputs: {
          title: input.title,
          category: input.category,
          primaryKeyword: input.primaryKeyword,
          excerptLength: input.excerpt?.length ?? 0,
          contentLength: input.contentMarkdown?.length ?? 0,
        },
        status: "succeeded",
        attempts: meta.attempts,
        durationMs: meta.durationMs,
        articleId: input.articleId,
        createdBy: admin.id,
      });
    }

    return NextResponse.json({
      seo,
      provenance: { model: meta.model, attempts: meta.attempts, durationMs: meta.durationMs, persisted: provenancePersisted },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "SEO suggestion failed.";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
