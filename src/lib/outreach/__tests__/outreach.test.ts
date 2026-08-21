import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { beforeEach, describe, expect, it } from "vitest";
import { NAV_GROUPS } from "@/components/admin/shell/sidebar";
import { MetaAdLibraryAdapter, FirecrawlResearchAdapter } from "@/lib/outreach/adapters";
import { contactFormAction, CONTACT_FORM_POLICY } from "@/lib/outreach/compliance";
import { externalLinkProps, EXTERNAL_LINK_REL, EXTERNAL_LINK_TARGET } from "@/lib/outreach/links";
import { canMarkResearchReady } from "@/lib/outreach/research-ready";
import { resolveOutreachSubview, OUTREACH_DEFAULT_SUBVIEW } from "@/lib/outreach/routing";
import { addContactRoute, addEvidence, archiveProspect, createProspect, getProspect, listContacts, listProspects, markResearchReady, startResearch, suppressProspect } from "@/lib/outreach/service";
import { commandCenter, runMetaSearch } from "@/lib/outreach/workspace";
import { buildOfficialMetaAdsLibraryUrl, EMPTY_META_QUERY } from "@/lib/outreach/meta-ads";
import { logConsoleSend, logFormCopy, runDraftPass1, runDraftPass2 } from "@/lib/outreach/draft-pipeline";
import { resetOutreachStore } from "@/lib/outreach/store";
import { OutreachValidationError, validateContactRouteWrite, validateEvidenceWrite, validateProspectWrite } from "@/lib/outreach/validation";

beforeEach(() => {
  resetOutreachStore();
});

describe("Outreach navigation", () => {
  it("places Outreach immediately below Founder-Led Calls and above C-Cold Trainer", () => {
    const command = NAV_GROUPS.find((group) => group.id === "command");
    expect(command).toBeTruthy();
    const ids = command!.items.map((item) => item.id);
    expect(ids.indexOf("outreach")).toBe(ids.indexOf("calls") + 1);
    expect(ids.indexOf("cold-trainer")).toBe(ids.indexOf("outreach") + 1);
    expect(command!.items[ids.indexOf("outreach")].label).toBe("Outreach");
  });
});

describe("Outreach routing", () => {
  it("defaults /outreach to Overview", () => {
    expect(OUTREACH_DEFAULT_SUBVIEW).toBe("overview");
    expect(resolveOutreachSubview(null)).toBe("overview");
    expect(resolveOutreachSubview(undefined)).toBe("overview");
    expect(resolveOutreachSubview("not-a-view")).toBe("overview");
    expect(resolveOutreachSubview("research-queue")).toBe("research-queue");
    expect(resolveOutreachSubview("meta-ads")).toBe("meta-ads");
    expect(resolveOutreachSubview("jobs")).toBe("jobs");
    expect(resolveOutreachSubview("drafts")).toBe("drafts");
  });
});

describe("Prospect CRUD validation", () => {
  it("requires a clinic name and rejects placeholder websites", () => {
    expect(() => validateProspectWrite({ clinicName: "  " })).toThrow(OutreachValidationError);
    expect(() => validateProspectWrite({ clinicName: "Summit", websiteUrl: "not-a-url" })).toThrow(/Website URL/);
    expect(() => validateProspectWrite({ clinicName: "Summit", websiteUrl: "https://summitmenshealth.example" })).toThrow(/Placeholder/);
    const row = createProspect({ clinicName: "Peak Clinic", websiteUrl: "https://peakclinic.com" }, "tester");
    expect(row.clinicName).toBe("Peak Clinic");
    expect(row.canonicalDomain).toBe("peakclinic.com");
    expect(row.isDemo).toBe(false);
  });

  it("labels incomplete records Needs Verification instead of substituting sample data", () => {
    const row = createProspect({ clinicName: "Incomplete Clinic" }, "tester");
    expect(row.status).toBe("NEEDS_REVIEW");
    expect(listProspects().every((item) => item.clinicName !== "Summit Men’s Health")).toBe(true);
  });
});

