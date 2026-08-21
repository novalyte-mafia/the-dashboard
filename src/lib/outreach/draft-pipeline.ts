import { getGeminiApiKey, generateGeminiText } from "@/lib/providers/gemini";
import { scrapeWebsite } from "@/lib/providers/firecrawl";
import { isExaConfigured, searchNewsMentions } from "@/lib/providers/exa";
import { FirecrawlResearchAdapter } from "./adapters";
import { DRAFT_FRESHNESS_DAYS, type DraftContactRouteType, type DraftVerificationResult, type OutreachContactRoute, type OutreachEvidence, type OutreachProspect } from "./types";
import { addEvidence, getProspect, recordActivity, serializeProspect, updateProspect } from "./service";
import { getOutreachStore, nowIso, type OutreachStore } from "./store";
import { emptyVerification } from "./draft-fields";
import { DRAFT_SYSTEM_PROMPT, fallbackDraft } from "./draft-prompt";
import { OutreachValidationError, isHttpUrl, hasResearchIdentity } from "./validation";

const FRESHNESS_MS = DRAFT_FRESHNESS_DAYS * 24 * 60 * 60 * 1000;

export function deriveContactRouteType(routes: OutreachContactRoute[]): DraftContactRouteType {
  const live = routes.filter((row) => !row.isDoNotContact && row.channelType !== "NONE_FOUND");
  if (live.some((row) => row.channelType === "PUBLISHED_EMAIL")) return "email";
  if (live.some((row) => row.channelType === "CONTACT_FORM")) return "web_form";
  return "none";
}

function evidenceFor(store: OutreachStore, prospectId: string) {
  return [...store.evidence.values()].filter((row) => row.prospectId === prospectId);
}

function routesFor(store: OutreachStore, prospectId: string) {
  return [...store.routes.values()].filter((row) => row.prospectId === prospectId);
}

function pageCandidates(websiteUrl: string | null) {
  if (!websiteUrl || !isHttpUrl(websiteUrl)) return [];
  try {
    const origin = new URL(websiteUrl).origin;
    return [
      { url: `${origin}/`, pageType: "HOMEPAGE" as const },
      { url: `${origin}/about`, pageType: "ABOUT" as const },
      { url: `${origin}/services`, pageType: "SERVICES" as const },
      { url: `${origin}/contact`, pageType: "CONTACT" as const },
    ];
  } catch {
    return [];
  }
}

async function maybeScrape(url: string): Promise<{ ok: boolean; excerpt: string; title: string | null }> {
  if (!FirecrawlResearchAdapter.isConfigured()) {
    return { ok: false, excerpt: "", title: null };
  }
  try {
    const data = await scrapeWebsite(url) as { markdown?: string; content?: string; metadata?: { title?: string } };
    const excerpt = String(data.markdown || data.content || "").replace(/\s+/g, " ").trim().slice(0, 800);
    return { ok: Boolean(excerpt), excerpt, title: data.metadata?.title ?? null };
  } catch {
    return { ok: false, excerpt: "", title: null };
  }
}

function latestEvidenceByUrl(evidence: OutreachEvidence[]) {
  const latest = new Map<string, OutreachEvidence>();
  for (const row of evidence) {
    const prev = latest.get(row.sourceUrl);
    if (!prev || Date.parse(row.capturedAt) > Date.parse(prev.capturedAt)) latest.set(row.sourceUrl, row);
  }
  return [...latest.values()];
}

function isFixtureHost(url: string | null) {
  if (!url) return false;
  try {
    const host = new URL(url).hostname.toLowerCase();
    return host === "example.com" || host.endsWith(".example");
  } catch {
    return false;
  }
}

function shouldRefresh(existing: OutreachEvidence | undefined) {
  if (!existing) return true;
  return Date.now() - Date.parse(existing.capturedAt) > FRESHNESS_MS || existing.confidence === "NEEDS_REVIEW";
}

function advertisingInactive(row: OutreachEvidence) {
  const status = String(row.structuredData.signalStatus ?? row.structuredData.status ?? "").toUpperCase();
  return status === "NO_SIGNAL" || status === "INACTIVE" || status === "INACTIVE_OBSERVED";
}

