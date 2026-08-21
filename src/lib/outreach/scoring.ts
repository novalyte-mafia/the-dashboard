import type { AdSignalStatus, OutreachProspectRow } from "./types";

export function researchCompleteness(input: {
  websiteStatus: "found" | "missing" | "needs_review";
  contactRoute: OutreachProspectRow["contactRoute"];
  adSignal: AdSignalStatus;
  evidenceCount: number;
  contactSearchCompleted: boolean;
  verticalSet: boolean;
}): { score: number; missing: string[] } {
  const missing: string[] = [];
  let points = 0;
  if (input.websiteStatus === "found") points += 25;
  else missing.push("Website missing");
  if (input.contactRoute !== "none") points += 25;
  else missing.push("Public contact route missing");
  if (input.adSignal !== "NO_SIGNAL") points += 15;
  else missing.push("Meta Ads Library check not run");
  if (input.evidenceCount > 0) points += 15;
  else missing.push("No research evidence");
  if (input.contactSearchCompleted) points += 10;
  else missing.push("Contact search not completed");
  if (input.verticalSet) points += 10;
  else missing.push("Vertical not classified");
  return { score: Math.min(100, points), missing };
}

export function leadScore(input: {
  completeness: number;
  adSignal: AdSignalStatus;
  contactRoute: OutreachProspectRow["contactRoute"];
  status: OutreachProspectRow["status"];
}): number {
  let score = input.completeness;
  if (input.adSignal === "ACTIVE_OBSERVED") score += 12;
  if (input.contactRoute === "email" || input.contactRoute === "multiple") score += 8;
  if (input.status === "RESEARCH_READY") score += 5;
  if (input.status === "SUPPRESSED" || input.status === "ARCHIVED") score = 0;
  return Math.max(0, Math.min(100, score));
}

export function nextBestAction(input: {
  missing: string[];
  adSignal: AdSignalStatus;
  contactRoute: OutreachProspectRow["contactRoute"];
  status: OutreachProspectRow["status"];
  draftStatus: OutreachProspectRow["draftStatus"];
}): { key: string; label: string; reason: string } {
  if (input.status === "SUPPRESSED" || input.status === "ARCHIVED") {
    return { key: "none", label: "No action", reason: "This prospect is archived or suppressed." };
  }
  if (input.missing.includes("Website missing")) {
    return { key: "verify_website", label: "Verify website", reason: "A public website is required before research and outreach." };
  }
  if (input.missing.includes("Meta Ads Library check not run")) {
    return { key: "meta_ads", label: "Search Meta Ads Library", reason: "No advertising evidence is attached yet." };
  }
  if (input.contactRoute === "none") {
    return { key: "contact_routes", label: "Find public contact routes", reason: "No published email or contact form is on file." };
  }
  if (input.status === "NEEDS_REVIEW" || input.missing.includes("No research evidence")) {
    return { key: "research", label: "Run website research", reason: "Evidence is incomplete and needs a human-reviewed research pass." };
  }
  if (!input.draftStatus) {
    return { key: "draft", label: "Generate draft", reason: "Research is present; prepare a first-email draft for human send." };
  }
  if (input.draftStatus === "DRAFT" || input.draftStatus === "NEEDS_REVIEW") {
    return { key: "verify_draft", label: "Verify draft", reason: "Run Pass 2 to re-check the contact route and evidence freshness." };
  }
  if (input.draftStatus === "VERIFIED_READY") {
    return { key: "outreach", label: "Review outreach handoff", reason: "Draft is verified. Sending stays a manual human action." };
  }
  return { key: "review", label: "Open prospect", reason: "Review the clinic workspace and choose the next research step." };
}
