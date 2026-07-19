import { NextRequest, NextResponse } from "next/server";
import { createHash, randomUUID } from "node:crypto";
import { getSessionAdmin, requireAdminRole } from "@/lib/auth";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { normalizeJournalSlug } from "@/lib/journal-article-v1";

const DRAFT_BUCKET = "journal-drafts";
const PUBLIC_BUCKET = "journal-media";
const MAX_BYTES = 10 * 1024 * 1024;
const ALLOWED = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/avif",
  "image/gif",
]);

function sb() {
  return getSupabaseAdmin() as any;
}

function publicUrl(bucket: string, path: string): string {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/+$/, "");
  if (!base) return "";
  return `${base}/storage/v1/object/public/${bucket}/${path}`;
}

export async function GET(req: NextRequest) {
  if (!(await getSessionAdmin())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const articleId = req.nextUrl.searchParams.get("articleId");
  try {
    let query = sb()
      .from("journal_media")
      .select("*")
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .limit(200);

    const { data, error } = await query;
    if (error) {
      if (/does not exist|schema cache/i.test(error.message)) {
        return NextResponse.json({ media: [] });
      }
      throw new Error(error.message);
    }

    let rows = data ?? [];
    if (articleId) {
      const { data: links } = await sb()
        .from("article_media")
        .select("media_id, role")
        .eq("article_id", articleId);
      const allowed = new Set((links ?? []).map((l: { media_id: string }) => l.media_id));
      rows = rows.filter((r: { id: string }) => allowed.has(r.id));
    }

    const media = rows.map((row: any) => ({
      id: row.id,
      bucketId: row.bucket_id,
      objectPath: row.object_path,
      visibility: row.visibility,
      mimeType: row.mime_type,
      byteSize: row.byte_size,
      width: row.width,
      height: row.height,
      alt: row.alt_text ?? "",
      caption: row.caption ?? null,
      url:
        row.visibility === "published" || row.bucket_id === PUBLIC_BUCKET
          ? publicUrl(row.bucket_id, row.object_path)
          : null,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }));

    return NextResponse.json({ media });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to list media.";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}

export async function POST(req: NextRequest) {
  const admin = await requireAdminRole(["admin", "operations"]);
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const form = await req.formData().catch(() => null);
  if (!form) return NextResponse.json({ error: "Expected multipart form data." }, { status: 400 });

  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Missing file." }, { status: 400 });
  }
  if (!ALLOWED.has(file.type)) {
    return NextResponse.json({ error: "Unsupported file type." }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: "File exceeds 10MB limit." }, { status: 400 });
  }

  const alt = String(form.get("alt") ?? "").trim();
  const caption = String(form.get("caption") ?? "").trim() || null;
  const articleId = String(form.get("articleId") ?? "").trim() || null;
  const asHero = String(form.get("role") ?? "") === "hero";
  const publish = String(form.get("visibility") ?? "draft") === "published";

  const buffer = Buffer.from(await file.arrayBuffer());
  const checksum = createHash("sha256").update(buffer).digest("hex");
  const ext = file.name.split(".").pop()?.toLowerCase().replace(/[^a-z0-9]/g, "") || "bin";
  const baseName = normalizeJournalSlug(file.name.replace(/\.[^.]+$/, "")) || "asset";
  const objectPath = `${new Date().toISOString().slice(0, 10)}/${baseName}-${randomUUID().slice(0, 8)}.${ext}`;
  const bucket = publish ? PUBLIC_BUCKET : DRAFT_BUCKET;

  const { error: uploadError } = await sb().storage.from(bucket).upload(objectPath, buffer, {
    contentType: file.type,
    upsert: false,
  });
  if (uploadError) {
    return NextResponse.json({ error: uploadError.message }, { status: 502 });
  }

  const { data: mediaRow, error: insertError } = await sb()
    .from("journal_media")
    .insert({
      bucket_id: bucket,
      object_path: objectPath,
      visibility: publish ? "published" : "draft",
      mime_type: file.type,
      byte_size: buffer.length,
      alt_text: alt || baseName,
      caption,
      checksum,
      created_by: admin.id,
    })
    .select("*")
    .single();

  if (insertError) {
    return NextResponse.json({ error: insertError.message }, { status: 502 });
  }

  if (articleId) {
    await sb().from("article_media").upsert({
      article_id: articleId,
      media_id: mediaRow.id,
      role: asHero ? "hero" : "inline",
      sort_order: 0,
    });
    if (asHero) {
      await sb()
        .from("Article")
        .update({
          heroMediaId: mediaRow.id,
          heroImageUrl: publish ? publicUrl(bucket, objectPath) : null,
          heroImageAlt: alt || baseName,
          heroImageCaption: caption,
          updatedAt: new Date().toISOString(),
        })
        .eq("id", articleId);
    }
  }

  return NextResponse.json(
    {
      media: {
        id: mediaRow.id,
        bucketId: mediaRow.bucket_id,
        objectPath: mediaRow.object_path,
        visibility: mediaRow.visibility,
        mimeType: mediaRow.mime_type,
        byteSize: mediaRow.byte_size,
        alt: mediaRow.alt_text ?? "",
        caption: mediaRow.caption,
        url: publish ? publicUrl(bucket, objectPath) : null,
        createdAt: mediaRow.created_at,
      },
    },
    { status: 201 },
  );
}
