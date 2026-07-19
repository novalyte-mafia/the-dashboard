import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAdminRole } from "@/lib/auth";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { db } from "@/lib/db";

const transcriptLineSchema = z.object({
  speaker: z.string().min(1).max(60),
  text: z.string().min(1).max(20000),
  timestamp: z.string().optional(),
  kind: z.enum(["utterance", "coach"]).optional(),
});

const suggestionSchema = z.object({
  suggested_response: z.string().min(1).max(4000),
  was_used: z.boolean().optional(),
  response_type: z.string().max(80).optional(),
  call_stage: z.string().max(80).optional(),
  reason: z.string().max(2000).optional(),
  knowledge_sources: z.array(z.unknown()).optional(),
  grounding_status: z.string().max(80).optional(),
  confidence: z.number().min(0).max(1).optional(),
  clinic_utterance: z.string().max(4000).optional(),
  latency_ms: z.number().int().min(0).max(120000).optional(),
});

const schema = z.object({
  transcript: z.array(transcriptLineSchema).max(2000).optional(),
  suggestions: z.array(suggestionSchema).max(500).optional(),
  provider: z.string().max(60).optional(),
});

/**
 * Persist final transcript segments + copilot suggestions for a call session.
 * Idempotent on (call_session_id, sequence_num) for segments.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdminRole(["admin", "operations", "sales"]);
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: callSessionId } = await params;
  const session = await db.callSession.findUnique({ where: { id: callSessionId } });
  if (!session) return NextResponse.json({ error: "Call session not found" }, { status: 404 });

  const parsed = schema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid artifacts payload." }, { status: 400 });
  }

  const supabase = getSupabaseAdmin() as any;
  const provider = parsed.data.provider ?? "deepgram";
  let segmentsWritten = 0;
  let suggestionsWritten = 0;

  const spoken = (parsed.data.transcript ?? []).filter(
    (line) => line.kind !== "coach" && line.speaker !== "Coach" && line.text.trim(),
  );

  if (spoken.length > 0) {
    const rows = spoken.map((line, index) => ({
      call_session_id: callSessionId,
      sequence_num: index + 1,
      speaker: line.speaker,
      text: line.text.trim(),
      is_final: true,
      provider,
      started_at: line.timestamp && !Number.isNaN(Date.parse(line.timestamp))
        ? new Date(line.timestamp).toISOString()
        : null,
      metadata: { adminId: admin.id },
    }));

    const { error } = await supabase
      .from("call_transcript_segments")
      .upsert(rows, { onConflict: "call_session_id,sequence_num" });

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    segmentsWritten = rows.length;
  }

  if (parsed.data.suggestions?.length) {
    const rows = parsed.data.suggestions.map((item, index) => ({
      call_session_id: callSessionId,
      sequence_num: index + 1,
      suggested_response: item.suggested_response,
      response_type: item.response_type ?? null,
      call_stage: item.call_stage ?? null,
      reason: item.reason ?? null,
      knowledge_sources: item.knowledge_sources ?? [],
      grounding_status: item.grounding_status ?? null,
      confidence: item.confidence ?? null,
      clinic_utterance: item.clinic_utterance ?? null,
      was_used: item.was_used ?? null,
      latency_ms: item.latency_ms ?? null,
      metadata: { adminId: admin.id },
    }));

    // Replace prior rows for this session so re-finalize stays idempotent.
    await supabase.from("call_copilot_suggestions").delete().eq("call_session_id", callSessionId);
    const { error } = await supabase.from("call_copilot_suggestions").insert(rows);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    suggestionsWritten = rows.length;
  }

  if (parsed.data.suggestions?.length) {
    await db.callSession
      .update({
        where: { id: callSessionId },
        data: { aiSuggestions: JSON.stringify(parsed.data.suggestions) },
      })
      .catch(() => undefined);
  }

  await supabase
    .from("call_events")
    .insert({
      call_session_id: callSessionId,
      event_type: "artifacts_persisted",
      event_status: "saved",
      payload: { segmentsWritten, suggestionsWritten },
    })
    .catch(() => undefined);

  return NextResponse.json({ segmentsWritten, suggestionsWritten });
}
