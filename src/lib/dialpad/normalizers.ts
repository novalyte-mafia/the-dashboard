import type { ValidatedDialpadCallEvent } from "./schemas";
import type { NormalizedCallStatus } from "./types";

/**
 * Provider-payload -> domain normalization. Keeps Dialpad-specific shapes out
 * of the rest of the application.
 */

/**
 * Maps a Dialpad call state to the normalized status.
 * Unknown provider states map to "unknown" and are preserved in metadata by
 * the caller — they must never crash processing.
 */
export function mapDialpadState(
  state: string | null | undefined,
  context: { isTransferred?: boolean | null; dateConnected?: number | null } = {},
): NormalizedCallStatus {
  switch ((state ?? "").toLowerCase()) {
    case "preanswer":
      return "initiating";
    case "calling":
    case "ringing":
      return "ringing";
    case "connected":
    case "merged":
    case "barge":
    case "takeover":
      return "connected";
    case "hold":
    case "parked":
      return "held";
    case "queued":
      return "queued";
    case "voicemail":
    case "voicemail_uploaded":
      return "voicemail";
    case "missed":
      return "missed";
    case "blocked":
      return "failed";
    case "hangup":
      if (context.isTransferred) return "transferred";
      // A hangup with no connection is effectively an unanswered/canceled call.
      return context.dateConnected ? "completed" : "canceled";
    default:
      return "unknown";
  }
}

/** States that describe post-call artifacts rather than live transitions. */
export function isEnrichmentSignal(state: string | null | undefined): boolean {
  return [
    "recording",
    "call_transcription",
    "transcription",
    "recap_summary",
    "recap_outcome",
    "recap_purposes",
    "recap_action_items",
    "ai_playbook",
    "dispositions",
    "csat",
    "pcsat",
  ].includes((state ?? "").toLowerCase());
}

/** Idempotency key for a provider event. */
export function buildEventKey(payload: ValidatedDialpadCallEvent): string {
  const callId = payload.call_id ?? "nocall";
  const state = payload.state ?? "nostate";
  const ts = payload.event_timestamp ?? payload.date_ended ?? payload.date_connected ?? payload.date_started ?? 0;
  return `${callId}:${state}:${ts}`;
}

export interface NormalizedTranscriptSegment {
  sequenceNum: number;
  speakerLabel: string;
  speakerRole: "operator" | "contact" | "unknown";
  text: string;
  segmentType: string;
  startedAt: string | null; // ISO
  providerMetadata: Record<string, unknown>;
}

/**
 * Normalizes Dialpad transcript lines. Dialpad lines carry a spoken-at time
 * and speaker identity but no confidence and no end time — those are left
 * null rather than invented.
 */
export function normalizeTranscriptLines(
  lines: Array<{
    content?: string | null;
    name?: string | null;
    time?: string | null;
    type?: string | null;
    user_id?: number | string | null;
    contact_id?: string | null;
  }>,
): NormalizedTranscriptSegment[] {
  return lines
    .filter((l) => typeof l.content === "string" && l.content.trim().length > 0)
    .map((line, index) => {
      let startedAt: string | null = null;
      if (line.time) {
        // Dialpad emits times like "2018-05-08T21:33:19.300000" without a
        // zone designator; they are UTC, so parse them as such rather than
        // as server-local time.
        const raw = /[zZ]|[+-]\d{2}:?\d{2}$/.test(line.time.trim()) ? line.time.trim() : `${line.time.trim()}Z`;
        const parsed = new Date(raw);
        if (!Number.isNaN(parsed.getTime())) startedAt = parsed.toISOString();
      }
      const speakerRole: NormalizedTranscriptSegment["speakerRole"] =
        line.user_id != null ? "operator" : line.contact_id != null ? "contact" : "unknown";
      return {
        sequenceNum: index,
        speakerLabel: line.name?.trim() || (speakerRole === "operator" ? "Operator" : "Contact"),
        speakerRole,
        text: line.content!.trim(),
        segmentType: line.type ?? "transcript",
        startedAt,
        providerMetadata: {
          user_id: line.user_id ?? null,
          contact_id: line.contact_id ?? null,
        },
      };
    });
}

/** Millisecond unix timestamp -> ISO string (null-safe). */
export function msToIso(ms: number | null | undefined): string | null {
  if (ms == null || !Number.isFinite(ms)) return null;
  return new Date(ms).toISOString();
}
