/**
 * Standalone Miami batch research (avoids Next.js server-only imports).
 * Usage: npx tsx --env-file=.env.local scripts/research-miami-batch.mts
 */
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const FIRECRAWL_KEY = process.env.FIRECRAWL_API_KEY!;
const FIRECRAWL_URL = process.env.FIRECRAWL_API_URL || "https://api.firecrawl.dev";
const GLM_KEY = process.env.GLM_API_KEY!;
const GLM_URL = process.env.GLM_API_URL || "https://open.bigmodel.cn/api/paas/v4/chat/completions";
const GLM_MODEL = process.env.GLM_MODEL || "glm-5";

const CLINIC_IDS = [
  "clinic_1beaf931-ead9-4b9e-a952-28d47a376c09",
  "clinic_d5b157e7-faae-4464-bb86-67fb3fe2b8d1",
  "clinic_c91313b7-0dd2-46ed-b9e0-39e26622500a",
  "clinic_03cd9fe6-5cb5-4b7d-8746-c161e1c4b6ad",
  "clinic_1fb9add5-f2ee-4cd7-8603-4be3d100ee0b",
  "clinic_70ed12e2-1e2f-4b50-b75d-ff94e7a88f5a",
];

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

async function scrape(url: string) {
  const res = await fetch(`${FIRECRAWL_URL}/v1/scrape`, {
    method: "POST",
    headers: { Authorization: `Bearer ${FIRECRAWL_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ url, formats: ["markdown"], onlyMainContent: true, timeout: 20000 }),
    signal: AbortSignal.timeout(35000),
  });
  const payload = await res.json();
  if (!res.ok || payload.success === false) throw new Error(`Firecrawl ${res.status}`);
  return payload.data ?? payload;
}

function heuristicExtract(clinic: any, website: string, markdown: string, title: string) {
  const text = `${title}\n${clinic.notes || ""}\n${markdown}`;
  const patterns = [
    { re: /hair\s*transplant|hair\s*restoration/i, label: "Hair restoration", category: "Hair Restoration" },
    { re: /testosterone|\btrt\b|hormone/i, label: "TRT / hormone therapy", category: "TRT / Hormone Therapy" },
    { re: /glp-?1|weight\s*loss|weight\s*management|semaglutide/i, label: "Medical weight management", category: "Weight Management" },
    { re: /longevity|anti-?aging/i, label: "Longevity / preventive care", category: "Longevity" },
    { re: /peptide/i, label: "Peptide therapy", category: "Peptides" },
  ];
  const hits = patterns.filter((p) => p.re.test(text));
  const services = hits.map((h) => h.label);
  const category = hits[0]?.category;
  const telehealth = /telehealth|telemedicine|virtual\s*consult/i.test(text);
  const fitStatus = services.length ? "strong_fit" : /clinic|medical|health/i.test(text) ? "possible_fit" : "research_required";
  return {
    shortSummary: services.length
      ? `${clinic.name} is a ${category} practice in ${clinic.city || "Miami"}, ${clinic.state || "FL"}. Public materials reference ${services.slice(0, 3).join(", ").toLowerCase()}.`
      : `${clinic.name} is listed in ${clinic.city || "Miami"}, ${clinic.state || "FL"}. Public service details are limited — verify on the call.`,
    primaryCategory: category,
    services,
    careDelivery: telehealth ? ["hybrid"] : ["in_person"],
    city: clinic.city,
    state: clinic.state,
    bookingUrl: (text.match(/https?:\/\/[^\s)]+(?:book|schedul|consult)[^\s)]*/i) || [])[0],
    differentiators: services.slice(0, 2),
    notableFacts: services.slice(0, 2).map((s) => ({ text: `${clinic.name} publicly references ${s.toLowerCase()}.`, confidence: "medium", sourceUrl: website })),
    fitStatus,
    fitReason: services.length ? `Public signals align with ${services.join(", ")}.` : "Needs verification.",
    conversationFocus: services[0]
      ? `Lead with ${clinic.name}'s focus on ${services[0].toLowerCase()} and explain that Novalyte is building concentrated Miami directory coverage for patients exploring that care.`
      : `Lead with verifying services and explain Miami directory coverage.`,
    missingInformation: ["Decision-maker", ...(services.length ? [] : ["Primary services"])],
    confidence: services.length ? 0.55 : 0.35,
  };
}

async function extract(clinic: any, website: string, markdown: string, title: string) {
  try {
    const system = `Extract factual clinic intelligence JSON for Novalyte outreach. Only use website markdown. Never invent contacts/emails. fitStatus: strong_fit|possible_fit|research_required|not_relevant|invalid. Return ONLY JSON.`;
    const user = `Clinic: ${clinic.name}\nCity/State: ${clinic.city}/${clinic.state}\nWebsite: ${website}\nNotes: ${(clinic.notes || "").slice(0, 400)}\nTitle: ${title}\n\nMarkdown:\n${markdown.slice(0, 12000)}\n\nKeys: shortSummary, primaryCategory, services[], careDelivery[], bookingUrl, differentiators[], notableFacts[{text,confidence}], fitStatus, fitReason, conversationFocus, missingInformation[], confidence`;
    const res = await fetch(GLM_URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${GLM_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: GLM_MODEL,
        temperature: 0.1,
        max_tokens: 1600,
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
      }),
      signal: AbortSignal.timeout(45000),
    });
    if (!res.ok) return heuristicExtract(clinic, website, markdown, title);
    const payload = await res.json();
    const raw = String(payload.choices?.[0]?.message?.content ?? "");
    const match = raw.match(/\{[\s\S]*\}/);
    if (!match) return heuristicExtract(clinic, website, markdown, title);
    return JSON.parse(match[0]);
  } catch {
    return heuristicExtract(clinic, website, markdown, title);
  }
}

