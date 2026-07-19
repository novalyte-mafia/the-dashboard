import "server-only";

import { getSupabaseAdmin } from "@/lib/supabase/admin";
import {
  buildArticleWritePayload,
  computeAdvisorySeoScore,
  rowToArticleListItem,
  rowToJournalArticle,
  type ArticleRow,
  type ArticleWriteInput,
} from "@/lib/content/article-mapper";
import { normalizeJournalSlug } from "@/lib/journal-article-v1";
import { requestJournalRevalidation } from "@/lib/content/journal-hooks";

type SupabaseAny = ReturnType<typeof getSupabaseAdmin> & {
  from: (table: string) => any;
  storage: { from: (bucket: string) => any };
};

function sb(): SupabaseAny {
  return getSupabaseAdmin() as unknown as SupabaseAny;
}

export async function fetchArticleRow(id: string): Promise<ArticleRow | null> {
  const { data, error } = await sb()
    .from("Article")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;
  if ((data as ArticleRow).deletedAt) return null;
  return data as ArticleRow;
}

export async function listArticleRows(status?: string): Promise<ArticleRow[]> {
  let query = sb()
    .from("Article")
    .select("*")
    .order("updatedAt", { ascending: false })
    .limit(500);
  if (status) query = query.eq("status", status);
  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return ((data as ArticleRow[]) ?? []).filter((row) => !row.deletedAt);
}

async function insertRevision(
  articleId: string,
  row: ArticleRow,
  changeSummary: string | undefined,
  createdBy: string | undefined,
): Promise<void> {
  const article = rowToJournalArticle(row);
  const { data: latest } = await sb()
    .from("article_revisions")
    .select("revision_number")
    .eq("article_id", articleId)
    .order("revision_number", { ascending: false })
    .limit(1)
    .maybeSingle();
  const nextNumber = Number(latest?.revision_number ?? 0) + 1;
  const { error } = await sb()
    .from("article_revisions")
    .insert({
      article_id: articleId,
      revision_number: nextNumber,
      schema_version: article.schemaVersion,
      row_version: article.rowVersion,
      snapshot: article,
      change_summary: changeSummary ?? null,
      created_by: createdBy ?? null,
    });
  // Revisions table may not exist until migration is applied - don't fail the write.
  if (error && !/does not exist|schema cache/i.test(error.message)) {
    console.warn("[article-store] revision insert failed:", error.message);
  }
}

async function recordSlugRedirect(
  fromSlug: string,
  articleId: string,
  createdBy?: string,
): Promise<void> {
  const normalized = normalizeJournalSlug(fromSlug);
  if (!normalized) return;
  const { error } = await sb()
    .from("article_slug_redirects")
    .upsert(
      {
        from_slug: normalized,
        article_id: articleId,
        http_status: 308,
        is_active: true,
        created_by: createdBy ?? null,
      },
      { onConflict: "from_slug" },
    );
  if (error && !/does not exist|schema cache/i.test(error.message)) {
    console.warn("[article-store] slug redirect upsert failed:", error.message);
  }
}

export async function createArticle(
  input: ArticleWriteInput,
  adminId?: string,
): Promise<ReturnType<typeof rowToJournalArticle>> {
  const payload = buildArticleWritePayload(input, null, { adminId });
  const { data, error } = await sb()
    .from("Article")
    .insert(payload)
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  await insertRevision(String(data.id), data as ArticleRow, "Created", adminId);
  return rowToJournalArticle(data as ArticleRow);
}

export class VersionConflictError extends Error {
  constructor(public current: ReturnType<typeof rowToJournalArticle>) {
    super("Article was modified by another session. Reload and try again.");
    this.name = "VersionConflictError";
  }
}

