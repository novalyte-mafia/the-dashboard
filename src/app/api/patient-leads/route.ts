import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSessionAdmin } from "@/lib/auth";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { logActivity } from "@/lib/data";

const createSchema = z.object({
  source: z.enum(["assessment", "consultation", "manual", "import", "campaign"]).default("manual"),
  firstName: z.string().trim().min(1).max(80),
  lastName: z.string().trim().max(80).optional().default(""),
  email: z.string().email().optional().nullable(),
  phone: z.string().max(40).optional().nullable(),
  city: z.string().max(80).optional().nullable(),
  state: z.string().max(40).optional().nullable(),
  zip: z.string().max(20).optional().nullable(),
  treatmentInterest: z.string().max(200).optional().nullable(),
  symptoms: z.string().max(4000).optional().nullable(),
  concerns: z.string().max(4000).optional().nullable(),
  assessmentPayload: z.record(z.string(), z.unknown()).optional().default({}),
  preferredContact: z.string().max(40).optional().nullable(),
  bestTime: z.string().max(80).optional().nullable(),
  insurancePreference: z.string().max(120).optional().nullable(),
  telehealthPreference: z.string().max(80).optional().nullable(),
  qualificationScore: z.number().int().min(0).max(100).optional().nullable(),
  urgencyScore: z.number().int().min(0).max(100).optional().nullable(),
  campaignSource: z.string().max(120).optional().nullable(),
  sourcePage: z.string().max(200).optional().nullable(),
  notes: z.string().max(4000).optional().nullable(),
  verified: z.boolean().optional().default(true),
});

export async function GET(req: NextRequest) {
  const admin = await getSessionAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const status = req.nextUrl.searchParams.get("status");
  const supabase = getSupabaseAdmin();
  let query = supabase.from("patient_leads").select("*").order("created_at", { ascending: false }).limit(100);
  if (status) query = query.eq("status", status);
  const { data, error } = await query;
  if (error) {
    console.error("patient_leads list", error);
    return NextResponse.json({ error: "Unable to load leads." }, { status: 502 });
  }

  const leads = data ?? [];
  if (leads.length === 0) return NextResponse.json({ leads: [] });

  const leadIds = leads.map((l) => l.id);
  const { data: assignments, error: assignError } = await supabase
    .from("lead_assignments")
    .select("lead_id, clinic_id, status, delivered_at, Clinic(id, name)")
    .in("lead_id", leadIds)
    .in("status", ["pending", "delivered", "viewed", "accepted", "booked"])
    .order("delivered_at", { ascending: false });

  if (assignError) {
    console.error("lead_assignments list", assignError);
    return NextResponse.json({ leads });
  }

  const assignmentByLead = new Map<string, (typeof assignments)[number]>();
  for (const row of assignments ?? []) {
    if (!assignmentByLead.has(row.lead_id)) assignmentByLead.set(row.lead_id, row);
  }

  return NextResponse.json({
    leads: leads.map((lead) => ({
      ...lead,
      active_assignment: assignmentByLead.get(lead.id) ?? null,
    })),
  });
}

export async function POST(req: NextRequest) {
  const adminUser = await getSessionAdmin();
  if (!adminUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const parsed = createSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid lead payload.", details: parsed.error.flatten() }, { status: 400 });
  }

  const d = parsed.data;
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("patient_leads")
    .insert({
      source: d.source,
      first_name: d.firstName,
      last_name: d.lastName,
      email: d.email,
      phone: d.phone,
      city: d.city,
      state: d.state,
      zip: d.zip,
      treatment_interest: d.treatmentInterest,
      symptoms: d.symptoms,
      concerns: d.concerns,
      assessment_payload: d.assessmentPayload,
      preferred_contact: d.preferredContact,
      best_time: d.bestTime,
      insurance_preference: d.insurancePreference,
      telehealth_preference: d.telehealthPreference,
      qualification_score: d.qualificationScore,
      urgency_score: d.urgencyScore,
      campaign_source: d.campaignSource,
      source_page: d.sourcePage,
      notes: d.notes,
      status: d.verified ? "qualified" : "new",
      verified_at: d.verified ? new Date().toISOString() : null,
      verified_by: d.verified ? adminUser.id : null,
    })
    .select("*")
    .single();

  if (error || !data) {
    console.error("patient_leads create", error);
    return NextResponse.json({ error: "Unable to create lead." }, { status: 502 });
  }

  await logActivity({
    adminId: adminUser.id,
    entityType: "patient_lead",
    entityId: data.id,
    action: "patient_lead_created",
    summary: `Created patient lead ${d.firstName} ${d.lastName}`.trim(),
  }).catch(() => undefined);

  return NextResponse.json({ lead: data }, { status: 201 });
}
