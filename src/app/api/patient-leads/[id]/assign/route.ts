import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSessionAdmin } from "@/lib/auth";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { logActivity } from "@/lib/data";

const assignSchema = z.object({
  clinicId: z.string().min(1),
  explanation: z.string().max(2000).optional().nullable(),
  matchScore: z.number().min(0).max(100).optional().nullable(),
});

/**
 * Push a verified lead into a clinic's portal inbox.
 * POST /api/patient-leads/[id]/assign
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const adminUser = await getSessionAdmin();
  if (!adminUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: leadId } = await params;
  const parsed = assignSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid assignment payload." }, { status: 400 });
  }

  const supabase = getSupabaseAdmin();
  const { data: lead, error: leadError } = await supabase
    .from("patient_leads")
    .select("id, status, first_name, last_name")
    .eq("id", leadId)
    .maybeSingle();
  if (leadError) throw leadError;
  if (!lead) return NextResponse.json({ error: "Lead not found." }, { status: 404 });

  const { data: clinic, error: clinicError } = await supabase
    .from("Clinic")
    .select("id, name, organization_id")
    .eq("id", parsed.data.clinicId)
    .maybeSingle();
  if (clinicError) throw clinicError;
  if (!clinic) return NextResponse.json({ error: "Clinic not found." }, { status: 404 });
  if (!clinic.organization_id) {
    return NextResponse.json(
      { error: "Clinic is not linked to an organization portal yet. Approve a clinic claim first." },
      { status: 409 },
    );
  }

  const { data: assignment, error: assignError } = await supabase
    .from("lead_assignments")
    .insert({
      lead_id: leadId,
      clinic_id: clinic.id,
      organization_id: clinic.organization_id,
      assigned_by: adminUser.id,
      status: "delivered",
      match_score: parsed.data.matchScore,
      explanation: parsed.data.explanation,
      delivered_at: new Date().toISOString(),
    })
    .select("*")
    .single();

  if (assignError || !assignment) {
    console.error("lead assign", assignError);
    return NextResponse.json(
      { error: assignError?.message?.includes("lead_assignments_active_unique")
          ? "This lead is already assigned to that clinic."
          : "Unable to push lead to clinic portal." },
      { status: 409 },
    );
  }

  await supabase
    .from("patient_leads")
    .update({
      status: "routed",
      updated_at: new Date().toISOString(),
      verified_at: new Date().toISOString(),
      verified_by: adminUser.id,
    })
    .eq("id", leadId);

  await supabase.from("lead_events").insert({
    lead_id: leadId,
    assignment_id: assignment.id,
    actor: adminUser.id,
    action: "pushed_to_clinic",
    payload: { clinicId: clinic.id, clinicName: clinic.name },
  });

  await logActivity({
    adminId: adminUser.id,
    entityType: "patient_lead",
    entityId: leadId,
    action: "patient_lead_routed",
    summary: `Pushed lead ${lead.first_name} ${lead.last_name} to ${clinic.name}`,
  }).catch(() => undefined);

  // Email + in-portal notifications for org members (replaces localStorage prefs).
  const patientLabel = `${lead.first_name} ${lead.last_name}`.trim() || "New patient";
  try {
    const { data: members } = await supabase
      .from("organization_memberships")
      .select("user_id")
      .eq("organization_id", clinic.organization_id)
      .eq("status", "active");
    const userIds = [...new Set((members ?? []).map((m) => m.user_id).filter(Boolean))];
    if (userIds.length) {
      await supabase.from("portal_notifications").insert(
        userIds.map((userId) => ({
          organization_id: clinic.organization_id,
          user_id: userId,
          type: "lead_delivered",
          title: `New patient lead for ${clinic.name}`,
          body: `${patientLabel} was delivered to your clinic portal inbox.`,
          payload: {
            assignmentId: assignment.id,
            leadId,
            clinicId: clinic.id,
            href: `/clinic/leads/${assignment.id}`,
          },
        })),
      );

      const resendKey = process.env.RESEND_API_KEY?.trim();
      if (resendKey) {
        const { data: profiles } = await supabase
          .from("profiles")
          .select("email")
          .in("id", userIds);
        const emails = [
          ...new Set((profiles ?? []).map((p) => p.email).filter(Boolean)),
        ] as string[];
        const portalUrl =
          process.env.NEXT_PUBLIC_PORTAL_SITE_URL?.replace(/\/$/, "") ||
          "https://portal.novalyte.io";
        await Promise.allSettled(
          emails.map((to) =>
            fetch("https://api.resend.com/emails", {
              method: "POST",
              headers: {
                Authorization: `Bearer ${resendKey}`,
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                from: process.env.RESEND_FROM_EMAIL || "Novalyte <noreply@novalyte.io>",
                to: [to],
                subject: `New patient lead for ${clinic.name}`,
                html: `<p>${patientLabel} was delivered to your clinic portal inbox.</p><p><a href="${portalUrl}/clinic/leads/${assignment.id}">Open lead</a></p>`,
              }),
            }),
          ),
        );
      }
    }
  } catch (notifyError) {
    console.warn("clinic lead notify failed", notifyError);
  }

  return NextResponse.json({
    ok: true,
    assignment,
    message: `Lead delivered to ${clinic.name} clinic portal.`,
  });
}
