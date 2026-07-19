/**
 * Normalized Dialpad error model. Provider payloads and HTTP details are
 * translated into stable codes the application (and UI) can rely on.
 * Never carries secrets.
 */

export type DialpadErrorCode =
  | "integration_disabled"
  | "not_configured"
  | "invalid_credentials"
  | "forbidden"
  | "not_found"
  | "conflict"
  | "rate_limited"
  | "invalid_request"
  | "provider_unavailable"
  | "timeout"
  | "network_error"
  | "invalid_phone_number"
  | "do_not_call"
  | "outside_calling_hours"
  | "duplicate_call"
  | "no_user_mapping"
  | "webhook_signature_invalid"
  | "transcript_not_ready"
  | "transcript_unavailable"
  | "recording_unavailable"
  | "unknown";

export class DialpadError extends Error {
  readonly code: DialpadErrorCode;
  readonly httpStatus?: number;
  /** Seconds until retry is allowed (from Retry-After when present). */
  readonly retryAfterSec?: number;
  /** Provider request id, when the response exposed one. */
  readonly providerRequestId?: string;
  /** Safe for end users. */
  readonly userMessage: string;

  constructor(
    code: DialpadErrorCode,
    userMessage: string,
    options: {
      httpStatus?: number;
      retryAfterSec?: number;
      providerRequestId?: string;
      cause?: unknown;
    } = {},
  ) {
    super(`[dialpad:${code}] ${userMessage}`);
    this.name = "DialpadError";
    this.code = code;
    this.userMessage = userMessage;
    this.httpStatus = options.httpStatus;
    this.retryAfterSec = options.retryAfterSec;
    this.providerRequestId = options.providerRequestId;
    if (options.cause) (this as { cause?: unknown }).cause = options.cause;
  }

  /** HTTP status the dashboard API should surface for this error. */
  get apiStatus(): number {
    switch (this.code) {
      case "integration_disabled":
      case "not_configured":
        return 503;
      case "invalid_credentials":
      case "forbidden":
        return 502; // never leak our provider auth state as a client 401
      case "not_found":
        return 404;
      case "conflict":
      case "duplicate_call":
      case "do_not_call":
      case "outside_calling_hours":
        return 409;
      case "rate_limited":
        return 429;
      case "invalid_request":
      case "invalid_phone_number":
        return 400;
      case "no_user_mapping":
        return 412;
      case "webhook_signature_invalid":
        return 401;
      case "transcript_not_ready":
        return 202;
      case "timeout":
      case "network_error":
      case "provider_unavailable":
        return 502;
      default:
        return 500;
    }
  }
}

/** True when a provider failure is safe to retry (transient). */
export function isRetryableError(err: unknown): boolean {
  if (!(err instanceof DialpadError)) return false;
  return ["rate_limited", "provider_unavailable", "timeout", "network_error"].includes(err.code);
}

export function toDialpadError(err: unknown): DialpadError {
  if (err instanceof DialpadError) return err;
  if (err instanceof Error && err.name === "AbortError") {
    return new DialpadError("timeout", "Dialpad did not respond in time.", { cause: err });
  }
  return new DialpadError("unknown", "Unexpected Dialpad integration error.", { cause: err });
}