describe("Evidence and contact-route source URLs", () => {
  it("requires a source URL on evidence", () => {
    expect(() => validateEvidenceWrite({ evidenceType: "ADVERTISING_RECORD", sourceUrl: "" }, true)).toThrow(/source URL/);
    const created = createProspect({ clinicName: "Evidence Clinic", websiteUrl: "https://evidenceclinic.com" }, "tester");
    const evidence = addEvidence(created.id, {
      evidenceType: "ADVERTISING_RECORD",
      sourceType: "MANUAL",
      sourceUrl: "https://www.facebook.com/ads/library/?id=evidence-clinic",
    }, "tester");
    expect(evidence.sourceUrl).toContain("https://");
  });

  it("requires a source URL on contact routes unless the record is an explicit manual operator record", () => {
    expect(() =>
      validateContactRouteWrite({ channelType: "PUBLISHED_EMAIL", value: "info@clinicmail.com" }, true),
    ).toThrow(/source URL/);
    expect(() =>
      validateContactRouteWrite({
        channelType: "PUBLISHED_EMAIL",
        value: "info@clinicmail.com",
        isManualRecord: true,
      }, true),
    ).not.toThrow();
  });
});

describe("Research Ready validation", () => {
  it("does not allow suppressed or archived prospects", () => {
    const suppressed = createProspect({ clinicName: "Suppressed Clinic", websiteUrl: "https://suppressedclinic.com" }, "tester");
    const archived = createProspect({ clinicName: "Archived Clinic", websiteUrl: "https://archivedclinic.com" }, "tester");
    suppressProspect(suppressed.id, "Operator suppressed", "tester");
    archiveProspect(archived.id, "tester");
    const suppressedRow = getProspect(suppressed.id)!;
    const archivedRow = getProspect(archived.id)!;
    expect(canMarkResearchReady(suppressedRow.prospect, suppressedRow.evidence, suppressedRow.contactRoutes).allowed).toBe(false);
    expect(canMarkResearchReady(archivedRow.prospect, archivedRow.evidence, archivedRow.contactRoutes).allowed).toBe(false);
    expect(markResearchReady(suppressed.id, "tester")).toMatchObject({ error: "not_ready" });
    expect(markResearchReady(archived.id, "tester")).toMatchObject({ error: "not_ready" });
  });

  it("returns missing requirements clearly and treats NONE_FOUND as completed contact-search only when captured", () => {
    const created = createProspect({
      clinicName: "Ready Check",
      websiteUrl: "https://readycheckhealth.com",
    }, "tester");
    const before = getProspect(created.id)!;
    expect(before.researchReady.allowed).toBe(false);
    expect(before.researchReady.missingRequirements.length).toBeGreaterThan(0);

    addEvidence(created.id, {
      evidenceType: "WEBSITE_PAGE",
      sourceType: "MANUAL",
      sourceUrl: "https://readycheckhealth.com/contact",
    }, "tester");
    const mid = getProspect(created.id)!;
    expect(mid.researchReady.allowed).toBe(false);
    expect(mid.researchReady.missingRequirements.some((item) => /contact route|No Route Found/i.test(item))).toBe(true);

    addContactRoute(created.id, {
      channelType: "NONE_FOUND",
      value: "No public business contact route found",
      sourceUrl: "https://readycheckhealth.com/contact",
    }, "tester");
    const after = getProspect(created.id)!;
    expect(after.researchReady.allowed).toBe(true);
    expect(after.prospect.contactSearchCompleted).toBe(true);
  });
});

describe("Default views exclude suppressed records", () => {
  it("starts empty and omits suppressed prospects from the default active list", () => {
    expect(listProspects()).toEqual([]);
    const live = createProspect({ clinicName: "Live Clinic", websiteUrl: "https://liveclinic.com" }, "tester");
    const hidden = createProspect({ clinicName: "Hidden Clinic", websiteUrl: "https://hiddenclinic.com" }, "tester");
    suppressProspect(hidden.id, "DNC", "tester");
    const rows = listProspects();
    expect(rows.some((row) => row.id === live.id)).toBe(true);
    expect(rows.some((row) => row.id === hidden.id)).toBe(false);
    const withSuppressed = listProspects({ includeSuppressed: true, statusGroup: "all" });
    expect(withSuppressed.some((row) => row.status === "SUPPRESSED")).toBe(true);
  });

  it("omits suppressed contact routes from the default contacts list", () => {
    const contacts = listContacts();
    expect(contacts.every((row) => !row.isDoNotContact)).toBe(true);
  });
});

