import "server-only";
import type { DialpadCall, DialpadTranscript, NormalizedCallStatus } from "./types";

/**
 * Mock Dialpad provider for local development and automated tests.
 *
 * Guarantees:
 * - never contacts Dialpad,
 * - never dials real numbers,
 * - serverless-safe: call progress derives deterministically from elapsed
 *   time since initiation (no in-memory timers).
 *
 * Special test numbers simulate provider failures:
 *   +15550000429  rate limited at initiation
 *   +15550000500  provider unavailable at initiation
 *   +15550000404  no active Dialpad device
 *   +15550000486  never answered (ends canceled)
 *   +15550000000  drops mid-call (ends failed)
 */

export const MOCK_ERROR_NUMBERS = {
  RATE_LIMITED: "+15550000429",
  PROVIDER_UNAVAILABLE: "+15550000500",
  NO_ACTIVE_DEVICE: "+15550000404",
  NO_ANSWER: "+15550000486",
  MID_CALL_FAILURE: "+15550000000",
} as const;

// Mock call timeline (seconds since initiation).
const RINGING_AT_SEC = 2;
const CONNECTED_AT_SEC = 6;
const COMPLETED_AT_SEC = 24;
const RECORDING_READY_AT_SEC = 32;
const TRANSCRIPT_READY_AT_SEC = 40;

export function mockProviderCallId(callSessionId: string): string {
  // Stable, clearly-mock provider id derived from the session.
  return `mock-${callSessionId.replace(/[^a-zA-Z0-9]/g, "").slice(-16)}`;
}

export interface MockCallProgress {
  status: NormalizedCallStatus;
  ringingAtMs: number | null;
  connectedAtMs: number | null;
  endedAtMs: number | null;
  durationMs: number | null;
  eventTimestampMs: number;
  recordingReady: boolean;
  transcriptReady: boolean;
}

/** Derives the current mock call state from time elapsed since initiation. */
export function computeMockProgress(startedAtMs: number, externalNumber: string, nowMs = Date.now()): MockCallProgress {
  const elapsedSec = (nowMs - startedAtMs) / 1000;
  const ringingAtMs = startedAtMs + RINGING_AT_SEC * 1000;
  const connectedAtMs = startedAtMs + CONNECTED_AT_SEC * 1000;
  const completedAtMs = startedAtMs + COMPLETED_AT_SEC * 1000;

  if (externalNumber === MOCK_ERROR_NUMBERS.NO_ANSWER) {
    if (elapsedSec < RINGING_AT_SEC) {
      return base("initiating", startedAtMs);
    }
    if (elapsedSec < COMPLETED_AT_SEC) {
      return { ...base("ringing", ringingAtMs), ringingAtMs };
    }
    return { ...base("canceled", completedAtMs), ringingAtMs, endedAtMs: completedAtMs };
  }

  if (externalNumber === MOCK_ERROR_NUMBERS.MID_CALL_FAILURE) {
    if (elapsedSec < RINGING_AT_SEC) return base("initiating", startedAtMs);
    if (elapsedSec < CONNECTED_AT_SEC) return { ...base("ringing", ringingAtMs), ringingAtMs };
    if (elapsedSec < 12) return { ...base("connected", connectedAtMs), ringingAtMs, connectedAtMs };
    const failedAtMs = startedAtMs + 12_000;
    return {
      ...base("failed", failedAtMs),
      ringingAtMs,
      connectedAtMs,
      endedAtMs: failedAtMs,
      durationMs: failedAtMs - connectedAtMs,
    };
  }

  if (elapsedSec < RINGING_AT_SEC) return base("initiating", startedAtMs);
  if (elapsedSec < CONNECTED_AT_SEC) return { ...base("ringing", ringingAtMs), ringingAtMs };
  if (elapsedSec < COMPLETED_AT_SEC) {
    return { ...base("connected", connectedAtMs), ringingAtMs, connectedAtMs };
  }
  return {
    ...base("completed", completedAtMs),
    ringingAtMs,
    connectedAtMs,
    endedAtMs: completedAtMs,
    durationMs: completedAtMs - connectedAtMs,
    recordingReady: elapsedSec >= RECORDING_READY_AT_SEC,
    transcriptReady: elapsedSec >= TRANSCRIPT_READY_AT_SEC,
  };

  function base(status: NormalizedCallStatus, eventTimestampMs: number): MockCallProgress {
    return {
      status,
      ringingAtMs: null,
      connectedAtMs: null,
      endedAtMs: null,
      durationMs: null,
      eventTimestampMs,
      recordingReady: false,
      transcriptReady: false,
    };
  }
}