export async function updateArticle(
  id: string,
  input: ArticleWriteInput,
  adminId?: string,
): Promise<ReturnType<typeof rowToJournalArticle>> {
  const existing = await fetchArticleRow(id);
  if (!existing) throw new Error("Article not found.");

  if (
    input.rowVersion != null &&
    Number(existing.rowVersion ?? 1) !== Number(input.rowVersion)
  ) {
    throw new VersionConflictError(rowToJournalArticle(existing));
  }

  const previousSlug = String(existing.slug ?? "");
  const payload = buildArticleWritePayload(input, existing, {
    adminId,
    bumpVersion: true,
  });
  // Never allow clients to change id/createdAt via update.
  delete payload.id;
  delete payload.createdAt;

  const { data, error } = await sb()
    .from("Article")
    .update(payload)
    .eq("id", id)
    .eq("rowVersion", Number(existing.rowVersion ?? 1))
    .select("*")
    .maybeSingle();

  if (error) {
    // Pre-migration databases may lack rowVersion. Retry without optimistic filter.
    if (/rowVersion|schema cache|column/i.test(error.message)) {
      const { data: fallback, error: fallbackError } = await sb()
        .from("Article")
        .update(payload)
        .eq("id", id)
        .select("*")
        .maybeSingle();
      if (fallbackError) throw new Error(fallbackError.message);
      if (!fallback) throw new Error("Article not found.");
      await insertRevision(
        id,
        fallback as ArticleRow,
        input.changeSummary ?? "Updated",
        adminId,
      );
      return rowToJournalArticle(fallback as ArticleRow);
    }
    throw new Error(error.message);
  }

  if (!data) {
    const latest = await fetchArticleRow(id);
    if (!latest) throw new Error("Article not found.");
    throw new VersionConflictError(rowToJournalArticle(latest));
  }

  const nextSlug = String(data.slug ?? "");
  if (previousSlug && nextSlug && previousSlug !== nextSlug) {
    await recordSlugRedirect(previousSlug, id, adminId);
  }

  await insertRevision(
    id,
    data as ArticleRow,
    input.changeSummary ?? "Updated",
    adminId,
  );
  return rowToJournalArticle(data as ArticleRow);
}

export async function transitionArticleStatus(
  id: string,
  action: "publish" | "unpublish" | "schedule" | "archive" | "review" | "approve",
  options: {
    scheduledFor?: string | null;
    rowVersion?: number;
    adminId?: string;
  } = {},
): Promise<ReturnType<typeof rowToJournalArticle>> {
  const now = new Date().toISOString();
  const existingRow = await fetchArticleRow(id);
  if (!existingRow) throw new Error("Article not found.");
  const existing = rowToJournalArticle(existingRow);

  if (action === "publish" || action === "schedule") {
    if (existing.status !== "approved") {
      throw new Error(
        "A human editor must approve the article before it can be published or scheduled.",
      );
    }
  }

  if (action === "approve") {
    assertArticleReadyForApproval(existing);
  }

  const patch: ArticleWriteInput = {
    rowVersion: options.rowVersion,
    changeSummary: action,
  };

  switch (action) {
    case "publish":
      patch.status = "published";
      patch.publishedAt = now;
      patch.scheduledFor = null;
      break;
    case "unpublish":
      patch.status = "draft";
      patch.publishedAt = null;
      patch.scheduledFor = null;
      break;
    case "schedule":
      if (!options.scheduledFor) throw new Error("scheduledFor is required.");
      patch.status = "scheduled";
      patch.scheduledFor = options.scheduledFor;
      break;
    case "archive":
      patch.status = "archived";
      break;
    case "review":
      patch.status = "review";
      break;
    case "approve":
      patch.status = "approved";
      break;
  }

  const article = await updateArticle(id, patch, options.adminId);

  try {
    await requestJournalRevalidation({
      slugs: [article.slug],
      categories: [article.category],
      all:
        action === "publish" || action === "unpublish" || action === "archive",
    });
  } catch (err) {
    console.warn(
      "[article-store] journal revalidation skipped:",
      err instanceof Error ? err.message : err,
    );
  }

  return article;
}

