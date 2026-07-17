import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAdminRole } from "@/lib/auth";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { db } from "@/lib/db";
import { createHash } from "crypto";

const BUCKET = "call-recordings";

const schema = z.object({
  idempotencyKey: z.string().min(8).max(120).optional(),
  fileType: z.string().max(80).default("audio/webm"),
  audioDurationSec: z.number().int().min(0).max(86400).optional(),
  consentStatus: z.string().max(60).optional(),
  checksumSha256: z.string().max(128).optional(),
});

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdminRole(["admin", "operations", "sales"]);
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: callSessionId } = await params;
  const session = await db.callSession.findUnique({ where: { id: callSessionId } });
  if (!session) return NextResponse.json({ error: "Call session not found" }, { status: 404 });

  const formData = await req.formData().catch(() => null);
  if (!formData?.get("audio")) {
    return NextResponse.json({ error: "Missing audio file." }, { status: 400 });
  }

  const meta = schema.safeParse({
    idempotencyKey: formData.get("idempotencyKey") ?? undefined,
    fileType: formData.get("fileType") ?? "audio/webm",
    audioDurationSec: formData.get("audioDurationSec") ? Number(formData.get("audioDurationSec")) : undefined,
    consentStatus: formData.get("consentStatus") ?? undefined,
    checksumSha256: formData.get("checksumSha256") ?? undefined,
  });
  if (!meta.success) return NextResponse.json({ error: "Invalid recording metadata." }, { status: 400 });

  const audioFile = formData.get("audio") as File;
  const buffer = Buffer.from(await audioFile.arrayBuffer());
  const checksum =
    meta.data.checksumSha256 ?? createHash("sha256").update(buffer).digest("hex");
  const idempotencyKey = meta.data.idempotencyKey ?? `${callSessionId}-primary`;
  const storagePath = `${session.clinicId}/${callSessionId}/${idempotencyKey}.webm`;

  const supabase = getSupabaseAdmin() as any;

  // Idempotency: return existing if already uploaded
  const { data: existing } = await supabase
    .from("call_recordings")
    .select("id, storage_path, recording_status")
    .eq("call_session_id", callSessionId)
    .eq("idempotency_key", idempotencyKey)
    .maybeSingle();

  if (existing?.recording_status === "uploaded" || existing?.recording_status === "finalized") {
    return NextResponse.json({ recordingId: existing.id, storagePath: existing.storage_path, status: "uploaded", deduplicated: true });
  }

  const { error: uploadError } = await supabase.storage.from(BUCKET).upload(storagePath, buffer, {
    contentType: meta.data.fileType,
    upsert: false,
  });

  if (uploadError && !uploadError.message?.includes("already exists")) {
    await supabase.from("call_recordings").upsert({
      call_session_id: callSessionId,
      clinic_id: session.clinicId,
      admin_id: admin.id,
      storage_bucket: BUCKET,
      storage_path: storagePath,
      file_type: meta.data.fileType,
      file_size: buffer.length,
      checksum_sha256: checksum,
      recording_status: "cloud_save_failed",
      consent_status: meta.data.consentStatus ?? "unknown",
      idempotency_key: idempotencyKey,
      error_details: uploadError.message,
      updated_at: new Date().toISOString(),
    }, { onConflict: "call_session_id,idempotency_key" }).catch(() => undefined);

    return NextResponse.json({ error: uploadError.message }, { status: 502 });
  }

  const { data: recording, error: dbError } = await supabase
    .from("call_recordings")
    .upsert({
      call_session_id: callSessionId,
      clinic_id: session.clinicId,
      contact_id: session.contactId,
      admin_id: admin.id,
      provider_call_id: session.providerCallId,
      storage_bucket: BUCKET,
      storage_path: storagePath,
      file_type: meta.data.fileType,
      file_size: buffer.length,
      audio_duration_sec: meta.data.audioDurationSec,
      checksum_sha256: checksum,
      recording_status: "uploaded",
      consent_status: meta.data.consentStatus ?? "unknown",
      transcript_status: "pending",
      analysis_status: "pending",
      idempotency_key: idempotencyKey,
      ended_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }, { onConflict: "call_session_id,idempotency_key" })
    .select("id, storage_path")
    .single();

  if (dbError) return NextResponse.json({ error: dbError.message }, { status: 500 });

  const signedUrl = await supabase.storage.from(BUCKET).createSignedUrl(storagePath, 3600);

  await db.callSession.update({
    where: { id: callSessionId },
    data: {
      recordingUrl: signedUrl.data?.signedUrl ?? storagePath,
      structuredData: JSON.stringify({
        ...(JSON.parse(session.structuredData || "{}") as object),
        recordingId: recording.id,
        recordingStoragePath: storagePath,
        recordingChecksum: checksum,
      }),
    },
  }).catch(() => undefined);

  return NextResponse.json({
    recordingId: recording.id,
    storagePath: recording.storage_path,
    status: "uploaded",
    signedUrl: signedUrl.data?.signedUrl,
  });
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdminRole(["admin", "operations", "sales"]);
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: callSessionId } = await params;
  const body = await req.json().catch(() => ({}));
  const recordingStatus = String(body.recordingStatus ?? "");
  const supabase = getSupabaseAdmin() as any;

  const { data, error } = await supabase
    .from("call_recordings")
    .update({ recording_status: recordingStatus, updated_at: new Date().toISOString() })
    .eq("call_session_id", callSessionId)
    .select("id, recording_status")
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ recording: data });
}
