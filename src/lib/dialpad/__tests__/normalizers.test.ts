import { describe, expect, it } from "vitest";
import { buildEventKey, isEnrichmentSignal, mapDialpadState, msToIso, normalizeTranscriptLines } from "../normalizers";
import { dialpadCallEventSchema, dialpadTranscriptSchema } from "../schemas";

/** Documented sample payload from https://developers.dialpad.com/docs/call-events */
const HANGUP_FIXTURE = {
  master_call_id: null,
  date_ended: 1582853818129,
  internal_number: "+16010123456",
  duration: 16464.904000000002,
  total_duration: 19303.775000000001,
  entry_point_target: {},
  proxy_target: {},
  call_dispositions: null,
  entry_point_call_id: null,
  operator_call_id: null,
  call_id: 4978137078431744,
  state: "hangup",
  date_started: 1582853788099,
  transcription_text: null,
  direction: "outbound",
  date_connected: 1582853801664,
  voicemail_link: null,
  is_transferred: false,
  was_recorded: false,
  date_rang: null,
  target: { phone: "+16010123456", type: "user", id: 5908860123456789, name: "sample", email: "test@dialpad.com", office_id: 4632479632575683 },
  contact: { phone: "+16043111111", type: "google", id: "http://www.google.com/m8/feeds/contacts/x", name: "Test", email: "" },
  group_id: null,
  external_number: "+16043111111",
};

describe("dialpad payload validation", () => {
  it("accepts the documented hangup fixture", () => {
    const parsed = dialpadCallEventSchema.safeParse(HANGUP_FIXTURE);
    expect(parsed.success).toBe(true);
  });

  it("accepts the documented transcript fixture", () => {
    const parsed = dialpadTranscriptSchema.safeParse({
      call_id: "1001",
      lines: [
        { contact_id: "abc", content: "hi", name: "(415) 555-6666", time: "2018-05-08T21:33:19.300000", type: "transcript" },
        { content: "hello", name: "Bot", time: "2018-05-08T21:33:15.300000", type: "transcript", user_id: 2 },
        { content: "price_inquiry", name: "Bot", time: "2018-05-08T21:33:17.300000", type: "moment", user_id: 2 },
      ],
    });
    expect(parsed.success).toBe(true);
  });
});

describe("state mapping", () => {
  it("maps documented states", () => {
    expect(mapDialpadState("calling")).toBe("ringing");
    expect(mapDialpadState("ringing")).toBe("ringing");
    expect(mapDialpadState("preanswer")).toBe("initiating");
    expect(mapDialpadState("connected")).toBe("connected");
    expect(mapDialpadState("hold")).toBe("held");
    expect(mapDialpadState("queued")).toBe("queued");
    expect(mapDialpadState("missed")).toBe("missed");
    expect(mapDialpadState("voicemail")).toBe("voicemail");
  });

  it("maps hangup based on connection and transfer context", () => {
    expect(mapDialpadState("hangup", { dateConnected: 123 })).toBe("completed");
    expect(mapDialpadState("hangup", { dateConnected: null })).toBe("canceled");
    expect(mapDialpadState("hangup", { isTransferred: true, dateConnected: 123 })).toBe("transferred");
  });

  it("maps unknown provider states to unknown without crashing", () => {
    expect(mapDialpadState("some_future_state")).toBe("unknown");
    expect(mapDialpadState(null)).toBe("unknown");
    expect(mapDialpadState(undefined)).toBe("unknown");
  });

  it("classifies enrichment signals separately from live states", () => {
    expect(isEnrichmentSignal("recording")).toBe(true);
    expect(isEnrichmentSignal("call_transcription")).toBe(true);
    expect(isEnrichmentSignal("recap_summary")).toBe(true);
    expect(isEnrichmentSignal("connected")).toBe(false);
    expect(isEnrichmentSignal("hangup")).toBe(false);
  });
});

describe("event idempotency keys", () => {
  it("is stable for identical payloads", () => {
    const a = dialpadCallEventSchema.parse(HANGUP_FIXTURE);
    const b = dialpadCallEventSchema.parse(JSON.parse(JSON.stringify(HANGUP_FIXTURE)));
    expect(buildEventKey(a)).toBe(buildEventKey(b));
  });

  it("differs across states and timestamps", () => {
    const base = dialpadCallEventSchema.parse(HANGUP_FIXTURE);
    const other = { ...base, state: "connected" };
    expect(buildEventKey(base)).not.toBe(buildEventKey(other));
  });
});

describe("transcript normalization", () => {
  it("normalizes speakers and preserves order without inventing data", () => {
    const segments = normalizeTranscriptLines([
      { content: "hi there", name: "(415) 555-6666", time: "2018-05-08T21:33:19.300000", type: "transcript", contact_id: "c1" },
      { content: "hello!", name: "Operator Bob", time: "2018-05-08T21:33:21.300000", type: "transcript", user_id: 2 },
      { content: "price_inquiry", name: "Operator Bob", time: "2018-05-08T21:33:22.300000", type: "moment", user_id: 2 },
      { content: "   ", name: "noise", time: null, type: "transcript" },
    ]);
    expect(segments).toHaveLength(3); // blank line dropped
    expect(segments[0].speakerRole).toBe("contact");
    expect(segments[1].speakerRole).toBe("operator");
    expect(segments[2].segmentType).toBe("moment");
    expect(segments.map((s) => s.sequenceNum)).toEqual([0, 1, 2]);
    // No invented confidence/end timestamps.
    expect(Object.keys(segments[0])).not.toContain("confidence");
    expect(segments[0].startedAt).toContain("2018-05-08");
  });

  it("handles unparseable times as null", () => {
    const segments = normalizeTranscriptLines([{ content: "hi", time: "garbage", type: "transcript" }]);
    expect(segments[0].startedAt).toBeNull();
  });
});

describe("msToIso", () => {
  it("converts and null-guards", () => {
    expect(msToIso(1582853818129)).toBe("2020-02-28T01:36:58.129Z");
    expect(msToIso(null)).toBeNull();
    expect(msToIso(undefined)).toBeNull();
    expect(msToIso(Number.NaN)).toBeNull();
  });
});