describe("Activity logging", () => {
  it("creates an activity record for entity writes", () => {
    const created = createProspect({ clinicName: "Activity Clinic", websiteUrl: "https://activityclinic.com" }, "tester");
    addEvidence(created.id, {
      evidenceType: "OPERATOR_NOTE",
      sourceType: "MANUAL",
      sourceUrl: "https://activityclinic.com",
      excerpt: "Operator captured a public homepage.",
    }, "tester");
    addContactRoute(created.id, {
      channelType: "PUBLISHED_EMAIL",
      value: "info@activityclinic.com",
      sourceUrl: "https://activityclinic.com/contact",
    }, "tester");
    const detail = getProspect(created.id)!;
    const types = detail.activity.map((row) => row.eventType);
    expect(types).toContain("prospect_created");
    expect(types).toContain("evidence_added");
    expect(types).toContain("contact_route_added");
  });
});

describe("Adapters never fabricate live data", () => {
  it("returns NOT_CONFIGURED from unconfigured adapters and never fabricates live data", async () => {
    const result = await MetaAdLibraryAdapter.searchProspects("clinic", {});
    expect(result.status).toBe("NOT_CONFIGURED");
    if (result.status === "NOT_CONFIGURED") expect(result.adapterName).toBe("meta_ad_library");
    const firecrawl = await FirecrawlResearchAdapter.fetchPublicPage("https://novalyte.io");
    expect(firecrawl.status === "NOT_CONFIGURED" || firecrawl.status === "error").toBe(true);
  });

  it("records a not-configured research job instead of fake live results", () => {
    const created = createProspect({ clinicName: "Research Clinic", websiteUrl: "https://researchclinic.com" }, "tester");
    const job = startResearch(created.id, "exa", "tester", "idem-1");
    expect(job.status).toBe("NOT_CONFIGURED");
    expect(job.errorMessage).toMatch(/not configured/i);
    const again = startResearch(created.id, "exa", "tester", "idem-1");
    expect(again.id).toBe(job.id);
  });
});

describe("Meta Ads Library search honesty", () => {
  it("builds an official Ads Library URL from query fields", () => {
    const url = buildOfficialMetaAdsLibraryUrl({
      ...EMPTY_META_QUERY,
      keyword: "TRT clinic",
      state: "CA",
      country: "US",
      activeStatus: "active",
    });
    expect(url).toContain("https://www.facebook.com/ads/library/");
    expect(url).toContain("q=TRT");
    expect(url).toContain("country=US");
  });

  it("records a link-out search with zero fabricated ads when the API is not configured", async () => {
    const result = await runMetaSearch({
      query: { ...EMPTY_META_QUERY, keyword: "TRT clinic", country: "US" },
      name: "TRT Clinics — California",
      actorId: "tester",
    });
    expect(result.results).toEqual([]);
    expect(result.search.adsFound).toBe(0);
    expect(result.search.trustMode === "OFFICIAL_LINK_OUT" || result.search.trustMode === "NOT_CONFIGURED").toBe(true);
    expect(result.officialUrl).toContain("facebook.com/ads/library");
    expect(result.job.logs.length).toBeGreaterThan(0);
    expect(result.job.logs.some((log) => /not be fabricated|link-out|no meta api/i.test(log.message))).toBe(true);
  });

  it("exposes command-center action cards without invented counts", () => {
    const data = commandCenter();
    expect(data.metrics.prospectsDiscovered).toBe(0);
    expect(data.actionRequired.every((row) => row.count === 0)).toBe(true);
    expect(data.activity).toEqual([]);
  });
});

describe("External links and contact-form policy", () => {
  it("opens external website and source links with noopener and noreferrer", () => {
    const props = externalLinkProps("https://novalyte.io");
    expect(props.target).toBe(EXTERNAL_LINK_TARGET);
    expect(props.rel).toBe(EXTERNAL_LINK_REL);
    expect(props.rel).toContain("noopener");
    expect(props.rel).toContain("noreferrer");
  });

  it("exposes Open Contact Form only and never submit behavior", () => {
    expect(contactFormAction("CONTACT_FORM")).toEqual({ label: "Open Contact Form", submit: false });
    expect(contactFormAction("PUBLISHED_EMAIL")).toBeNull();
    expect(CONTACT_FORM_POLICY.submitEnabled).toBe(false);
    expect(CONTACT_FORM_POLICY.sendEnabled).toBe(false);
    expect(CONTACT_FORM_POLICY.automateFormsEnabled).toBe(false);
  });
});

