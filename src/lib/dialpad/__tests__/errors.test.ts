import { describe, expect, it } from "vitest";
import { DialpadError, isRetryableError, toDialpadError } from "../errors";

describe("dialpad error normalization", () => {
  it("classifies retryable transient failures only", () => {
    expect(isRetryableError(new DialpadError("rate_limited", "x"))).toBe(true);
    expect(isRetryableError(new DialpadError("provider_unavailable", "x"))).toBe(true);
    expect(isRetryableError(new DialpadError("timeout", "x"))).toBe(true);
    expect(isRetryableError(new DialpadError("network_error", "x"))).toBe(true);
    // Validation and auth failures are never retried.
    expect(isRetryableError(new DialpadError("invalid_request", "x"))).toBe(false);
    expect(isRetryableError(new DialpadError("invalid_credentials", "x"))).toBe(false);
    expect(isRetryableError(new DialpadError("forbidden", "x"))).toBe(false);
    expect(isRetryableError(new Error("plain"))).toBe(false);
  });

  it("maps codes to appropriate API statuses", () => {
    expect(new DialpadError("rate_limited", "x").apiStatus).toBe(429);
    expect(new DialpadError("do_not_call", "x").apiStatus).toBe(409);
    expect(new DialpadError("duplicate_call", "x").apiStatus).toBe(409);
    expect(new DialpadError("invalid_phone_number", "x").apiStatus).toBe(400);
    expect(new DialpadError("integration_disabled", "x").apiStatus).toBe(503);
    expect(new DialpadError("webhook_signature_invalid", "x").apiStatus).toBe(401);
    // Provider auth failures never surface as client 401s.
    expect(new DialpadError("invalid_credentials", "x").apiStatus).toBe(502);
  });

  it("preserves retry-after metadata", () => {
    const err = new DialpadError("rate_limited", "x", { retryAfterSec: 42 });
    expect(err.retryAfterSec).toBe(42);
  });

  it("normalizes unknown throwables", () => {
    expect(toDialpadError("boom").code).toBe("unknown");
    const abort = new Error("aborted");
    abort.name = "AbortError";
    expect(toDialpadError(abort).code).toBe("timeout");
    const existing = new DialpadError("not_found", "x");
    expect(toDialpadError(existing)).toBe(existing);
  });
});