/** Fixture matching the documented GET /call/{id} response shape. */
export function buildMockCallDetails(input: {
  providerCallId: string;
  externalNumber: string;
  internalNumber: string;
  customData: string | null;
  startedAtMs: number;
}): DialpadCall {
  const progress = computeMockProgress(input.startedAtMs, input.externalNumber);
  return {
    call_id: Number(String(Math.abs(hashCode(input.providerCallId))).slice(0, 12)),
    state: progress.status === "completed" ? "hangup" : progress.status,
    direction: "outbound",
    date_started: input.startedAtMs,
    date_rang: progress.ringingAtMs,
    date_connected: progress.connectedAtMs,
    date_ended: progress.endedAtMs,
    duration: progress.durationMs,
    total_duration: progress.endedAtMs ? progress.endedAtMs - input.startedAtMs : null,
    internal_number: input.internalNumber,
    external_number: input.externalNumber,
    custom_data: input.customData,
    contact: { phone: input.externalNumber, type: "local", id: "mock-contact", name: "Mock Clinic", email: "" },
    target: { phone: input.internalNumber, type: "user", id: 999000111, name: "Mock Operator", email: "mock@novalyte.io" },
    is_transferred: false,
    was_recorded: progress.recordingReady,
    recording_details: progress.recordingReady
      ? [
          {
            id: `${input.providerCallId}-rec-1`,
            url: `https://dialpad.example.invalid/mock-recording/${input.providerCallId}`,
            duration: progress.durationMs,
            start_time: progress.connectedAtMs,
            recording_type: "callrecording",
          },
        ]
      : [],
    event_timestamp: progress.eventTimestampMs,
  };
}

/** Fixture matching the documented GET /transcripts/{call_id} response shape. */
export function buildMockTranscript(providerCallId: string, connectedAtMs: number): DialpadTranscript {
  const t = (offsetSec: number) => new Date(connectedAtMs + offsetSec * 1000).toISOString();
  return {
    call_id: providerCallId,
    lines: [
      { content: "Good afternoon, thanks for calling — how can I help you?", name: "Mock Clinic", time: t(1), type: "transcript", contact_id: "mock-contact" },
      { content: "Hi, this is Jamil with Novalyte AI. I'm calling about including your clinic in our free men's health directory.", name: "Mock Operator", time: t(5), type: "transcript", user_id: 999000111 },
      { content: "Is this a sales call? Does the listing cost anything?", name: "Mock Clinic", time: t(10), type: "transcript", contact_id: "mock-contact" },
      { content: "price_inquiry", name: "Mock Clinic", time: t(10), type: "moment", contact_id: "mock-contact" },
      { content: "No — the directory listing is completely free. I just need permission to list your public details.", name: "Mock Operator", time: t(14), type: "transcript", user_id: 999000111 },
      { content: "That sounds fine. Go ahead and list us.", name: "Mock Clinic", time: t(17), type: "transcript", contact_id: "mock-contact" },
    ],
  };
}

function hashCode(value: string): number {
  let hash = 0;
  for (let i = 0; i < value.length; i++) {
    hash = (hash << 5) - hash + value.charCodeAt(i);
    hash |= 0;
  }
  return hash;
}
