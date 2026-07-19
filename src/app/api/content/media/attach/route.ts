import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAdminRole } from "@/lib/auth";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { fetchArticleRow } from "@/lib/content/article-store";

const schema = z.object({
  articleId: z.string().min(1),
  mediaId: z.string().uuid(),
  role: z.enum(["hero", "inline", "social", "attachment"]).default("inline"),
});

function sb() {
  return getSupabaseAdmin() as any;
}

function publicUrl(bucket: string, path: string): string {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/+$/, "");
  if (!base) return "";
  return `${base}/storage/v1/object/public/${bucket}/${path}`;
}

export async function POST(req: NextRequest) {
  const admin = await requireAdminRole(["admin", "operations"]);
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const parsed = schema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid request.", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const { articleId, mediaId, role } = parsed.data;
  const article = await fetchArticleRow(articleId);
  if (!article) return NextResponse.json({ error: "Article not found." }, { status: 404 });

  const { data: media, error: mediaError } = await sb()
    .from("journal_media")
    .select("*")
    .eq("id", mediaId)
    .is("deleted_at", null)
    .maybeSingle();
  if (mediaError) return NextResponse.json({ error: mediaError.message }, { status: 502 });
  if (!media) return NextResponse.json({ error: "Media not found." }, { status: 404 });

  const { error: linkError } = await sb().from("article_media").upsert({
    article_id: articleId,
    media_id: mediaId,
    role,
    sort_order: 0,
  });
  if (linkError) return NextResponse.json({ error: linkError.message }, { status: 502 });

  if (role === "hero") {
    const url =
      media.visibility === "published" || media.bucket_id === "journal-media"
        ? publicUrl(media.bucket_id, media.object_path)
        : null;
    await sb()
      .from("Article")
      .update({
        heroMediaId: mediaId,
        heroImageUrl: url,
        heroImageAlt: media.alt_text ?? "",
        heroImageCaption: media.caption,
        updatedAt: new Date().toISOString(),
      })
      .eq("id", articleId);
  }

  return NextResponse.json({ ok: true, mediaId, articleId, role });
}
