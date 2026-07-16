import "server-only";

const GLM_URL = process.env.GLM_API_URL?.trim() || "https://open.bigmodel.cn/api/paas/v4/chat/completions";

function sanitize(value: string, max = 5000) {
  return value
    .slice(0, max)
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, "[redacted email]")
    .replace(/(?:\+?1[ .-]?)?(?:\(\d{3}\)|\d{3})[ .-]?\d{3}[ .-]?\d{4}/g, "[redacted phone]");
}

export async function generateCopilotSuggestion(input: { clinicName: string; clinicContext: string; transcript: string; question?: string }) {
  const apiKey = process.env.GLM_API_KEY?.trim();
  if (!apiKey) throw new Error("GLM_API_KEY is not configured.");
  const response = await fetch(GLM_URL, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: process.env.GLM_MODEL?.trim() || "glm-5",
      temperature: 0.2,
      max_tokens: 180,
      messages: [
        { role: "system", content: "You are a concise sales-call copilot. Coach the human operator; never speak to the clinic. Do not infer or request medical information. Return one suggested sentence and one follow-up question." },
        { role: "user", content: `Clinic: ${sanitize(input.clinicName, 200)}\nContext: ${sanitize(input.clinicContext, 1200)}\nConversation notes: ${sanitize(input.transcript, 3500)}\nOperator question: ${sanitize(input.question ?? "What should I say next?", 500)}` },
      ],
    }),
    signal: AbortSignal.timeout(25000),
    cache: "no-store",
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(`GLM request failed (${response.status}).`);
  return payload.choices?.[0]?.message?.content ?? "GLM returned no suggestion.";
}