async function gatherLiveEvidence(prospect: OutreachProspect, actorId: string, store = getOutreachStore()) {
  const added: OutreachEvidence[] = [];
  if (prospect.isDemo || !prospect.websiteUrl || isFixtureHost(prospect.websiteUrl) || process.env.VITEST) return added;
  const byUrl = new Map(latestEvidenceByUrl(evidenceFor(store, prospect.id)).map((row) => [row.sourceUrl, row]));

  for (const page of pageCandidates(prospect.websiteUrl).slice(0, 4)) {
    if (!shouldRefresh(byUrl.get(page.url))) continue;
    const scraped = await maybeScrape(page.url);
    if (!scraped.ok) continue;
    added.push(addEvidence(prospect.id, {
      evidenceType: page.pageType === "CONTACT" ? "CONTACT_PAGE" : "WEBSITE_PAGE",
      sourceType: "FIRECRAWL",
      sourceUrl: page.url,
      sourceTitle: scraped.title ?? `${prospect.clinicName} ${page.pageType.toLowerCase()}`,
      excerpt: scraped.excerpt,
      confidence: "MEDIUM",
      observedAt: nowIso(),
      structuredData: { pageType: page.pageType, fetchStatus: "ok" },
    }, actorId));
    byUrl.set(page.url, added[added.length - 1]);
  }

  const website = prospect.websiteUrl;
  if (website && isHttpUrl(website) && !byUrl.has(website) && added.length === 0) {
    added.push(addEvidence(prospect.id, {
      evidenceType: "WEBSITE_PAGE",
      sourceType: "WEBSITE",
      sourceUrl: website,
      sourceTitle: `${prospect.clinicName} public website`,
      excerpt: "Public website URL on file. Live page scrape was not available (Firecrawl not configured or fetch failed).",
      confidence: "LOW",
      observedAt: nowIso(),
      structuredData: { pageType: "HOMEPAGE", fetchStatus: "connector_unavailable" },
    }, actorId));
  }

  if (isExaConfigured()) {
    try {
      const hits = await searchNewsMentions(prospect.clinicName, [prospect.city, prospect.stateOrRegion].filter(Boolean).join(" "));
      for (const hit of hits.slice(0, 5)) {
        if (!shouldRefresh(byUrl.get(hit.url))) continue;
        added.push(addEvidence(prospect.id, {
          evidenceType: "NEWS_MENTION",
          sourceType: "EXA",
          sourceUrl: hit.url,
          sourceTitle: hit.title,
          excerpt: hit.excerpt || hit.title,
          confidence: "MEDIUM",
          observedAt: nowIso(),
          structuredData: { kind: "news_mention" },
        }, actorId));
        byUrl.set(hit.url, added[added.length - 1]);
      }
    } catch {
      // Connector failed — do not fabricate news mentions.
    }
  }
  return added;
}

async function generateCopy(prospect: OutreachProspect, evidence: OutreachEvidence[]) {
  const fallback = fallbackDraft(prospect, evidence);
  if (!getGeminiApiKey()) return { ...fallback, model: "fallback" as const };
  try {
    const packet = evidence.slice(0, 12).map((row) => ({
      id: row.id,
      type: row.evidenceType,
      source: row.sourceType,
      url: row.sourceUrl,
      excerpt: row.excerpt,
      confidence: row.confidence,
    }));
    const raw = await generateGeminiText({
      system: DRAFT_SYSTEM_PROMPT,
      user: JSON.stringify({
        clinicName: prospect.clinicName,
        city: prospect.city,
        state: prospect.stateOrRegion,
        websiteUrl: prospect.websiteUrl,
        evidence: packet,
      }),
      json: true,
      temperature: 0.4,
      maxOutputTokens: 700,
      thinkingLevel: "minimal",
    });
    const parsed = JSON.parse(raw) as {
      subject?: string;
      message?: string;
      angle?: string;
      sourcedDetail?: string;
      evidenceIds?: string[];
    };
    if (!parsed.message?.trim() || !parsed.subject?.trim()) return { ...fallback, model: "fallback" as const };
    return {
      subject: parsed.subject.trim(),
      message: parsed.message.trim(),
      angle: parsed.angle?.trim() || fallback.angle,
      sourcedDetail: parsed.sourcedDetail?.trim() || fallback.sourcedDetail,
      evidenceIds: Array.isArray(parsed.evidenceIds) && parsed.evidenceIds.length ? parsed.evidenceIds : fallback.evidenceIds,
      model: "gemini" as const,
    };
  } catch {
    return { ...fallback, model: "fallback" as const };
  }
}

