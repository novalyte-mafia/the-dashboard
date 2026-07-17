import type { ConsentStatus } from "./recording-consent";

export type PostCallAnalysisInput = {
  callSessionId: string;
  clinicId: string;
  clinicName: string;
  transcript: Array<{ speaker: string; text: string; timestamp?: string }>;
  durationSec: number;
  consentStatus: ConsentStatus;
  recordingStatus: string;
  copilotSuggestions: Array<{ suggested_response: string; was_used?: boolean }>;
  qualification: Record<string, unknown>;
  outcome?: string;
};

export type PostCallAnalysisResult = {
  summary: string;
  directoryPermissionResult: string;
  contactReached: boolean;
  decisionMakerStatus: string;
  informationCollected: Record<string, unknown>;
  informationMissing: string[];
  clinicQuestions: string[];
  objectionsRaised: string[];
  operatorResponses: string[];
  copilotSuggestionsSummary: { shown: number; used: number };
  strongMoments: string[];
  weakMoments: string[];
  missedOpportunities: string[];
  complianceConcerns: string[];
  followUpAction: string;
  recommendedFollowUpDate: string | null;
  clinicInterestLevel: string;
  callQualityScore: number;
  transcriptConfidenceScore: number;
  recordingQualityScore: number;
  trainingEligibilityRecommendation: "eligible" | "excluded" | "requires_review";
};

const PERMISSION_PATTERNS = /\b(yes|go ahead|permission|you can list|sounds good|okay to list)\b/i;
const DECLINE_PATTERNS = /\b(not interested|no thanks|don't call|decline|do not list)\b/i;
const QUESTION_PATTERNS = /\?/;

export function generatePostCallAnalysis(input: PostCallAnalysisInput): PostCallAnalysisResult {
  const clinicLines = input.transcript.filter((l) => l.speaker === "Clinic");
  const jamilLines = input.transcript.filter((l) => l.speaker === "Jamil");
  const allClinicText = clinicLines.map((l) => l.text).join(" ");

  let directoryPermissionResult = "unknown";
  if (PERMISSION_PATTERNS.test(allClinicText)) directoryPermissionResult = "granted";
  else if (DECLINE_PATTERNS.test(allClinicText)) directoryPermissionResult = "declined";

  const clinicQuestions = clinicLines.filter((l) => QUESTION_PATTERNS.test(l.text)).map((l) => l.text);
  const objectionsRaised: string[] = [];
  if (/free|catch|fee/i.test(allClinicText)) objectionsRaised.push("listing_cost");
  if (/sell|sales|marketing/i.test(allClinicText)) objectionsRaised.push("sales_concern");
  if (/busy|bad time/i.test(allClinicText)) objectionsRaised.push("timing");
  if (/not interested/i.test(allClinicText)) objectionsRaised.push("not_interested");

  const infoKeys = ["listingContact", "bookingMethod", "acceptingPatients", "services", "email"];
  const informationCollected: Record<string, unknown> = {};
  const informationMissing: string[] = [];
  for (const key of infoKeys) {
    if (input.qualification[key]) informationCollected[key] = input.qualification[key];
    else informationMissing.push(key);
  }

  const usedCount = input.copilotSuggestions.filter((s) => s.was_used).length;
  const contactReached = clinicLines.length > 0;
  const decisionMakerStatus = input.qualification.decisionMakerReached ? "reached" : contactReached ? "unknown" : "not_reached";

  const complianceConcerns: string[] = [];
  if (input.consentStatus === "declined" && input.recordingStatus === "active") {
    complianceConcerns.push("Recording may have continued after consent declined");
  }
  if (input.consentStatus === "pending" && input.recordingStatus === "active") {
    complianceConcerns.push("Recording active before consent confirmed");
  }

  const transcriptScore = Math.min(1, clinicLines.length / Math.max(1, input.transcript.length));
  const recordingScore = input.recordingStatus === "uploaded" || input.recordingStatus === "finalized" ? 0.9 : 0.4;
  const callQualityScore = Math.round(
    ((contactReached ? 0.3 : 0) +
      (directoryPermissionResult === "granted" ? 0.4 : directoryPermissionResult === "declined" ? 0.1 : 0.15) +
      transcriptScore * 0.2 +
      recordingScore * 0.1) *
      100,
  ) / 100;

  const trainingEligibilityRecommendation: PostCallAnalysisResult["trainingEligibilityRecommendation"] =
    input.consentStatus === "verbal_consent_obtained" || input.consentStatus === "not_required"
      ? callQualityScore >= 0.5
        ? "requires_review"
        : "excluded"
      : "excluded";

  return {
    summary: contactReached
      ? `Directory-permission call with ${input.clinicName}. ${clinicLines.length} clinic utterances over ${input.durationSec}s. Permission: ${directoryPermissionResult}.`
      : `Call attempt to ${input.clinicName} — no clinic responses captured.`,
    directoryPermissionResult,
    contactReached,
    decisionMakerStatus,
    informationCollected,
    informationMissing,
    clinicQuestions,
    objectionsRaised,
    operatorResponses: jamilLines.slice(-5).map((l) => l.text),
    copilotSuggestionsSummary: { shown: input.copilotSuggestions.length, used: usedCount },
    strongMoments: directoryPermissionResult === "granted" ? ["Directory permission obtained"] : [],
    weakMoments: informationMissing.length > 2 ? ["Key listing details not collected"] : [],
    missedOpportunities: [],
    complianceConcerns,
    followUpAction:
      directoryPermissionResult === "granted"
        ? "Send verification email and complete listing review"
        : directoryPermissionResult === "declined"
          ? "Respect decline; optional one-page email if requested"
          : "Schedule callback with listing decision-maker",
    recommendedFollowUpDate: directoryPermissionResult === "granted" ? null : new Date(Date.now() + 3 * 86400000).toISOString(),
    clinicInterestLevel: directoryPermissionResult === "granted" ? "warm" : DECLINE_PATTERNS.test(allClinicText) ? "cold" : "unknown",
    callQualityScore,
    transcriptConfidenceScore: Math.round(transcriptScore * 100) / 100,
    recordingQualityScore: recordingScore,
    trainingEligibilityRecommendation,
  };
}