describe("Outreach phase-1 compliance", () => {
  it("does not introduce Resend, sending routes, or form-submit automation in Outreach code", () => {
    const root = join(process.cwd(), "src");
    const files = collectFiles(join(root, "lib", "outreach"))
      .concat(collectFiles(join(root, "components", "admin", "views", "outreach")))
      .concat(join(root, "app", "api", "outreach", "[...path]", "route.ts"))
      .filter((file) => !file.includes("__tests__") && !file.endsWith("compliance.ts"));
    const haystack = files.map((file) => readFileSync(file, "utf8")).join("\n").toLowerCase();
    expect(haystack).not.toMatch(/from ["']resend["']/);
    expect(haystack).not.toMatch(/resend_api_key/);
    expect(haystack).not.toMatch(/sendemail\(/);
    expect(haystack).not.toMatch(/submitcontactform|submit_form|formsubmit/);
    expect(haystack).toContain("noopener noreferrer");
  });
});

describe("Research-driven draft pipeline", () => {
  it("requires evidence before Pass 1", async () => {
    const created = createProspect({ clinicName: "No Evidence Clinic", websiteUrl: "https://noevidenceclinic.com" }, "tester");
    await expect(runDraftPass1(created.id, "tester")).rejects.toThrow(/evidence/i);
  });

  it("writes a clinic-specific first draft linked to sourced evidence", async () => {
    const a = createProspect({ clinicName: "Austin Peak Clinic", city: "Austin", websiteUrl: "https://austinpeak.com" }, "tester");
    const b = createProspect({ clinicName: "Dallas River Clinic", city: "Dallas", websiteUrl: "https://dallasriver.com" }, "tester");
    addEvidence(a.id, {
      evidenceType: "ADVERTISING_RECORD",
      sourceType: "META_AD_LIBRARY",
      sourceUrl: "https://facebook.com/ads/library/?id=austin-peak",
      excerpt: "Meta ad promoting testosterone consults in Austin",
      confidence: "HIGH",
    }, "tester");
    addEvidence(b.id, {
      evidenceType: "NEWS_MENTION",
      sourceType: "GOOGLE_SEARCH",
      sourceUrl: "https://news.com/dallas-river-opens",
      excerpt: "Dallas River Clinic opened a second location in Uptown",
      confidence: "HIGH",
    }, "tester");
    const first = await runDraftPass1(a.id, "tester");
    const second = await runDraftPass1(b.id, "tester");
    expect(first.prospect.draftStatus).toBe("DRAFT");
    expect(first.prospect.draftMessage).toMatch(/Hello there,/);
    expect(first.prospect.draftMessage).toMatch(/founder of Novalyte AI/);
    expect(first.prospect.draftMessage).toMatch(/no cost/);
    expect(first.prospect.draftMessage).toMatch(/Would you be open to having Austin Peak Clinic included/);
    expect(first.prospect.draftMessage).toMatch(/testosterone consults in Austin/);
    expect(first.prospect.draftMessage).not.toMatch(/Haley/);
    expect(first.prospect.draftEvidenceIds.length).toBeGreaterThan(0);
    expect(second.prospect.draftMessage).toMatch(/Dallas River Clinic/);
    expect(second.prospect.draftMessage).toMatch(/second location in Uptown/);
    expect(first.prospect.draftMessage).not.toBe(second.prospect.draftMessage);
    const types = getProspect(a.id)!.activity.map((row) => row.eventType);
    expect(types).toContain("draft_generated");
  });

  it("flags Needs Review when the contact route is dead and does not log a send", async () => {
    const created = createProspect({ clinicName: "Bounced Clinic", websiteUrl: "https://bounced.com" }, "tester");
    addEvidence(created.id, {
      evidenceType: "WEBSITE_PAGE",
      sourceType: "WEBSITE",
      sourceUrl: "https://bounced.com",
      excerpt: "Homepage for Bounced Clinic",
      confidence: "HIGH",
    }, "tester");
    addContactRoute(created.id, {
      channelType: "PUBLISHED_EMAIL",
      value: "info@bounced.com",
      sourceUrl: "https://bounced.com/contact",
      verificationStatus: "BOUNCED",
    }, "tester");
    await runDraftPass1(created.id, "tester");
    const gated = await runDraftPass2(created.id, "tester");
    expect(gated.ready).toBe(false);
    expect(gated.prospect?.draftStatus).toBe("NEEDS_REVIEW");
    expect(() => logConsoleSend(created.id, "tester")).toThrow(/verification/i);
    expect(getProspect(created.id)!.activity.map((row) => row.eventType)).toContain("draft_needs_review");
  });

  it("logs console send only for verified email routes and copy only for web forms", async () => {
    const emailClinic = createProspect({ clinicName: "Email Route Clinic", city: "Austin", websiteUrl: "https://emailroute.com" }, "tester");
    addEvidence(emailClinic.id, {
      evidenceType: "WEBSITE_PAGE",
      sourceType: "WEBSITE",
      sourceUrl: "https://emailroute.com",
      excerpt: "Men’s clinic homepage in Austin",
      confidence: "HIGH",
    }, "tester");
    addContactRoute(emailClinic.id, {
      channelType: "PUBLISHED_EMAIL",
      value: "hello@emailroute.com",
      sourceUrl: "https://emailroute.com/contact",
      verificationStatus: "SYNTAX_VALID",
    }, "tester");
    await runDraftPass1(emailClinic.id, "tester");
    const verified = await runDraftPass2(emailClinic.id, "tester");
    expect(verified.ready).toBe(true);
    expect(verified.prospect?.draftStatus).toBe("VERIFIED_READY");
    expect(verified.prospect?.contactRouteType).toBe("email");
    expect(() => logFormCopy(emailClinic.id, "tester")).toThrow(/contact-form/i);
    const sent = logConsoleSend(emailClinic.id, "tester");
    expect(sent?.draftStatus).toBe("SENT");
    expect(getProspect(emailClinic.id)!.activity.map((row) => row.eventType)).toContain("console_send_logged");

    const formClinic = createProspect({ clinicName: "Form Route Clinic", city: "Houston", websiteUrl: "https://formroute.com" }, "tester");
    addEvidence(formClinic.id, {
      evidenceType: "WEBSITE_PAGE",
      sourceType: "WEBSITE",
      sourceUrl: "https://formroute.com",
      excerpt: "Wellness consults listed on the Houston homepage",
      confidence: "HIGH",
    }, "tester");
    addContactRoute(formClinic.id, {
      channelType: "CONTACT_FORM",
      value: "https://formroute.com/contact",
      sourceUrl: "https://formroute.com/contact",
    }, "tester");
    await runDraftPass1(formClinic.id, "tester");
    const copied = logFormCopy(formClinic.id, "tester");
    expect(copied?.draftStatus).toBe("COPIED");
    expect(() => logConsoleSend(formClinic.id, "tester")).toThrow(/published business email/i);
    expect(getProspect(formClinic.id)!.activity.map((row) => row.eventType)).toContain("draft_copied");
  });

  it("does not fabricate news mentions when live search is skipped", async () => {
    const created = createProspect({ clinicName: "Silent Search Clinic", websiteUrl: "https://silentsearch.com" }, "tester");
    addEvidence(created.id, {
      evidenceType: "WEBSITE_PAGE",
      sourceType: "WEBSITE",
      sourceUrl: "https://silentsearch.com",
      excerpt: "Peptide and wellness services listed on the homepage",
      confidence: "HIGH",
    }, "tester");
    await runDraftPass1(created.id, "tester");
    const detail = getProspect(created.id)!;
    expect(detail.evidence.every((row) => row.evidenceType !== "NEWS_MENTION")).toBe(true);
    expect(detail.prospect.draftMessage).toMatch(/Hello there,/);
  });
});

function collectFiles(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) out.push(...collectFiles(path));
    else if (/\.(ts|tsx)$/.test(name)) out.push(path);
  }
  return out;
}
