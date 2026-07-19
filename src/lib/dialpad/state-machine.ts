import { TERMINAL_CALL_STATUSES, type NormalizedCallStatus } from "./types";

/**
 * Normalized call-state transition rules.
 *
 * Dialpad webhook events can be duplicated and can arrive out of order, so
 * transitions are validated by rank + event timestamp instead of assuming
 * arrival order equals call-state order.
 *
 * Guarantees:
 *  - A late "ringing" never overwrites "completed".
 *  - Duplicate events are no-ops.
 *  - A terminal event with a later timestamp finalizes an active call.
 *  - Lateral moves (connected <-> held) require a newer event timestamp.
 *  - Unknown states never regress a known state.
 */

const STATUS_RANK: Record<NormalizedCallStatus, number> = {
  unknown: 0,
  queued: 1,
  initiating: 2,
  ringing: 3,
  connected: 4,
  active: 4,
  held: 4,
  voicemail: 5,
  transferred: 5,
  completed: 6,
  canceled: 6,
  failed: 6,
  missed: 6,
};

export function isTerminalStatus(status: NormalizedCallStatus): boolean {
  return (TERMINAL_CALL_STATUSES as readonly string[]).includes(status);
}

export interface TransitionInput {
  currentStatus: NormalizedCallStatus;
  /** Timestamp of the event that produced the current status (ms), if known. */
  currentEventAtMs: number | null;
  nextStatus: NormalizedCallStatus;
  nextEventAtMs: number | null;
}

export interface TransitionDecision {
  apply: boolean;
  reason:
    | "advance"
    | "lateral_newer"
    | "terminal_finalize"
    | "duplicate"
    | "stale_event"
    | "regression_blocked"
    | "terminal_locked"
    | "unknown_ignored";
}

export function decideTransition(input: TransitionInput): TransitionDecision {
  const { currentStatus, currentEventAtMs, nextStatus, nextEventAtMs } = input;
  const curRank = STATUS_RANK[currentStatus] ?? 0;
  const nextRank = STATUS_RANK[nextStatus] ?? 0;
  const isNewer =
    nextEventAtMs === null || currentEventAtMs === null ? true : nextEventAtMs > currentEventAtMs;

  if (nextStatus === currentStatus) {
    return { apply: false, reason: "duplicate" };
  }

  // Never map a known status back to unknown.
  if (nextStatus === "unknown" && currentStatus !== "unknown") {
    return { apply: false, reason: "unknown_ignored" };
  }

  if (isTerminalStatus(currentStatus)) {
    // Terminal states are locked; a different terminal state with a strictly
    // newer timestamp may correct the final disposition (e.g. missed ->
    // voicemail is not terminal->terminal, but failed -> completed is).
    if (isTerminalStatus(nextStatus) && nextEventAtMs !== null && currentEventAtMs !== null && nextEventAtMs > currentEventAtMs) {
      return { apply: true, reason: "terminal_finalize" };
    }
    return { apply: false, reason: "terminal_locked" };
  }

  if (isTerminalStatus(nextStatus)) {
    // Terminal events finalize active calls when not older than the current
    // state's event.
    if (isNewer || nextEventAtMs === null) {
      return { apply: true, reason: "terminal_finalize" };
    }
    return { apply: false, reason: "stale_event" };
  }

  if (nextRank > curRank) {
    return { apply: true, reason: "advance" };
  }

  if (nextRank === curRank && isNewer) {
    // connected <-> held oscillation and similar lateral moves.
    return { apply: true, reason: "lateral_newer" };
  }

  if (nextRank < curRank) {
    return { apply: false, reason: "regression_blocked" };
  }

  return { apply: false, reason: "stale_event" };
}