export async function runDraftPass1(prospectId: string, actorId: string, store = getOutreachStore()) {
  const detail = getProspect(prospectId, store);
  if (!detail) throw new OutreachValidationError("Prospect not found.", "prospectId");
  const prospect = store.prospects.get(prospectId)!;
  if (prospect.isSuppressed || prospect.status === "SUPPRESSED") {
    throw new OutreachValidationError("Suppressed prospects cannot be drafted.", "status");
  }
  if (!hasResearchIdentity(prospect)) {
    throw new OutreachValidationError("Needs Verification: clinic name plus a website, city, or public profile is required before drafting.", "identity");
  }
  await gatherLiveEvidence(prospect, actorId, store);
  const evidence = evidenceFor(store, prospectId);
  if (!evidence.length) {
    throw new OutreachValidationError("At least one evidence record is required before drafting.", "evidence");
  }
  const copy = await generateCopy(prospect, evidence);
  const routeType = deriveContactRouteType(routesFor(store, prospectId));
  const updated = updateProspect(prospectId, {
    draftSubject: copy.subject,
    draftMessage: copy.message,
    draftGeneratedAt: nowIso(),
    draftEvidenceIds: copy.evidenceIds,
    draftStatus: "DRAFT",
    draftAngle: copy.angle,
    contactRouteType: routeType,
    lastResearchedAt: nowIso(),
    status: prospect.status === "NEW" ? "RESEARCHING" : prospect.status,
  }, actorId, store);
  recordActivity(store, prospectId, "draft_generated", `First-pass draft generated (${copy.model}). Human send only.`, {
    actorId,
    entityType: "draft",
    metadata: { model: copy.model, evidenceIds: copy.evidenceIds },
  });
  return { prospect: updated, pass: 1 as const, model: copy.model, evidenceCount: evidence.length };
}

export async function verifyDraftGate(prospectId: string, store = getOutreachStore()): Promise<DraftVerificationResult> {
  const prospect = store.prospects.get(prospectId);
  if (!prospect) throw new OutreachValidationError("Prospect not found.", "prospectId");
  const result = emptyVerification();
  result.checkedAt = nowIso();
  const routes = routesFor(store, prospectId).filter((row) => !row.isDoNotContact && row.channelType !== "NONE_FOUND");
  const email = routes.find((row) => row.channelType === "PUBLISHED_EMAIL");
  const form = routes.find((row) => row.channelType === "CONTACT_FORM");
  const skipLiveResolve = Boolean(process.env.VITEST) || prospect.isDemo || isFixtureHost(form?.value ?? prospect.websiteUrl);

  if (email) {
    const syntaxOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.value);
    if (!syntaxOk) {
      result.failures.push("Published business email has an invalid format.");
    } else if (email.verificationStatus === "BOUNCED" || email.verificationStatus === "DOMAIN_MISSING") {
      result.failures.push("Stored email route is marked bounced or domain missing.");
    } else {
      result.contactLive = true;
    }
  } else if (form && isHttpUrl(form.value)) {
    result.contactLive = skipLiveResolve ? true : await urlResolves(form.value);
    if (!result.contactLive) result.failures.push("Contact form URL did not resolve. Page may have been removed.");
  } else {
    result.failures.push("No published email or contact form to verify.");
  }

  const evidence = latestEvidenceByUrl(evidenceFor(store, prospectId));
  const now = Date.now();
  const stale = evidence.filter((row) => now - Date.parse(row.capturedAt) > FRESHNESS_MS);
  const needsReview = evidence.filter((row) => row.confidence === "NEEDS_REVIEW");
  result.evidenceFresh = stale.length === 0 && needsReview.length === 0;
  if (stale.length) result.failures.push(`Evidence older than ${DRAFT_FRESHNESS_DAYS} days must be re-checked before send.`);
  if (needsReview.length) result.failures.push("Evidence marked Needs Review must be re-verified before send.");
  if (!evidence.length) result.failures.push("No evidence on file.");
  const cited = new Set(prospect.draftEvidenceIds);
  const inactiveAds = evidenceFor(store, prospectId).filter((row) =>
    row.evidenceType === "ADVERTISING_RECORD" && advertisingInactive(row) && (cited.size === 0 || cited.has(row.id)),
  );
  if (inactiveAds.length) {
    result.failures.push("Advertising evidence cited in this draft is no longer active.");
  }
  result.ok = result.failures.length === 0 && result.contactLive;
  return result;
}

async function urlResolves(url: string) {
  try {
    const response = await fetch(url, {
      method: "GET",
      redirect: "follow",
      signal: AbortSignal.timeout(8000),
      cache: "no-store",
      headers: { "User-Agent": "Novalyte-Outreach-Verify/1.0" },
    });
    return response.ok;
  } catch {
    return false;
  }
}

