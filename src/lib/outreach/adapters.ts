import type { AdapterResult } from "./types";

export interface AdvertisingResearchAdapter {
  name: string;
  searchProspects(query: string, filters: Record<string, unknown>): Promise<AdapterResult<unknown[]>>;
  getAdvertiserEvidence(sourceUrl: string): Promise<AdapterResult<unknown>>;
  normalizeAdvertisingEvidence(rawData: unknown): Record<string, unknown>;
  isConfigured(): boolean;
}

export interface WebsiteResearchAdapter {
  name: string;
  discoverPages(websiteUrl: string): Promise<AdapterResult<unknown[]>>;
  fetchPublicPage(pageUrl: string): Promise<AdapterResult<unknown>>;
  extractPublicContactRoutes(pageData: unknown): Promise<AdapterResult<unknown[]>>;
  normalizeEvidence(pageData: unknown): Record<string, unknown>;
  isConfigured(): boolean;
}

export interface BusinessProfileResearchAdapter {
  name: string;
  searchBusiness(query: string, location: string): Promise<AdapterResult<unknown[]>>;
  getBusinessProfile(profileUrl: string): Promise<AdapterResult<unknown>>;
  normalizeBusinessEvidence(rawData: unknown): Record<string, unknown>;
  isConfigured(): boolean;
}

function notConfigured(name: string): AdapterResult<never> {
  return { status: "NOT_CONFIGURED", adapterName: name };
}

function liveNotImplemented(name: string, configured: () => boolean): AdapterResult<never> {
  if (!configured()) return notConfigured(name);
  return { status: "error", message: "Live fetch is not implemented in this phase. No fabricated results were returned." };
}

function placeholder(name: string, envKey: string): AdvertisingResearchAdapter & WebsiteResearchAdapter & BusinessProfileResearchAdapter {
  const isConfigured = () => Boolean(process.env[envKey]?.trim());
  return {
    name,
    isConfigured,
    searchProspects: async () => liveNotImplemented(name, isConfigured),
    getAdvertiserEvidence: async () => liveNotImplemented(name, isConfigured),
    normalizeAdvertisingEvidence: () => ({}),
    discoverPages: async () => liveNotImplemented(name, isConfigured),
    fetchPublicPage: async () => liveNotImplemented(name, isConfigured),
    extractPublicContactRoutes: async () => liveNotImplemented(name, isConfigured),
    normalizeEvidence: () => ({}),
    searchBusiness: async () => liveNotImplemented(name, isConfigured),
    getBusinessProfile: async () => liveNotImplemented(name, isConfigured),
    normalizeBusinessEvidence: () => ({}),
  };
}

export const MetaAdLibraryAdapter = placeholder("meta_ad_library", "META_AD_LIBRARY_API_KEY");
export const GoogleAdsTransparencyAdapter = placeholder("google_ads_transparency", "GOOGLE_ADS_TRANSPARENCY_API_KEY");
export const GooglePlacesAdapter = placeholder("google_places", "GOOGLE_MAPS_API_KEY");
export const GoogleSearchAdapter = placeholder("google_search", "GOOGLE_SEARCH_API_KEY");
export const ExaResearchAdapter = placeholder("exa", "EXA_API_KEY");
export const FirecrawlResearchAdapter = placeholder("firecrawl", "FIRECRAWL_API_KEY");

export const ManualResearchAdapter: WebsiteResearchAdapter = {
  name: "manual",
  isConfigured: () => true,
  discoverPages: async () => ({ status: "ok", data: [] }),
  fetchPublicPage: async () => ({ status: "ok", data: null }),
  extractPublicContactRoutes: async () => ({ status: "ok", data: [] }),
  normalizeEvidence: (pageData) => (pageData && typeof pageData === "object" ? (pageData as Record<string, unknown>) : {}),
};

export function connectorStatuses() {
  return [
    { key: "meta_ad_library", label: "Meta Ad Library", env: "META_AD_LIBRARY_API_KEY", adapter: MetaAdLibraryAdapter },
    { key: "google_ads_transparency", label: "Google Ads Transparency", env: "GOOGLE_ADS_TRANSPARENCY_API_KEY", adapter: GoogleAdsTransparencyAdapter },
    { key: "google_places", label: "Google Places / Search", env: "GOOGLE_MAPS_API_KEY", adapter: GooglePlacesAdapter },
    { key: "google_search", label: "Google Search", env: "GOOGLE_SEARCH_API_KEY", adapter: GoogleSearchAdapter },
    { key: "website_research", label: "Website research", env: "FIRECRAWL_API_KEY", adapter: FirecrawlResearchAdapter },
    { key: "exa", label: "Exa", env: "EXA_API_KEY", adapter: ExaResearchAdapter },
    { key: "firecrawl", label: "Firecrawl", env: "FIRECRAWL_API_KEY", adapter: FirecrawlResearchAdapter },
  ].map((row) => ({
    key: row.key,
    label: row.label,
    configured: row.adapter.isConfigured(),
    status: row.adapter.isConfigured() ? "configured" : "not_configured",
    env: row.env,
  }));
}

export function getAdapterByName(name: string) {
  switch (name) {
    case "meta_ad_library":
      return MetaAdLibraryAdapter;
    case "google_ads_transparency":
      return GoogleAdsTransparencyAdapter;
    case "google_places":
      return GooglePlacesAdapter;
    case "google_search":
      return GoogleSearchAdapter;
    case "exa":
      return ExaResearchAdapter;
    case "firecrawl":
    case "website_research":
      return FirecrawlResearchAdapter;
    case "manual":
      return ManualResearchAdapter;
    default:
      return null;
  }
}
