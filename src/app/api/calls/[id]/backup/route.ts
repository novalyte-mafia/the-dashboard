import { NextRequest, NextResponse } from "next/server";
import { createHash } from "crypto";
import { requireAdminRole } from "@/lib/auth";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { db } from "@/lib/db";

const BUCKET = "call-recordings";

/**
 * Browser-side "local backup": store a redundant copy in Supabase Storage
 * under a backup/ path and record metadata in call_local_backups.
 * True disk write isn't possible from a web app; the client may also trigger
 * a download after this succeeds.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdminRole(["admin", "operations", "sales"]);
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: callSessionId } = await params;
  const session = await db.callSession.findUnique({ where: { id: callSessionId } });
  if (!session) return NextResponse.json({ error: "Call session not found" }, { status: 404 });

  const formData = await req.formData().catch(() => null);
  const audioFile = formData?.get("audio") as File | null;
  if (!audioFile) {
    return NextResponse.json({ error: "Missing audio file." }, { status: 400 });
  }

  let clientMeta: Record<string, unknown> = {};
  const rawMeta = formData?.get("metadata");
  if (typeof rawMeta === "string" && rawMeta.trim()) {
    try {
      clientMeta = JSON.parse(rawMeta) as Record<string, unknown>;
    } catch {
      clientMeta = {};
    }
  }

  const buffer = Buffer.from(await audioFile.arrayBuffer());
  const checksum = createHash("sha256").update(buffer).digest("hex");
  const relativePath = `backup/${session.clinicId}/${callSessionId}/audio.webm`;
  const supabase = getSupabaseAdmin() as any;

  const { data: recording } = await supabase
    .from("call_recordings")
    .select("id")
    .eq("call_session_id", callSessionId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { error: uploadError } = await supabase.storage.from(BUCKET).upload(relativePath, buffer, {
    contentType: audioFile.type || "audio/webm",
    upsert: true,
  });

  const backupStatus = uploadError ? "failed" : "saved";
  const cloudUploadStatus = String(clientMeta.cloudUploadStatus ?? (uploadError ? "cloud_save_failed" : "uploaded"));

  const { data: backup, error: dbError } = await supabase
    .from("call_local_backups")
    .upsert(
      {
        call_session_id: callSessionId,
        recording_id: recording?.id ?? null,
        local_root_path: `supabase://${BUCKET}`,
        relative_path: relativePath,
        checksum_sha256: checksum,
        file_size: buffer.length,
        backup_status: backupStatus,
        cloud_upload_status: cloudUploadStatus,
        metadata: {
          ...clientMeta,
          adminId: admin.id,
          uploadError: uploadError?.message ?? null,
        },
        updated_at: new Date().toISOString(),
      },
      { onConflict: "call_session_id,relative_path" },
    )
    .select("id, backup_status, relative_path")
    .single();

  if (dbError) {
    return NextResponse.json({ error: dbError.message }, { status: 500 });
  }

  if (uploadError) {
    return NextResponse.json(
      { error: uploadError.message, backupId: backup?.id, status: "failed" },
      { status: 502 },
    );
  }

  await supabase
    .from("call_events")
    .insert({
      call_session_id: callSessionId,
      event_type: "local_backup",
      event_status: "saved",
      payload: { relativePath, checksum, fileSize: buffer.length },
    })
    .catch(() => undefined);

  return NextResponse.json({
    backupId: backup.id,
    relativePath: backup.relative_path,
    status: backup.backup_status,
    checksum,
  });
}
