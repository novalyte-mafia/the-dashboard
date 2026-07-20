import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSessionAdmin } from "@/lib/auth";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { logActivity } from "@/lib/data";

const schema = z.discriminatedUnion("source", [
  z.object({ source: z.literal("assessment"), assessmentId: z.string().min(1) }),
  z.object({ source: z.literal("consultation"), consultationId: z.string().min(1) }),
]);

/**
 * Promote AssessmentSubmission or ConsultationRequest → patient_leads.
 * POST /api/patient-leads/promote
 */
export async function POST(req: NextRequest) {
  const adminUser = await getSessionAdmin();
  if (!adminUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid promote payload.", details: parsed.error.flatten() }, { status: 400 });
  }

  const supabase = getSupabaseAdmin();
  const arg =
    parsed.data.source === "assessment" ? parsed.data.assessmentId : parsed.data.consultationId;

  const rpcResult =
    parsed.data.source === "assessment"
      ? await supabase.rpc("promote_assessment_to_patient_lead", { p_assessment_id: arg })
      : await supabase.rpc("promote_consultation_to_patient_lead", { p_consultation_id: arg });

  if (rpcResult.error || !rpcResult.data) {
    console.error("promote lead rpc", rpcResult.error);
    return NextResponse.json({ error: rpcResult.error?.message || "Unable to promote lead." }, { status: 502 });
  }

  await logActivity({
    adminId: adminUser.id,
    entityType: "patient_lead",
    entityId: String(rpcResult.data),
    action: "patient_lead_promoted",
    summary: `Promoted ${parsed.data.source} ${arg} to patient lead`,
  }).catch(() => undefined);

  const { data: lead } = await supabase.from("patient_leads").select("*").eq("id", rpcResult.data).maybeSingle();

  return NextResponse.json({ leadId: rpcResult.data, lead }, { status: 201 });
}
