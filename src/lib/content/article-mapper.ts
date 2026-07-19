import { z } from "zod";
import {
  JOURNAL_ARTICLE_SCHEMA_VERSION,
  journalArticleStatusSchema,
  normalizeJournalSlug,
  type JournalArticleBlock,
  type JournalArticleStatus,
  type JournalArticleV1,
} from "@/lib/journal-article-v1";
import {
  countWords,
  estimateReadingTime,
  markdownToBlocks,
} from "@/lib/content/markdown-blocks";
import type { Article } from "@/types";

/** Raw Supabase "Article" row shape used by Command Center APIs. */
export type ArticleRow = Record<string, unknown>;

const authorFallback = {
  name: "Novalyte Editorial",
  role: "Editorial Team",
  bio: "",
};

function asIso(value: unknown, fallback = new Date().toISOString()): string {
  if (typeof value === "string" && value.trim()) {
    const d = new Date(value);
    if (!Number.isNaN(d.getTime())) return d.toISOString();
  }
  return fallback;
}

function asNullableIso(value: unknown): string | null {
  if (value == null || value === "") return null;
  if (typeof value === "string") {
    const d = new Date(value);
    if (!Number.isNaN(d.getTime())) return d.toISOString();
  }
  return null;
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((v): v is string => typeof v === "string" && v.trim().length > 0);
}

function parseJsonArray<T>(value: unknown, itemSchema: z.ZodType<T>): T[] {
  if (!Array.isArray(value)) return [];
  const out: T[] = [];
  for (const item of value) {
    const parsed = itemSchema.safeParse(item);
    if (parsed.success) out.push(parsed.data);
  }
  return out;
}

function parseAuthor(row: ArticleRow): JournalArticleV1["author"] {
  const json = row.authorJson;
  if (json && typeof json === "object") {
    const name = typeof (json as { name?: unknown }).name === "string"
      ? (json as { name: string }).name
      : null;
    const role = typeof (json as { role?: unknown }).role === "string"
      ? (json as { role: string }).role
      : "Author";
    const bio = typeof (json as { bio?: unknown }).bio === "string"
      ? (json as { bio: string }).bio
      : "";
    if (name) return { name, role, bio };
  }
  const legacyName =
    (typeof row.authorName === "string" && row.authorName.trim()) ||
    (typeof row.author === "string" && row.author.trim()) ||
    authorFallback.name;
  return { name: legacyName, role: "Author", bio: "" };
}

function parseReviewer(row: ArticleRow): JournalArticleV1["medicalReviewer"] {
  const json = row.medicalReviewerJson;
  if (json && typeof json === "object") {
    const name = typeof (json as { name?: unknown }).name === "string"
      ? (json as { name: string }).name
      : null;
    const role = typeof (json as { role?: unknown }).role === "string"
      ? (json as { role: string }).role
      : "Medical Reviewer";
    if (name) return { name, role };
  }
  if (typeof row.reviewerName === "string" && row.reviewerName.trim()) {
    return { name: row.reviewerName.trim(), role: "Medical Reviewer" };
  }
  // Legacy column is a plain string on live rows.
  if (typeof row.medicalReviewer === "string" && row.medicalReviewer.trim()) {
    return { name: row.medicalReviewer.trim(), role: "Medical Reviewer" };
  }
  return null;
}

function parseStatus(row: ArticleRow): JournalArticleStatus {
  const raw = typeof row.status === "string" ? row.status : null;
  const parsed = journalArticleStatusSchema.safeParse(raw);
  if (parsed.success) return parsed.data;
  if (row.publishedAt) return "published";
  return "draft";
}

function parseBody(row: ArticleRow): {
  body: JournalArticleBlock[];
  tableOfContents: { id: string; title: string }[];
  contentMarkdown: string | null;
} {
  const markdown =
    typeof row.contentMarkdown === "string"
      ? row.contentMarkdown
      : typeof row.content === "string"
        ? row.content
        : null;

  if (Array.isArray(row.bodyJson) && row.bodyJson.length > 0) {
    const blocks: JournalArticleBlock[] = [];
    for (const item of row.bodyJson) {
      // Soft-accept known block shapes; invalid blocks are dropped.
      if (item && typeof item === "object" && "type" in item) {
        blocks.push(item as JournalArticleBlock);
      }
    }
    const toc = Array.isArray(row.tableOfContents)
      ? (row.tableOfContents as { id: string; title: string }[])
      : blocks
          .filter(
            (b): b is Extract<JournalArticleBlock, { type: "heading" }> =>
              b.type === "heading" && b.level === 2,
          )
          .map((b) => ({ id: b.id, title: b.text }));
    return { body: blocks, tableOfContents: toc, contentMarkdown: markdown };
  }

  if (markdown) {
    const converted = markdownToBlocks(markdown);
    return {
      body: converted.blocks,
      tableOfContents: converted.tableOfContents,
      contentMarkdown: markdown,
    };
  }

  return { body: [], tableOfContents: [], contentMarkdown: markdown };
}