export async function runDraftPass2(prospectId: string, actorId: string, store = getOutreachStore()) {
  const prospect = store.prospects.get(prospectId);
  if (!prospect) throw new OutreachValidationError("Prospect not found.", "prospectId");
  await gatherLiveEvidence(prospect, actorId, store);
  const verification = await verifyDraftGate(prospectId, store);
  if (!verification.ok) {
    updateProspect(prospectId, {
      draftStatus: "NEEDS_REVIEW",
      lastVerifiedAt: verification.checkedAt,
      verificationResult: verification,
      status: "NEEDS_REVIEW",
    }, actorId, store);
    recordActivity(store, prospectId, "draft_needs_review", `Pre-send verification failed: ${verification.failures.join(" ")}`, {
      actorId,
      entityType: "draft",
      metadata: verification as unknown as Record<string, unknown>,
    });
    return { prospect: getProspect(prospectId, store)?.prospect ?? null, verification, pass: 2 as const, ready: false };
  }
  const evidence = evidenceFor(store, prospectId);
  const copy = await generateCopy(prospect, evidence);
  updateProspect(prospectId, {
    draftSubject: copy.subject,
    draftMessage: copy.message,
    draftGeneratedAt: nowIso(),
    draftEvidenceIds: copy.evidenceIds,
    draftStatus: "VERIFIED_READY",
    draftAngle: copy.angle,
    contactRouteType: deriveContactRouteType(routesFor(store, prospectId)),
    lastVerifiedAt: verification.checkedAt,
    verificationResult: verification,
    lastResearchedAt: nowIso(),
  }, actorId, store);
  recordActivity(store, prospectId, "draft_verified", "Pre-send verification passed. Draft marked Verified — Ready to Send. Human send only.", {
    actorId,
    entityType: "draft",
  });
  return { prospect: getProspect(prospectId, store)?.prospect ?? null, verification, pass: 2 as const, ready: true };
}

export function saveDraftEdits(
  prospectId: string,
  patch: { draftSubject?: string; draftMessage?: string },
  actorId: string,
  store = getOutreachStore(),
) {
  const prospect = store.prospects.get(prospectId);
  if (!prospect) throw new OutreachValidationError("Prospect not found.", "prospectId");
  return updateProspect(prospectId, {
    draftSubject: patch.draftSubject ?? prospect.draftSubject,
    draftMessage: patch.draftMessage ?? prospect.draftMessage,
    draftStatus: prospect.draftStatus === "VERIFIED_READY" ? "DRAFT" : prospect.draftStatus,
  }, actorId, store);
}

export function logConsoleSend(prospectId: string, actorId: string, store = getOutreachStore()) {
  const prospect = store.prospects.get(prospectId);
  if (!prospect) throw new OutreachValidationError("Prospect not found.", "prospectId");
  if (prospect.contactRouteType !== "email") {
    throw new OutreachValidationError("Send from console is only available for a published business email. Use Copy message for contact forms.", "contactRouteType");
  }
  if (prospect.draftStatus !== "VERIFIED_READY") {
    throw new OutreachValidationError("Run pre-send verification before logging a console send.", "draftStatus");
  }
  const updated = updateProspect(prospectId, { draftStatus: "SENT" }, actorId, store);
  recordActivity(store, prospectId, "console_send_logged", "Operator logged a human send from console. No automated email was sent.", {
    actorId,
    entityType: "draft",
    metadata: { channel: "email", operator: actorId },
  });
  return updated;
}

export function logFormCopy(prospectId: string, actorId: string, store = getOutreachStore()) {
  const prospect = store.prospects.get(prospectId);
  if (!prospect) throw new OutreachValidationError("Prospect not found.", "prospectId");
  if (prospect.contactRouteType !== "web_form") {
    throw new OutreachValidationError("Copy message is for contact-form routes. Use Send from console when a published email exists.", "contactRouteType");
  }
  const updated = updateProspect(prospectId, { draftStatus: "COPIED" }, actorId, store);
  recordActivity(store, prospectId, "draft_copied", "Operator copied the draft to paste into a public contact form. The form was not submitted.", {
    actorId,
    entityType: "draft",
    metadata: { channel: "web_form_copy", operator: actorId },
  });
  return updated;
}

export function listDrafts(store = getOutreachStore()) {
  return [...store.prospects.values()]
    .filter((row) => !row.isSuppressed && row.status !== "ARCHIVED" && row.status !== "SUPPRESSED")
    .sort((a, b) => (b.draftGeneratedAt ?? b.updatedAt).localeCompare(a.draftGeneratedAt ?? a.updatedAt))
    .map((row) => serializeProspect(store, row));
}
