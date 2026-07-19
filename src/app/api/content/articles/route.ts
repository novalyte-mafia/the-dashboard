import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSessionAdmin, requireAdminRole } from "@/lib/auth";
import {
  createArticle,
  listArticleRows,
  toListResponse,
} from "@/lib/content/article-store";
import { journalArticleStatusSchema } from "@/lib/journal-article-v1";

const createSchema = z.object({
  title: z.string().min(1).max(200),
  slug: z.string().max(200).optional(),
  excerpt: z.string().max(2000).optional(),
  category: z.string().min(1).max(120).optional(),
  status: journalArticleStatusSchema.optional(),
  contentMarkdown: z.string().max(200_000).optional(),
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
});

export async function GET(req: NextRequest) {
  if (!(await getSessionAdmin())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const status = req.nextUrl.searchParams.get("status") ?? undefined;
  try {
    const rows = await listArticleRows(status || undefined);
    return NextResponse.json({ articles: toListResponse(rows) });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unable to load articles.";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}

export async function POST(req: NextRequest) {
  const admin = await requireAdminRole(["admin", "operations"]);
  if (!admin)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const parsed = createSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid request.", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  try {
    const article = await createArticle(parsed.data, admin.id);
    return NextResponse.json({ article }, { status: 201 });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unable to create article.";
    const status = /unique|duplicate/i.test(message) ? 409 : 502;
    return NextResponse.json({ error: message }, { status });
  }
}
