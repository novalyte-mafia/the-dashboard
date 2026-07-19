import { describe, expect, it } from "vitest";
import { decideTransition, isTerminalStatus } from "../state-machine";

describe("call state machine", () => {
  it("advances through the normal lifecycle", () => {
    expect(
      decideTransition({ currentStatus: "initiating", currentEventAtMs: 1000, nextStatus: "ringing", nextEventAtMs: 2000 }).apply,
    ).toBe(true);
    expect(
      decideTransition({ currentStatus: "ringing", currentEventAtMs: 2000, nextStatus: "connected", nextEventAtMs: 3000 }).apply,
    ).toBe(true);
    expect(
      decideTransition({ currentStatus: "connected", currentEventAtMs: 3000, nextStatus: "completed", nextEventAtMs: 9000 }).apply,
    ).toBe(true);
  });

  it("a late ringing event never overwrites completed", () => {
    const decision = decideTransition({
      currentStatus: "completed",
      currentEventAtMs: 9000,
      nextStatus: "ringing",
      nextEventAtMs: 2500,
    });
    expect(decision.apply).toBe(false);
    expect(decision.reason).toBe("terminal_locked");
  });

  it("duplicate events are no-ops", () => {
    const decision = decideTransition({
      currentStatus: "connected",
      currentEventAtMs: 3000,
      nextStatus: "connected",
      nextEventAtMs: 3000,
    });
    expect(decision.apply).toBe(false);
    expect(decision.reason).toBe("duplicate");
  });

  it("a completed event with a later timestamp finalizes an active call", () => {
    const decision = decideTransition({
      currentStatus: "held",
      currentEventAtMs: 5000,
      nextStatus: "completed",
      nextEventAtMs: 8000,
    });
    expect(decision.apply).toBe(true);
    expect(decision.reason).toBe("terminal_finalize");
  });

  it("an out-of-order (stale) terminal event does not finalize", () => {
    const decision = decideTransition({
      currentStatus: "connected",
      currentEventAtMs: 9000,
      nextStatus: "canceled",
      nextEventAtMs: 2000,
    });
    expect(decision.apply).toBe(false);
  });

  it("connected <-> held oscillation applies with newer timestamps", () => {
    expect(
      decideTransition({ currentStatus: "connected", currentEventAtMs: 3000, nextStatus: "held", nextEventAtMs: 4000 }).apply,
    ).toBe(true);
    expect(
      decideTransition({ currentStatus: "held", currentEventAtMs: 4000, nextStatus: "connected", nextEventAtMs: 5000 }).apply,
    ).toBe(true);
    // Stale lateral move is rejected.
    expect(
      decideTransition({ currentStatus: "held", currentEventAtMs: 4000, nextStatus: "connected", nextEventAtMs: 3500 }).apply,
    ).toBe(false);
  });

  it("unknown states never regress a known state", () => {
    const decision = decideTransition({
      currentStatus: "connected",
      currentEventAtMs: 3000,
      nextStatus: "unknown",
      nextEventAtMs: 4000,
    });
    expect(decision.apply).toBe(false);
    expect(decision.reason).toBe("unknown_ignored");
  });

  it("terminal disposition can be corrected by a strictly newer terminal event", () => {
    expect(
      decideTransition({ currentStatus: "missed", currentEventAtMs: 5000, nextStatus: "completed", nextEventAtMs: 6000 }).apply,
    ).toBe(true);
    expect(
      decideTransition({ currentStatus: "completed", currentEventAtMs: 6000, nextStatus: "missed", nextEventAtMs: 5000 }).apply,
    ).toBe(false);
  });

  it("regressions are blocked", () => {
    const decision = decideTransition({
      currentStatus: "connected",
      currentEventAtMs: 3000,
      nextStatus: "queued",
      nextEventAtMs: 4000,
    });
    expect(decision.apply).toBe(false);
    expect(decision.reason).toBe("regression_blocked");
  });

  it("classifies terminal statuses", () => {
    expect(isTerminalStatus("completed")).toBe(true);
    expect(isTerminalStatus("failed")).toBe(true);
    expect(isTerminalStatus("connected")).toBe(false);
    expect(isTerminalStatus("voicemail")).toBe(false);
  });
});
