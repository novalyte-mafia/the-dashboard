import { createHash } from "node:crypto";

export type TrafficClassification =
  | "external"
  | "internal"
  | "test"
  | "bot"
  | "unknown";

export type IdentityClassification =
  | "anonymous"
  | "identified"
  | "internal_personnel"
  | "test_identity";

export type EnvironmentClassification =
  | "production"
  | "preview"
  | "development"
  | "test";

export type ConversionClassification =
  | "real"
  | "test"
  | "internal"
  | "duplicate"
  | "invalid";

const TEST_EMAIL =
  /(^test[@.]|[+._-]test[@.]|do-?not-?contact|attribution-qa\+|noreply\+test|cursor.?agent)/i;
const TEST_NAME = /\b(test|do[- ]?not[- ]?contact|qa only|pipeline audit)\b/i;
const TEST_UTM = /^(pipeline_audit|attribution_fix|inbox_recipient_fix|live_activity|cursor_agent)$/i;
const BOT_UA =
  /(bot|crawler|spider|slurp|facebookexternalhit|preview|headless|playwright|puppeteer|selenium|curl|wget|python-requests)/i;

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function shortVisitorLabel(distinctId: string | null | undefined): string {
  if (!distinctId) return "Anonymous Visitor ----";
  const digest = createHash("sha256").update(distinctId).digest("hex").slice(0, 4).toUpperCase();
  return `Anonymous Visitor ${digest}`;
}

export function classifyTestSubmission(input: {
  contactName?: string | null;
  contactEmail?: string | null;
  utmSource?: string | null;
  utmMedium?: string | null;
  utmCampaign?: string | null;
  isTestFlag?: boolean | null;
  metadata?: Record<string, unknown> | null;
  environment?: string | null;
}): boolean {
  if (input.isTestFlag === true) return true;
  if (input.metadata?.is_test === true || input.metadata?.is_test === "true") return true;
  if (input.environment === "test" || input.environment === "development") return true;
  if (input.contactEmail && TEST_EMAIL.test(input.contactEmail)) return true;
  if (input.contactName && TEST_NAME.test(input.contactName)) return true;
  if (input.utmCampaign && TEST_UTM.test(input.utmCampaign)) return true;
  if (input.utmMedium && TEST_UTM.test(input.utmMedium)) return true;
  if (input.utmSource && /^cursor_agent$/i.test(input.utmSource)) return true;
  return false;
}

export function classifyBot(userAgent?: string | null): boolean {
  return Boolean(userAgent && BOT_UA.test(userAgent));
}

export function classifyEnvironment(
  host?: string | null,
  vercelEnv?: string | null,
  nodeEnv?: string | null,
): EnvironmentClassification {
  if (vercelEnv === "preview") return "preview";
  if (nodeEnv === "development" || vercelEnv === "development") return "development";
  if (host && /(localhost|127\.0\.0\.1)/i.test(host)) return "development";
  if (host && /\.vercel\.app$/i.test(host)) return "preview";
  return "production";
}

export function classifyTraffic(input: {
  isInternalDevice?: boolean;
  isTest?: boolean;
  isBot?: boolean;
}): TrafficClassification {
  if (input.isTest) return "test";
  if (input.isInternalDevice) return "internal";
  if (input.isBot) return "bot";
  return "external";
}

export function classifyConversion(input: {
  isTest?: boolean;
  isInternal?: boolean;
  isDuplicate?: boolean;
  hasSubmission?: boolean;
}): ConversionClassification {
  if (input.isDuplicate) return "duplicate";
  if (!input.hasSubmission) return "invalid";
  if (input.isTest) return "test";
  if (input.isInternal) return "internal";
  return "real";
}
