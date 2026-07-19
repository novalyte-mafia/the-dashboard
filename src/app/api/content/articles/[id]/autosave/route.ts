import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAdminRole } from "@/lib/auth";
import {
  VersionConflictError,
  computeAdvisorySeoScore,
  updateArticle,
} from "@/lib/content/article-store";
import { articleBlockSchema } from "@/lib/journal-article-v1";

/**
 * Lightweight optimistic autosave. Same write path as PATCH, but scoped to
 * draft content fields and always recorded as an "Autosave" revision summary.
 */
const autosaveSchema = z.object({
  rowVersion: z.number().int().positive(),
  title: z.string().min(1).max(200).optional(),
  slug: z.string().max(200).optional(),
  excerpt: z.string().max(2000).optional(),
  category: z.string().min(1).max(120).optional(),
  contentMarkdown: z.string().max(200_000).nullable().optional(),
  body: z.array(articleBlockSchema).optional(),
  author: z
    .object({
      name: z.string().min(1),
      role: z.string().optional(),
      bio: z.string().optional(),
    })
    .optional(),
  medicalReviewer: z
    .object({ name: z.string().min(1), role: z.string().optional() })
    .nullable()
    .optional(),
  relatedTreatment: z.string().nullable().optional(),
  seo: z
    .object({
      title: z.string().nullable().optional(),
      description: z.string().nullable().optional(),
      canonicalUrl: z.string().nullable().optional(),
      noIndex: z.boolean().optional(),
    })
    .optional(),
  keywords: z
    .object({
      primary: z.string().nullable().optional(),
      secondary: z.array(z.string()).optional(),
    })
    .optional(),
  hero: z
    .object({
      mediaId: z.string().uuid().nullable().optional(),
      src: z.string().optional(),
      alt: z.string().optional(),
      caption: z.string().nullable().optional(),
      aspect: z.enum(["wide", "standard"]).nullable().optional(),
    })
    .optional(),
});

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const admin = await requireAdminRole(["admin", "operations"]);
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const parsed = autosaveSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid request.", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  try {
    const article = await updateArticle(
      id,
      { ...parsed.data, changeSummary: "Autosave" },
      admin.id,
    );
    const seo = computeAdvisorySeoScore(article);
    return NextResponse.json({ article, seo });
  } catch (error) {
    if (error instanceof VersionConflictError) {
      return NextResponse.json(
        { error: error.message, article: error.current, conflict: true },
        { status: 409 },
      );
    }
    const message = error instanceof Error ? error.message : "Autosave failed.";
    const status = /not found/i.test(message) ? 404 : /unique|duplicate/i.test(message) ? 409 : 502;
    return NextResponse.json({ error: message }, { status });
  }
}
