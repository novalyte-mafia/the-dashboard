import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAdminRole } from "@/lib/auth";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { db } from "@/lib/db";
import { generatePostCallAnalysis } from "@/lib/calls/post-call-analysis";
import type { ConsentStatus } from "@/lib/calls/recording-consent";

const schema = z.object({
  transcript: z.array(z.object({
    speaker: z.string(),
    text: z.string(),
    timestamp: z.string().optional(),
  })).optional(),
  durationSec: z.number().int().min(0).optional(),
  consentStatus: z.string().optional(),
  recordingStatus: z.string().optional(),
  qualification: z.record(z.string(), z.unknown()).optional(),
  outcome: z.string().optional(),
  copilotSuggestions: z.array(z.object({
    suggested_response: z.string(),
    was_used: z.boolean().optional(),
  })).optional(),
});

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdminRole(["admin", "operations", "sales"]);
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: callSessionId } = await params;
  const session = await db.callSession.findUnique({
    where: { id: callSessionId },
    include: { clinic: { select: { name: true } } },
  });
  if (!session) return NextResponse.json({ error: "Call session not found" }, { status: 404 });

  const body = schema.safeParse(await req.json().catch(() => ({})));
  const structured = JSON.parse(session.structuredData || "{}") as Record<string, unknown>;

  let transcript = body.success && body.data.transcript?.length
    ? body.data.transcript
    : (JSON.parse(session.transcript || "[]") as Array<{ speaker: string; text: string; timestamp?: string }>);

  transcript = transcript.filter((l) => l.speaker !== "Coach");

  const analysis = generatePostCallAnalysis({
    callSessionId,
    clinicId: session.clinicId,
    clinicName: session.clinic?.name ?? "Clinic",
    transcript,
    durationSec: body.data?.durationSec ?? session.durationSec ?? 0,
    consentStatus: (body.data?.consentStatus ?? structured.consentStatus ?? "unknown") as ConsentStatus,
    recordingStatus: body.data?.recordingStatus ?? String(structured.recordingStatus ?? "unknown"),
    copilotSuggestions: body.data?.copilotSuggestions ?? [],
    qualification: (body.data?.qualification ?? structured.qualification ?? {}) as Record<string, unknown>,
    outcome: body.data?.outcome ?? session.outcome,
  });

  const supabase = getSupabaseAdmin() as any;
  const { data, error } = await supabase
    .from("call_post_analyses")
    .upsert({
      call_session_id: callSessionId,
      clinic_id: session.clinicId,
      summary: analysis.summary,
      directory_permission_result: analysis.directoryPermissionResult,
      contact_reached: analysis.contactReached,
      decision_maker_status: analysis.decisionMakerStatus,
      information_collected: analysis.informationCollected,
      information_missing: analysis.informationMissing,
      clinic_questions: analysis.clinicQuestions,
      objections_raised: analysis.objectionsRaised,
      operator_responses: analysis.operatorResponses,
      copilot_suggestions_summary: analysis.copilotSuggestionsSummary,
      strong_moments: analysis.strongMoments,
      weak_moments: analysis.weakMoments,
      missed_opportunities: analysis.missedOpportunities,
      compliance_concerns: analysis.complianceConcerns,
      follow_up_action: analysis.followUpAction,
      recommended_follow_up_date: analysis.recommendedFollowUpDate,
      clinic_interest_level: analysis.clinicInterestLevel,
      call_quality_score: analysis.callQualityScore,
      transcript_confidence_score: analysis.transcriptConfidenceScore,
      recording_quality_score: analysis.recordingQualityScore,
      training_eligibility_recommendation: analysis.trainingEligibilityRecommendation,
      analysis_status: "completed",
      raw_analysis: analysis,
      updated_at: new Date().toISOString(),
    }, { onConflict: "call_session_id" })
    .select("id")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await db.callSession.update({
    where: { id: callSessionId },
    data: {
      structuredData: JSON.stringify({
        ...structured,
        postCallAnalysis: analysis,
        postAnalysisId: data.id,
        directoryPermissionStatus: analysis.directoryPermissionResult,
        trainingEligible: analysis.trainingEligibilityRecommendation,
      }),
    },
  }).catch(() => undefined);

  return NextResponse.json({ analysis, analysisId: data.id });
}
