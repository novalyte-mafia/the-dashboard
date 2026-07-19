/**
 * Dialpad provider types, derived from the official OpenAPI definitions:
 * - POST /api/v2/call            (protos.call.RingCallMessage / RingCallProto)
 * - GET  /api/v2/call/{id}       (protos.call.CallProto)
 * - GET  /api/v2/call            (protos.call.CallCollection)
 * - GET  /api/v2/transcripts/{id}(protos.transcript.TranscriptProto)
 * - POST /api/v2/webhooks        (protos.webhook.WebhookProto)
 * - POST /api/v2/subscriptions/call (protos.call_event_subscription.*)
 * - Call events doc: https://developers.dialpad.com/docs/call-events
 *
 * Provider payloads are treated as untrusted; runtime validation lives in
 * schemas.ts. These types describe the documented shape only.
 */

// ---------------------------------------------------------------------------
// Requests
// ---------------------------------------------------------------------------

export interface DialpadRingCallRequest {
  phone_number: string; // E.164
  user_id: number;
  outbound_caller_id?: string | null;
  custom_data?: string | null;
  device_id?: string | null;
  is_consult?: boolean;
  group_id?: number | null;
  group_type?: "callcenter" | "department" | "office" | null;
}

export interface DialpadCreateWebhookRequest {
  hook_url: string;
  secret?: string | null;
}

export type DialpadCallState =
  | "preanswer"
  | "calling"
  | "ringing"
  | "connected"
  | "merged"
  | "hold"
  | "queued"
  | "parked"
  | "hangup"
  | "missed"
  | "voicemail"
  | "voicemail_uploaded"
  | "blocked"
  | "eavesdrop"
  | "monitor"
  | "barge"
  | "takeover"
  | "admin"
  | "transcription"
  | "call_transcription"
  | "recording"
  | "dispositions"
  | "csat"
  | "pcsat"
  | "recap_summary"
  | "recap_outcome"
  | "recap_purposes"
  | "recap_action_items"
  | "ai_playbook"
  | "all";

export interface DialpadCreateCallEventSubscriptionRequest {
  endpoint_id: number;
  call_states?: DialpadCallState[];
  enabled?: boolean;
  target_type?: "user" | "office" | "department" | "callcenter" | null;
  target_id?: number | null;
  group_calls_only?: boolean | null;
}

// ---------------------------------------------------------------------------
// Responses
// ---------------------------------------------------------------------------

export interface DialpadRingCallResponse {
  call_id?: number | null;
}

export interface DialpadParty {
  phone?: string | null;
  type?: string | null;
  id?: string | number | null;
  email?: string | null;
  name?: string | null;
  office_id?: number | null;
}

export interface DialpadRecordingDetail {
  id?: string | null;
  url?: string | null;
  duration?: number | null; // ms
  start_time?: number | null; // unix ms
  recording_type?: "admincallrecording" | "callrecording" | "voicemail" | null;
}

export interface DialpadCall {
  call_id?: number | null;
  state?: string | null;
  direction?: "inbound" | "outbound" | null;
  date_started?: number | null;
  date_rang?: number | null;
  date_connected?: number | null;
  date_ended?: number | null;
  duration?: number | null; // ms
  total_duration?: number | null; // ms
  internal_number?: string | null;
  external_number?: string | null;
  custom_data?: string | null;
  contact?: DialpadParty | null;
  target?: DialpadParty | null;
  proxy_target?: DialpadParty | null;
  entry_point_call_id?: number | null;
  operator_call_id?: number | null;
  master_call_id?: number | null;
  is_transferred?: boolean | null;
  was_recorded?: boolean | null;
  recording_details?: DialpadRecordingDetail[] | null;
  transcription_text?: string | null;
  voicemail_link?: string | null;
  event_timestamp?: number | null;
  mos_score?: number | null;
  labels?: string[] | null;
  recap_summary?: string | null;
  recap_outcome?: string | null;
}

export interface DialpadCallCollection {
  cursor?: string | null;
  items?: DialpadCall[] | null;
}

export interface DialpadTranscriptLine {
  content?: string | null;
  name?: string | null;
  time?: string | null; // ISO date-time
  type?: "transcript" | "moment" | "real_time_moment" | "custom_moment" | "ai_question" | null;
  user_id?: number | null;
  contact_id?: string | null;
}

export interface DialpadTranscript {
  call_id?: number | string | null;
  lines?: DialpadTranscriptLine[] | null;
}

export interface DialpadWebhook {
  id?: number | string | null;
  hook_url?: string | null;
  signature?: { algo?: string | null; type?: string | null; secret?: string | null } | null;
}

export interface DialpadCallEventSubscription {
  id?: number | string | null;
  call_states?: string[] | null;
  enabled?: boolean | null;
  webhook?: DialpadWebhook | null;
  target_type?: string | null;
  target_id?: number | null;
}

/** Webhook call-event payload (superset; fields vary per state). */
export interface DialpadCallEventPayload extends DialpadCall {
  /** unix ms; use for ordering — events may arrive out of order. */
  event_timestamp?: number | null;
}

// ---------------------------------------------------------------------------
// Normalized domain model
// ---------------------------------------------------------------------------

export type NormalizedCallStatus =
  | "queued"
  | "initiating"
  | "ringing"
  | "connected"
  | "active"
  | "held"
  | "transferred"
  | "completed"
  | "canceled"
  | "failed"
  | "missed"
  | "voicemail"
  | "unknown";

export const TERMINAL_CALL_STATUSES: readonly NormalizedCallStatus[] = [
  "completed",
  "canceled",
  "failed",
  "missed",
] as const;

export interface DialpadCustomData {
  v: 1;
  call_session_id: string;
  clinic_id: string;
  contact_id: string | null;
  campaign_id: string | null;
  operator_user_id: string;
  source: string;
}
