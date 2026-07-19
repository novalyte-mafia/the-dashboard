import "server-only";
import { getDialpadConfig } from "./env";
import { DialpadError, toDialpadError, isRetryableError } from "./errors";
import {
  dialpadCallCollectionSchema,
  dialpadCallEventSchema,
  dialpadRingCallResponseSchema,
  dialpadSubscriptionSchema,
  dialpadTranscriptSchema,
  dialpadWebhookSchema,
} from "./schemas";
import type {
  DialpadCall,
  DialpadCallCollection,
  DialpadCallEventSubscription,
  DialpadCreateCallEventSubscriptionRequest,
  DialpadCreateWebhookRequest,
  DialpadRingCallRequest,
  DialpadRingCallResponse,
  DialpadTranscript,
  DialpadWebhook,
} from "./types";

/**
 * Server-only Dialpad API v2 client.
 *
 * - Bearer authorization from validated server env (never exposed to UI).
 * - Request timeouts, structured error parsing, Retry-After handling.
 * - Retries only safe transient failures (GET requests; never POST /call).
 * - Redacts secrets from every error path.
 *
 * UI components must never import this; go through the service layer.
 */

const REQUEST_TIMEOUT_MS = 15_000;
const MAX_GET_RETRIES = 2;

interface RequestOptions {
  method: "GET" | "POST" | "PUT" | "DELETE";
  path: string;
  query?: Record<string, string | number | boolean | undefined>;
  body?: unknown;
  /** Retries apply only to idempotent requests. */
  idempotent?: boolean;
}

function extractRetryAfterSec(res: Response): number | undefined {
  const raw = res.headers.get("retry-after");
  if (!raw) return undefined;
  const secs = Number(raw);
  return Number.isFinite(secs) && secs >= 0 ? secs : undefined;
}

async function parseErrorBody(res: Response): Promise<string> {
  try {
    const text = await res.text();
    // Dialpad errors are JSON like {"error": {"message": "..."}}
    try {
      const json = JSON.parse(text);
      const message = json?.error?.message ?? json?.message;
      if (typeof message === "string") return message.slice(0, 300);
    } catch {
      // fall through to raw text
    }
    return text.slice(0, 300);
  } catch {
    return "";
  }
}

