import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { normalizeToE164 } from "@/lib/dialpad/phone";
import { getQuoConfig } from "@/lib/quo/env";
import { verifyQuoWebhookSignature } from "@/lib/quo/webhook";
import { enrichCallSessionFromQuo } from "@/lib/quo/enrich";

/**
 * Quo call webhook receiver.
 * Events: call.ringing | call.completed | call.recording.completed
 *
 * Matches outbound legs to clinics by participant phone when possible.
 * Requires QUO_WEBHOOK_SECRET (base64 signing key from Quo).
 */
export async function POST(req: NextRequest) {
  const config = getQuoConfig();
  const rawBody = await req.text();
  const signature =
    req.headers.get("openphone-signature") ||
    req.headers.get("quo-signature") ||
    req.headers.get("x-openphone-signature");

  if (config.webhookSecret) {
    const secrets = config.webhookSecret.split(",").map((s) => s.trim()).filter(Boolean);
    const ok = secrets.some((secret) =>
      verifyQuoWebhookSignature({
        rawBody,
        signatureHeader: signature,
        signingSecretBase64: secret,
      }),
    );
    if (!ok) {
      return NextResponse.json({ error: "Invalid webhook signature" }, { status: 401 });
    }
  } else if (process.env.NODE_ENV === "production") {
    // Fail closed in production if secret never configured.
    console.warn("[quo-webhook] QUO_WEBHOOK_SECRET missing — rejecting");
    return NextResponse.json({ error: "Webhook not configured" }, { status: 503 });
  }

  let payload: Record<string, unknown>;
  try {
    payload = JSON.parse(rawBody) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const eventType = String(payload.type ?? payload.event ?? "");
  const data =
    payload.data && typeof payload.data === "object"
      ? (payload.data as Record<string, unknown>)
      : payload;

  const callId = typeof data.id === "string" ? data.id : typeof data.objectId === "string" ? data.objectId : null;
  if (!callId) {
    return NextResponse.json({ ok: true, ignored: true, reason: "no_call_id" });
  }

  const participants = Array.isArray(data.participants)
    ? data.participants.filter((p): p is string => typeof p === "string")
    : [];
  const participantE164 = participants.map((p) => normalizeToE164(p)).find(Boolean) ?? null;
  const status = typeof data.status === "string" ? data.status : null;
  const direction = data.direction === "incoming" ? "inbound" : "outbound";
  const durationSec = typeof data.duration === "number" ? Math.max(0, Math.round(data.duration)) : 0;
  const answered = Boolean(data.answeredAt) || status === "completed" || status === "in-progress";

  const existing = await db.callSession.findFirst({
    where: { provider: "quo", providerCallId: callId },
  });

  if (existing) {
    await db.callSession.update({
      where: { id: existing.id },
      data: {
        status: status === "completed" || eventType.includes("completed") ? "saved" : existing.status,
        endedAt: data.completedAt ? new Date(String(data.completedAt)) : existing.endedAt,
        durationSec: durationSec || existing.durationSec,
        answered: answered || existing.answered,
        outcome: answered ? (existing.outcome === "not_started" ? "connected" : existing.outcome) : existing.outcome,
        notes: existing.notes ?? `Quo webhook: ${eventType || status || "update"}`,
        metadata: JSON.stringify({
          ...(safeJson(existing.metadata) ?? {}),
          lastQuoWebhook: eventType || status,
          quoPayload: { id: callId, status, direction },
        }),
      },
    });
    if (eventType.includes("completed") || status === "completed" || eventType.includes("recording")) {
      await enrichCallSessionFromQuo({ callSessionId: existing.id, quoCallId: callId }).catch((err) => {
        console.warn("[quo-webhook] enrich failed", err);
      });
    }
    return NextResponse.json({ ok: true, updated: existing.id });
  }

  if (!participantE164) {
    return NextResponse.json({ ok: true, ignored: true, reason: "no_participant" });
  }

  // Best-effort clinic match by digits (E.164 or national formatting in DB).
  const digits = participantE164.replace(/\D/g, "");
  const national = digits.length === 11 && digits.startsWith("1") ? digits.slice(1) : digits;
  const clinics = await db.clinic.findMany({
    where: {
      OR: [
        { primaryPhone: participantE164 },
        { primaryPhone: { contains: national } },
      ],
      archived: false,
    },
    take: 5,
  });
  const clinic =
    clinics.find((c) => normalizeToE164(c.primaryPhone) === participantE164) || clinics[0] || null;

  if (!clinic) {
    return NextResponse.json({ ok: true, ignored: true, reason: "no_clinic_match" });
  }

  const created = await db.callSession.create({
    data: {
      clinicId: clinic.id,
      startedAt: data.createdAt ? new Date(String(data.createdAt)) : new Date(),
      endedAt: data.completedAt ? new Date(String(data.completedAt)) : null,
      durationSec,
      attemptNumber: Number(clinic.callAttempts ?? 0) + 1,
      answered,
      provider: "quo",
      providerCallId: callId,
      callEnvironment: "live",
      status: status === "completed" || eventType.includes("completed") ? "saved" : "connected",
      outcome: answered ? "connected" : "no_answer",
      connectedAt: data.answeredAt ? new Date(String(data.answeredAt)) : undefined,
      externalNumber: participantE164,
      direction,
      notes: `Auto-logged from Quo webhook (${eventType || status || "call"})`,
      metadata: JSON.stringify({ quoWebhook: true, eventType, quoCallId: callId }),
      structuredData: JSON.stringify({
        provider: "quo",
        mode: "quo_webhook",
        quoStatus: status,
        quoDirection: data.direction ?? null,
        quoCallId: callId,
      }),
      providerMetadata: { mode: "quo_webhook", source: "quo-webhook", quoCallId: callId },
    } as never,
  });

  if (eventType.includes("completed") || status === "completed" || eventType.includes("recording")) {
    await enrichCallSessionFromQuo({ callSessionId: created.id, quoCallId: callId }).catch((err) => {
      console.warn("[quo-webhook] enrich failed", err);
    });
  }

  return NextResponse.json({ ok: true, created: created.id, clinicId: clinic.id });
}

function safeJson(raw: string | null | undefined): Record<string, unknown> | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as unknown;
    return parsed && typeof parsed === "object" ? (parsed as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}