function talkTrack(name: string, city: string, category?: string, service?: string, focus?: string) {
  const svc = service || category;
  const saw = svc
    ? `I came across ${name} while researching ${String(svc).toLowerCase()} providers in ${city || "Miami"}`
    : `I came across ${name} while researching healthcare providers in ${city || "Miami"}`;
  const frontDesk = `Hi, my name is Jamil, and I'm calling from Novalyte AI. ${saw}. We're building concentrated directory coverage for patients exploring specialized care in Miami, and I wanted to find out who handles partnerships, marketing, or your online clinic profile.`;
  const decisionMaker = `Hi, my name is Jamil, and I'm the founder of Novalyte AI. ${saw}. We would like to create a complimentary profile that directs interested patients to your existing consultation or booking process.`;
  return {
    frontDesk,
    decisionMaker,
    gatekeeper: `Hi, this is Jamil from Novalyte AI. Quick question — who handles marketing or your online clinic listing for ${name}?`,
    voicemail: `Hi, this is Jamil, founder of Novalyte AI. ${saw}. I'm calling about a free directory profile — no fee, nothing publishes without your review. Thank you.`,
    followUp: `Hi, this is Jamil from Novalyte AI following up with ${name} about the complimentary Miami directory profile.`,
    emailTransition:
      "Of course — what's the best email, and whose attention should I put it to? I'll send a short overview of the free listing.",
    relevanceStatement:
      "We are not replacing your website or scheduling system. The profile would present verified information about your services and direct interested patients to the destination your clinic approves.",
    permissionRequest:
      "There is no listing fee, contract, or obligation. Nothing would be published without your approval. Would you be open to reviewing a profile for possible inclusion?",
    personalizedOpening: frontDesk,
    conversationFocus:
      focus ||
      (svc
        ? `Lead with ${name}'s focus on ${String(svc).toLowerCase()} and explain that Novalyte is building concentrated Miami directory coverage for patients exploring that care.`
        : `Lead with verifying the clinic's public services and explain that Novalyte is building concentrated Miami directory coverage.`),
  };
}

