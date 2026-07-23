import { z } from "zod";

/**
 * Canonical Journal payload. This file is mirrored in both applications until
 * they share a package; update both copies in the same change.
 */
export const JOURNAL_ARTICLE_SCHEMA_VERSION = 1 as const;

export const journalArticleStatusSchema = z.enum([
  "idea",
  "brief",
  "draft",
  "review",
  "approved",
  "scheduled",
  "published",
  "update_needed",
  "archived",
]);

export const articleBlockSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("heading"),
    level: z.union([z.literal(2), z.literal(3)]),
    text: z.string().min(1),
    id: z.string().min(1),
  }),
  z.object({ type: z.literal("paragraph"), text: z.string() }),
  z.object({
    type: z.literal("list"),
    items: z.array(z.string()),
    ordered: z.boolean().optional(),
  }),
  z.object({
    type: z.literal("image"),
    src: z.string().min(1),
    alt: z.string().min(1),
    caption: z.string().optional(),
    aspect: z.enum(["wide", "standard"]).optional(),
  }),
  z.object({
    type: z.literal("video"),
    url: z.string().url(),
    title: z.string().min(1),
    caption: z.string().optional(),
  }),
  z.object({
    type: z.literal("callout"),
    tone: z.enum(["info", "warning", "tip"]),
    text: z.string(),
  }),
  z.object({
    type: z.literal("pullquote"),
    text: z.string().min(1),
    attribution: z.string().optional(),
  }),
  z.object({
    type: z.literal("cta"),
    variant: z.enum(["assessment", "directory", "custom"]),
    title: z.string().min(1),
    body: z.string(),
    primaryLabel: z.string().min(1),
    primaryHref: z.string().min(1),
    secondaryLabel: z.string().optional(),
    secondaryHref: z.string().optional(),
  }),
  z.object({
    type: z.literal("table"),
    headers: z.array(z.string()),
    rows: z.array(z.array(z.string())),
  }),
]);

export const journalMedicalReviewStatusSchema = z.enum([
  "draft",
  "editorial_review",
  "medical_review_required",
  "medically_reviewed",
  "approved",
  "published",
]);

export const journalAuthorSchema = z.object({
  name: z.string().min(1),
  role: z.string().min(1),
  bio: z.string(),
});

export const journalReviewerSchema = z.object({
  name: z.string().min(1),
  role: z.string().min(1),
});

export const journalArticleV1Schema = z.object({
  schemaVersion: z.literal(JOURNAL_ARTICLE_SCHEMA_VERSION),
  rowVersion: z.number().int().positive(),
  id: z.string().min(1),
  slug: z.string().min(1),
  title: z.string().min(1),
  excerpt: z.string(),
  category: z.string().min(1),
  tags: z.array(z.string()),
  status: journalArticleStatusSchema,
  author: journalAuthorSchema,
  medicalReviewer: journalReviewerSchema.nullable(),
  medicalReviewStatus: journalMedicalReviewStatusSchema.optional(),
  contentMarkdown: z.string().nullable(),
  body: z.array(articleBlockSchema),
  tableOfContents: z.array(z.object({
    id: z.string().min(1),
    title: z.string().min(1),
  })),
  references: z.array(z.object({
    label: z.string().min(1),
    source: z.string().min(1),
    url: z.string().url().nullable().optional(),
  })),
  faqs: z.array(z.object({
    question: z.string().min(1),
    answer: z.string().min(1),
  })),
  relatedTreatment: z.string().nullable(),
  readingTime: z.number().int().positive(),
  seo: z.object({
    title: z.string().nullable(),
    description: z.string().nullable(),
    canonicalUrl: z.string().url().nullable(),
    noIndex: z.boolean(),
  }),
  keywords: z.object({
    primary: z.string().nullable(),
    secondary: z.array(z.string()),
  }),
  hero: z.object({
    mediaId: z.string().uuid().nullable(),
    src: z.string(),
    alt: z.string(),
    caption: z.string().nullable(),
    aspect: z.enum(["wide", "standard"]).nullable(),
  }),
  scheduledFor: z.string().datetime({ offset: true }).nullable(),
  publishedAt: z.string().datetime({ offset: true }).nullable(),
  createdAt: z.string().datetime({ offset: true }),
  updatedAt: z.string().datetime({ offset: true }),
  deletedAt: z.string().datetime({ offset: true }).nullable(),
});

export type JournalArticleStatus = z.infer<typeof journalArticleStatusSchema>;
export type JournalArticleBlock = z.infer<typeof articleBlockSchema>;
export type JournalArticleV1 = z.infer<typeof journalArticleV1Schema>;

export function normalizeJournalSlug(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
