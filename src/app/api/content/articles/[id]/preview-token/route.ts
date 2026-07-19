import { NextRequest, NextResponse } from "next/server";
import { requireAdminRole } from "@/lib/auth";
import { fetchArticleRow } from "@/lib/content/article-store";
import { buildJournalPreviewUrl } from "@/lib/content/journal-hooks";
import { JOURNAL_PREVIEW_DEFAULT_TTL_SECONDS } from "@/lib/content/journal-preview-token";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const admin = await requireAdminRole(["admin", "operations"]);
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const ttlSeconds =
    typeof body?.ttlSeconds === "number" ? body.ttlSeconds : JOURNAL_PREVIEW_DEFAULT_TTL_SECONDS;

  try {
    const row = await fetchArticleRow(id);
    if (!row) return NextResponse.json({ error: "Not found." }, { status: 404 });

    const previewUrl = buildJournalPreviewUrl(id, ttlSeconds);
    return NextResponse.json({
      previewUrl,
      expiresInSeconds: Math.min(Math.max(Math.floor(ttlSeconds), 60), 60 * 60 * 4),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to create preview token.";
    const status = /not configured/i.test(message) ? 503 : 502;
    return NextResponse.json({ error: message }, { status });
  }
}
