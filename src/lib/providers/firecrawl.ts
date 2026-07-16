import "server-only";

const FIRECRAWL_URL = process.env.FIRECRAWL_API_URL?.trim() || "https://api.firecrawl.dev";

export async function scrapeWebsite(url: string) {
  const apiKey = process.env.FIRECRAWL_API_KEY?.trim();
  if (!apiKey) throw new Error("FIRECRAWL_API_KEY is not configured.");

  const response = await fetch(`${FIRECRAWL_URL}/v1/scrape`, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ url, formats: ["markdown"], onlyMainContent: true, timeout: 20000 }),
    signal: AbortSignal.timeout(30000),
    cache: "no-store",
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || payload.success === false) {
    throw new Error(`Firecrawl request failed (${response.status}).`);
  }
  return payload.data ?? payload;
}
