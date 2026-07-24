import "server-only";

import type { ExtractedClinicIntelligence } from "./types";
import { heuristicExtractFromMarkdown } from "./heuristic";

const GLM_URL = process.env.GLM_API_URL?.trim() || "https://open.bigmodel.cn/api/paas/v4/chat/completions";

function sanitize(value: string, max = 14000) {
  return value.slice(0, max);
}

function parseJsonObject(raw: string): Record<string, unknown> | null {
  const match = raw.match(/\{[\s\S]*\}/);
  if (!match) return null;
  try {
    return JSON.parse(match[0]) as Record<string, unknown>;
  } catch {
    return null;
  }
}

export async function extractClinicIntelligenceFromMarkdown(input: {
  clinicName: string;
  city?: string | null;
  state?: string | null;
  website: string;
  notes?: string | null;
  markdown: string;
  pageTitle?: string | null;
}): Promise<ExtractedClinicIntelligence> {
  const fallback = () => heuristicExtractFromMarkdown(input);
  const apiKey = process.env.GLM_API_KEY?.trim();
  if (!apiKey) return fallback();

  try {
    const system = `You extract factual clinic intelligence for Novalyte's founder outreach.
Rules:
- Only use facts supported by the provided website markdown.
- Never invent phone numbers, emails, providers, years in business, accreditations, or partnerships.
- If unsure, omit the field or add it to missingInformation / warnings.
- Do NOT classify a lab, imaging center, or drug-testing facility as a men's health treatment clinic.
- fitStatus must be one of: strong_fit, possible_fit, research_required, not_relevant, invalid.
- notableFacts: 2-4 short verified facts with confidence high|medium|low.
- Return ONLY valid JSON.`;

    const user = `Clinic name: ${input.clinicName}
Known city/state: ${input.city ?? ""} / ${input.state ?? ""}
Website: ${input.website}
Import notes: ${sanitize(input.notes ?? "", 500)}
Page title: ${input.pageTitle ?? ""}

Website markdown:
${sanitize(input.markdown)}

JSON keys: shortSummary, detailedSummary, primaryCategory, secondaryCategories[], services[], audience[], careDelivery[],
address, city, state, postalCode, county, serviceArea[], bookingUrl, contactUrl, phoneNumbers[], emailAddresses[],
providers[{name,title}], leadership[{name,title}], likelyDecisionMakers[{name,title}],
differentiators[], notableFacts[{text,sourceUrl,confidence}], accreditations[], yearsInBusiness,
businessType, appearsClosed, fitStatus, fitReason, directoryCategories[], conversationFocus,
missingInformation[], warnings[], confidence`;

    const response = await fetch(GLM_URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: process.env.GLM_MODEL?.trim() || "glm-5",
        temperature: 0.1,
        max_tokens: 1800,
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
      }),
      signal: AbortSignal.timeout(45000),
      cache: "no-store",
    });

    const payload = await response.json().catch(() => ({}));
    if (!response.ok) return fallback();

    const raw = String(payload.choices?.[0]?.message?.content ?? "");
    const parsed = parseJsonObject(raw);
    if (!parsed) return fallback();

    const notableFacts = Array.isArray(parsed.notableFacts)
      ? parsed.notableFacts
          .map((f: any) => ({
            text: String(f?.text ?? "").trim(),
            sourceUrl: f?.sourceUrl ? String(f.sourceUrl) : input.website,
            confidence: (["high", "medium", "low", "unverified"].includes(f?.confidence) ? f.confidence : "medium") as
              | "high"
              | "medium"
              | "low"
              | "unverified",
          }))
          .filter((f) => f.text)
      : [];

    return {
      shortSummary: parsed.shortSummary ? String(parsed.shortSummary) : undefined,
      detailedSummary: parsed.detailedSummary ? String(parsed.detailedSummary) : undefined,
      primaryCategory: parsed.primaryCategory ? String(parsed.primaryCategory) : undefined,
      secondaryCategories: Array.isArray(parsed.secondaryCategories) ? parsed.secondaryCategories.map(String) : [],
      services: Array.isArray(parsed.services) ? parsed.services.map(String) : [],
      audience: Array.isArray(parsed.audience) ? parsed.audience.map(String) : [],
      careDelivery: Array.isArray(parsed.careDelivery) ? (parsed.careDelivery as any) : [],
      address: parsed.address ? String(parsed.address) : undefined,
      city: parsed.city ? String(parsed.city) : undefined,
      state: parsed.state ? String(parsed.state) : undefined,
      postalCode: parsed.postalCode ? String(parsed.postalCode) : undefined,
      county: parsed.county ? String(parsed.county) : undefined,
      serviceArea: Array.isArray(parsed.serviceArea) ? parsed.serviceArea.map(String) : [],
      bookingUrl: parsed.bookingUrl ? String(parsed.bookingUrl) : undefined,
      contactUrl: parsed.contactUrl ? String(parsed.contactUrl) : undefined,
      phoneNumbers: Array.isArray(parsed.phoneNumbers) ? parsed.phoneNumbers.map(String) : [],
      emailAddresses: Array.isArray(parsed.emailAddresses) ? parsed.emailAddresses.map(String) : [],
      providers: Array.isArray(parsed.providers) ? (parsed.providers as any) : [],
      leadership: Array.isArray(parsed.leadership) ? (parsed.leadership as any) : [],
      likelyDecisionMakers: Array.isArray(parsed.likelyDecisionMakers) ? (parsed.likelyDecisionMakers as any) : [],
      differentiators: Array.isArray(parsed.differentiators) ? parsed.differentiators.map(String) : [],
      notableFacts,
      accreditations: Array.isArray(parsed.accreditations) ? parsed.accreditations.map(String) : [],
      yearsInBusiness: parsed.yearsInBusiness ? String(parsed.yearsInBusiness) : undefined,
      businessType: parsed.businessType ? String(parsed.businessType) : undefined,
      appearsClosed: Boolean(parsed.appearsClosed),
      fitStatus: parsed.fitStatus as any,
      fitReason: parsed.fitReason ? String(parsed.fitReason) : undefined,
      directoryCategories: Array.isArray(parsed.directoryCategories) ? parsed.directoryCategories.map(String) : [],
      conversationFocus: parsed.conversationFocus ? String(parsed.conversationFocus) : undefined,
      missingInformation: Array.isArray(parsed.missingInformation) ? parsed.missingInformation.map(String) : [],
      warnings: Array.isArray(parsed.warnings) ? parsed.warnings.map(String) : [],
      confidence: typeof parsed.confidence === "number" ? parsed.confidence : 0.5,
    };
  } catch {
    return fallback();
  }
}