function assertArticleReadyForApproval(
  article: ReturnType<typeof rowToJournalArticle>,
) {
  const wordCount = (article.contentMarkdown ?? "")
    .replace(/[#>*_`|-]/g, " ")
    .split(/\s+/)
    .filter(Boolean).length;
  const missing: string[] = [];

  if (!article.title.trim()) missing.push("title");
  if (!article.slug.trim()) missing.push("slug");
  if (article.excerpt.trim().length < 80) missing.push("excerpt");
  if (wordCount < 1200) missing.push("at least 1,200 reviewed words");
  if (!article.seo.title?.trim()) missing.push("SEO title");
  if (!article.seo.description?.trim()) missing.push("meta description");
  if (!article.keywords.primary?.trim()) missing.push("primary keyword");
  if (!article.hero.src.trim()) missing.push("featured image");
  if (!article.hero.alt.trim()) missing.push("featured image alt text");
  if (!article.author.name.trim()) missing.push("author");
  if (!Array.isArray(article.body) || article.body.length === 0) {
    missing.push("structured article body");
  }
  if (
    article.references.filter((reference) => {
      if (!reference.url) return false;
      try {
        return ["http:", "https:"].includes(new URL(reference.url).protocol);
      } catch {
        return false;
      }
    }).length < 2
  ) {
    missing.push("at least two linked sources");
  }

  if (missing.length > 0) {
    throw new Error(
      `Complete the editorial review before approval: ${missing.join(", ")}.`,
    );
  }
}

export async function duplicateArticle(
  id: string,
  adminId?: string,
): Promise<ReturnType<typeof rowToJournalArticle>> {
  const existing = await fetchArticleRow(id);
  if (!existing) throw new Error("Article not found.");
  const source = rowToJournalArticle(existing);
  return createArticle(
    {
      title: `${source.title} (Copy)`,
      slug: `${source.slug}-copy-${Date.now().toString(36)}`,
      excerpt: source.excerpt,
      category: source.category,
      status: "draft",
      contentMarkdown: source.contentMarkdown,
      body: source.body,
      tableOfContents: source.tableOfContents,
      faqs: source.faqs,
      references: source.references,
      tags: source.tags,
      author: source.author,
      medicalReviewer: source.medicalReviewer,
      relatedTreatment: source.relatedTreatment,
      seo: { ...source.seo, canonicalUrl: null },
      keywords: source.keywords,
      hero: source.hero,
      publishedAt: null,
      scheduledFor: null,
      changeSummary: `Duplicated from ${source.id}`,
    },
    adminId,
  );
}

export async function listRevisions(articleId: string) {
  const { data, error } = await sb()
    .from("article_revisions")
    .select(
      "id, revision_number, row_version, change_summary, created_by, created_at",
    )
    .eq("article_id", articleId)
    .order("revision_number", { ascending: false })
    .limit(100);
  if (error) {
    if (/does not exist|schema cache/i.test(error.message)) return [];
    throw new Error(error.message);
  }
  return data ?? [];
}

export async function restoreRevision(
  articleId: string,
  revisionId: string,
  adminId?: string,
): Promise<ReturnType<typeof rowToJournalArticle>> {
  const { data: revision, error } = await sb()
    .from("article_revisions")
    .select("*")
    .eq("id", revisionId)
    .eq("article_id", articleId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!revision?.snapshot) throw new Error("Revision not found.");

  const snapshot = revision.snapshot as ReturnType<typeof rowToJournalArticle>;
  const existing = await fetchArticleRow(articleId);
  if (!existing) throw new Error("Article not found.");

  return updateArticle(
    articleId,
    {
      rowVersion: Number(existing.rowVersion ?? 1),
      title: snapshot.title,
      slug: snapshot.slug,
      excerpt: snapshot.excerpt,
      category: snapshot.category,
      status: snapshot.status === "published" ? "draft" : snapshot.status,
      contentMarkdown: snapshot.contentMarkdown,
      body: snapshot.body,
      tableOfContents: snapshot.tableOfContents,
      faqs: snapshot.faqs,
      references: snapshot.references,
      tags: snapshot.tags,
      author: snapshot.author,
      medicalReviewer: snapshot.medicalReviewer,
      relatedTreatment: snapshot.relatedTreatment,
      seo: snapshot.seo,
      keywords: snapshot.keywords,
      hero: snapshot.hero,
      publishedAt: null,
      scheduledFor: null,
      changeSummary: `Restored revision #${revision.revision_number}`,
    },
    adminId,
  );
}

export function toListResponse(rows: ArticleRow[]) {
  const out: ReturnType<typeof rowToArticleListItem>[] = [];
  for (const row of rows) {
    try {
      const item = rowToArticleListItem(row);
      const full = rowToJournalArticle(row);
      const seo = computeAdvisorySeoScore(full);
      out.push({ ...item, seoScore: item.seoScore ?? seo.score });
    } catch (error) {
      // Never let a single malformed row take down the authenticated list.
      console.warn(
        "[article-store] skipped malformed Article row",
        row?.id,
        error instanceof Error ? error.message : error,
      );
      out.push({
        id: String(row.id ?? "unknown"),
        title: typeof row.title === "string" ? row.title : "Untitled",
        slug: typeof row.slug === "string" ? row.slug : "untitled",
        excerpt: typeof row.excerpt === "string" ? row.excerpt : "",
        category:
          typeof row.category === "string" ? row.category : "Uncategorized",
        secondaryKeywords: [],
        authorName: "Novalyte Editorial",
        status: "draft",
        createdAt: new Date().toISOString(),
        dataSource: "live",
        rowVersion: 1,
        contentMarkdown: null,
      });
    }
  }
  return out;
}

export { rowToJournalArticle, computeAdvisorySeoScore, rowToArticleListItem };
