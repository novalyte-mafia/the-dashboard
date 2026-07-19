import { z } from "zod";
import { articleBlockSchema } from "@/lib/journal-article-v1";

/**
 * Shared request/response contracts for GLM long-form generation.
 * This module is intentionally client-safe (no server-only imports) so the
 * Content Studio service layer can reuse the types.
 */

export const GENERATION_KINDS = ["outline", "article", "section", "seo"] as const;
export type GenerationKind = (typeof GENERATION_KINDS)[number];

// ---------------------------------------------------------------------------
// Outline
// ---------------------------------------------------------------------------
export const outlineRequestSchema = z.object({
  articleId: z.string().min(1).optional(),
  topic: z.string().min(3).max(300),
  category: z.string().max(120).optional(),
  audience: z.string().max(120).optional(),
  searchIntent: z.string().max(60).optional(),
  primaryKeyword: z.string().max(120).optional(),
  secondaryKeywords: z.array(z.string().max(120)).max(20).default([]),
  notes: z.string().max(2000).optional(),
  targetWordCount: z.number().int().min(400).max(6000).default(1800),
});
export type OutlineRequest = z.infer<typeof outlineRequestSchema>;

export const outlineSectionSchema = z.object({
  heading: z.string().min(1).max(200),
  summary: z.string().max(1000).default(""),
  keyPoints: z.array(z.string().max(400)).max(12).default([]),
  targetWords: z.number().int().positive().max(2000).optional(),
});
export type OutlineSection = z.infer<typeof outlineSectionSchema>;

export const generatedOutlineSchema = z.object({
  title: z.string().min(1).max(200),
  alternativeTitles: z.array(z.string().max(200)).max(8).default([]),
  slug: z.string().min(1).max(200),
  excerpt: z.string().max(600).default(""),
  sections: z.array(outlineSectionSchema).min(3).max(15),
  faqs: z
    .array(z.object({ question: z.string().max(300), answer: z.string().max(1200) }))
    .max(10)
    .default([]),
});
export type GeneratedOutline = z.infer<typeof generatedOutlineSchema>;

// ---------------------------------------------------------------------------
// Full article from an approved outline
// ---------------------------------------------------------------------------
export const articleRequestSchema = z.object({
  articleId: z.string().min(1).optional(),
  outline: generatedOutlineSchema,
  category: z.string().max(120).optional(),
  audience: z.string().max(120).optional(),
  searchIntent: z.string().max(60).optional(),
  primaryKeyword: z.string().max(120).optional(),
  secondaryKeywords: z.array(z.string().max(120)).max(20).default([]),
  notes: z.string().max(2000).optional(),
});
export type ArticleRequest = z.infer<typeof articleRequestSchema>;

export const generatedSectionSchema = z.object({
  heading: z.string(),
  markdown: z.string(),
  status: z.enum(["generated", "failed"]),
  error: z.string().optional(),
});
export type GeneratedSection = z.infer<typeof generatedSectionSchema>;

export const generatedArticleSchema = z.object({
  title: z.string(),
  sections: z.array(generatedSectionSchema),
  /** Full assembled article body (Markdown, without the H1 title). */
  contentMarkdown: z.string(),
  /** Deterministic conversion of contentMarkdown into JournalArticleV1 blocks. */
  body: z.array(articleBlockSchema),
  tableOfContents: z.array(z.object({ id: z.string(), title: z.string() })),
  faqs: z.array(z.object({ question: z.string(), answer: z.string() })),
  wordCount: z.number().int().nonnegative(),
  readingTime: z.number().int().positive(),
  /** True when every outline section generated successfully. */
  complete: z.boolean(),
});
export type GeneratedArticle = z.infer<typeof generatedArticleSchema>;

// ---------------------------------------------------------------------------
// Section regenerate / improve
// ---------------------------------------------------------------------------
export const sectionRequestSchema = z.object({
  articleId: z.string().min(1).optional(),
  articleTitle: z.string().min(1).max(200),
  sectionHeading: z.string().min(1).max(200),
  /** Current section body. Required for "improve", optional for "regenerate". */
  currentMarkdown: z.string().max(20000).optional(),
  instruction: z.string().max(1000).optional(),
  mode: z.enum(["regenerate", "improve"]).default("regenerate"),
  articleExcerpt: z.string().max(600).optional(),
  keyPoints: z.array(z.string().max(400)).max(12).default([]),
  audience: z.string().max(120).optional(),
  primaryKeyword: z.string().max(120).optional(),
});
export type SectionRequest = z.infer<typeof sectionRequestSchema>;

export const generatedSectionResultSchema = z.object({
  heading: z.string(),
  markdown: z.string(),
  body: z.array(articleBlockSchema),
});
export type GeneratedSectionResult = z.infer<typeof generatedSectionResultSchema>;

// ---------------------------------------------------------------------------
// SEO metadata suggestions
// ---------------------------------------------------------------------------
export const seoRequestSchema = z.object({
  articleId: z.string().min(1).optional(),
  title: z.string().min(1).max(200),
  excerpt: z.string().max(600).optional(),
  contentMarkdown: z.string().max(40000).optional(),
  category: z.string().max(120).optional(),
  primaryKeyword: z.string().max(120).optional(),
});
export type SeoRequest = z.infer<typeof seoRequestSchema>;

export const seoSuggestionsSchema = z.object({
  seoTitle: z.string().max(70),
  seoDescription: z.string().max(170),
  slug: z.string().max(200),
  suggestedTitles: z.array(z.string().max(200)).max(8).default([]),
  suggestedPrimaryKeyword: z.string().max(120).nullable().default(null),
  suggestedSecondaryKeywords: z.array(z.string().max(120)).max(15).default([]),
  /**
   * Always "ai_suggestion": these keywords come from the language model, not a
   * search-data provider, and carry no volume/CPC/difficulty metrics.
   */
  keywordSource: z.literal("ai_suggestion").default("ai_suggestion"),
});
export type SeoSuggestions = z.infer<typeof seoSuggestionsSchema>;

// ---------------------------------------------------------------------------
// Provenance
// ---------------------------------------------------------------------------
export interface GenerationProvenance {
  kind: GenerationKind;
  provider: "glm";
  model: string;
  /** Sanitized prompt inputs as sent to the model (no secrets). */
  promptInputs: Record<string, unknown>;
  status: "succeeded" | "partial" | "failed";
  attempts: number;
  durationMs: number;
  articleId?: string;
  createdBy?: string;
}
