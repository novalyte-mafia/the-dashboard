export type ConsentStatus =
  | "not_required"
  | "pending"
  | "verbal_consent_obtained"
  | "written_consent_obtained"
  | "declined"
  | "unknown"
  | "recording_disabled"
  | "compliance_review_required";

export type RecordingStatus =
  | "not_started"
  | "initializing"
  | "active"
  | "paused"
  | "failed"
  | "audio_unavailable"
  | "consent_required"
  | "uploading"
  | "uploaded"
  | "local_backup_saved"
  | "cloud_save_failed"
  | "local_save_failed"
  | "finalized";

/** Two-party consent states (approximate — configurable, not legal advice). */
export const TWO_PARTY_CONSENT_STATES = new Set([
  "CA", "CA-US", "California",
  "FL", "Florida",
  "IL", "Illinois",
  "MD", "Maryland",
  "MA", "Massachusetts",
  "MT", "Montana",
  "NH", "New Hampshire",
  "PA", "Pennsylvania",
  "WA", "Washington",
  "CT", "Connecticut",
]);

export function inferConsentRequirement(clinicState?: string | null, callerState?: string | null): {
  requiresExplicitConsent: boolean;
  jurisdiction: string;
} {
  const clinic = (clinicState ?? "").trim();
  const caller = (callerState ?? "").trim();
  const jurisdiction = clinic || caller || "unknown";
  const requiresExplicitConsent =
    TWO_PARTY_CONSENT_STATES.has(clinic.toUpperCase()) ||
    TWO_PARTY_CONSENT_STATES.has(clinic) ||
    TWO_PARTY_CONSENT_STATES.has(caller.toUpperCase()) ||
    TWO_PARTY_CONSENT_STATES.has(caller);
  return { requiresExplicitConsent, jurisdiction };
}

export const DEFAULT_CONSENT_SCRIPT =
  "This call may be recorded for quality, training, and directory verification purposes. Is that okay?";

export const DIRECTORY_ONLY_DISCLOSURE =
  "I'm Jamil with Novalyte AI. This call is only to request permission to include your clinic in our free verified directory and verify a few public listing details.";
