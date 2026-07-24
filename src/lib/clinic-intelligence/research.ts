import "server-only";

import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { scrapeWebsite } from "@/lib/providers/firecrawl";
import { extractClinicIntelligenceFromMarkdown } from "./extract";
import { classifyFit } from "./fit";
import {
  buildTalkTrack,
  computeResearchCompleteness,
  mergeExtractedWithClinic,
  verificationQuestionsForCategory,
} from "./talk-track";
import { mapDbProfile } from "./map";
import type { ClinicIntelligenceProfile } from "./types";

function normalizeWebsite(raw?: string | null): string | null {
  if (!raw?.trim()) return null;
  try {
    const withProto = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
    const url = new URL(withProto);
    url.search = "";
    url.hash = "";
    return url.toString();
  } catch {
    return null;
  }
}

function applyLockedFields(existing: any, next: Record<string, unknown>) {
  const locked: string[] = Array.isArray(existing?.locked_fields) ? existing.locked_fields : [];
  const out = { ...next };
  for (const field of locked) {
    if (field in existing && existing[field] != null) {
      out[field] = existing[field];
    }
  }
  // Never overwrite verified human-approved core narrative if locked or reviewed
  if (existing?.research_status === "verified" && locked.length === 0) {
    // Still allow refresh of scrape metadata, but keep approved talk tracks if present
    if (existing.conversation_focus) out.conversation_focus = existing.conversation_focus;
    if (existing.personalized_opening) out.personalized_opening = existing.personalized_opening;
    if (existing.talk_track && Object.keys(existing.talk_track || {}).length) out.talk_track = existing.talk_track;
    if (existing.short_summary) out.short_summary = existing.short_summary;
  }
  return out;
}

export async function getClinicIntelligence(clinicId: string): Promise<ClinicIntelligenceProfile | null> {
  const supabase = getSupabaseAdmin();
  const { data: profile } = await supabase
    .from("clinic_intelligence_profiles")
    .select("*")
    .eq("clinic_id", clinicId)
    .maybeSingle();
  if (!profile) return null;
  const { data: sources } = await supabase
    .from("clinic_intelligence_sources")
    .select("*")
    .eq("clinic_id", clinicId)
    .order("retrieved_at", { ascending: false });
  return mapDbProfile(profile, sources ?? []);
}

