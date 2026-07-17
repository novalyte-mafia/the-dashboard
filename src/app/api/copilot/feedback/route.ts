import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSessionAdmin } from "@/lib/auth";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

const schema = z.object({
  callSessionId: z.string().optional(),
  rating: z.enum([
    "helpful",
    "not_helpful",
    "incorrect",
    "too_long",
    "too_aggressive",
    "repetitive",
    "not_relevant",
    "factually_inaccurate",
    "used_successfully",
    "edited_before_speaking",
  ]),
  originalSuggestion: z.string().max(4000).optional(),
  finalResponseUsed: z.string().max(4000).optional(),
  transcriptContext: z.string().max(12000).optional(),
  retrievedKnowledge: z.any().optional(),
  callStage: z.string().max(100).optional(),
  objectionType: z.string().max(200).optional(),
  metadata: z.record(z.string(), z.any()).optional(),
});

export async function POST(req: NextRequest) {
  if (!(await getSessionAdmin())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const parsed = schema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "Invalid feedback" }, { status: 400 });

  try {
    const supabase = getSupabaseAdmin() as any;
    const { data, error } = await supabase
      .from("copilot_response_feedback")
      .insert({
        call_session_id: parsed.data.callSessionId ?? null,
        rating: parsed.data.rating,
        original_suggestion: parsed.data.originalSuggestion ?? null,
        final_response_used: parsed.data.finalResponseUsed ?? null,
        transcript_context: parsed.data.transcriptContext ?? null,
        retrieved_knowledge: parsed.data.retrievedKnowledge ?? null,
        call_stage: parsed.data.callStage ?? null,
        objection_type: parsed.data.objectionType ?? null,
        metadata: parsed.data.metadata ?? null,
      })
      .select("id")
      .single();
    if (error) throw error;
    return NextResponse.json({ ok: true, id: data.id });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message ?? "Feedback save failed" }, { status: 500 });
  }
}
