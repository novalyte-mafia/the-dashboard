export const CALL_GOALS = [
  "Find decision-maker",
  "Verify listing",
  "Request permission",
  "Book follow-up",
  "Re-engage",
] as const;

export type CallGoal = (typeof CALL_GOALS)[number];

export const COACH_STAGES = [
  "opening",
  "routing",
  "relevance",
  "discovery",
  "objection",
  "ask",
  "wrap_up",
  "reset",
] as const;

export type CoachStage = (typeof COACH_STAGES)[number];

export const RISK_FLAGS = [
  "none",
  "unverified_claim",
  "sensitive_question",
  "consent_or_recording",
  "handoff_needed",
] as const;

export type RiskFlag = (typeof RISK_FLAGS)[number];

export const NEXT_ACTIONS = [
  "ask_question",
  "pause",
  "listen",
  "schedule_followup",
  "handoff",
  "wrap_up",
] as const;

export type CoachNextAction = (typeof NEXT_ACTIONS)[number];

export type TranscriptSpeaker = "founder" | "prospect" | "unknown";

export interface TranscriptTurn {
  id: string;
  speaker: TranscriptSpeaker;
  text: string;
  at: string;
  confident: boolean;
  words?: number;
  durationMs?: number;
}

export interface CoachSuggestion {
  stage: CoachStage;
  say_next: string;
  delivery_cue: string;
  reason: string;
  risk_flag: RiskFlag;
  next_action: CoachNextAction;
  tone?: "Calm" | "Warm" | "Direct";
  alternate?: string;
  source?: "glm" | "gemini" | "fallback" | "reset";
}

export interface TalkListenMetrics {
  founderMs: number;
  listenMs: number;
  talkListenLabel: string;
  longestFounderMonologueMs: number;
  questionCount: number;
  interruptionCount: number;
  wordsPerMinute: number;
  fillerCount: number;
  silenceOver4sCount: number;
  talkingTooLong: boolean;
  supportiveCue: string;
}

export interface PrepFields {
  myGoal: string;
  valueProposition: string;
  desiredNextStep: string;
  mustNotClaim: string;
  notesToRemember: string;
}

export interface ClinicContextPayload {
  clinic_id: string | null;
  is_seed: boolean;
  clinic_name: string;
  location: string;
  clinic_type: string;
  phone: string;
  website: string;
  address: string;
  known_services: string;
  contact_name: string;
  contact_role: string;
  contact_id: string | null;
  email: string;
  readiness_score: string;
  status: string;
  directory_status: string;
  previous_calls: string;
  notes: string;
  call_goal: CallGoal;
  approved_value_proposition: string;
  prohibited_claims: string[];
  missing_facts: string[];
}

export interface CoachingEvent {
  at: string;
  type: "coach" | "stuck" | "reset" | "pause" | "resume" | "metric" | "note";
  detail: string;
  suggestion?: CoachSuggestion;
}

export interface ExtractedContact {
  firstName: string;
  lastName: string;
  title: string;
  email: string;
  phone: string;
  isDecisionMaker: boolean;
}

export interface VerifiedClinicFields {
  phone: string;
  email: string;
  services: string;
  website: string;
  decisionMaker: string;
  permission: string;
}

export interface Scorecard {
  whatWentWell: string;
  oneImprovement: string;
  shorterPhrase: string;
  nextCallOpening: string;
  coachSummary: string;
  source: "glm" | "gemini" | "fallback";
}

export interface PostCallReview {
  outcome: string;
  decisionMakerStatus: string;
  contactName: string;
  contactRole: string;
  contactEmail: string;
  verifiedDetails: string;
  permissions: string;
  objections: string;
  promisedFollowUp: string;
  nextAction: string;
  followUpDate: string;
  followUpNotes: string;
  notes: string;
  extractedContacts: ExtractedContact[];
  verifiedClinicFields: VerifiedClinicFields;
  objectionTags: string[];
  scorecard: Scorecard;
}

export type MicStatus = "idle" | "ready" | "listening" | "paused" | "connecting";

export type PracticePersonaId =
  | "receptionist"
  | "skeptical_owner"
  | "busy_manager"
  | "friendly_office_manager";

export const CONVERSATION_MAP = [
  { id: "opening", label: "Opening" },
  { id: "routing", label: "Find the right person" },
  { id: "relevance", label: "Explain relevance" },
  { id: "discovery", label: "Ask one discovery question" },
  { id: "ask", label: "Request the next step" },
  { id: "wrap_up", label: "Close professionally" },
] as const;

export const DEFAULT_PREP: PrepFields = {
  myGoal: "Confirm the right person and a short follow-up.",
  valueProposition:
    "We help keep clinic information accurate where people are researching local care.",
  desiredNextStep: "The right contact, email, or a callback time.",
  mustNotClaim:
    "No ranking, traffic, patient-volume, endorsement, medical, or compliance claims.",
  notesToRemember: "",
};

export const PROHIBITED_CLAIMS = [
  "Do not guarantee rankings, leads, traffic, or patient volume",
  "Do not make medical or compliance claims",
  "Do not imply an endorsement or existing relationship",
  "Do not invent clinic services, contact names, or past conversations",
];
