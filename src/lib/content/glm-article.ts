import "server-only";

import { normalizeJournalSlug } from "@/lib/journal-article-v1";
import {
  countWords,
  estimateReadingTime,
  markdownToBlocks,
} from "@/lib/content/markdown-blocks";
import {
  generatedOutlineSchema,
  seoSuggestionsSchema,
  type ArticleRequest,
  type GeneratedArticle,
  type GeneratedOutline,
  type GeneratedSection,
  type GeneratedSectionResult,
  type OutlineRequest,
  type SectionRequest,
  type SeoRequest,
  type SeoSuggestions,
} from "@/lib/content/generation-types";

/**
 * GLM long-form article generation for the Content Studio.
 *
 * Mirrors the server-only conventions of src/lib/providers/glm.ts (server-only
 * key, AbortSignal.timeout, input sanitization) but with long-form budgets,
 * bounded retries, and sectioned generation with graceful partial failure.
 */

const GLM_URL = process.env.GLM_API_URL?.trim() || "https://open.bigmodel.cn/api/paas/v4/chat/completions";

const EDITORIAL_SYSTEM_RULES = `You are a senior medical-wellness content writer for Novalyte AI's public Journal (men's health: TRT, GLP-1, peptides, IV therapy, hormone optimization, longevity).
Editorial rules:
- Write for a general audience at roughly an 8th-10th grade reading level. Clear, direct, evidence-aware.
- Never invent statistics, study citations, prices, guarantees, or medical claims. If evidence is uncertain, say so plainly.
- Never invent search volume, CPC, or keyword-difficulty numbers.
- No promises of outcomes. Include appropriate caution around prescription treatments.
- The company name is always "Novalyte AI". Do not fabricate partnerships or credentials.`;

function sanitize(value: string, max = 20000) {
  return value
    .slice(0, max)
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, "[redacted email]")
    .replace(/(?:\+?1[ .-]?)?(?:\(\d{3}\)|\d{3})[ .-]?\d{3}[ .-]?\d{4}/g, "[redacted phone]");
}

export function getGlmArticleModel(): string {
  return process.env.GLM_LONGFORM_MODEL?.trim() || process.env.GLM_MODEL?.trim() || "glm-5";
}

interface GlmCallOptions {
  system: string;
  user: string;
  maxTokens: number;
  temperature: number;
  timeoutMs?: number;
  maxAttempts?: number;
}

export interface GlmCallMeta {
  model: string;
  attempts: number;
  durationMs: number;
}

class GlmRequestError extends Error {
  constructor(message: string, readonly retryable: boolean) {
    super(message);
  }
}

async function callGlm(options: GlmCallOptions): Promise<{ text: string; meta: GlmCallMeta }> {
  const apiKey = process.env.GLM_API_KEY?.trim();
  if (!apiKey) throw new Error("GLM_API_KEY is not configured.");

  const model = getGlmArticleModel();
  const maxAttempts = options.maxAttempts ?? 3;
  const started = Date.now();
  let lastError: unknown;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      const response = await fetch(GLM_URL, {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model,
          temperature: options.temperature,
          max_tokens: options.maxTokens,
          messages: [
            { role: "system", content: options.system },
            { role: "user", content: options.user },
          ],
        }),
        signal: AbortSignal.timeout(options.timeoutMs ?? 90000),
        cache: "no-store",
      });

      if (!response.ok) {
        const retryable = response.status === 429 || response.status >= 500;
        throw new GlmRequestError(`GLM request failed (${response.status}).`, retryable);
      }

      const payload = await response.json().catch(() => ({}));
      const text = String(payload.choices?.[0]?.message?.content ?? "").trim();
      if (!text) throw new GlmRequestError("GLM returned an empty completion.", true);

      return { text, meta: { model, attempts: attempt, durationMs: Date.now() - started } };
    } catch (error) {
      lastError = error;
      const retryable =
        error instanceof GlmRequestError
          ? error.retryable
          : // AbortError (timeout) and network failures are retryable.
            true;
      if (!retryable || attempt === maxAttempts) break;
      await new Promise((resolve) => setTimeout(resolve, attempt * 1500));
    }
  }

  throw lastError instanceof Error ? lastError : new Error("GLM request failed.");
}

function extractJson(raw: string): unknown {
  const trimmed = raw.replace(/^```(?:json)?/m, "").replace(/```\s*$/m, "").trim();
  const match = trimmed.match(/[\[{][\s\S]*[\]}]/);
  if (!match) return null;
  try {
    return JSON.parse(match[0]);
  } catch {
    return null;
  }
}