/** Map a Supabase row into the canonical JournalArticleV1 contract. */
export function rowToJournalArticle(row: ArticleRow): JournalArticleV1 {
  const { body, tableOfContents, contentMarkdown } = parseBody(row);
  const markdownForMetrics = contentMarkdown ?? "";
  const readingTime =
    typeof row.readingTime === "number" && row.readingTime > 0
      ? Math.floor(row.readingTime)
      : estimateReadingTime(markdownForMetrics || "word");

  const canonicalRaw =
    typeof row.canonicalUrl === "string" && row.canonicalUrl.trim()
      ? row.canonicalUrl.trim()
      : null;
  let canonicalUrl: string | null = null;
  if (canonicalRaw) {
    try {
      canonicalUrl = new URL(canonicalRaw).toString();
    } catch {
      canonicalUrl = null;
    }
  }

  return {
    schemaVersion: JOURNAL_ARTICLE_SCHEMA_VERSION,
    rowVersion:
      typeof row.rowVersion === "number" && row.rowVersion >= 1
        ? Math.floor(row.rowVersion)
        : 1,
    id: String(row.id ?? ""),
    slug: normalizeJournalSlug(String(row.slug ?? "")) || "untitled",
    title: String(row.title ?? "Untitled"),
    excerpt: typeof row.excerpt === "string" ? row.excerpt : "",
    category: typeof row.category === "string" && row.category.trim()
      ? row.category
      : "Uncategorized",
    tags: asStringArray(row.tags),
    status: parseStatus(row),
    author: parseAuthor(row),
    medicalReviewer: parseReviewer(row),
    contentMarkdown,
    body,
    tableOfContents,
    references: parseJsonArray(
      row.referencesJson,
      z.object({
        label: z.string().min(1),
        source: z.string().min(1),
        url: z.string().url().nullable().optional(),
      }),
    ),
    faqs: parseJsonArray(
      row.faqsJson,
      z.object({ question: z.string().min(1), answer: z.string().min(1) }),
    ),
    relatedTreatment:
      typeof row.relatedTreatment === "string" ? row.relatedTreatment : null,
    readingTime,
    seo: {
      title: typeof row.seoTitle === "string" ? row.seoTitle : null,
      description: typeof row.seoDescription === "string" ? row.seoDescription : null,
      canonicalUrl,
      noIndex: Boolean(row.seoNoIndex),
    },
    keywords: {
      primary: typeof row.primaryKeyword === "string" ? row.primaryKeyword : null,
      secondary: asStringArray(row.secondaryKeywords),
    },
    hero: {
      mediaId:
        typeof row.heroMediaId === "string" && row.heroMediaId
          ? row.heroMediaId
          : null,
      src: typeof row.heroImageUrl === "string" ? row.heroImageUrl : "",
      alt: typeof row.heroImageAlt === "string" ? row.heroImageAlt : "",
      caption: typeof row.heroImageCaption === "string" ? row.heroImageCaption : null,
      aspect:
        row.heroImageAspect === "wide" || row.heroImageAspect === "standard"
          ? row.heroImageAspect
          : null,
    },
    scheduledFor: asNullableIso(row.scheduledFor),
    publishedAt: asNullableIso(row.publishedAt ?? row.publishDate),
    createdAt: asIso(row.createdAt),
    updatedAt: asIso(row.updatedAt ?? row.createdAt),
    deletedAt: asNullableIso(row.deletedAt),
  };
}

/** List/DTO projection consumed by Content Studio and Articles views. */
export function rowToArticleListItem(row: ArticleRow): Article & {
  dataSource: "live";
  rowVersion: number;
  contentMarkdown: string | null;
  metaTitle?: string;
  metaDescription?: string;
  heroImageUrl?: string;
  readingTime?: number;
  updatedAt?: string;
  liveUrl?: string;
} {
  const article = rowToJournalArticle(row);
  const markdown = article.contentMarkdown ?? "";
  return {
    id: article.id,
    title: article.title,
    slug: article.slug,
    excerpt: article.excerpt,
    category: article.category,
    treatmentCategory: article.relatedTreatment ?? undefined,
    primaryKeyword: article.keywords.primary ?? undefined,
    secondaryKeywords: article.keywords.secondary,
    authorName: article.author.name,
    reviewerName: article.medicalReviewer?.name,
    status: article.status,
    wordCount: markdown ? countWords(markdown) : article.body.length ? undefined : 0,
    seoScore:
      typeof row.seoScore === "number" ? row.seoScore : undefined,
    readabilityScore:
      typeof row.readabilityScore === "number" ? row.readabilityScore : undefined,
    publishDate: article.publishedAt ?? undefined,
    views: Number(row.views ?? 0),
    createdAt: article.createdAt,
    dataSource: "live",
    rowVersion: article.rowVersion,
    contentMarkdown: article.contentMarkdown,
    metaTitle: article.seo.title ?? undefined,
    metaDescription: article.seo.description ?? undefined,
    heroImageUrl: article.hero.src || undefined,
    readingTime: article.readingTime,
    updatedAt: article.updatedAt,
    liveUrl: article.status === "published" ? `/journal/${article.slug}` : undefined,
  };
}

