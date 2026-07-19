import { describe, expect, it } from "vitest";
import { MOCK_ERROR_NUMBERS, buildMockCallDetails, buildMockTranscript, computeMockProgress } from "../mock";

const NUMBER = "+16015551234";

describe("mock call progression", () => {
  it("derives state deterministically from elapsed time", () => {
    const start = Date.now();
    expect(computeMockProgress(start, NUMBER, start + 1000).status).toBe("initiating");
    expect(computeMockProgress(start, NUMBER, start + 3000).status).toBe("ringing");
    expect(computeMockProgress(start, NUMBER, start + 10_000).status).toBe("connected");
    const done = computeMockProgress(start, NUMBER, start + 60_000);
    expect(done.status).toBe("completed");
    expect(done.durationMs).toBeGreaterThan(0);
    expect(done.transcriptReady).toBe(true);
    expect(done.recordingReady).toBe(true);
  });

  it("simulates delayed transcript availability", () => {
    const start = Date.now();
    const justEnded = computeMockProgress(start, NUMBER, start + 25_000);
    expect(justEnded.status).toBe("completed");
    expect(justEnded.transcriptReady).toBe(false);
    const later = computeMockProgress(start, NUMBER, start + 45_000);
    expect(later.transcriptReady).toBe(true);
  });

  it("simulates a never-answered call", () => {
    const start = Date.now();
    const progress = computeMockProgress(start, MOCK_ERROR_NUMBERS.NO_ANSWER, start + 60_000);
    expect(progress.status).toBe("canceled");
    expect(progress.connectedAtMs).toBeNull();
  });

  it("simulates a mid-call failure", () => {
    const start = Date.now();
    const progress = computeMockProgress(start, MOCK_ERROR_NUMBERS.MID_CALL_FAILURE, start + 60_000);
    expect(progress.status).toBe("failed");
    expect(progress.connectedAtMs).not.toBeNull();
  });

  it("builds provider-shaped call details", () => {
    const start = Date.now() - 60_000;
    const details = buildMockCallDetails({
      providerCallId: "mock-abc",
      externalNumber: NUMBER,
      internalNumber: "+15550001000",
      customData: null,
      startedAtMs: start,
    });
    expect(details.state).toBe("hangup");
    expect(details.direction).toBe("outbound");
    expect(details.external_number).toBe(NUMBER);
    expect(details.recording_details!.length).toBeGreaterThan(0);
  });

  it("builds a provider-shaped transcript", () => {
    const transcript = buildMockTranscript("mock-abc", Date.now());
    expect(transcript.lines!.length).toBeGreaterThan(3);
    expect(transcript.lines!.some((l) => l.type === "moment")).toBe(true);
    expect(transcript.lines!.some((l) => l.user_id != null)).toBe(true);
    expect(transcript.lines!.some((l) => l.contact_id != null)).toBe(true);
  });
});
