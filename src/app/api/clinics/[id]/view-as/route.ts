import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSessionAdmin, requireAdminRole } from "@/lib/auth";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { logActivity } from "@/lib/data";

const bodySchema = z.object({
  reason: z.string().min(8).max(500),
  /** Design gate: must acknowledge that full JWT minting is not enabled. */
  acknowledgeDesignOnly: z.literal(true),
});

/**
 * Admin "view as clinic" — design + audit gate only.
 * Records intent in clinic_admin_impersonation_sessions; does NOT mint clinic sessions yet.
 * POST /api/clinics/[id]/view-as
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const adminUser = await requireAdminRole(["admin", "operations"]);
  if (!adminUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: clinicId } = await params;
  const parsed = bodySchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "Provide a reason (8+ chars) and acknowledgeDesignOnly: true.",
        design: {
          enabled: false,
          next: "Session minting ships after Phase 0 audit trail is validated in production.",
        },
      },
      { status: 400 },
    );
  }

  const supabase = getSupabaseAdmin();
  const { data: clinic, error } = await supabase
    .from("Clinic")
    .select("id, name, organization_id")
    .eq("id", clinicId)
    .maybeSingle();
  if (error) throw error;
  if (!clinic) return NextResponse.json({ error: "Clinic not found." }, { status: 404 });
  if (!clinic.organization_id) {
    return NextResponse.json(
      { error: "Clinic has no organization_id — claim/approve first." },
      { status: 409 },
    );
  }

  const { data: session, error: insertError } = await supabase
    .from("clinic_admin_impersonation_sessions")
    .insert({
      admin_user_id: adminUser.id,
      organization_id: clinic.organization_id,
      clinic_id: clinic.id,
      reason: parsed.data.reason,
      audit_note: "design_gate_only_no_jwt",
    })
    .select("id, started_at")
    .single();

  if (insertError) {
    // Table may not be migrated on dashboard DB yet — still return the design contract.
    console.warn("view-as insert failed (migration pending?)", insertError.message);
    await logActivity({
      adminId: adminUser.id,
      entityType: "clinic",
      entityId: clinicId,
      action: "clinic_view_as_requested",
      summary: `View-as requested for ${clinic.name} (gate only): ${parsed.data.reason}`,
    }).catch(() => undefined);

    return NextResponse.json({
      ok: true,
      enabled: false,
      designOnly: true,
      clinicId: clinic.id,
      organizationId: clinic.organization_id,
      message:
        "View-as is gated: audit intent recorded when table exists. No clinic JWT was minted.",
    });
  }

  await logActivity({
    adminId: adminUser.id,
    entityType: "clinic",
    entityId: clinicId,
    action: "clinic_view_as_requested",
    summary: `View-as gate session ${session.id} for ${clinic.name}`,
  }).catch(() => undefined);

  return NextResponse.json({
    ok: true,
    enabled: false,
    designOnly: true,
    impersonationSessionId: session.id,
    startedAt: session.started_at,
    clinicId: clinic.id,
    organizationId: clinic.organization_id,
    message:
      "View-as design gate: session row created for audit. Clinic JWT minting is not enabled yet.",
  });
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const adminUser = await getSessionAdmin();
  if (!adminUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  return NextResponse.json({
    clinicId: id,
    enabled: false,
    designOnly: true,
    endpoint: "POST /api/clinics/[id]/view-as",
    requiredBody: { reason: "string", acknowledgeDesignOnly: true },
  });
}