export async function researchClinicIntelligence(
  clinicId: string,
  options?: { force?: boolean; adminId?: string },
): Promise<{ profile: ClinicIntelligenceProfile; scraped: boolean }> {
  const supabase = getSupabaseAdmin();
  const { data: clinic, error } = await supabase.from("prospect_clinics").select("*").eq("id", clinicId).maybeSingle();
  if (error || !clinic) throw new Error("Clinic not found.");

  const { data: existing } = await supabase
    .from("clinic_intelligence_profiles")
    .select("*")
    .eq("clinic_id", clinicId)
    .maybeSingle();

  if (existing?.research_status === "verified" && !options?.force) {
    return { profile: (await getClinicIntelligence(clinicId))!, scraped: false };
  }

  // Upsert researching state
  const researchingRow = {
    clinic_id: clinicId,
    research_status: "researching",
    updated_at: new Date().toISOString(),
    last_error: null,
  };
  if (existing) {
    await supabase.from("clinic_intelligence_profiles").update(researchingRow).eq("id", existing.id);
  } else {
    await supabase.from("clinic_intelligence_profiles").insert({
      ...researchingRow,
      fit_status: "research_required",
      priority: "medium",
    });
  }

  const website = normalizeWebsite(clinic.website);
  if (!website) {
    const fit = classifyFit({
      clinicName: clinic.name,
      notes: clinic.notes,
      website: null,
      isDuplicateSecondary: false,
      doNotCall: clinic.doNotCall,
      operatingStatus: clinic.operatingStatus,
    });
    const talk = buildTalkTrack({ clinicName: clinic.name, city: clinic.city, state: clinic.state });
    const { completeness, missing } = computeResearchCompleteness({
      websiteUrl: null,
      shortSummary: null,
      services: [],
      city: clinic.city,
      phoneNumbers: clinic.primaryPhone ? [clinic.primaryPhone] : [],
      fitStatus: fit.fitStatus,
      conversationFocus: talk.conversationFocus,
      talkTrack: talk,
      sourcesCount: 0,
    });
    const failedRow = {
      clinic_id: clinicId,
      research_status: "failed",
      fit_status: fit.fitStatus,
      fit_score: fit.fitScore,
      priority: fit.priority,
      short_summary: `${clinic.name} does not have a confirmed official website on file. Research cannot be completed until a website is added or verified manually.`,
      city: clinic.city,
      state: clinic.state,
      postal_code: clinic.zip,
      phone_numbers: clinic.primaryPhone ? [clinic.primaryPhone] : [],
      novalyte_fit_reason: fit.reason,
      conversation_focus: talk.conversationFocus,
      personalized_opening: talk.personalizedOpening,
      relevance_statement: talk.relevanceStatement,
      talk_track: talk,
      verification_questions: verificationQuestionsForCategory(null),
      missing_information: ["Official website", ...missing],
      warnings: ["No website on file"],
      research_completeness: completeness,
      research_confidence: 0.1,
      last_researched_at: new Date().toISOString(),
      last_error: "No website to research",
      generated_by: "firecrawl+glm",
      updated_at: new Date().toISOString(),
      recommended_outcome: "Verify website and services before calling, or mark not relevant.",
      recommended_next_action: "Find official website or mark Research Required.",
    };
    const { data: saved } = await supabase
      .from("clinic_intelligence_profiles")
      .upsert(failedRow, { onConflict: "clinic_id" })
      .select("*")
      .single();
    return { profile: mapDbProfile(saved), scraped: false };
  }

  try {
    const scraped = await scrapeWebsite(website);
    const markdown = String(scraped.markdown ?? scraped.content ?? "").slice(0, 14000);
    const pageTitle = scraped.metadata?.title ?? scraped.title ?? clinic.name;

    const extracted = await extractClinicIntelligenceFromMarkdown({
      clinicName: clinic.name,
      city: clinic.city,
      state: clinic.state,
      website,
      notes: clinic.notes,
      markdown,
      pageTitle: String(pageTitle),
    });

    const fit = classifyFit({
      clinicName: clinic.name,
      notes: clinic.notes,
      website,
      extracted,
      doNotCall: clinic.doNotCall,
      operatingStatus: clinic.operatingStatus,
    });

    const merged = mergeExtractedWithClinic(clinic, extracted);
    const talk = buildTalkTrack({
      ...merged,
      conversationFocus: extracted.conversationFocus || undefined,
    });

    const phoneNumbers =
      extracted.phoneNumbers?.length ? extracted.phoneNumbers : clinic.primaryPhone ? [clinic.primaryPhone] : [];

    const speakingFacts = (extracted.notableFacts || []).filter(
      (f) => f.confidence === "high" || f.confidence === "medium",
    );

    const { completeness, missing } = computeResearchCompleteness({
      websiteUrl: website,
      shortSummary: extracted.shortSummary,
      services: extracted.services,
      city: extracted.city || clinic.city,
      phoneNumbers,
      bookingUrl: extracted.bookingUrl,
      providers: extracted.providers,
      leadership: extracted.leadership,
      likelyDecisionMakers: extracted.likelyDecisionMakers,
      fitStatus: fit.fitStatus,
      conversationFocus: talk.conversationFocus,
      talkTrack: talk,
      sourcesCount: 1,
    });

    const researchStatus =
      fit.fitStatus === "not_relevant" || fit.fitStatus === "invalid"
        ? "needs_review"
        : completeness >= 60
          ? "needs_review"
          : "needs_review";

    const nextRowRaw: Record<string, unknown> = {
      clinic_id: clinicId,
      research_status: researchStatus,
      fit_status: fit.fitStatus,
      fit_score: fit.fitScore,
      priority: fit.priority,
      short_summary: extracted.shortSummary || null,
      detailed_summary: extracted.detailedSummary || null,
      primary_category: extracted.primaryCategory || null,
      secondary_categories: extracted.secondaryCategories || [],
      services: extracted.services || [],
      audience: extracted.audience || [],
      care_delivery: extracted.careDelivery || [],
      address: extracted.address || clinic.address || null,
      city: extracted.city || clinic.city || null,
      state: extracted.state || clinic.state || null,
      postal_code: extracted.postalCode || clinic.zip || null,
      county: extracted.county || null,
      service_area: extracted.serviceArea || [],
      website_url: website,
      booking_url: extracted.bookingUrl || null,
      contact_url: extracted.contactUrl || null,
      phone_numbers: phoneNumbers,
      email_addresses: extracted.emailAddresses || [],
      providers: extracted.providers || [],
      leadership: extracted.leadership || [],
      likely_decision_makers: extracted.likelyDecisionMakers || [],
      differentiators: extracted.differentiators || [],
      notable_facts: speakingFacts,
      accreditations: extracted.accreditations || [],
      years_in_business: extracted.yearsInBusiness || null,
      novalyte_fit_reason: extracted.fitReason || fit.reason,
      recommended_directory_categories: extracted.directoryCategories || [],
      conversation_focus: talk.conversationFocus,
      personalized_opening: talk.personalizedOpening,
      relevance_statement: talk.relevanceStatement,
      verification_questions: verificationQuestionsForCategory(extracted.primaryCategory),
      objection_preparation: [],
      recommended_outcome:
        "Get permission for a free directory listing, identify the reviewer, verify public details, and set a review-before-publish follow-up.",
      recommended_next_action:
        fit.fitStatus === "not_relevant" || fit.fitStatus === "invalid"
          ? "Review fit and exclude from Ready to Call if confirmed."
          : "Call with Quo using the personalized opener; verify booking destination and reviewer.",
      talk_track: talk,
      missing_information: Array.from(new Set([...(extracted.missingInformation || []), ...missing])),
      warnings: extracted.warnings || [],
      research_completeness: completeness,
      research_confidence: extracted.confidence ?? 0.5,
      last_researched_at: new Date().toISOString(),
      last_error: null,
      generated_by: "firecrawl+glm",
      raw_scrape_excerpt: markdown.slice(0, 4000),
      updated_at: new Date().toISOString(),
    };

    const nextRow = applyLockedFields(existing, nextRowRaw);

    const { data: saved, error: saveErr } = await supabase
      .from("clinic_intelligence_profiles")
      .upsert(nextRow, { onConflict: "clinic_id" })
      .select("*")
      .single();
    if (saveErr || !saved) throw new Error(saveErr?.message || "Failed to save intelligence profile.");

    // Replace sources for this scrape (keep call/manual sources)
    await supabase
      .from("clinic_intelligence_sources")
      .delete()
      .eq("profile_id", saved.id)
      .eq("source_type", "clinic_website");

    await supabase.from("clinic_intelligence_sources").insert({
      profile_id: saved.id,
      clinic_id: clinicId,
      source_url: website,
      page_title: String(pageTitle),
      source_type: "clinic_website",
      excerpt: markdown.slice(0, 1200),
      confidence: (extracted.confidence ?? 0.5) >= 0.7 ? "high" : (extracted.confidence ?? 0.5) >= 0.4 ? "medium" : "low",
      is_official: true,
      human_reviewed: false,
    });

    // Sync market sprint research_status lightly (do not reset pipeline)
    await supabase
      .from("market_sprint_clinics")
      .update({
        research_status: completeness >= 50 ? "complete" : "research_needed",
        updated_at: new Date().toISOString(),
      })
      .eq("clinic_id", clinicId);

    // Soft-update clinic telehealth if extracted and currently false/null-ish — only if not locked
    if (extracted.careDelivery?.includes("telehealth") || extracted.careDelivery?.includes("hybrid")) {
      await supabase.from("prospect_clinics").update({ telehealth: true }).eq("id", clinicId);
    }

    const profile = await getClinicIntelligence(clinicId);
    return { profile: profile!, scraped: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Research failed";
    await supabase
      .from("clinic_intelligence_profiles")
      .upsert(
        {
          clinic_id: clinicId,
          research_status: "failed",
          fit_status: "research_required",
          priority: "low",
          last_error: message,
          last_researched_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          short_summary: `${clinic.name}: research failed. Open the website manually and verify services before calling.`,
          website_url: website,
          city: clinic.city,
          state: clinic.state,
          missing_information: ["Successful website research"],
          warnings: [message],
        },
        { onConflict: "clinic_id" },
      );
    throw err;
  }
}
