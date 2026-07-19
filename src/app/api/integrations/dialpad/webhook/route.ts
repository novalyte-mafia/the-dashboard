import { NextRequest, NextResponse } from "next/server";
import { getDialpadConfig } from "@/lib/dialpad/env";
import { verifyHs256Jwt, JwtVerificationError } from "@/lib/dialpad/jwt";
import { dialpadCallEventSchema } from "@/lib/dialpad/schemas";
import { processDialpadEvent } from "@/lib/dialpad/service";
import { dialpadLog } from "@/lib/dialpad/log";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Dialpad call-event webhook.
 *
 * Dialpad signs webhook payloads as HS256 JWTs when the webhook is created
 * with a secret. Production accepts ONLY verified JWT payloads; unsigned JSON
 * is accepted exclusively in mock mode (local simulation). Signature failures
 * are rejected with 401. Events are persisted idempotently and processed
 * through a state machine that tolerates duplicates and out-of-order arrival.
 */
export async function POST(req: NextRequest) {
  const config = getDialpadConfig();
  if (!config.enabled) {
    // Fail closed but return 200 so a mis-pointed provider does not retry
    // forever against a disabled deployment.
    dialpadLog("dialpad.webhook.rejected", { reason: "integration_disabled" }, "warn");
    return NextResponse.json({ ok: false, reason: "integration_disabled" });
  }

  const rawBody = await req.text();
  if (!rawBody || rawBody.length > 512_000) {
    dialpadLog("dialpad.webhook.rejected", { reason: "empty_or_oversized_body" }, "warn");
    return NextResponse.json({ error: "Invalid payload." }, { status: 400 });
  }

  let payloadObject: unknown;
  const looksLikeJson = rawBody.trimStart().startsWith("{");

  if (looksLikeJson) {
    // Unsigned JSON is only acceptable in explicitly configured mock mode.
    if (config.mode !== "mock") {
      dialpadLog("dialpad.webhook.rejected", { reason: "unsigned_payload_in_live_mode" }, "warn");
      return NextResponse.json({ error: "Signed payload required." }, { status: 401 });
    }
    try {
      payloadObject = JSON.parse(rawBody);
    } catch {
      return NextResponse.json({ error: "Malformed JSON." }, { status: 400 });
    }
  } else {
    if (!config.webhookSecret) {
      dialpadLog("dialpad.webhook.rejected", { reason: "webhook_secret_missing" }, "error");
      return NextResponse.json({ error: "Webhook is not configured." }, { status: 503 });
    }
    try {
      payloadObject = verifyHs256Jwt(rawBody, config.webhookSecret);
    } catch (err) {
      const reason = err instanceof JwtVerificationError ? err.message : "verification_failed";
      dialpadLog("dialpad.webhook.rejected", { reason }, "warn");
      return NextResponse.json({ error: "Invalid webhook signature." }, { status: 401 });
    }
  }

  const parsed = dialpadCallEventSchema.safeParse(payloadObject);
  if (!parsed.success) {
    dialpadLog("dialpad.webhook.rejected", { reason: "schema_mismatch" }, "warn");
    return NextResponse.json({ error: "Unrecognized payload shape." }, { status: 400 });
  }

  dialpadLog("dialpad.webhook.received", {
    provider_call_id: parsed.data.call_id ?? null,
    state: parsed.data.state ?? null,
  });

  try {
    const result = await processDialpadEvent(parsed.data);
    // Respond quickly and successfully; unmatched events are persisted for
    // reconciliation rather than triggering provider retries.
    return NextResponse.json({ ok: true, outcome: result.outcome });
  } catch (err) {
    dialpadLog(
      "dialpad.webhook.rejected",
      { reason: "processing_error", message: err instanceof Error ? err.message : "unknown" },
      "error",
    );
    // 500 lets Dialpad retry delivery; idempotency makes retries safe.
    return NextResponse.json({ error: "Event processing failed." }, { status: 500 });
  }
}