export type ArticleWriteInput = {
  title?: string;
  slug?: string;
  excerpt?: string;
  category?: string;
  status?: JournalArticleStatus;
  contentMarkdown?: string | null;
  body?: JournalArticleBlock[];
  tableOfContents?: { id: string; title: string }[];
  faqs?: { question: string; answer: string }[];
  references?: { label: string; source: string; url?: string | null }[];
  tags?: string[];
  author?: { name: string; role?: string; bio?: string };
  medicalReviewer?: { name: string; role?: string } | null;
  relatedTreatment?: string | null;
  seo?: {
    title?: string | null;
    description?: string | null;
    canonicalUrl?: string | null;
    noIndex?: boolean;
  };
  keywords?: {
    primary?: string | null;
    secondary?: string[];
  };
  hero?: {
    mediaId?: string | null;
    src?: string;
    alt?: string;
    caption?: string | null;
    aspect?: "wide" | "standard" | null;
  };
  scheduledFor?: string | null;
  publishedAt?: string | null;
  /** Expected optimistic version; omit on create. */
  rowVersion?: number;
  changeSummary?: string;
};

/** Build a Supabase write payload from editor input + optional existing row. */
export function buildArticleWritePayload(
  input: ArticleWriteInput,
  existing?: ArticleRow | null,
  options?: { bumpVersion?: boolean; adminId?: string },
): Record<string, unknown> {
  const existingArticle = existing ? rowToJournalArticle(existing) : null;
  const title = (input.title ?? existingArticle?.title ?? "Untitled").trim() || "Untitled";
  const slugSource = input.slug ?? existingArticle?.slug ?? title;
  const slug = normalizeJournalSlug(slugSource) || normalizeJournalSlug(title) || "untitled";

  const contentMarkdown =
    input.contentMarkdown !== undefined
      ? input.contentMarkdown
      : existingArticle?.contentMarkdown ?? null;

  let body = input.body ?? existingArticle?.body ?? [];
  let tableOfContents =
    input.tableOfContents ?? existingArticle?.tableOfContents ?? [];

  if (input.contentMarkdown !== undefined && input.body === undefined) {
    const converted = markdownToBlocks(input.contentMarkdown ?? "");
    body = converted.blocks;
    tableOfContents = converted.tableOfContents;
  }

  const author = input.author
    ? {
        name: input.author.name.trim() || authorFallback.name,
        role: input.author.role?.trim() || "Author",
        bio: input.author.bio ?? "",
      }
    : existingArticle?.author ?? authorFallback;

  const medicalReviewer =
    input.medicalReviewer === undefined
      ? existingArticle?.medicalReviewer ?? null
      : input.medicalReviewer
        ? {
            name: input.medicalReviewer.name.trim(),
            role: input.medicalReviewer.role?.trim() || "Medical Reviewer",
          }
        : null;

  const keywords = {
    primary:
      input.keywords?.primary !== undefined
        ? input.keywords.primary
        : existingArticle?.keywords.primary ?? null,
    secondary:
      input.keywords?.secondary !== undefined
        ? input.keywords.secondary
        : existingArticle?.keywords.secondary ?? [],
  };

  const seo = {
    title:
      input.seo?.title !== undefined
        ? input.seo.title
        : existingArticle?.seo.title ?? null,
    description:
      input.seo?.description !== undefined
        ? input.seo.description
        : existingArticle?.seo.description ?? null,
    canonicalUrl:
      input.seo?.canonicalUrl !== undefined
        ? input.seo.canonicalUrl
        : existingArticle?.seo.canonicalUrl ?? null,
    noIndex:
      input.seo?.noIndex !== undefined
        ? input.seo.noIndex
        : existingArticle?.seo.noIndex ?? false,
  };

  const hero = {
    mediaId:
      input.hero?.mediaId !== undefined
        ? input.hero.mediaId
        : existingArticle?.hero.mediaId ?? null,
    src:
      input.hero?.src !== undefined
        ? input.hero.src
        : existingArticle?.hero.src ?? "",
    alt:
      input.hero?.alt !== undefined
        ? input.hero.alt
        : existingArticle?.hero.alt ?? "",
    caption:
      input.hero?.caption !== undefined
        ? input.hero.caption
        : existingArticle?.hero.caption ?? null,
    aspect:
      input.hero?.aspect !== undefined
        ? input.hero.aspect
        : existingArticle?.hero.aspect ?? null,
  };

  const status = input.status ?? existingArticle?.status ?? "draft";
  const now = new Date().toISOString();
  const currentVersion = existingArticle?.rowVersion ?? 1;
  // Create starts at 1; updates bump unless explicitly disabled.
  const rowVersion = existing
    ? options?.bumpVersion === false
      ? currentVersion
      : currentVersion + 1
    : 1;

  const readingTime = estimateReadingTime(contentMarkdown || "word");
  const referencesJson = input.references ?? existingArticle?.references ?? [];

  // Only write columns that exist on the live "Article" table. Legacy string
  // columns (`author`, `medicalReviewer`, `references`, `content`) stay in sync
  // for older readers; never write invented columns like authorName/wordCount.
  return {
    title,
    slug,
    excerpt: input.excerpt ?? existingArticle?.excerpt ?? "",
    category: input.category ?? existingArticle?.category ?? "Uncategorized",
    status,
    content: contentMarkdown ?? "",
    contentMarkdown,
    bodyJson: body,
    tableOfContents,
    faqsJson: input.faqs ?? existingArticle?.faqs ?? [],
    referencesJson,
    // Keep legacy free-text references readable when structured JSON is empty.
    references:
      referencesJson.length > 0
        ? referencesJson
            .map((r) => `${r.label}: ${r.source}${r.url ? ` — ${r.url}` : ""}`)
            .join("\n")
        : typeof existing?.references === "string"
          ? existing.references
          : "",
    tags: input.tags ?? existingArticle?.tags ?? [],
    authorJson: author,
    author: author.name,
    medicalReviewerJson: medicalReviewer,
    medicalReviewer: medicalReviewer?.name ?? null,
    relatedTreatment:
      input.relatedTreatment !== undefined
        ? input.relatedTreatment
        : existingArticle?.relatedTreatment ?? null,
    seoTitle: seo.title,
    seoDescription: seo.description,
    canonicalUrl: seo.canonicalUrl,
    seoNoIndex: seo.noIndex,
    primaryKeyword: keywords.primary,
    secondaryKeywords: keywords.secondary,
    heroMediaId: hero.mediaId,
    heroImageUrl: hero.src || null,
    heroImageAlt: hero.alt || null,
    heroImageCaption: hero.caption,
    heroImageAspect: hero.aspect,
    scheduledFor:
      input.scheduledFor !== undefined
        ? input.scheduledFor
        : existingArticle?.scheduledFor ?? null,
    publishedAt:
      input.publishedAt !== undefined
        ? input.publishedAt
        : existingArticle?.publishedAt ?? null,
    readingTime,
    schemaVersion: JOURNAL_ARTICLE_SCHEMA_VERSION,
    rowVersion,
    updatedAt: now,
    ...(existing ? {} : { id: crypto.randomUUID(), createdAt: now }),
  };
}

