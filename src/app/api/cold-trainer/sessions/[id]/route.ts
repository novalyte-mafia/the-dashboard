import { NextRequest, NextResponse } from "next/server";
import { getSessionAdmin } from "@/lib/auth";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { z } from "zod";

const schema = z.object({
  transcript: z.array(z.unknown()).max(200).optional(),
  coaching_events: z.array(z.unknown()).max(200).optional(),
  suggested_lines: z.array(z.unknown()).max(80).optional(),
  talk_listen_metrics: z.record(z.string(), z.unknown()).optional(),
  call_goal: z.string().max(80).optional(),
  recording_status: z.string().max(80).optional(),
  created_call_id: z.string().max(120).nullable().optional(),
  call_outcome: z.string().max(80).optional(),
  extracted_contacts: z.array(z.unknown()).optional(),
  verified_clinic_fields: z.record(z.string(), z.unknown()).optional(),
  objection_tags: z.array(z.string()).optional(),
  follow_up_date: z.string().max(40).nullable().optional(),
  follow_up_notes: z.string().max(2000).optional(),
});

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = await getSessionAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const parsed = schema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "Invalid session patch." }, { status: 400 });

  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  for (const [key, value] of Object.entries(parsed.data)) {
    if (value !== undefined) patch[key] = value;
  }

  try {
    const { data, error } = await getSupabaseAdmin()
      .from("cold_trainer_sessions")
      .update(patch)
      .eq("id", id)
      .eq("user_id", admin.id)
      .select()
      .maybeSingle();
    if (error) throw error;
    return NextResponse.json({ session: data ?? { id, ...patch } });
  } catch (err) {
    console.error("cold_trainer_sessions patch failed", err);
    return NextResponse.json({ session: { id, ...patch }, persisted: false });
  }
}