async function researchOne(id: string) {
  const { data: clinic, error } = await supabase.from("prospect_clinics").select("*").eq("id", id).maybeSingle();
  if (error || !clinic) throw new Error("clinic missing");
  let website = clinic.website?.trim();
  if (!website) throw new Error("no website");
  if (!/^https?:\/\//i.test(website)) website = `https://${website}`;
  const url = new URL(website);
  url.search = "";
  website = url.toString();

  const scraped = await scrape(website);
  const markdown = String(scraped.markdown ?? "").slice(0, 14000);
  const title = scraped.metadata?.title ?? clinic.name;
  const extracted = await extract(clinic, website, markdown, String(title));
  const services: string[] = Array.isArray(extracted.services) ? extracted.services.map(String) : [];
  const talk = talkTrack(
    clinic.name,
    clinic.city || "Miami",
    extracted.primaryCategory,
    services[0],
    extracted.conversationFocus,
  );
  const facts = Array.isArray(extracted.notableFacts)
    ? extracted.notableFacts.filter((f: any) => f?.text && ["high", "medium"].includes(f.confidence || "medium"))
    : [];
  const fit = extracted.fitStatus || "possible_fit";
  const completeness = Math.min(
    100,
    (extracted.shortSummary ? 15 : 0) +
      (services.length ? 15 : 0) +
      (website ? 15 : 0) +
      (clinic.city ? 10 : 0) +
      (clinic.primaryPhone ? 10 : 0) +
      (extracted.bookingUrl ? 10 : 0) +
      (talk.conversationFocus ? 10 : 0) +
      (facts.length ? 10 : 0) +
      5,
  );

  const row = {
    clinic_id: id,
    research_status: "needs_review",
    fit_status: fit,
    fit_score: fit === "strong_fit" ? 85 : fit === "possible_fit" ? 55 : 30,
    priority: fit === "strong_fit" ? "high" : fit === "possible_fit" ? "medium" : "low",
    short_summary: extracted.shortSummary || null,
    primary_category: extracted.primaryCategory || null,
    services,
    care_delivery: extracted.careDelivery || [],
    city: extracted.city || clinic.city,
    state: extracted.state || clinic.state,
    website_url: website,
    booking_url: extracted.bookingUrl || null,
    phone_numbers: clinic.primaryPhone ? [clinic.primaryPhone] : [],
    differentiators: extracted.differentiators || [],
    notable_facts: facts,
    novalyte_fit_reason: extracted.fitReason || null,
    conversation_focus: talk.conversationFocus,
    personalized_opening: talk.personalizedOpening,
    relevance_statement: talk.relevanceStatement,
    talk_track: talk,
    verification_questions: [
      "What are the main services you want patients to know about?",
      "Do you offer care in person, by telehealth, or both?",
      "Which booking destination should appear in the directory?",
      "Who should review the profile before publication?",
    ],
    missing_information: extracted.missingInformation || [],
    research_completeness: completeness,
    research_confidence: extracted.confidence ?? 0.6,
    last_researched_at: new Date().toISOString(),
    generated_by: "firecrawl+glm",
    raw_scrape_excerpt: markdown.slice(0, 3500),
    updated_at: new Date().toISOString(),
    recommended_outcome:
      "Get permission for a free directory listing, identify the reviewer, verify public details, and set a review-before-publish follow-up.",
    recommended_next_action: "Call with Quo using the personalized opener.",
  };

  const { data: saved, error: saveErr } = await supabase
    .from("clinic_intelligence_profiles")
    .upsert(row, { onConflict: "clinic_id" })
    .select("*")
    .single();
  if (saveErr) throw new Error(saveErr.message);

  await supabase.from("clinic_intelligence_sources").delete().eq("profile_id", saved.id).eq("source_type", "clinic_website");
  await supabase.from("clinic_intelligence_sources").insert({
    profile_id: saved.id,
    clinic_id: id,
    source_url: website,
    page_title: String(title),
    source_type: "clinic_website",
    excerpt: markdown.slice(0, 1000),
    confidence: "medium",
    is_official: true,
  });

  return {
    id,
    name: clinic.name,
    fit: saved.fit_status,
    category: saved.primary_category,
    completeness: saved.research_completeness,
    summary: String(saved.short_summary || "").slice(0, 120),
    opening: String(saved.personalized_opening || "").slice(0, 120),
  };
}

async function main() {
  const out = [];
  for (const id of CLINIC_IDS) {
    process.stdout.write(`${id}… `);
    try {
      const r = await researchOne(id);
      out.push(r);
      console.log(`ok · ${r.fit} · ${r.completeness}%`);
    } catch (e) {
      out.push({ id, error: e instanceof Error ? e.message : String(e) });
      console.log(`FAIL ${e instanceof Error ? e.message : e}`);
    }
  }
  console.log(JSON.stringify(out, null, 2));
}

main();
