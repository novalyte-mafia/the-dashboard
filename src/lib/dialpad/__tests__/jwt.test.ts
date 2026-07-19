import { describe, expect, it } from "vitest";
import { signHs256Jwt, verifyHs256Jwt, JwtVerificationError } from "../jwt";

const SECRET = "test-webhook-secret";

describe("webhook JWT verification", () => {
  it("verifies a valid HS256 token", () => {
    const payload = { call_id: 4978137078431744, state: "hangup", event_timestamp: 1582853818129 };
    const token = signHs256Jwt(payload, SECRET);
    const verified = verifyHs256Jwt(token, SECRET);
    expect(verified.call_id).toBe(payload.call_id);
    expect(verified.state).toBe("hangup");
  });

  it("rejects a token signed with the wrong secret", () => {
    const token = signHs256Jwt({ state: "ringing" }, "attacker-secret");
    expect(() => verifyHs256Jwt(token, SECRET)).toThrow(JwtVerificationError);
  });

  it("rejects tampered payloads", () => {
    const token = signHs256Jwt({ state: "ringing" }, SECRET);
    const [head, , sig] = token.split(".");
    const forgedBody = Buffer.from(JSON.stringify({ state: "connected" })).toString("base64url");
    expect(() => verifyHs256Jwt(`${head}.${forgedBody}.${sig}`, SECRET)).toThrow(JwtVerificationError);
  });

  it("rejects non-HS256 algorithms including 'none'", () => {
    const head = Buffer.from(JSON.stringify({ alg: "none", typ: "JWT" })).toString("base64url");
    const body = Buffer.from(JSON.stringify({ state: "hangup" })).toString("base64url");
    expect(() => verifyHs256Jwt(`${head}.${body}.`, SECRET)).toThrow(/algorithm/i);
  });

  it("rejects malformed tokens", () => {
    expect(() => verifyHs256Jwt("only.two", SECRET)).toThrow(JwtVerificationError);
    expect(() => verifyHs256Jwt("{}", SECRET)).toThrow(JwtVerificationError);
  });

  it("rejects expired tokens beyond skew", () => {
    const token = signHs256Jwt({ exp: Math.floor(Date.now() / 1000) - 3600 }, SECRET);
    expect(() => verifyHs256Jwt(token, SECRET)).toThrow(/expired/i);
  });

  it("accepts tokens without exp (Dialpad may omit claims)", () => {
    const token = signHs256Jwt({ state: "connected" }, SECRET);
    expect(verifyHs256Jwt(token, SECRET).state).toBe("connected");
  });
});