function stripLeadingHeading(markdown: string, heading: string): string {
  const lines = markdown.trim().split("\n");
  const first = lines[0]?.trim() ?? "";
  const normalized = first.replace(/^#{1,6}\s+/, "").replace(/[*_`]/g, "").trim().toLowerCase();
  if (/^#{1,6}\s+/.test(first) && normalized === heading.trim().toLowerCase()) {
    return lines.slice(1).join("\n").trim();
  }
  return markdown.trim();
}

// ---------------------------------------------------------------------------
// Outline generation
// ---------------------------------------------------------------------------
export async function generateArticleOutline(
  input: OutlineRequest,
): Promise<{ outline: GeneratedOutline; meta: GlmCallMeta }> {
  const system = `${EDITORIAL_SYSTEM_RULES}

Task: design a long-form article outline. Return ONLY valid JSON with this shape:
{"title": string, "alternativeTitles": string[], "slug": string, "excerpt": string,
 "sections": [{"heading": string, "summary": string, "keyPoints": string[], "targetWords": number}],
 "faqs": [{"question": string, "answer": string}]}
Rules: 5-9 sections covering intro through conclusion; section headings are plain text without numbering or markdown; targetWords per section should sum roughly to the requested total; 3-5 FAQs.`;

  const user =
    `Topic: ${sanitize(input.topic, 300)}\n` +
    `Category: ${sanitize(input.category ?? "General wellness", 120)}\n` +
    `Audience: ${sanitize(input.audience ?? "general audience", 120)}\n` +
    `Search intent: ${sanitize(input.searchIntent ?? "informational", 60)}\n` +
    `Primary keyword: ${sanitize(input.primaryKeyword ?? "none provided", 120)}\n` +
    `Secondary keywords: ${sanitize(input.secondaryKeywords.join(", ") || "none provided", 600)}\n` +
    `Target word count: ${input.targetWordCount}\n` +
    `Editor notes: ${sanitize(input.notes ?? "none", 2000)}`;

  const { text, meta } = await callGlm({ system, user, maxTokens: 2500, temperature: 0.5, timeoutMs: 60000 });

  const parsed = generatedOutlineSchema.safeParse(extractJson(text));
  if (!parsed.success) {
    throw new Error("GLM returned an outline that could not be parsed. Try again.");
  }

  return {
    outline: {
      ...parsed.data,
      slug: normalizeJournalSlug(parsed.data.slug || parsed.data.title),
    },
    meta,
  };
}

// ---------------------------------------------------------------------------
// Full article generation from an approved outline (sectioned, partial-safe)
// ---------------------------------------------------------------------------
export async function generateArticleFromOutline(
  input: ArticleRequest,
): Promise<{ article: GeneratedArticle; meta: GlmCallMeta }> {
  const { outline } = input;
  const started = Date.now();
  let totalAttempts = 0;
  const model = getGlmArticleModel();

  const contextHeader =
    `Article title: ${sanitize(outline.title, 200)}\n` +
    `Excerpt: ${sanitize(outline.excerpt, 600)}\n` +
    `Category: ${sanitize(input.category ?? "General wellness", 120)}\n` +
    `Audience: ${sanitize(input.audience ?? "general audience", 120)}\n` +
    `Search intent: ${sanitize(input.searchIntent ?? "informational", 60)}\n` +
    `Primary keyword: ${sanitize(input.primaryKeyword ?? "none provided", 120)}\n` +
    `Secondary keywords: ${sanitize(input.secondaryKeywords.join(", ") || "none provided", 600)}\n` +
    `Editor notes: ${sanitize(input.notes ?? "none", 2000)}\n` +
    `Full outline: ${outline.sections.map((s) => s.heading).join(" | ")}`;

  const sections: GeneratedSection[] = [];
  let previousTail = "";

  for (const section of outline.sections) {
    const system = `${EDITORIAL_SYSTEM_RULES}

Task: write ONE section of a long-form article in Markdown.
Formatting rules:
- Do NOT repeat the section heading; start directly with body content.
- Use only these constructs: paragraphs, "###" sub-headings, "-" bullet lists, numbered lists, pipe tables, and blockquote callouts like "> **Tip:** ..." / "> **Warning:** ...".
- No H1/H2 headings, no links, no images, no code blocks.
- Flow naturally from the previous section; do not re-introduce the article.`;

    const user =
      `${contextHeader}\n\n` +
      `Section to write: ${sanitize(section.heading, 200)}\n` +
      `Section brief: ${sanitize(section.summary, 1000)}\n` +
      `Key points to cover:\n${section.keyPoints.map((p) => `- ${sanitize(p, 400)}`).join("\n") || "- (writer's judgment)"}\n` +
      `Target length: about ${section.targetWords ?? 300} words.\n` +
      (previousTail ? `End of the previous section (for continuity, do not repeat):\n${sanitize(previousTail, 800)}` : "This is the opening section.");

    try {
      const { text, meta } = await callGlm({
        system,
        user,
        maxTokens: Math.min(4000, Math.max(1200, Math.round((section.targetWords ?? 300) * 3))),
        temperature: 0.6,
        timeoutMs: 90000,
      });
      totalAttempts += meta.attempts;
      const markdown = stripLeadingHeading(text, section.heading);
      sections.push({ heading: section.heading, markdown, status: "generated" });
      previousTail = markdown.split("\n\n").slice(-1)[0] ?? "";
    } catch (error) {
      totalAttempts += 1;
      sections.push({
        heading: section.heading,
        markdown: "",
        status: "failed",
        error: error instanceof Error ? error.message : "Section generation failed.",
      });
    }
  }

  const contentMarkdown = sections
    .map((s) =>
      s.status === "generated"
        ? `## ${s.heading}\n\n${s.markdown}`
        : `## ${s.heading}\n\n> **Note:** This section failed to generate. Use "Regenerate section" to retry.`,
    )
    .join("\n\n");

  const { blocks, tableOfContents } = markdownToBlocks(contentMarkdown);

  const article: GeneratedArticle = {
    title: outline.title,
    sections,
    contentMarkdown,
    body: blocks,
    tableOfContents,
    faqs: outline.faqs,
    wordCount: countWords(contentMarkdown),
    readingTime: estimateReadingTime(contentMarkdown),
    complete: sections.every((s) => s.status === "generated"),
  };

  return { article, meta: { model, attempts: totalAttempts, durationMs: Date.now() - started } };
}

// ---------------------------------------------------------------------------
// Section regenerate / improve
// ---------------------------------------------------------------------------
export async function generateArticleSection(
  input: SectionRequest,
): Promise<{ section: GeneratedSectionResult; meta: GlmCallMeta }> {
  const improving = input.mode === "improve" && Boolean(input.currentMarkdown?.trim());

  const system = `${EDITORIAL_SYSTEM_RULES}

Task: ${improving ? "improve an existing section of" : "rewrite one section of"} a long-form article, in Markdown.
Formatting rules:
- Do NOT repeat the section heading; start directly with body content.
- Use only these constructs: paragraphs, "###" sub-headings, "-" bullet lists, numbered lists, pipe tables, and blockquote callouts like "> **Tip:** ..." / "> **Warning:** ...".
- No H1/H2 headings, no links, no images, no code blocks.
${improving ? "- Preserve accurate facts from the current version; tighten structure and clarity." : ""}`;

  const user =
    `Article title: ${sanitize(input.articleTitle, 200)}\n` +
    `Excerpt: ${sanitize(input.articleExcerpt ?? "", 600)}\n` +
    `Audience: ${sanitize(input.audience ?? "general audience", 120)}\n` +
    `Primary keyword: ${sanitize(input.primaryKeyword ?? "none provided", 120)}\n` +
    `Section heading: ${sanitize(input.sectionHeading, 200)}\n` +
    `Key points:\n${input.keyPoints.map((p) => `- ${sanitize(p, 400)}`).join("\n") || "- (writer's judgment)"}\n` +
    `Editor instruction: ${sanitize(input.instruction ?? "none", 1000)}\n` +
    (input.currentMarkdown ? `Current section content:\n${sanitize(input.currentMarkdown, 12000)}` : "No current content; write fresh.");

  const { text, meta } = await callGlm({ system, user, maxTokens: 3000, temperature: 0.6, timeoutMs: 90000 });
  const markdown = stripLeadingHeading(text, input.sectionHeading);
  const { blocks } = markdownToBlocks(`## ${input.sectionHeading}\n\n${markdown}`);

  return { section: { heading: input.sectionHeading, markdown, body: blocks }, meta };
}

// ---------------------------------------------------------------------------
// SEO metadata suggestions
// ---------------------------------------------------------------------------
export async function generateSeoSuggestions(
  input: SeoRequest,
): Promise<{ seo: SeoSuggestions; meta: GlmCallMeta }> {
  const system = `${EDITORIAL_SYSTEM_RULES}

Task: suggest SEO metadata for an article. Return ONLY valid JSON with this shape:
{"seoTitle": string (max 60 chars), "seoDescription": string (max 160 chars), "slug": string,
 "suggestedTitles": string[], "suggestedPrimaryKeyword": string|null, "suggestedSecondaryKeywords": string[]}
Rules: keywords are qualitative editorial suggestions only — you have no search-volume data, so never mention volume, difficulty, or CPC. The slug is lowercase-hyphenated.`;

  const user =
    `Title: ${sanitize(input.title, 200)}\n` +
    `Category: ${sanitize(input.category ?? "General wellness", 120)}\n` +
    `Current primary keyword: ${sanitize(input.primaryKeyword ?? "none provided", 120)}\n` +
    `Excerpt: ${sanitize(input.excerpt ?? "", 600)}\n` +
    `Article content (may be truncated):\n${sanitize(input.contentMarkdown ?? "", 12000)}`;

  const { text, meta } = await callGlm({ system, user, maxTokens: 900, temperature: 0.4, timeoutMs: 45000 });

  const raw = extractJson(text) as Record<string, unknown> | null;
  const parsed = seoSuggestionsSchema.safeParse({
    ...(raw ?? {}),
    seoTitle: typeof raw?.seoTitle === "string" ? raw.seoTitle.slice(0, 70) : "",
    seoDescription: typeof raw?.seoDescription === "string" ? raw.seoDescription.slice(0, 170) : "",
    slug: normalizeJournalSlug(String(raw?.slug ?? input.title)),
    keywordSource: "ai_suggestion",
  });
  if (!parsed.success || !parsed.data.seoTitle) {
    throw new Error("GLM returned SEO suggestions that could not be parsed. Try again.");
  }

  return { seo: parsed.data, meta };
}
