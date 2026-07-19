import { describe, expect, it } from "vitest";
import { isE164, maskPhone, normalizeToE164 } from "../phone";

describe("normalizeToE164", () => {
  it("passes through valid E.164", () => {
    expect(normalizeToE164("+16015551234")).toBe("+16015551234");
    expect(normalizeToE164("+44 20 7946 0958")).toBe("+442079460958");
  });

  it("normalizes 10-digit US numbers", () => {
    expect(normalizeToE164("(601) 555-1234")).toBe("+16015551234");
    expect(normalizeToE164("601.555.1234")).toBe("+16015551234");
    expect(normalizeToE164("601 555 1234")).toBe("+16015551234");
  });

  it("normalizes 11-digit numbers starting with 1", () => {
    expect(normalizeToE164("1-601-555-1234")).toBe("+16015551234");
  });

  it("rejects invalid input", () => {
    expect(normalizeToE164("")).toBeNull();
    expect(normalizeToE164(null)).toBeNull();
    expect(normalizeToE164(undefined)).toBeNull();
    expect(normalizeToE164("not a phone")).toBeNull();
    expect(normalizeToE164("12345")).toBeNull();
    expect(normalizeToE164("0615551234")).toBeNull(); // NANP cannot start with 0
    expect(normalizeToE164("+0123456789")).toBeNull(); // E.164 cannot start +0
  });

  it("isE164 validates strictly", () => {
    expect(isE164("+16015551234")).toBe(true);
    expect(isE164("16015551234")).toBe(false);
    expect(isE164("+1601555123456789")).toBe(false); // too long
  });

  it("maskPhone never reveals the full number", () => {
    expect(maskPhone("+16015551234")).not.toContain("5551234");
    expect(maskPhone(null)).toBe("(none)");
  });
});