async function rawRequest<T>(options: RequestOptions): Promise<T> {
  const config = getDialpadConfig();
  if (!config.enabled || config.mode !== "live") {
    throw new DialpadError("integration_disabled", "Dialpad live API is not enabled.");
  }
  if (!config.apiKey) {
    throw new DialpadError("not_configured", "Dialpad API key is not configured.");
  }

  const url = new URL(`${config.apiBaseUrl}${options.path}`);
  for (const [key, value] of Object.entries(options.query ?? {})) {
    if (value !== undefined) url.searchParams.set(key, String(value));
  }

  let attempt = 0;
  // Retry loop only for idempotent transient failures.
  for (;;) {
    attempt += 1;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    let res: Response;
    try {
      res = await fetch(url, {
        method: options.method,
        headers: {
          Authorization: `Bearer ${config.apiKey}`,
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: options.body === undefined ? undefined : JSON.stringify(options.body),
        signal: controller.signal,
        cache: "no-store",
      });
    } catch (err) {
      clearTimeout(timer);
      const normalized =
        err instanceof Error && err.name === "AbortError"
          ? new DialpadError("timeout", "Dialpad did not respond in time.", { cause: err })
          : new DialpadError("network_error", "Could not reach Dialpad.", { cause: err });
      if (options.idempotent && attempt <= MAX_GET_RETRIES && isRetryableError(normalized)) {
        await new Promise((r) => setTimeout(r, 500 * attempt));
        continue;
      }
      throw normalized;
    }
    clearTimeout(timer);

    const requestId = res.headers.get("x-request-id") ?? res.headers.get("x-cloud-trace-context") ?? undefined;

    if (res.ok) {
      try {
        return (await res.json()) as T;
      } catch (err) {
        throw new DialpadError("unknown", "Dialpad returned an unreadable response.", {
          httpStatus: res.status,
          providerRequestId: requestId,
          cause: err,
        });
      }
    }

    const detail = await parseErrorBody(res);
    const opts = { httpStatus: res.status, providerRequestId: requestId };
    let error: DialpadError;
    switch (res.status) {
      case 400:
      case 422:
        error = new DialpadError("invalid_request", detail || "Dialpad rejected the request.", opts);
        break;
      case 401:
        error = new DialpadError("invalid_credentials", "Dialpad API key is invalid or revoked.", opts);
        break;
      case 403:
        error = new DialpadError(
          "forbidden",
          "Dialpad API key lacks permission (check key scopes and admin level).",
          opts,
        );
        break;
      case 404:
        error = new DialpadError("not_found", detail || "Dialpad resource not found.", opts);
        break;
      case 409:
        error = new DialpadError("conflict", detail || "Dialpad reported a conflict.", opts);
        break;
      case 429:
        error = new DialpadError("rate_limited", "Dialpad rate limit reached.", {
          ...opts,
          retryAfterSec: extractRetryAfterSec(res),
        });
        break;
      default:
        error =
          res.status >= 500
            ? new DialpadError("provider_unavailable", "Dialpad is temporarily unavailable.", opts)
            : new DialpadError("unknown", detail || `Dialpad error (HTTP ${res.status}).`, opts);
    }

    // Retry-safe transient failures on idempotent requests only. 429 honors
    // Retry-After when short enough; validation failures are never retried.
    if (options.idempotent && attempt <= MAX_GET_RETRIES && isRetryableError(error)) {
      const delayMs =
        error.code === "rate_limited" && error.retryAfterSec !== undefined
          ? Math.min(error.retryAfterSec, 5) * 1000
          : 500 * attempt;
      await new Promise((r) => setTimeout(r, delayMs));
      continue;
    }
    throw error;
  }
}

// ---------------------------------------------------------------------------
// Public client methods
// ---------------------------------------------------------------------------

/**
 * POST /api/v2/call — rings the user's active Dialpad device(s).
 * Rate limit: 5/minute. Never retried (not idempotent).
 */
export async function initiateCall(request: DialpadRingCallRequest): Promise<DialpadRingCallResponse> {
  const raw = await rawRequest<unknown>({ method: "POST", path: "/call", body: request });
  const parsed = dialpadRingCallResponseSchema.safeParse(raw);
  if (!parsed.success) {
    throw new DialpadError("unknown", "Dialpad call response had an unexpected shape.");
  }
  return { call_id: parsed.data.call_id == null ? null : Number(parsed.data.call_id) };
}

/** GET /api/v2/call/{id} — details for a (typically concluded) call. 10/min. */
export async function getCall(callId: string | number): Promise<DialpadCall> {
  const raw = await rawRequest<unknown>({
    method: "GET",
    path: `/call/${encodeURIComponent(String(callId))}`,
    idempotent: true,
  });
  const parsed = dialpadCallEventSchema.safeParse(raw);
  if (!parsed.success) {
    throw new DialpadError("unknown", "Dialpad call detail response had an unexpected shape.");
  }
  return parsed.data as DialpadCall;
}

/**
 * GET /api/v2/call — paginated concluded calls (requires company admin key +
 * `calls:list` scope).
 */
export async function listCalls(params: {
  startedAfterMs?: number;
  startedBeforeMs?: number;
  targetId?: number;
  targetType?: string;
  cursor?: string;
}): Promise<DialpadCallCollection> {
  const raw = await rawRequest<unknown>({
    method: "GET",
    path: "/call",
    query: {
      started_after: params.startedAfterMs,
      started_before: params.startedBeforeMs,
      target_id: params.targetId,
      target_type: params.targetType,
      cursor: params.cursor,
    },
    idempotent: true,
  });
  const parsed = dialpadCallCollectionSchema.safeParse(raw);
  if (!parsed.success) {
    throw new DialpadError("unknown", "Dialpad call list response had an unexpected shape.");
  }
  return parsed.data as DialpadCallCollection;
}

/** GET /api/v2/transcripts/{call_id} — Dialpad AI transcript with moments. */
export async function getTranscript(callId: string | number): Promise<DialpadTranscript> {
  const raw = await rawRequest<unknown>({
    method: "GET",
    path: `/transcripts/${encodeURIComponent(String(callId))}`,
    idempotent: true,
  });
  const parsed = dialpadTranscriptSchema.safeParse(raw);
  if (!parsed.success) {
    throw new DialpadError("unknown", "Dialpad transcript response had an unexpected shape.");
  }
  return parsed.data as DialpadTranscript;
}

/** POST /api/v2/webhooks — creates a signed webhook endpoint registration. */
export async function createWebhook(request: DialpadCreateWebhookRequest): Promise<DialpadWebhook> {
  const raw = await rawRequest<unknown>({ method: "POST", path: "/webhooks", body: request });
  const parsed = dialpadWebhookSchema.safeParse(raw);
  if (!parsed.success) {
    throw new DialpadError("unknown", "Dialpad webhook response had an unexpected shape.");
  }
  return parsed.data as DialpadWebhook;
}

/** GET /api/v2/webhooks — lists existing webhooks (duplicate prevention). */
export async function listWebhooks(): Promise<DialpadWebhook[]> {
  const raw = await rawRequest<{ items?: unknown[] }>({ method: "GET", path: "/webhooks", idempotent: true });
  const items = Array.isArray(raw?.items) ? raw.items : [];
  const out: DialpadWebhook[] = [];
  for (const item of items) {
    const parsed = dialpadWebhookSchema.safeParse(item);
    if (parsed.success) out.push(parsed.data as DialpadWebhook);
  }
  return out;
}

/** POST /api/v2/subscriptions/call — subscribes call events to a webhook. */
export async function createCallEventSubscription(
  request: DialpadCreateCallEventSubscriptionRequest,
): Promise<DialpadCallEventSubscription> {
  const raw = await rawRequest<unknown>({ method: "POST", path: "/subscriptions/call", body: request });
  const parsed = dialpadSubscriptionSchema.safeParse(raw);
  if (!parsed.success) {
    throw new DialpadError("unknown", "Dialpad subscription response had an unexpected shape.");
  }
  return parsed.data as DialpadCallEventSubscription;
}

/** GET /api/v2/subscriptions/call — lists call-event subscriptions. */
export async function listCallEventSubscriptions(): Promise<DialpadCallEventSubscription[]> {
  const raw = await rawRequest<{ items?: unknown[] }>({
    method: "GET",
    path: "/subscriptions/call",
    idempotent: true,
  });
  const items = Array.isArray(raw?.items) ? raw.items : [];
  const out: DialpadCallEventSubscription[] = [];
  for (const item of items) {
    const parsed = dialpadSubscriptionSchema.safeParse(item);
    if (parsed.success) out.push(parsed.data as DialpadCallEventSubscription);
  }
  return out;
}

/**
 * Verifies credentials by fetching the configured Dialpad user.
 * GET /api/v2/users/{id}
 */
export async function testConnection(): Promise<{
  ok: boolean;
  dialpadUser?: { id?: string; displayName?: string };
  error?: string;
}> {
  const config = getDialpadConfig();
  if (!config.userId) return { ok: false, error: "DIALPAD_USER_ID is not configured." };
  try {
    const raw = await rawRequest<{ id?: number | string; display_name?: string; first_name?: string; last_name?: string }>(
      { method: "GET", path: `/users/${encodeURIComponent(config.userId)}`, idempotent: true },
    );
    return {
      ok: true,
      dialpadUser: {
        id: raw?.id != null ? String(raw.id) : undefined,
        displayName:
          raw?.display_name ?? [raw?.first_name, raw?.last_name].filter(Boolean).join(" ") ?? undefined,
      },
    };
  } catch (err) {
    const normalized = toDialpadError(err);
    return { ok: false, error: normalized.userMessage };
  }
}
