import { NextRequest, NextResponse } from "next/server";
import { getSessionAdmin } from "@/lib/auth";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { ALL_MARKETS_SLUG } from "@/lib/market-sprints/types";

const NATIONAL_STAGES = ["ready_to_call", "follow_up_required", "attempted", "connected"];
const MARKET_STAGES = [
  "imported",
  "needs_research",
  "research_complete",
  "ready_to_call",
  "attempted",
  "connected",
  "decision_maker_reached",
  "follow_up_required",
  "interested",
  "directory_approved",
  "meeting_booked",
];

export async function GET(req: NextRequest) {
  const admin = await getSessionAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const params = req.nextUrl.searchParams;
  const marketSlug = params.get("market") || params.get("marketSlug");
  const state = params.get("state");
  const timezone = params.get("timezone");
  const priority = params.get("priority");
  const neverContacted = params.get("neverContacted") === "true";
  const includeAllStages = params.get("includeAllStages") === "true";
  const take = Math.min(Number(params.get("limit") || 250) || 250, 500);

  const supabase = getSupabaseAdmin();

  let marketClinicIds: string[] | null = null;
  let marketMeta: Record<string, any> | null = null;
  let sprint: any = null;

  if (marketSlug && marketSlug !== ALL_MARKETS_SLUG) {
    const { data: sprintRow } = await supabase
      .from("market_sprints")
      .select("id, name, slug, timezone, status, primary_city, state_abbreviation")
      .eq("slug", marketSlug)
      .maybeSingle();

    if (!sprintRow) {
      return NextResponse.json({ error: "Market sprint not found", queue: [] }, { status: 404 });
    }
    sprint = sprintRow;

    const { data: members } = await supabase
      .from("market_sprint_clinics")
      .select(
        "clinic_id, cohort_status, research_status, duplicate_of_clinic_id, duplicate_flags, verification_flags, match_confidence, priority",
      )
      .eq("market_sprint_id", sprintRow.id);

    marketMeta = Object.fromEntries((members ?? []).map((m) => [m.clinic_id, m]));
    marketClinicIds = (members ?? []).map((m) => m.clinic_id);

    if (!marketClinicIds.length) {
      return NextResponse.json({
        queue: [],
        market: {
          slug: sprint.slug,
          name: sprint.name,
          status: sprint.status,
          timezone: sprint.timezone,
        },
      });
    }
  }

  let query = supabase
    .from("prospect_clinics")
    .select(
      "id, name, city, state, zip, timezone, primaryPhone, website, pipelineStage, priority, readinessScore, callAttempts, lastContactedAt, nextAction, nextActionAt, telehealth, notes, doNotCall, archived, interested, directoryStatus, operatingStatus",
    )
    .eq("archived", false);

  if (marketClinicIds) {
    query = query.in("id", marketClinicIds);
    // Market view keeps DNC/invalid visible for filters, but default UI excludes them.
  } else {
    query = query.eq("doNotCall", false);
    const stages = includeAllStages ? MARKET_STAGES : NATIONAL_STAGES;
    query = query.in("pipelineStage", stages);
  }

  if (state) query = query.eq("state", state);
  if (timezone) query = query.eq("timezone", timezone);
  if (priority) query = query.eq("priority", priority);
  if (neverContacted) query = query.is("lastContactedAt", null);

  query = query.order("readinessScore", { ascending: false }).limit(take);

  const { data: clinics, error } = await query;
  if (error) {
    console.error("call-queue", error);
    return NextResponse.json({ error: "Failed to load queue" }, { status: 500 });
  }

  const ids = (clinics ?? []).map((c) => c.id);
  let contactsByClinic = new Map<string, any[]>();
  let followUpsByClinic = new Map<string, any>();
  let intelByClinic = new Map<string, any>();

  if (ids.length) {
    const [{ data: contacts }, { data: followUps }, { data: intelRows }] = await Promise.all([
      supabase.from("prospect_contacts").select("*").in("clinicId", ids),
      supabase
        .from("prospect_tasks")
        .select("*")
        .in("clinicId", ids)
        .order("dueDate", { ascending: true }),
      supabase
        .from("clinic_intelligence_profiles")
        .select(
          "clinic_id, research_status, fit_status, fit_score, priority, short_summary, primary_category, services, conversation_focus, research_completeness, missing_information, notable_facts, website_url, booking_url, personalized_opening, novalyte_fit_reason, research_confidence, last_researched_at",
        )
        .in("clinic_id", ids),
    ]);
    for (const ct of contacts ?? []) {
      const list = contactsByClinic.get(ct.clinicId) ?? [];
      list.push(ct);
      contactsByClinic.set(ct.clinicId, list);
    }
    for (const fu of followUps ?? []) {
      if (!followUpsByClinic.has(fu.clinicId)) followUpsByClinic.set(fu.clinicId, fu);
    }
    for (const row of intelRows ?? []) {
      intelByClinic.set(row.clinic_id, row);
    }
  }

  const queue = (clinics ?? []).map((c: any) => {
    const contacts = contactsByClinic.get(c.id) || [];
    const dm = contacts.find((ct: any) => ct.isDecisionMaker) ?? contacts[0] ?? null;
    const member = marketMeta?.[c.id];
    const intel = intelByClinic.get(c.id);
    return {
      id: c.id,
      name: c.name,
      city: c.city,
      state: c.state,
      zip: c.zip,
      timezone: c.timezone || sprint?.timezone || "America/New_York",
      primaryPhone: c.primaryPhone,
      website: c.website,
      pipelineStage: c.pipelineStage,
      priority: c.priority,
      readinessScore: c.readinessScore,
      callAttempts: c.callAttempts,
      lastContactedAt: c.lastContactedAt,
      nextAction: c.nextAction,
      nextActionAt: c.nextActionAt,
      telehealth: c.telehealth,
      notes: c.notes,
      interested: c.interested,
      doNotCall: c.doNotCall,
      directoryStatus: c.directoryStatus,
      operatingStatus: c.operatingStatus,
      services: Array.isArray(intel?.services) ? intel.services : [],
      decisionMaker: dm
        ? {
            firstName: dm.firstName,
            lastName: dm.lastName,
            title: dm.title,
            email: dm.email,
            isDecisionMaker: dm.isDecisionMaker,
          }
        : null,
      followUp: followUpsByClinic.get(c.id) ?? null,
      market: member
        ? {
            cohortStatus: member.cohort_status,
            researchStatus: member.research_status,
            duplicateOfClinicId: member.duplicate_of_clinic_id,
            duplicateFlags: member.duplicate_flags ?? [],
            verificationFlags: member.verification_flags ?? [],
            matchConfidence: member.match_confidence,
            priority: member.priority,
          }
        : null,
      intelligence: intel
        ? {
            researchStatus: intel.research_status,
            fitStatus: intel.fit_status,
            fitScore: intel.fit_score,
            priority: intel.priority,
            shortSummary: intel.short_summary,
            primaryCategory: intel.primary_category,
            services: intel.services ?? [],
            conversationFocus: intel.conversation_focus,
            researchCompleteness: intel.research_completeness ?? 0,
            missingInformation: intel.missing_information ?? [],
            notableFacts: intel.notable_facts ?? [],
            websiteUrl: intel.website_url,
            bookingUrl: intel.booking_url,
            personalizedOpening: intel.personalized_opening,
            novalyteFitReason: intel.novalyte_fit_reason,
            researchConfidence: intel.research_confidence,
            lastResearchedAt: intel.last_researched_at,
          }
        : null,
    };
  });

  // Prefer researched strong fits, then non-duplicates, then readiness
  queue.sort((a, b) => {
    const aDup = a.market?.duplicateOfClinicId || a.intelligence?.fitStatus === "duplicate" ? 1 : 0;
    const bDup = b.market?.duplicateOfClinicId || b.intelligence?.fitStatus === "duplicate" ? 1 : 0;
    if (aDup !== bDup) return aDup - bDup;
    const fitRank = (f?: string | null) =>
      f === "strong_fit" ? 0 : f === "possible_fit" ? 1 : f === "research_required" ? 2 : 3;
    const fr = fitRank(a.intelligence?.fitStatus) - fitRank(b.intelligence?.fitStatus);
    if (fr !== 0) return fr;
    return Number(b.readinessScore ?? 0) - Number(a.readinessScore ?? 0);
  });

  return NextResponse.json({
    queue,
    market: sprint
      ? {
          slug: sprint.slug,
          name: sprint.name,
          status: sprint.status,
          timezone: sprint.timezone,
          primaryCity: sprint.primary_city,
          stateAbbreviation: sprint.state_abbreviation,
        }
      : marketSlug === ALL_MARKETS_SLUG
        ? { slug: ALL_MARKETS_SLUG, name: "All Markets", status: "national", timezone: null }
        : null,
  });
}
