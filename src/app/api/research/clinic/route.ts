import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSessionAdmin } from "@/lib/auth";
import { getClinicIntelligence, researchClinicIntelligence } from "@/lib/clinic-intelligence";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

const postSchema = z.object({
  clinicId: z.string().min(1),
  force: z.boolean().optional(),
});

export async function GET(req: NextRequest) {
  if (!(await getSessionAdmin())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const clinicId = req.nextUrl.searchParams.get("clinicId");
  if (!clinicId) return NextResponse.json({ error: "clinicId required" }, { status: 400 });
  const profile = await getClinicIntelligence(clinicId);
  return NextResponse.json({ profile });
}

export async function POST(req: NextRequest) {
  const admin = await getSessionAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const body = postSchema.parse(await req.json());
    const result = await researchClinicIntelligence(body.clinicId, {
      force: body.force,
      adminId: admin.id,
    });
    return NextResponse.json({
      research: {
        clinicId: body.clinicId,
        scraped: result.scraped,
        profile: result.profile,
      },
      profile: result.profile,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Research request failed." },
      { status: 502 },
    );
  }
}

const patchSchema = z.object({
  clinicId: z.string().min(1),
  action: z.enum([
    "approve",
    "mark_incorrect",
    "mark_not_relevant",
    "mark_duplicate",
    "mark_invalid",
    "edit",
  ]),
  edits: z
    .object({
      shortSummary: z.string().optional(),
      conversationFocus: z.string().optional(),
      personalizedOpening: z.string().optional(),
      novalyteFitReason: z.string().optional(),
      primaryCategory: z.string().optional(),
      fitStatus: z
        .enum(["strong_fit", "possible_fit", "research_required", "not_relevant", "duplicate", "invalid"])
        .optional(),
      talkTrackFrontDesk: z.string().optional(),
      lockEditedFields: z.boolean().optional(),
    })
    .optional(),
});

export async function PATCH(req: NextRequest) {
  const admin = await getSessionAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = patchSchema.parse(await req.json());
  const supabase = getSupabaseAdmin();
  const { data: existing } = await supabase
    .from("clinic_intelligence_profiles")
    .select("*")
    .eq("clinic_id", body.clinicId)
    .maybeSingle();
  if (!existing) return NextResponse.json({ error: "Intelligence profile not found" }, { status: 404 });

  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  const locked: string[] = Array.isArray(existing.locked_fields) ? [...existing.locked_fields] : [];

  if (body.action === "approve") {
    patch.research_status = "verified";
    patch.reviewed_by = admin.email || admin.id;
    patch.reviewed_at = new Date().toISOString();
    patch.last_verified_at = new Date().toISOString();
  } else if (body.action === "mark_not_relevant") {
    patch.fit_status = "not_relevant";
    patch.priority = "exclude";
    patch.research_status = "needs_review";
  } else if (body.action === "mark_duplicate") {
    patch.fit_status = "duplicate";
    patch.priority = "exclude";
  } else if (body.action === "mark_invalid") {
    patch.fit_status = "invalid";
    patch.priority = "exclude";
  } else if (body.action === "mark_incorrect") {
    patch.research_status = "stale";
    patch.warnings = Array.from(new Set([...(existing.warnings || []), "Marked incorrect by reviewer"]));
  } else if (body.action === "edit" && body.edits) {
    if (body.edits.shortSummary != null) {
      patch.short_summary = body.edits.shortSummary;
      if (body.edits.lockEditedFields !== false) locked.push("short_summary");
    }
    if (body.edits.conversationFocus != null) {
      patch.conversation_focus = body.edits.conversationFocus;
      if (body.edits.lockEditedFields !== false) locked.push("conversation_focus");
    }
    if (body.edits.personalizedOpening != null) {
      patch.personalized_opening = body.edits.personalizedOpening;
      if (body.edits.lockEditedFields !== false) locked.push("personalized_opening");
    }
    if (body.edits.novalyteFitReason != null) {
      patch.novalyte_fit_reason = body.edits.novalyteFitReason;
      if (body.edits.lockEditedFields !== false) locked.push("novalyte_fit_reason");
    }
    if (body.edits.primaryCategory != null) {
      patch.primary_category = body.edits.primaryCategory;
      if (body.edits.lockEditedFields !== false) locked.push("primary_category");
    }
    if (body.edits.fitStatus != null) patch.fit_status = body.edits.fitStatus;
    if (body.edits.talkTrackFrontDesk != null) {
      patch.talk_track = { ...(existing.talk_track || {}), frontDesk: body.edits.talkTrackFrontDesk };
      if (body.edits.lockEditedFields !== false) locked.push("talk_track");
    }
    patch.locked_fields = Array.from(new Set(locked));
    patch.reviewed_by = admin.email || admin.id;
    patch.reviewed_at = new Date().toISOString();
  }

  const { error } = await supabase.from("clinic_intelligence_profiles").update(patch).eq("id", existing.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const profile = await getClinicIntelligence(body.clinicId);
  return NextResponse.json({ profile });
}
