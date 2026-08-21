import type { DraftContactRouteType, DraftStatus, DraftVerificationResult, OutreachProspect } from "./types";

export function emptyDraftFields(): Pick<
  OutreachProspect,
  | "draftSubject"
  | "draftMessage"
  | "draftGeneratedAt"
  | "draftEvidenceIds"
  | "draftStatus"
  | "draftAngle"
  | "contactRouteType"
  | "lastVerifiedAt"
  | "verificationResult"
> {
  return {
    draftSubject: null,
    draftMessage: null,
    draftGeneratedAt: null,
    draftEvidenceIds: [],
    draftStatus: null,
    draftAngle: null,
    contactRouteType: "none",
    lastVerifiedAt: null,
    verificationResult: null,
  };
}

export function isDraftStatus(value: string | null | undefined): value is DraftStatus {
  return value === "DRAFT" || value === "VERIFIED_READY" || value === "NEEDS_REVIEW" || value === "SENT" || value === "COPIED";
}

export function isDraftContactRouteType(value: string | null | undefined): value is DraftContactRouteType {
  return value === "email" || value === "web_form" || value === "none";
}

export function emptyVerification(): DraftVerificationResult {
  return {
    ok: false,
    contactLive: false,
    evidenceFresh: false,
    failures: [],
    warnings: [],
    checkedAt: new Date().toISOString(),
  };
}
