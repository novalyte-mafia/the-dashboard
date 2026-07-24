import { NextRequest, NextResponse } from "next/server";
import { getSessionAdmin } from "@/lib/auth";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import {
  computeReadinessStage,
  directoryUrlForMarket,
  mapDbSprint,
} from "@/lib/market-sprints";

type Ctx = { params: Promise<{ slug: string }> };

export async function GET(_req: NextRequest, ctx: Ctx) {
  const admin = await getSessionAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { slug } = await ctx.params;
  const supabase = getSupabaseAdmin();

  const { data: sprintRow, error } = await supabase
    .from("market_sprints")
    .select("*")
    .eq("slug", slug)
    .maybeSingle();

  if (error) {
    console.error("market_sprint get", error);
    return NextResponse.json({ error: "Failed to load market sprint" }, { status: 500 });
  }
  if (!sprintRow) return NextResponse.json({ error: "Market sprint not found" }, { status: 404 });

  const sprint = mapDbSprint(sprintRow as any);

  const { data: members, error: memErr } = await supabase
    .from("market_sprint_clinics")
    .select("clinic_id, cohort_status, research_status, duplicate_of_clinic_id, verification_flags")
    .eq("market_sprint_id", sprint.id);

  if (memErr) {
    console.error("market_sprint members", memErr);
    return NextResponse.json({ error: "Failed to load market members" }, { status: 500 });
  }

  const clinicIds = (members ?? []).map((m) => m.clinic_id);
  let clinicsById = new Map<string, any>();
  if (clinicIds.length) {
    const { data: clinics } = await supabase
      .from("prospect_clinics")
      .select("id, callAttempts, lastContactedAt, pipelineStage, interested, doNotCall, directoryStatus, nextActionAt")
      .in("id", clinicIds);
    clinicsById = new Map((clinics ?? []).map((c) => [c.id, c]));
  }

  const now = Date.now();
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);

  let researchComplete = 0;
  let researchNeeded = 0;
  let readyToCall = 0;
  let contacted = 0;
  let connected = 0;
  let interested = 0;
  let permissionGranted = 0;
  let profilesPrepared = 0;
  let profilesAwaitingReview = 0;
  let approved = 0;
  let published = 0;
  let followUpsDue = 0;
  let dnc = 0;
  let invalid = 0;
  let closed = 0;
  let duplicatesFlagged = 0;
  let qualified = 0;

  for (const m of members ?? []) {
    const clinic = clinicsById.get(m.clinic_id);
    const isDupSecondary = Boolean(m.duplicate_of_clinic_id);
    if (isDupSecondary) duplicatesFlagged += 1;

    if (m.research_status === "complete") researchComplete += 1;
    if (m.research_status === "research_needed" || m.research_status === "flagged") researchNeeded += 1;

    if (m.cohort_status === "do_not_call" || clinic?.doNotCall) {
      dnc += 1;
      continue;
    }
    if (m.cohort_status === "invalid") {
      invalid += 1;
      continue;
    }
    if (m.cohort_status === "closed") {
      closed += 1;
      continue;
    }

    if (!isDupSecondary) qualified += 1;

    if (
      m.cohort_status === "ready_to_call" &&
      !isDupSecondary &&
      m.research_status !== "flagged"
    ) {
      readyToCall += 1;
    }

    const attempts = Number(clinic?.callAttempts ?? 0);
    if (attempts > 0 || clinic?.lastContactedAt) contacted += 1;
    if (["connected", "decision_maker_reached"].includes(clinic?.pipelineStage ?? "")) connected += 1;
    if (m.cohort_status === "interested" || clinic?.interested) interested += 1;
    if (m.cohort_status === "permission_granted") permissionGranted += 1;
    if (m.cohort_status === "profile_review_pending") profilesAwaitingReview += 1;
    if (["approved", "published"].includes(m.cohort_status) || ["approved", "published"].includes(clinic?.directoryStatus ?? "")) {
      if (clinic?.directoryStatus === "published" || m.cohort_status === "published") published += 1;
      else approved += 1;
      profilesPrepared += 1;
    }
    if (clinic?.nextActionAt && new Date(clinic.nextActionAt).getTime() <= now) followUpsDue += 1;
  }

  const totalIdentified = members?.length ?? 0;
  const contactRate = qualified > 0 ? contacted / qualified : 0;
  const permissionRate = contacted > 0 ? permissionGranted / contacted : 0;
  const target = sprint.targetClinicCount || Math.max(qualified, 1);
  const coveragePct = Math.min(100, Math.round(((approved + published) / target) * 100));

  const readinessStage = computeReadinessStage({
    qualified,
    approved: approved + published,
    published,
    contacted,
    targetClinicCount: target,
    campaignReadinessThreshold: sprint.campaignReadinessThreshold,
    minApprovedListings: sprint.minApprovedListings,
  });

  return NextResponse.json({
    market: sprint,
    metrics: {
      totalIdentified,
      qualified,
      researchComplete,
      researchNeeded,
      readyToCall,
      contacted,
      connected,
      interested,
      permissionGranted,
      profilesPrepared,
      profilesAwaitingReview,
      approved,
      published,
      followUpsDue,
      dnc,
      invalid,
      closed,
      duplicatesFlagged,
      contactRate,
      permissionRate,
      coveragePct,
      readinessStage,
      directoryUrl: directoryUrlForMarket(sprint),
    },
  });
}
