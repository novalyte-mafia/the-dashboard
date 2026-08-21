import "server-only";

export interface ExaNewsHit {
  url: string;
  title: string;
  excerpt: string;
}

export function isExaConfigured() {
  return Boolean(process.env.EXA_API_KEY?.trim());
}

export async function searchNewsMentions(clinicName: string, location: string): Promise<ExaNewsHit[]> {
  const apiKey = process.env.EXA_API_KEY?.trim();
  if (!apiKey) return [];
  const query = [
    `"${clinicName}"`,
    location,
    "(opens OR opening OR award OR expansion OR \"new provider\" OR press OR news)",
  ].filter(Boolean).join(" ");
  const response = await fetch("https://api.exa.ai/search", {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-api-key": apiKey },
    body: JSON.stringify({
      query,
      type: "auto",
      numResults: 5,
      contents: { text: { maxCharacters: 400 } },
    }),
    signal: AbortSignal.timeout(15000),
    cache: "no-store",
  });
  const payload = await response.json().catch(() => ({})) as {
    results?: Array<{ url?: string; title?: string; text?: string }>;
  };
  if (!response.ok) return [];
  return (payload.results ?? [])
    .filter((row) => typeof row.url === "string" && row.url.startsWith("http"))
    .map((row) => ({
      url: String(row.url),
      title: String(row.title || clinicName),
      excerpt: String(row.text || row.title || "").replace(/\s+/g, " ").trim().slice(0, 400),
    }));
}
