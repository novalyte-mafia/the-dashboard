import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAdminRole } from "@/lib/auth";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { db } from "@/lib/db";

const schema = z.object({
  consentStatus: z.enum([
    "not_required", "pending", "verbal_consent_obtained", "written_consent_obtained",
    "declined", "unknown", "recording_disabled", "compliance_review_required",
  ]),
  jurisdiction: z.string().max(120).optional(),
  consentScript: z.string().max(2000).optional(),
  consentWording: z.string().max(2000).optional(),
});

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdminRole(["admin", "operations", "sales"]);
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: callSessionId } = await params;
  const parsed = schema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "Invalid consent payload." }, { status: 400 });

  const session = await db.callSession.findUnique({ where: { id: callSessionId } });
  if (!session) return NextResponse.json({ error: "Call session not found" }, { status: 404 });

  const supabase = getSupabaseAdmin() as any;
  const { data, error } = await supabase
    .from("call_consent_events")
    .insert({
      call_session_id: callSessionId,
      clinic_id: session.clinicId,
      consent_status: parsed.data.consentStatus,
      jurisdiction: parsed.data.jurisdiction,
      consent_script: parsed.data.consentScript,
      consent_wording: parsed.data.consentWording,
      recorded_by_admin_id: admin.id,
    })
    .select("id, consent_status, created_at")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await db.callSession.update({
    where: { id: callSessionId },
    data: {
      structuredData: JSON.stringify({
        ...(JSON.parse(session.structuredData || "{}") as object),
        consentStatus: parsed.data.consentStatus,
        consentEventId: data.id,
      }),
    },
  }).catch(() => undefined);

  try {
    await supabase.from("call_events").insert({
      call_session_id: callSessionId,
      event_type: "consent",
      event_status: parsed.data.consentStatus,
      payload: { jurisdiction: parsed.data.jurisdiction },
    });
  } catch (_) {
    // Non-critical audit log — swallow failures
  }

  return NextResponse.json({ consent: data });
}
