import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { getSessionAdmin } from "@/lib/auth";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { z } from "zod";

const CALL_GOAL_ENUM = ["Find decision-maker", "Verify listing", "Request permission", "Book follow-up", "Re-engage"] as const;

const schema = z.object({
  clinic_id: z.string().max(120).nullable().optional(),
  contact_id: z.string().max(120).nullable().optional(),
  call_goal: z.enum(CALL_GOAL_ENUM),
  consent_status: z.string().max(80).default("transcription_acknowledged"),
  recording_status: z.string().max(80).default("not_started"),
  prep: z.record(z.string(), z.unknown()).optional(),
});

export async function POST(req: NextRequest) {
  const admin = await getSessionAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const parsed = schema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "Invalid session create." }, { status: 400 });

  const id = `cts_${randomUUID()}`;
  const row = {
    id,
    clinic_id: parsed.data.clinic_id ?? null,
    contact_id: parsed.data.contact_id ?? null,
    user_id: admin.id,
    started_at: new Date().toISOString(),
    call_goal: parsed.data.call_goal,
    consent_status: parsed.data.consent_status,
    recording_status: parsed.data.recording_status,
    transcript: [],
    coaching_events: [],
    suggested_lines: [],
    talk_listen_metrics: {},
    extracted_contacts: [],
    verified_clinic_fields: {},
    objection_tags: [],
    follow_up_notes: parsed.data.prep ? JSON.stringify(parsed.data.prep) : null,
  };

  try {
    const { data, error } = await getSupabaseAdmin().from("cold_trainer_sessions").insert(row).select().single();
    if (error) throw error;
    return NextResponse.json({ session: data });
  } catch (err) {
    console.error("cold_trainer_sessions create failed", err);
    return NextResponse.json({ session: row, persisted: false });
  }
}
