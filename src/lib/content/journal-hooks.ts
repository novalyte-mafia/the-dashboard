import "server-only";

import { createJournalPreviewToken } from "@/lib/content/journal-preview-token";

/**
 * Server-only bridge from Command Center content APIs to the public
 * marketing Journal (z.ai-novalyte-new-homepage).
 *
 * Required env (server-only):
 * - MARKETING_SITE_URL        e.g. https://novalyte.io (no trailing slash)
 * - JOURNAL_PREVIEW_SECRET    shared HMAC secret; must match the marketing app
 * - JOURNAL_REVALIDATE_SECRET bearer secret for POST /api/journal/revalidate
 */

function marketingSiteUrl(): string {
  const url = process.env.MARKETING_SITE_URL?.trim().replace(/\/+$/, "");
  if (!url) throw new Error("MARKETING_SITE_URL is not configured.");
  return url;
}

/** Build an exact-preview URL for a draft article, valid for `ttlSeconds`. */
export function buildJournalPreviewUrl(articleId: string, ttlSeconds?: number): string {
  const token = createJournalPreviewToken(articleId, ttlSeconds);
  return `${marketingSiteUrl()}/journal/preview/${token}`;
}

export type JournalRevalidationRequest = {
  /** Current slugs of the affected articles. */
  slugs?: string[];
  /** Category names affected (optional; slugs usually suffice). */
  categories?: string[];
  /** Invalidate every journal page (publish/unpublish/schedule flips). */
  all?: boolean;
};

/**
 * Ask the marketing site to invalidate its Journal caches after a
 * publish / unpublish / schedule / archive / slug change.
 * Throws on non-2xx so callers can surface the failure.
 */
export async function requestJournalRevalidation(
  request: JournalRevalidationRequest,
): Promise<void> {
  const secret = process.env.JOURNAL_REVALIDATE_SECRET?.trim();
  if (!secret) throw new Error("JOURNAL_REVALIDATE_SECRET is not configured.");

  const response = await fetch(`${marketingSiteUrl()}/api/journal/revalidate`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${secret}`,
    },
    body: JSON.stringify(request),
    cache: "no-store",
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(
      `Journal revalidation failed (${response.status}): ${body.slice(0, 300)}`,
    );
  }
}
