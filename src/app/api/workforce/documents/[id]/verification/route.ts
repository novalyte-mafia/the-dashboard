import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { requireWorkforceAdmin } from "@/lib/workforce/admin-auth";

const VERIFICATION_STATUSES = new Set(["pending", "verified", "rejected"]);

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireWorkforceAdmin();
  if ("response" in auth) return auth.response;

  const { id } = await params;
  const body = (await req.json().catch(() => ({}))) as {
    status?: string;
    reason?: string;
  };

  if (!body.status || !VERIFICATION_STATUSES.has(body.status)) {
    return NextResponse.json({ error: "Invalid status." }, { status: 400 });
  }

  const { data, error } = await getSupabaseAdmin().rpc("admin_set_document_verification", {
    p_document_id: id,
    p_status: body.status,
    p_reviewer: auth.admin.email,
    p_reason: body.reason ?? null,
  });

  if (error) {
    console.error("admin_set_document_verification error", error);
    const message = error.message ?? "Unable to update document verification.";
    const status = /not found/i.test(message) ? 404 : 502;
    return NextResponse.json({ error: message }, { status });
  }

  return NextResponse.json({ document: data });
}
