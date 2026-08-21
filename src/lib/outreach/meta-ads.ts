import type { MetaAdActiveStatus, MetaPlatform, MetaSearchQuery, MetaTrustMode, Vertical } from "./types";

export const META_ADS_LIBRARY_BASE = "https://www.facebook.com/ads/library/";
export const META_ADS_API_DOCS = "https://www.facebook.com/ads/library/api/";

export const EMPTY_META_QUERY: MetaSearchQuery = {
  advertiser: "",
  keyword: "",
  clinicName: "",
  city: "",
  state: "",
  country: "US",
  adCategory: "all",
  activeStatus: "active",
  platforms: ["facebook", "instagram"],
  dateFrom: "",
  dateTo: "",
  landingPageDomain: "",
  vertical: "",
};

export const SUGGESTED_META_SEARCHES: Array<{ name: string; query: Partial<MetaSearchQuery> }> = [
  { name: "TRT Clinics — California", query: { keyword: "TRT clinic", state: "CA", country: "US", vertical: "trt_hormone", activeStatus: "active" } },
  { name: "Men’s Health — Active Meta Ads", query: { keyword: "men's health clinic", country: "US", vertical: "mens_health", activeStatus: "active" } },
  { name: "MedSpas — Los Angeles", query: { keyword: "medspa", city: "Los Angeles", state: "CA", country: "US", vertical: "medspa", activeStatus: "active" } },
  { name: "Weight Management — Texas", query: { keyword: "weight loss clinic", state: "TX", country: "US", vertical: "weight_management", activeStatus: "active" } },
  { name: "Erectile Dysfunction Clinics — United States", query: { keyword: "erectile dysfunction clinic", country: "US", vertical: "ed", activeStatus: "active" } },
];

const COUNTRY_CODES: Record<string, string> = {
  US: "US",
  USA: "US",
  "UNITED STATES": "US",
  CA: "CA",
  CANADA: "CA",
  GB: "GB",
  UK: "GB",
};

export function normalizeCountry(value: string | null | undefined): string {
  const key = (value || "US").trim().toUpperCase();
  return COUNTRY_CODES[key] ?? (key.length === 2 ? key : "US");
}

export function metaSearchTerms(query: MetaSearchQuery): string {
  return [query.advertiser, query.clinicName, query.keyword, query.city, query.state]
    .map((part) => part.trim())
    .filter(Boolean)
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
}

export function validateMetaQuery(query: MetaSearchQuery): string | null {
  if (!metaSearchTerms(query) && !query.landingPageDomain.trim()) {
    return "Enter an advertiser, clinic name, keyword, or landing-page domain.";
  }
  return null;
}

export function buildOfficialMetaAdsLibraryUrl(query: MetaSearchQuery): string {
  const country = normalizeCountry(query.country);
  const q = metaSearchTerms(query) || query.landingPageDomain.trim();
  const params = new URLSearchParams();
  params.set("active_status", query.activeStatus === "all" ? "all" : query.activeStatus);
  params.set("ad_type", query.adCategory?.trim() && query.adCategory !== "all" ? query.adCategory : "all");
  params.set("country", country);
  params.set("is_targeted_country", "false");
  params.set("media_type", "all");
  params.set("search_type", query.advertiser.trim() && !query.keyword.trim() ? "page" : "keyword_unordered");
  if (q) params.set("q", q);
  return `${META_ADS_LIBRARY_BASE}?${params.toString()}`;
}

export function metaTrustMode(apiConfigured: boolean, liveResults: boolean): MetaTrustMode {
  if (liveResults) return "LIVE_META_DATA";
  if (apiConfigured) return "NOT_CONFIGURED";
  return "OFFICIAL_LINK_OUT";
}

export function isMetaApiConfigured(): boolean {
  return Boolean(process.env.META_AD_LIBRARY_API_KEY?.trim());
}

export interface GraphAdRow {
  id?: string;
  page_id?: string;
  page_name?: string;
  ad_snapshot_url?: string;
  ad_creative_bodies?: string[];
  ad_creative_link_captions?: string[];
  ad_creative_link_titles?: string[];
  ad_delivery_start_time?: string;
  publisher_platforms?: string[];
  ad_creative_link_descriptions?: string[];
}

export async function fetchMetaAdsArchive(query: MetaSearchQuery): Promise<{
  ok: boolean;
  ads: GraphAdRow[];
  error: string | null;
  usedApi: boolean;
}> {
  const token = process.env.META_AD_LIBRARY_API_KEY?.trim();
  if (!token) {
    return { ok: false, ads: [], error: null, usedApi: false };
  }
  const terms = metaSearchTerms(query);
  if (!terms) {
    return { ok: false, ads: [], error: "A search term is required for the Meta Ads Archive API.", usedApi: true };
  }
  const params = new URLSearchParams({
    access_token: token,
    search_terms: terms,
    ad_reached_countries: JSON.stringify([normalizeCountry(query.country)]),
    ad_active_status: query.activeStatus === "inactive" ? "INACTIVE" : query.activeStatus === "all" ? "ALL" : "ACTIVE",
    ad_type: "ALL",
    fields: [
      "id",
      "ad_creation_time",
      "ad_creative_bodies",
      "ad_creative_link_captions",
      "ad_creative_link_descriptions",
      "ad_creative_link_titles",
      "ad_delivery_start_time",
      "ad_snapshot_url",
      "page_id",
      "page_name",
      "publisher_platforms",
    ].join(","),
    limit: "25",
  });
  try {
    const response = await fetch(`https://graph.facebook.com/v21.0/ads_archive?${params.toString()}`, {
      signal: AbortSignal.timeout(20000),
      cache: "no-store",
    });
    const payload = await response.json().catch(() => ({})) as {
      data?: GraphAdRow[];
      error?: { message?: string };
    };
    if (!response.ok) {
      return {
        ok: false,
        ads: [],
        usedApi: true,
        error: payload.error?.message || `Meta Ads Archive API returned ${response.status}. Commercial ads often require approved Ad Library API access.`,
      };
    }
    return { ok: true, ads: payload.data ?? [], error: null, usedApi: true };
  } catch (error) {
    return {
      ok: false,
      ads: [],
      usedApi: true,
      error: error instanceof Error ? error.message : "Meta Ads Archive request failed.",
    };
  }
}

export function landingDomainFromUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  try {
    return new URL(url).hostname.replace(/^www\./, "").toLowerCase() || null;
  } catch {
    return null;
  }
}

export function verticalFromQuery(vertical: Vertical | ""): Vertical | "" {
  return vertical;
}

export function platformsFromQuery(platforms: MetaPlatform[]): string[] {
  return platforms.length ? platforms : ["facebook"];
}