export function computeAdvisorySeoScore(article: Pick<
  JournalArticleV1,
  "title" | "slug" | "excerpt" | "seo" | "keywords" | "hero" | "contentMarkdown" | "body"
>): { score: number; checks: { id: string; label: string; ok: boolean }[] } {
  const markdown = article.contentMarkdown ?? "";
  const words = countWords(markdown);
  const checks = [
    {
      id: "title-length",
      label: "Title length 10-70",
      ok: article.title.length > 10 && article.title.length < 70,
    },
    {
      id: "keyword-in-title",
      label: "Primary keyword in title",
      ok: Boolean(
        article.keywords.primary &&
          article.title.toLowerCase().includes(article.keywords.primary.toLowerCase()),
      ),
    },
    {
      id: "meta-title",
      label: "Meta title 10-60 chars",
      ok: Boolean(article.seo.title && article.seo.title.length > 10 && article.seo.title.length < 60),
    },
    {
      id: "meta-description",
      label: "Meta description 50-160 chars",
      ok: Boolean(
        article.seo.description &&
          article.seo.description.length > 50 &&
          article.seo.description.length < 160,
      ),
    },
    {
      id: "slug",
      label: "Slug set",
      ok: article.slug.length > 3,
    },
    {
      id: "body-depth",
      label: "Body >= 800 words",
      ok: words >= 800 || article.body.length >= 8,
    },
    {
      id: "hero",
      label: "Hero image + alt",
      ok: Boolean(article.hero.src && article.hero.alt),
    },
    {
      id: "secondary-keywords",
      label: "Secondary keywords",
      ok: article.keywords.secondary.length > 0,
    },
  ];
  const passed = checks.filter((c) => c.ok).length;
  const score = Math.round((passed / checks.length) * 100);
  return { score, checks };
}
