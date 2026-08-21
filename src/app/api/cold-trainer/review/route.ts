import { NextRequest, NextResponse } from "next/server";
import { getSessionAdmin } from "@/lib/auth";
import { extractReviewFromTranscript, mergeModelReview } from "@/lib/cold-trainer/extract";
import { generatePostCallFeedback } from "@/lib/cold-trainer/generate";
import { computeTalkListenMetrics } from "@/lib/cold-trainer/metrics";
import type { ClinicContextPayload, PrepFields, TalkListenMetrics, TranscriptTurn } from "@/lib/cold-trainer/types";
import { z } from "zod";

const schema = z.object({
  transcript: z.array(z.unknown()).max(200).default([]),
  talk_listen_metrics: z.record(z.string(), z.unknown()).optional(),
  clinic: z.record(z.string(), z.unknown()),
  prep: z.record(z.string(), z.unknown()),
});

export async function POST(req: NextRequest) {
  if (!(await getSessionAdmin())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const parsed = schema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "Invalid review request." }, { status: 400 });

  const turns = parsed.data.transcript as TranscriptTurn[];
  const metrics = (parsed.data.talk_listen_metrics as TalkListenMetrics | undefined)
    ?? computeTalkListenMetrics(turns);
  const clinic = parsed.data.clinic as ClinicContextPayload;
  const prep = parsed.data.prep as PrepFields;
  let review = extractReviewFromTranscript(turns, metrics);
  const model = await generatePostCallFeedback({
    clinic,
    turns,
    metrics,
    prep,
    callGoal: clinic.call_goal,
  });
  if (model) review = mergeModelReview(review, model);
  return NextResponse.json({ review });
}
