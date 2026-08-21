import "server-only";

const GEMINI_API_BASE =
  process.env.GEMINI_API_URL?.trim() || "https://generativelanguage.googleapis.com/v1beta";

/** Free-tier Gemini Flash. Override with GEMINI_MODEL if Google renames the SKU. */
export const DEFAULT_GEMINI_MODEL = "gemini-3.6-flash";

export function getGeminiApiKey(): string | null {
  return process.env.GEMINI_API_KEY?.trim() || null;
}

export function getGeminiModel(): string {
  return process.env.GEMINI_MODEL?.trim() || DEFAULT_GEMINI_MODEL;
}

export async function generateGeminiText(input: {
  system: string;
  user: string;
  temperature?: number;
  maxOutputTokens?: number;
  json?: boolean;
  /** Gemini 3 Flash thinking level. Live coach should stay "minimal". */
  thinkingLevel?: "minimal" | "low" | "medium" | "high";
}): Promise<string> {
  const apiKey = getGeminiApiKey();
  if (!apiKey) throw new Error("GEMINI_API_KEY is not configured.");

  const model = encodeURIComponent(getGeminiModel());
  const response = await fetch(`${GEMINI_API_BASE}/models/${model}:generateContent?key=${apiKey}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: input.system }] },
      contents: [{ role: "user", parts: [{ text: input.user }] }],
      generationConfig: {
        temperature: input.temperature ?? 0.2,
        maxOutputTokens: input.maxOutputTokens ?? 1024,
        thinkingConfig: { thinkingLevel: input.thinkingLevel ?? "minimal" },
        ...(input.json ? { responseMimeType: "application/json" } : {}),
      },
    }),
    signal: AbortSignal.timeout(20000),
    cache: "no-store",
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message =
      (payload as { error?: { message?: string } }).error?.message ||
      `Gemini request failed (${response.status}).`;
    throw new Error(message);
  }

  const parts = (payload as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
  }).candidates?.[0]?.content?.parts ?? [];
  const text = parts.map((part) => part.text ?? "").join("").trim();
  if (!text) throw new Error("Gemini returned no text.");
  return text;
}
