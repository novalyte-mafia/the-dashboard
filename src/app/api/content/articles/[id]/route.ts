import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSessionAdmin, requireAdminRole } from "@/lib/auth";
import {
  VersionConflictError,
  computeAdvisorySeoScore,
  fetchArticleRow,
  rowToJournalArticle,
  updateArticle,
} from "@/lib/content/article-store";
import { articleBlockSchema, journalArticleStatusSchema } from "@/lib/journal-article-v1";

const patchSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  slug: z.string().max(200).optional(),
  excerpt: z.string().max(2000).optional(),
  category: z.string().min(1).max(120).optional(),
  status: journalArticleStatusSchema.optional(),
  contentMarkdown: z.string().max(200_000).nullable().optional(),
  body: z.array(articleBlockSchema).optional(),
  tableOfContents: z
    .array(z.object({ id: z.string().min(1), title: z.string().min(1) }))
    .optional(),
  faqs: z
    .array(z.object({ question: z.string().min(1), answer: z.string().min(1) }))
    .optional(),
  references: z
    .array(z.object({
      label: z.string().min(1),
      source: z.string().min(1),
      url: z.string().url().nullable().optional(),
    }))
    .optional(),
  tags: z.array(z.string()).optional(),
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
  scheduledFor: z.string().datetime({ offset: true }).nullable().optional(),
  publishedAt: z.string().datetime({ offset: true }).nullable().optional(),
  rowVersion: z.number().int().positive(),
  changeSummary: z.string().max(500).optional(),
});

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!(await getSessionAdmin())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  try {
    const row = await fetchArticleRow(id);
    if (!row) return NextResponse.json({ error: "Not found." }, { status: 404 });
    const article = rowToJournalArticle(row);
    const seo = computeAdvisorySeoScore(article);
    return NextResponse.json({ article, seo });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to load article.";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const admin = await requireAdminRole(["admin", "operations"]);
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const parsed = patchSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid request.", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  try {
    const article = await updateArticle(id, parsed.data, admin.id);
    const seo = computeAdvisorySeoScore(article);
    return NextResponse.json({ article, seo });
  } catch (error) {
    if (error instanceof VersionConflictError) {
      return NextResponse.json(
        { error: error.message, article: error.current, conflict: true },
        { status: 409 },
      );
    }
    const message = error instanceof Error ? error.message : "Unable to update article.";
    const status = /not found/i.test(message) ? 404 : /unique|duplicate/i.test(message) ? 409 : 502;
    return NextResponse.json({ error: message }, { status });
  }
}
