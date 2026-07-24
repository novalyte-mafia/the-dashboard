import { NextRequest, NextResponse } from "next/server";
import { getSessionAdmin } from "@/lib/auth";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import {
  clinicMatchesMarket,
  deriveCohortStatus,
  deriveResearchStatus,
  mapDbSprint,
  normalizePhoneDigits,
} from "@/lib/market-sprints";

type Ctx = { params: Promise<{ slug: string }> };

/**
 * Re-scan prospect_clinics and upsert market associations without resetting
 * call outcomes, DNC, or pipeline stages on the clinic itself.
 */
export async function POST(_req: NextRequest, ctx: Ctx) {
  const admin = await getSessionAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { slug } = await ctx.params;
  const supabase = getSupabaseAdmin();

  const { data: sprintRow, error } = await supabase
    .from("market_sprints")
    .select("*")
    .eq("slug", slug)
    .maybeSingle();

  if (error || !sprintRow) {
    return NextResponse.json({ error: "Market sprint not found" }, { status: 404 });
  }

  const sprint = mapDbSprint(sprintRow as any);

  const { data: clinics, error: clinicErr } = await supabase
    .from("prospect_clinics")
    .select(
      "id, city, state, zip, primaryPhone, website, doNotCall, operatingStatus, pipelineStage, directoryStatus, interested, readinessScore, archived",
    )
    .eq("archived", false);

  if (clinicErr) {
    return NextResponse.json({ error: "Failed to load clinics" }, { status: 500 });
  }

  const matched = (clinics ?? [])
    .map((c) => {
      const result = clinicMatchesMarket(c, sprint);
      if (!result.match) return null;
      return { clinic: c, ...result };
    })
    .filter(Boolean) as Array<{
    clinic: any;
    confidence: "city" | "zip";
    reason: string;
  }>;

  // Phone-level duplicate detection within cohort
  const byPhone = new Map<string, any[]>();
  for (const row of matched) {
    const phone = normalizePhoneDigits(row.clinic.primaryPhone);
    if (phone.length < 10) continue;
    const list = byPhone.get(phone) ?? [];
    list.push(row.clinic);
    byPhone.set(phone, list);
  }
  const keepByPhone = new Map<string, string>();
  for (const [phone, list] of byPhone) {
    if (list.length < 2) continue;
    const sorted = [...list].sort(
      (a, b) => Number(b.readinessScore ?? 0) - Number(a.readinessScore ?? 0),
    );
    keepByPhone.set(phone, sorted[0].id);
  }

  const rows = matched.map(({ clinic, confidence, reason }) => {
    const phone = normalizePhoneDigits(clinic.primaryPhone);
    const keepId = keepByPhone.get(phone);
    const isDupSecondary = Boolean(keepId && keepId !== clinic.id);
    const verificationFlags: string[] = [];
    if (!phone || phone.length < 10) verificationFlags.push("invalid_or_missing_phone");
    if (!clinic.website) verificationFlags.push("missing_website");

    let cohortStatus = deriveCohortStatus(clinic);
    let researchStatus = deriveResearchStatus(clinic);
    if (isDupSecondary) {
      researchStatus = "flagged";
      if (
        !["do_not_call", "invalid", "closed", "published", "approved", "interested", "permission_granted", "not_interested"].includes(
          cohortStatus,
        )
      ) {
        cohortStatus = "research_needed";
      }
    }

    return {
      market_sprint_id: sprint.id,
      clinic_id: clinic.id,
      cohort_status: cohortStatus,
      research_status: researchStatus,
      match_reason: reason,
      match_confidence: confidence,
      duplicate_of_clinic_id: isDupSecondary ? keepId : null,
      duplicate_flags: isDupSecondary
        ? ["duplicate_phone"]
        : keepId === clinic.id
          ? ["duplicate_phone_primary"]
          : [],
      verification_flags: verificationFlags,
      priority: Number(clinic.readinessScore ?? 0),
      updated_at: new Date().toISOString(),
    };
  });

  // Upsert in chunks
  let upserted = 0;
  for (let i = 0; i < rows.length; i += 200) {
    const chunk = rows.slice(i, i + 200);
    const { error: upErr } = await supabase.from("market_sprint_clinics").upsert(chunk, {
      onConflict: "market_sprint_id,clinic_id",
    });
    if (upErr) {
      console.error("market sync upsert", upErr);
      return NextResponse.json({ error: "Failed to sync market clinics", details: upErr.message }, { status: 500 });
    }
    upserted += chunk.length;
  }

  return NextResponse.json({
    ok: true,
    slug: sprint.slug,
    matched: matched.length,
    upserted,
    duplicateGroups: keepByPhone.size,
  });
}
