import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { requireWorkforceAdmin } from "@/lib/workforce/admin-auth";

const ACTIONS = new Set(["verify", "reject"]);

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireWorkforceAdmin();
  if ("response" in auth) return auth.response;

  const { id } = await params;
  const body = (await req.json().catch(() => ({}))) as {
    action?: string;
    reason?: string;
  };

  if (!body.action || !ACTIONS.has(body.action)) {
    return NextResponse.json({ error: "Invalid action." }, { status: 400 });
  }

  const supabase = getSupabaseAdmin();
  const { data: docs, error: listError } = await supabase
    .from("professional_documents")
    .select("id, status, verification_status")
    .eq("profileId", id)
    .limit(100);
  if (listError) {
    console.error("list pending documents error", listError);
    return NextResponse.json({ error: "Unable to load pending documents." }, { status: 502 });
  }

  const pendingDocs = (docs ?? []).filter(
    (doc) => (doc.verification_status ?? doc.status ?? "pending") === "pending",
  );

  const targetStatus = body.action === "verify" ? "verified" : "rejected";
  const updated: unknown[] = [];

  for (const doc of pendingDocs) {
    const { data, error } = await supabase.rpc("admin_set_document_verification", {
      p_document_id: doc.id,
      p_status: targetStatus,
      p_reviewer: auth.admin.email,
      p_reason: body.reason ?? null,
    });
    if (error) {
      console.error("batch document verification error", error);
      return NextResponse.json({ error: error.message ?? "Unable to update credentials." }, { status: 502 });
    }
    updated.push(data);
  }

  return NextResponse.json({ documents: updated, updatedCount: updated.length });
}
