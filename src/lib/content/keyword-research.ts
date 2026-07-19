import "server-only";

import {
  DEFAULT_LANGUAGE_CODE,
  DEFAULT_LOCATION_NAME,
  fetchKeywordOverview,
  fetchRelatedKeywords,
  hasDataForSeoCredentials,
  type DataForSeoKeywordMetrics,
  type KeywordLocale,
} from "@/lib/content/dataforseo";

/**
 * Keyword research for the Content Studio keyword panel.
 *
 * Two modes, always explicitly labeled:
 * - `provider: "dataforseo"` — real metrics from DataForSEO Labs with
 *   location/language context (requires DATAFORSEO_LOGIN/PASSWORD).
 * - `provider: "ai"` — GLM keyword recommendations only. Metrics are always
 *   null in this mode; volume/CPC/difficulty are never invented.
 */

export interface KeywordSuggestion {
  keyword: string;
  source: "dataforseo" | "ai";
  /** Present only when source is "dataforseo". */
  metrics: DataForSeoKeywordMetrics | null;
  /** Present only for AI recommendations. */
  rationale: string | null;
}

export interface KeywordResearchResult {
  provider: "dataforseo" | "ai";
  providerLabel: string;
  metricsAvailable: boolean;
  /** Locale the metrics were fetched for; null in AI mode. */
  locale: KeywordLocale | null;
  seedKeyword: string;
  suggestions: KeywordSuggestion[];
  /** Apply-ready patch matching JournalArticleV1 `keywords` field. */
  keywords: { primary: string | null; secondary: string[] };
  notice: string | null;
  fetchedAt: string;
}

export interface KeywordResearchInput {
  seedKeyword: string;
  /** Existing/candidate keywords to score alongside the seed (metrics mode only). */
  additionalKeywords?: string[];
  topic?: string;
  locationName?: string;
  languageCode?: string;
  limit?: number;
}

const GLM_URL = process.env.GLM_API_URL?.trim() || "https://open.bigmodel.cn/api/paas/v4/chat/completions";

function buildKeywordsPatch(seed: string, suggestions: KeywordSuggestion[]) {
  const secondary = suggestions
    .map((s) => s.keyword)
    .filter((k) => k.toLowerCase() !== seed.toLowerCase())
    .slice(0, 10);
  return { primary: seed || null, secondary };
}

async function researchWithDataForSeo(input: KeywordResearchInput): Promise<KeywordResearchResult> {
  const locale: KeywordLocale = {
    locationName: input.locationName?.trim() || DEFAULT_LOCATION_NAME,
    languageCode: input.languageCode?.trim() || DEFAULT_LANGUAGE_CODE,
  };
  const limit = Math.min(Math.max(input.limit ?? 20, 1), 50);
  const seed = input.seedKeyword.trim();

  const overviewTargets = [seed, ...(input.additionalKeywords ?? [])];
  const [related, overview] = await Promise.all([
    fetchRelatedKeywords(seed, locale, limit),
    fetchKeywordOverview(overviewTargets, locale),
  ]);

  const byKeyword = new Map<string, KeywordSuggestion>();
  for (const row of [...overview, ...related]) {
    const key = row.keyword.toLowerCase();
    if (!byKeyword.has(key)) {
      byKeyword.set(key, { keyword: row.keyword, source: "dataforseo", metrics: row.metrics, rationale: null });
    }
  }
  const suggestions = [...byKeyword.values()]
    .sort((a, b) => (b.metrics?.searchVolume ?? -1) - (a.metrics?.searchVolume ?? -1))
    .slice(0, limit);

  return {
    provider: "dataforseo",
    providerLabel: `DataForSEO Labs (${locale.locationName}, ${locale.languageCode})`,
    metricsAvailable: true,
    locale,
    seedKeyword: seed,
    suggestions,
    keywords: buildKeywordsPatch(seed, suggestions),
    notice: null,
    fetchedAt: new Date().toISOString(),
  };
}

function parseAiKeywords(content: string): Array<{ keyword: string; rationale: string | null }> {
  const jsonMatch = content.match(/\[[\s\S]*\]/);
  if (!jsonMatch) return [];
  try {
    const parsed = JSON.parse(jsonMatch[0]);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((entry) => {
        if (typeof entry === "string") return { keyword: entry, rationale: null };
        if (entry && typeof entry.keyword === "string") {
          return {
            keyword: entry.keyword,
            rationale: typeof entry.rationale === "string" ? entry.rationale : null,
          };
        }
        return null;
      })
      .filter((e): e is { keyword: string; rationale: string | null } => e !== null && e.keyword.trim().length > 0);
  } catch {
    return [];
  }
}

async function researchWithAi(input: KeywordResearchInput): Promise<KeywordResearchResult> {
  const seed = input.seedKeyword.trim();
  const limit = Math.min(Math.max(input.limit ?? 12, 1), 25);
  const apiKey = process.env.GLM_API_KEY?.trim();
  if (!apiKey) {
    throw new Error("No keyword provider is configured (DataForSEO credentials and GLM_API_KEY are both missing).");
  }

  const response = await fetch(GLM_URL, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: process.env.GLM_MODEL?.trim() || "glm-5",
      temperature: 0.4,
      max_tokens: 900,
      messages: [
        {
          role: "system",
          content:
            "You are an SEO keyword strategist for a medical wellness clinic directory (TRT, hormone therapy, med spa topics). " +
            "Suggest realistic search keywords a patient would type into Google. " +
            `Return ONLY a JSON array of up to ${limit} objects: {"keyword": string, "rationale": string}. ` +
            "Rationale is one short phrase (e.g. intent or angle). Do NOT include search volume, CPC, difficulty, or any numeric metrics.",
        },
        {
          role: "user",
          content:
            `Seed keyword: ${seed.slice(0, 200)}\n` +
            (input.topic ? `Article topic: ${input.topic.slice(0, 500)}\n` : "") +
            `Suggest ${limit} related keywords.`,
        },
      ],
    }),
    signal: AbortSignal.timeout(30_000),
    cache: "no-store",
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(`GLM keyword request failed (${response.status}).`);
  const content: string = payload.choices?.[0]?.message?.content ?? "";
  const parsed = parseAiKeywords(content);

  const seen = new Set<string>();
  const suggestions: KeywordSuggestion[] = [];
  for (const entry of parsed) {
    const keyword = entry.keyword.trim().toLowerCase();
    if (!keyword || seen.has(keyword)) continue;
    seen.add(keyword);
    suggestions.push({ keyword, source: "ai", metrics: null, rationale: entry.rationale });
    if (suggestions.length >= limit) break;
  }

  return {
    provider: "ai",
    providerLabel: "AI recommendations (no search metrics)",
    metricsAvailable: false,
    locale: null,
    seedKeyword: seed,
    suggestions,
    keywords: buildKeywordsPatch(seed, suggestions),
    notice:
      "DataForSEO credentials are not configured. These are AI keyword recommendations only — search volume, CPC, and difficulty are unavailable and never estimated.",
    fetchedAt: new Date().toISOString(),
  };
}

export async function researchKeywords(input: KeywordResearchInput): Promise<KeywordResearchResult> {
  if (!input.seedKeyword.trim()) {
    throw new Error("A seed keyword is required.");
  }
  if (hasDataForSeoCredentials()) {
    return researchWithDataForSeo(input);
  }
  return researchWithAi(input);
}
