import { NextRequest, NextResponse } from "next/server";
import { getSessionAdmin } from "@/lib/auth";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { extractReviewFromTranscript, mergeModelReview } from "@/lib/cold-trainer/extract";
import { generatePostCallFeedback } from "@/lib/cold-trainer/generate";
import { computeTalkListenMetrics } from "@/lib/cold-trainer/metrics";
import type { ClinicContextPayload, PrepFields, TalkListenMetrics, TranscriptTurn } from "@/lib/cold-trainer/types";
import { z } from "zod";

const schema = z.object({
  transcript: z.array(z.unknown()).max(200).default([]),
  coaching_events: z.array(z.unknown()).max(200).optional(),
  suggested_lines: z.array(z.unknown()).max(80).optional(),
  talk_listen_metrics: z.record(z.string(), z.unknown()).optional(),
  call_outcome: z.string().max(80).optional(),
  follow_up_date: z.string().max(40).nullable().optional(),
  follow_up_notes: z.string().max(2000).optional(),
  call_goal: z.string().max(80).optional(),
  clinic: z.record(z.string(), z.unknown()).optional(),
  prep: z.record(z.string(), z.unknown()).optional(),
});

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = await getSessionAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const parsed = schema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "Invalid complete payload." }, { status: 400 });

  const turns = parsed.data.transcript as TranscriptTurn[];
  const metrics = (parsed.data.talk_listen_metrics as TalkListenMetrics | undefined)
    ?? computeTalkListenMetrics(turns);
  let review = extractReviewFromTranscript(turns, metrics);
  if (parsed.data.call_outcome) review.outcome = parsed.data.call_outcome;

  const clinic = parsed.data.clinic as ClinicContextPayload | undefined;
  const prep = parsed.data.prep as PrepFields | undefined;
  if (clinic && prep) {
    const model = await generatePostCallFeedback({
      clinic,
      turns,
      metrics,
      prep,
      callGoal: clinic.call_goal,
    });
    if (model) review = mergeModelReview(review, model);
  }

  const row = {
    ended_at: new Date().toISOString(),
    call_outcome: review.outcome,
    transcript: parsed.data.transcript,
    coaching_events: parsed.data.coaching_events ?? [],
    suggested_lines: parsed.data.suggested_lines ?? [],
    talk_listen_metrics: metrics,
    extracted_contacts: review.extractedContacts,
    verified_clinic_fields: review.verifiedClinicFields,
    objection_tags: review.objectionTags,
    follow_up_date: parsed.data.follow_up_date || null,
    follow_up_notes: parsed.data.follow_up_notes ?? review.followUpNotes,
    updated_at: new Date().toISOString(),
  };

  try {
    const { data, error } = await getSupabaseAdmin()
      .from("cold_trainer_sessions")
      .update(row)
      .eq("id", id)
      .eq("user_id", admin.id)
      .select()
      .maybeSingle();
    if (error) throw error;
    return NextResponse.json({ session: data ?? { id, ...row }, review });
  } catch (err) {
    console.error("cold_trainer_sessions complete failed", err);
    return NextResponse.json({ session: { id, ...row }, review, persisted: false });
  }
}
