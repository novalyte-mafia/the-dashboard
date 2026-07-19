import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { mapClinicClaim } from "@/lib/workforce/mappers";
import { requireWorkforceAdmin } from "@/lib/workforce/admin-auth";

const ACTIONS = new Set(["approve", "reject", "revoke"]);

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireWorkforceAdmin();
  if ("response" in auth) return auth.response;

  const { id } = await params;
  const body = (await req.json().catch(() => ({}))) as {
    action?: string;
    notes?: string;
  };

  if (!body.action || !ACTIONS.has(body.action)) {
    return NextResponse.json({ error: "Invalid action." }, { status: 400 });
  }

  const { data, error } = await getSupabaseAdmin().rpc("admin_review_clinic_claim", {
    p_claim_id: id,
    p_action: body.action,
    p_notes: body.notes ?? null,
    p_reviewer: auth.admin.email,
  });

  if (error) {
    console.error("admin_review_clinic_claim error", error);
    const message = error.message ?? "Unable to review clinic claim.";
    const status = /not found/i.test(message) ? 404 : 502;
    return NextResponse.json({ error: message }, { status });
  }

  return NextResponse.json({ claim: mapClinicClaim(data) });
}
