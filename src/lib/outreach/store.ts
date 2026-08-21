import type {
  OutreachActivity,
  OutreachContactRoute,
  OutreachEvidence,
  OutreachMetaAdResult,
  OutreachMetaSearch,
  OutreachProspect,
  OutreachResearchJob,
  OutreachSavedMetaSearch,
  OutreachSavedView,
  OutreachSettings,
  OutreachSuppression,
} from "./types";
import { randomUUID } from "node:crypto";

export interface OutreachStore {
  prospects: Map<string, OutreachProspect>;
  evidence: Map<string, OutreachEvidence>;
  routes: Map<string, OutreachContactRoute>;
  activity: OutreachActivity[];
  jobs: Map<string, OutreachResearchJob>;
  savedViews: Map<string, OutreachSavedView>;
  savedMetaSearches: Map<string, OutreachSavedMetaSearch>;
  metaSearches: Map<string, OutreachMetaSearch>;
  metaResults: Map<string, OutreachMetaAdResult>;
  suppressions: Map<string, OutreachSuppression>;
  settings: OutreachSettings;
}

export function defaultSettings(): OutreachSettings {
  return {
    demoDataEnabled: false,
    liveConnectorsEnabled: true,
    defaultVertical: "mens_health",
    defaultGeography: "US",
    defaultResearchConfidence: "NEEDS_REVIEW",
    defaultOwnerId: null,
    sourceRetentionDays: 365,
    websiteRecheckDays: 30,
    requireSourceUrlForContactRoute: true,
    requireEvidenceBeforeResearchReady: true,
    onlyPublicBusinessContactRoutes: true,
    noAutomatedSending: true,
    noAutomatedFormSubmission: true,
    suppressionPolicy: "Suppressed and Do Not Contact records stay out of active views. Outreach never sends messages or submits forms.",
    lastSyncByAdapter: {
      meta_ad_library: null,
      google_ads_transparency: null,
      google_places: null,
      google_search: null,
      website_research: null,
      exa: null,
      firecrawl: null,
    },
    enabledConnectors: {
      meta_ad_library: false,
      google_ads_transparency: false,
      google_places: false,
      google_search: false,
      website_research: false,
      exa: false,
      firecrawl: false,
    },
  };
}

export function createOutreachStore(): OutreachStore {
  return {
    prospects: new Map(),
    evidence: new Map(),
    routes: new Map(),
    activity: [],
    jobs: new Map(),
    savedViews: new Map(),
    savedMetaSearches: new Map(),
    metaSearches: new Map(),
    metaResults: new Map(),
    suppressions: new Map(),
    settings: defaultSettings(),
  };
}

let singleton: OutreachStore | null = null;

export function getOutreachStore(): OutreachStore {
  singleton ??= createOutreachStore();
  return singleton;
}

export function resetOutreachStore(): OutreachStore {
  singleton = createOutreachStore();
  return singleton;
}

export function newId(prefix: string): string {
  return `${prefix}_${randomUUID()}`;
}

export function nowIso(): string {
  return new Date().toISOString();
}
