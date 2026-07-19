import { NextRequest, NextResponse } from "next/server";
import { getSessionAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { getDialpadConfig } from "@/lib/dialpad/env";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Authenticated recording access. Raw provider recording URLs are never
 * returned by list/detail endpoints; playback goes through this route, which
 * verifies the caller can access the related call before redirecting to the
 * protected provider reference.
 *
 * GET  -> lists recording metadata for the session (no URLs)
 * GET ?recordingId=… -> 302 redirect to the provider recording reference
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = await getSessionAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const session = await db.callSession.findUnique({ where: { id } });
  if (!session || session.provider !== "dialpad") {
    return NextResponse.json({ error: "Call session not found." }, { status: 404 });
  }

  const supabase = getSupabaseAdmin();
  const recordingId = req.nextUrl.searchParams.get("recordingId");

  if (!recordingId) {
    const { data, error } = await supabase
      .from("call_recordings")
      .select("id, recording_type, duration_ms, available_at, recording_status")
      .eq("call_session_id", id)
      .eq("provider", "dialpad");
    if (error) return NextResponse.json({ error: "Failed to load recordings." }, { status: 500 });
    return NextResponse.json({
      recordingAvailable: Boolean(session.recordingAvailable),
      recordings: data ?? [],
      note: "Recording availability depends on the Dialpad recording configuration and applicable notification/consent requirements.",
    });
  }

  const { data: recording } = await supabase
    .from("call_recordings")
    .select("provider_url, recording_status")
    .eq("id", recordingId)
    .eq("call_session_id", id)
    .eq("provider", "dialpad")
    .maybeSingle();

  if (!recording?.provider_url) {
    return NextResponse.json({ error: "Recording is not available." }, { status: 404 });
  }

  const config = getDialpadConfig();
  if (config.mode === "mock") {
    // Mock recordings point at an invalid host by design; never redirect there.
    return NextResponse.json({
      error: "Mock mode: recording playback is simulated and has no audio.",
      mock: true,
    }, { status: 200 });
  }

  // Dialpad recording URLs are provider-hosted and access-controlled by
  // Dialpad. Redirect rather than proxying so provider-side auth applies;
  // response is never publicly cacheable.
  return NextResponse.redirect(recording.provider_url, {
    status: 302,
    headers: { "Cache-Control": "no-store, private" },
  });
}
