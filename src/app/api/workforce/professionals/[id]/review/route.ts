import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { requireWorkforceAdmin } from "@/lib/workforce/admin-auth";

const REVIEW_STATUSES = new Set(["pending_review", "approved", "rejected", "suspended"]);

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireWorkforceAdmin();
  if ("response" in auth) return auth.response;

  const { id } = await params;
  const body = (await req.json().catch(() => ({}))) as {
    reviewStatus?: string;
    reason?: string;
  };

  if (!body.reviewStatus || !REVIEW_STATUSES.has(body.reviewStatus)) {
    return NextResponse.json({ error: "Invalid reviewStatus." }, { status: 400 });
  }

  const { data, error } = await getSupabaseAdmin().rpc("admin_set_professional_review_status", {
    p_profile_id: id,
    p_review_status: body.reviewStatus,
    p_reason: body.reason ?? null,
  });

  if (error) {
    console.error("admin_set_professional_review_status error", error);
    const message = error.message ?? "Unable to update professional review status.";
    const status = /not found/i.test(message) ? 404 : 502;
    return NextResponse.json({ error: message }, { status });
  }

  return NextResponse.json({ profile: data });
}
