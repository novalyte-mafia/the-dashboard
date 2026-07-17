import "server-only";

const GLM_URL = process.env.GLM_API_URL?.trim() || "https://open.bigmodel.cn/api/paas/v4/chat/completions";

function sanitize(value: string, max = 5000) {
  return value
    .slice(0, max)
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, "[redacted email]")
    .replace(/(?:\+?1[ .-]?)?(?:\(\d{3}\)|\d{3})[ .-]?\d{3}[ .-]?\d{4}/g, "[redacted phone]");
}

export function generateFieldGuideSuggestion(transcript: string) {
  const reply = transcript.toLowerCase();
  if (reply.includes("sales") || reply.includes("did not request") || reply.includes("didn't request") || reply.includes("not interested")) {
    return "That’s fair. This is not a paid sales call—the basic verified listing is free. I only need to confirm your public details and your permission to publish them.";
  }
  if (reply.includes("email") || reply.includes("send me")) {
    return "Absolutely. Before I send it, may I confirm the best email and the name of the person who manages your clinic listing?";
  }
  // Fees / free questions (the live transcript often says: "is it free?" or "any fees?")
  if (
    reply.includes("free") ||
    reply.includes("fee") ||
    reply.includes("fees") ||
    reply.includes("cost") ||
    reply.includes("price") ||
    reply.includes("charge")
  ) {
    return "Yes—our verified directory listing is completely free. I just need your permission to include your clinic profile (and booking link, if you’d like).";
  }
  // Why are you calling?
  if ((reply.includes("why") || reply.includes("reason")) && (reply.includes("calling") || reply.includes("called"))) {
    return "Of course. We’re calling to verify your clinic’s public details for our directory—it's a free, permission-based listing. May I confirm a couple items to publish your verified profile?";
  }
  if (reply.includes("busy") || reply.includes("bad time") || reply.includes("call back")) {
    return "Of course. What day and time would be best for a two-minute verification call?";
  }
  if (reply.includes("manager") || reply.includes("owner") || reply.includes("doctor") || reply.includes("practice manager")) {
    return "Thank you. May I confirm who manages your clinic listing (owner/practice manager), or is there a better time to reach them?";
  }
  if (reply.includes("already") && (reply.includes("enough") || reply.includes("full"))) {
    return "That’s completely fine. Even if you’re currently booked, our directory helps the right patients find the right providers. May I confirm permission to include your verified profile?";
  }
  return "Thank you. To make sure we list the clinic accurately, may I confirm your public phone number, services, and whether you are accepting new patients?";
}

export async function generateCopilotSuggestion(input: {
  clinicName: string;
  clinicContext: string;
  transcript: string;
  question?: string;
  stage?: string;
  qualificationSummary?: string;
  missingQualification?: string;
  detectedObjections?: string;
  previousSuggestions?: string;
}) {
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
        {
          role: "system",
          content:
            "You are a concise call-copilot for a free, permission-based directory verification outreach. Coach the human operator only. Always assume the listing is free. Answer the clinic's latest direct question first. Only ask for missing details needed to complete directory verification (permission, email, booking link, public address/phone/services, accepting new patients). Use the business name 'Novalyte AI'. Never repeat the same suggestion. Return ONLY the operator sentence to say next (single concise sentence). Avoid medical inference and avoid requesting anything beyond directory verification.",
        },
        {
          role: "user",
          content:
            `Clinic: ${sanitize(input.clinicName, 200)}\n` +
            `Context: ${sanitize(input.clinicContext, 1200)}\n` +
            `Call stage: ${sanitize(input.stage ?? "unknown", 200)}\n` +
            `Qualification summary: ${sanitize(input.qualificationSummary ?? "", 800)}\n` +
            `Missing checklist: ${sanitize(input.missingQualification ?? "", 800)}\n` +
            `Detected objections (if any): ${sanitize(input.detectedObjections ?? "", 800)}\n` +
            `Previous suggestions (recent): ${sanitize(input.previousSuggestions ?? "", 1600)}\n` +
            `Conversation notes: ${sanitize(input.transcript, 3500)}\n` +
            `Clinic's latest direct question (or objection): ${sanitize(input.question ?? "What should I say next?", 500)}`,
        },
      ],
    }),
    signal: AbortSignal.timeout(25000),
    cache: "no-store",
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(`GLM request failed (${response.status}).`);
  return payload.choices?.[0]?.message?.content ?? "GLM returned no suggestion.";
}
