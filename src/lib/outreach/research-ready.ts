import { domainFromUrl, emailDomain } from "./validation";
import type {
  OutreachContactRoute,
  OutreachEvidence,
  OutreachProspect,
  ResearchReadyResult,
} from "./types";

const NINETY_DAYS_MS = 90 * 24 * 60 * 60 * 1000;

function isActiveContact(route: OutreachContactRoute): boolean {
  if (route.isDoNotContact) return false;
  if (route.verificationStatus === "SUPPRESSED" || route.verificationStatus === "DO_NOT_CONTACT") return false;
  if (route.channelType === "NONE_FOUND") return false;
  return true;
}

function hasCompletedNoneFound(routes: OutreachContactRoute[]): boolean {
  return routes.some((route) => route.channelType === "NONE_FOUND" && !route.isDoNotContact);
}

export function canMarkResearchReady(
  prospect: OutreachProspect,
  evidence: OutreachEvidence[],
  routes: OutreachContactRoute[],
): ResearchReadyResult {
  const missing: string[] = [];
  const warnings: string[] = [];
  const clinicName = Boolean(prospect.clinicName?.trim());
  const publicLink = Boolean(prospect.websiteUrl?.trim() || prospect.publicBusinessProfileUrl?.trim());
  const liveEvidence = evidence.filter((item) => item.sourceUrl?.trim());
  const evidenceOk = liveEvidence.length > 0;
  const contactSearch = routes.some(isActiveContact) || hasCompletedNoneFound(routes);
  const notSuppressed = !prospect.isSuppressed && prospect.status !== "SUPPRESSED";
  const notArchived = !prospect.archivedAt && prospect.status !== "ARCHIVED";

  if (!clinicName) missing.push("Clinic name is required.");
  if (!publicLink) missing.push("Website or a verified public business profile link is required.");
  if (!evidenceOk) missing.push("At least one evidence record with a source URL is required.");
  if (!contactSearch) {
    missing.push("Add a public contact route, or explicitly capture a completed No Route Found record.");
  }
  if (!notSuppressed) missing.push("Suppressed prospects cannot be marked Research Ready.");
  if (!notArchived) missing.push("Archived prospects cannot be marked Research Ready.");

  const now = Date.now();
  const adEvidence = liveEvidence.filter((item) => item.evidenceType === "ADVERTISING_RECORD");
  const siteEvidence = liveEvidence.filter((item) =>
    item.evidenceType === "WEBSITE_PAGE" || item.evidenceType === "CONTACT_PAGE",
  );
  if (adEvidence.some((item) => now - Date.parse(item.capturedAt) > NINETY_DAYS_MS)) {
    warnings.push("Advertising evidence is older than 90 days.");
  }
  if (siteEvidence.some((item) => now - Date.parse(item.capturedAt) > NINETY_DAYS_MS)) {
    warnings.push("Website evidence is older than 90 days.");
  }
  if (routes.some((route) => isActiveContact(route) && route.confidence === "LOW")) {
    warnings.push("A contact route is low confidence.");
  }
  const hasActiveAd = adEvidence.some((item) => item.structuredData?.signalStatus === "ACTIVE_OBSERVED");
  if (adEvidence.length === 0 || !hasActiveAd) {
    warnings.push("No active advertising signal.");
  }
  if (!prospect.city || !prospect.stateOrRegion) {
    warnings.push("Missing location.");
  }
  const siteDomain = domainFromUrl(prospect.websiteUrl);
  const mismatched = routes.some((route) => {
    if (route.channelType !== "PUBLISHED_EMAIL" || !isActiveContact(route)) return false;
    const mailDomain = emailDomain(route.value);
    return Boolean(siteDomain && mailDomain && siteDomain !== mailDomain);
  });
  if (mismatched) warnings.push("Domain mismatch between clinic website and published email.");

  return {
    allowed: missing.length === 0,
    missingRequirements: missing,
    warnings,
    summary: {
      clinicName,
      publicLink,
      evidence: evidenceOk,
      contactSearch,
      notSuppressed,
      notArchived,
    },
  };
}
