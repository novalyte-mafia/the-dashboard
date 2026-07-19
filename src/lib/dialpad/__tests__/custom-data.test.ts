import { describe, expect, it } from "vitest";
import { buildCustomData, parseCustomData, CUSTOM_DATA_MAX_LENGTH } from "../custom-data";

describe("dialpad custom_data", () => {
  const input = {
    callSessionId: "prospect_calls_abc-123",
    clinicId: "prospect_clinics_def-456",
    contactId: null,
    campaignId: null,
    operatorUserId: "admin_members_xyz-789",
  };

  it("round-trips through serialization", () => {
    const serialized = buildCustomData(input);
    expect(serialized.length).toBeLessThan(CUSTOM_DATA_MAX_LENGTH);
    const parsed = parseCustomData(serialized);
    expect(parsed).not.toBeNull();
    expect(parsed!.call_session_id).toBe(input.callSessionId);
    expect(parsed!.clinic_id).toBe(input.clinicId);
    expect(parsed!.contact_id).toBeNull();
    expect(parsed!.operator_user_id).toBe(input.operatorUserId);
    expect(parsed!.source).toBe("novalyte-command-center");
    expect(parsed!.v).toBe(1);
  });

  it("contains only identifiers (no PII keys)", () => {
    const parsed = JSON.parse(buildCustomData(input));
    expect(Object.keys(parsed).sort()).toEqual(
      ["v", "call_session_id", "clinic_id", "contact_id", "campaign_id", "operator_user_id", "source"].sort(),
    );
  });

  it("rejects malformed provider custom_data safely", () => {
    expect(parseCustomData(null)).toBeNull();
    expect(parseCustomData("")).toBeNull();
    expect(parseCustomData("not json")).toBeNull();
    expect(parseCustomData("{}")).toBeNull();
    expect(parseCustomData(JSON.stringify({ v: 2, call_session_id: "x" }))).toBeNull();
  });

  it("enforces the size ceiling", () => {
    expect(() =>
      buildCustomData({ ...input, campaignId: "x".repeat(CUSTOM_DATA_MAX_LENGTH) }),
    ).toThrow();
  });
});
