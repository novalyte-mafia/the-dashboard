import "server-only";

/**
 * DataForSEO Labs adapter (Basic Auth, server-only).
 *
 * Wraps the keyword_overview and related_keywords live endpoints. Every metric
 * returned from here is real provider data labeled `provider: "dataforseo"`
 * with its location/language context. When credentials are missing the caller
 * must fall back to labeled AI recommendations without metrics — this module
 * never fabricates volume/CPC/difficulty.
 */

const DATAFORSEO_BASE_URL = "https://api.dataforseo.com";
const REQUEST_TIMEOUT_MS = 30_000;
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // keyword metrics move slowly
const CACHE_MAX_ENTRIES = 200;

export const DEFAULT_LOCATION_NAME = "United States";
export const DEFAULT_LANGUAGE_CODE = "en";

export interface KeywordLocale {
  locationName: string;
  languageCode: string;
}

export interface DataForSeoKeywordMetrics {
  provider: "dataforseo";
  searchVolume: number | null;
  cpcUsd: number | null;
  /** 0..1 paid competition index. */
  competition: number | null;
  competitionLevel: string | null;
  /** 0..100 organic keyword difficulty. */
  keywordDifficulty: number | null;
  searchIntent: string | null;
}

export interface DataForSeoKeywordRow {
  keyword: string;
  metrics: DataForSeoKeywordMetrics;
}

export function hasDataForSeoCredentials(): boolean {
  return Boolean(process.env.DATAFORSEO_LOGIN?.trim() && process.env.DATAFORSEO_PASSWORD?.trim());
}

function basicAuthHeader(): string {
  const login = process.env.DATAFORSEO_LOGIN?.trim();
  const password = process.env.DATAFORSEO_PASSWORD?.trim();
  if (!login || !password) {
    throw new Error("DataForSEO credentials are not configured.");
  }
  return `Basic ${Buffer.from(`${login}:${password}`).toString("base64")}`;
}

// --- In-memory response cache (per server instance) ---
interface CacheEntry {
  expiresAt: number;
  value: DataForSeoKeywordRow[];
}
const cache = new Map<string, CacheEntry>();

function cacheGet(key: string): DataForSeoKeywordRow[] | null {
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    cache.delete(key);
    return null;
  }
  return entry.value;
}

function cacheSet(key: string, value: DataForSeoKeywordRow[]) {
  if (cache.size >= CACHE_MAX_ENTRIES) {
    const oldest = cache.keys().next().value;
    if (oldest !== undefined) cache.delete(oldest);
  }
  cache.set(key, { expiresAt: Date.now() + CACHE_TTL_MS, value });
}

async function postLabsEndpoint(path: string, task: Record<string, unknown>): Promise<unknown[]> {
  const response = await fetch(`${DATAFORSEO_BASE_URL}${path}`, {
    method: "POST",
    headers: { Authorization: basicAuthHeader(), "Content-Type": "application/json" },
    body: JSON.stringify([task]),
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    cache: "no-store",
  });
  if (!response.ok) {
    throw new Error(`DataForSEO request failed (${response.status}).`);
  }
  const payload = await response.json().catch(() => null) as {
    status_code?: number;
    tasks?: Array<{ status_code?: number; status_message?: string; result?: Array<{ items?: unknown[] }> }>;
  } | null;
  const taskResult = payload?.tasks?.[0];
  if (!taskResult || taskResult.status_code !== 20000) {
    throw new Error(`DataForSEO task failed: ${taskResult?.status_message ?? "unknown error"}`);
  }
  return taskResult.result?.flatMap((r) => r.items ?? []) ?? [];
}

function toFiniteNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function toMetrics(item: Record<string, any>): DataForSeoKeywordMetrics {
  const info = item.keyword_info ?? {};
  const properties = item.keyword_properties ?? {};
  const intent = item.search_intent_info ?? {};
  return {
    provider: "dataforseo",
    searchVolume: toFiniteNumber(info.search_volume),
    cpcUsd: toFiniteNumber(info.cpc),
    competition: toFiniteNumber(info.competition),
    competitionLevel: typeof info.competition_level === "string" ? info.competition_level : null,
    keywordDifficulty: toFiniteNumber(properties.keyword_difficulty),
    searchIntent: typeof intent.main_intent === "string" ? intent.main_intent : null,
  };
}

/** Real metrics for specific keywords via dataforseo_labs/google/keyword_overview/live. */
export async function fetchKeywordOverview(
  keywords: string[],
  locale: KeywordLocale,
): Promise<DataForSeoKeywordRow[]> {
  const normalized = [...new Set(keywords.map((k) => k.trim().toLowerCase()).filter(Boolean))].slice(0, 20);
  if (normalized.length === 0) return [];
  const cacheKey = JSON.stringify(["overview", normalized, locale.locationName, locale.languageCode]);
  const cached = cacheGet(cacheKey);
  if (cached) return cached;

  const items = await postLabsEndpoint("/v3/dataforseo_labs/google/keyword_overview/live", {
    keywords: normalized,
    location_name: locale.locationName,
    language_code: locale.languageCode,
  });
  const rows: DataForSeoKeywordRow[] = [];
  for (const raw of items) {
    const item = raw as Record<string, any>;
    if (typeof item?.keyword !== "string") continue;
    rows.push({ keyword: item.keyword, metrics: toMetrics(item) });
  }
  cacheSet(cacheKey, rows);
  return rows;
}

/** Related keyword ideas with metrics via dataforseo_labs/google/related_keywords/live. */
export async function fetchRelatedKeywords(
  seedKeyword: string,
  locale: KeywordLocale,
  limit = 20,
): Promise<DataForSeoKeywordRow[]> {
  const seed = seedKeyword.trim().toLowerCase();
  if (!seed) return [];
  const cacheKey = JSON.stringify(["related", seed, locale.locationName, locale.languageCode, limit]);
  const cached = cacheGet(cacheKey);
  if (cached) return cached;

  const items = await postLabsEndpoint("/v3/dataforseo_labs/google/related_keywords/live", {
    keyword: seed,
    location_name: locale.locationName,
    language_code: locale.languageCode,
    depth: 1,
    limit,
  });
  const rows: DataForSeoKeywordRow[] = [];
  for (const raw of items) {
    const data = (raw as Record<string, any>)?.keyword_data as Record<string, any> | undefined;
    if (typeof data?.keyword !== "string") continue;
    rows.push({ keyword: data.keyword, metrics: toMetrics(data) });
  }
  cacheSet(cacheKey, rows);
  return rows;
}
