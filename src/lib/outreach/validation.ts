import {
  CONTACT_CHANNEL_TYPES,
  CONTACT_VERIFICATION_STATUSES,
  EVIDENCE_TYPES,
  PROSPECT_STATUSES,
  RESEARCH_CONFIDENCES,
  SOURCE_TYPES,
  VERTICALS,
  type ContactChannelType,
  type OutreachContactRoute,
  type OutreachEvidence,
  type OutreachProspect,
} from "./types";

const URL_RE = /^https?:\/\/[^\s]+$/i;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function isHttpUrl(value: string | null | undefined): boolean {
  if (!value) return false;
  return URL_RE.test(value.trim());
}

export function isPublishedEmailFormat(value: string): boolean {
  return EMAIL_RE.test(value.trim());
}

export function domainFromUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  try {
    const host = new URL(url).hostname.replace(/^www\./, "").toLowerCase();
    return host || null;
  } catch {
    return null;
  }
}

export function emailDomain(value: string): string | null {
  const at = value.lastIndexOf("@");
  if (at < 0) return null;
  return value.slice(at + 1).toLowerCase() || null;
}

const PLACEHOLDER_HOST_RE = /(^|\.)example\.com$|(^|\.)example$|(^|\.)test$|(^|\.)invalid$|^localhost$|^127\.0\.0\.1$/i;

export function isPlaceholderHost(host: string | null | undefined): boolean {
  if (!host) return false;
  return PLACEHOLDER_HOST_RE.test(host.replace(/^www\./, "").toLowerCase());
}

export function assertNotPlaceholderUrl(url: string | null | undefined, field: string) {
  if (!url) return;
  const host = domainFromUrl(url);
  if (isPlaceholderHost(host)) {
    throw new OutreachValidationError(
      "Placeholder domains (.example, .test, .invalid, example.com, localhost) are not allowed.",
      field,
    );
  }
}

export function assertNotPlaceholderEmail(value: string | null | undefined, field: string) {
  if (!value || !value.includes("@")) return;
  if (isPlaceholderHost(emailDomain(value))) {
    throw new OutreachValidationError(
      "Placeholder email domains (.example, .test, .invalid, example.com, localhost) are not allowed.",
      field,
    );
  }
}

export function hasResearchIdentity(input: Partial<OutreachProspect>): boolean {
  const name = input.clinicName?.trim();
  return Boolean(name && (input.websiteUrl?.trim() || input.city?.trim() || input.publicBusinessProfileUrl?.trim()));
}

export class OutreachValidationError extends Error {
  constructor(
    message: string,
    public readonly field?: string,
  ) {
    super(message);
    this.name = "OutreachValidationError";
  }
}

export function assertEnum<T extends string>(value: string, allowed: readonly T[], field: string): T {
  if (!(allowed as readonly string[]).includes(value)) {
    throw new OutreachValidationError(`Invalid ${field}.`, field);
  }
  return value as T;
}

export function validateProspectWrite(input: Partial<OutreachProspect> & { clinicName?: string }) {
  const clinicName = input.clinicName?.trim();
  if (!clinicName) throw new OutreachValidationError("Clinic name is required.", "clinicName");
  if (input.websiteUrl && !isHttpUrl(input.websiteUrl)) {
    throw new OutreachValidationError("Website URL must be a public http(s) link.", "websiteUrl");
  }
  assertNotPlaceholderUrl(input.websiteUrl ?? null, "websiteUrl");
  if (input.publicBusinessProfileUrl && !isHttpUrl(input.publicBusinessProfileUrl)) {
    throw new OutreachValidationError("Business profile URL must be a public http(s) link.", "publicBusinessProfileUrl");
  }
  assertNotPlaceholderUrl(input.publicBusinessProfileUrl ?? null, "publicBusinessProfileUrl");
  if (input.status) assertEnum(input.status, PROSPECT_STATUSES, "status");
  if (input.researchConfidence) assertEnum(input.researchConfidence, RESEARCH_CONFIDENCES, "researchConfidence");
  if (input.sourceType) assertEnum(input.sourceType, SOURCE_TYPES, "sourceType");
  if (input.vertical) assertEnum(input.vertical, VERTICALS, "vertical");
  return { clinicName };
}

export function validateEvidenceWrite(
  input: Partial<OutreachEvidence> & { sourceUrl?: string; evidenceType?: string },
  requireSourceUrl = true,
) {
  if (input.evidenceType) assertEnum(input.evidenceType, EVIDENCE_TYPES, "evidenceType");
  if (input.sourceType) assertEnum(input.sourceType, SOURCE_TYPES, "sourceType");
  if (input.confidence) assertEnum(input.confidence, RESEARCH_CONFIDENCES, "confidence");
  const url = input.sourceUrl?.trim() ?? "";
  if (requireSourceUrl && !isHttpUrl(url)) {
    throw new OutreachValidationError("Evidence requires a public source URL.", "sourceUrl");
  }
  if (url) assertNotPlaceholderUrl(url, "sourceUrl");
}

export function validateContactRouteWrite(
  input: Partial<OutreachContactRoute> & { channelType?: string; value?: string },
  requireSourceUrl: boolean,
) {
  const channel = input.channelType
    ? assertEnum(input.channelType, CONTACT_CHANNEL_TYPES, "channelType")
    : undefined;
  if (input.verificationStatus) {
    assertEnum(input.verificationStatus, CONTACT_VERIFICATION_STATUSES, "verificationStatus");
  }
  if (channel === "PUBLISHED_EMAIL" && input.value && !isPublishedEmailFormat(input.value)) {
    throw new OutreachValidationError("Published email has an invalid format.", "value");
  }
  if (channel === "PUBLISHED_EMAIL") assertNotPlaceholderEmail(input.value, "value");
  if (input.value && isHttpUrl(input.value)) assertNotPlaceholderUrl(input.value, "value");
  if (input.sourceUrl) assertNotPlaceholderUrl(input.sourceUrl, "sourceUrl");
  if (channel && channel !== "NONE_FOUND" && channel !== "PUBLISHED_EMAIL" && channel !== "PUBLIC_PHONE") {
    if (input.value && !isHttpUrl(input.value) && !input.isManualRecord) {
      throw new OutreachValidationError("Contact route value should be a public URL for this channel.", "value");
    }
  }
  const hasSource = isHttpUrl(input.sourceUrl ?? null);
  const manual = Boolean(input.isManualRecord);
  if (requireSourceUrl && !hasSource && !manual) {
    throw new OutreachValidationError(
      "Contact route requires a source URL unless it is an explicit manual operator record.",
      "sourceUrl",
    );
  }
}

export const FORBIDDEN_CLAIM_PHRASES = [
  "guaranteed valid email",
  "verified recipient",
  "auto-send",
  "guaranteed deliverability",
  "we found their personal email",
];
