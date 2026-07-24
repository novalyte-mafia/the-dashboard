import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireAdminRole } from "@/lib/auth";
import { getQuoConfig } from "@/lib/quo/env";
import { enrichCallSessionFromQuo } from "@/lib/quo/enrich";
import { listQuoCalls, resolveQuoCaller } from "@/lib/quo/client";
import { normalizeToE164 } from "@/lib/dialpad/phone";

const schema = z.object({
  clinicId: z.string().min(1).optional(),
  callSessionId: z.string().min(1).optional(),
  quoCallId: z.string().min(1).optional(),
});

/**
 * Pull Quo transcript / summary / recording into dashboard call sessions.
 * - callSessionId (+ optional quoCallId): enrich one row
 * - clinicId: sync recent Quo calls for clinic phone, then enrich each
 */
export async function POST(req: NextRequest) {
  const admin = await requireAdminRole(["admin", "operations", "sales"]);
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const config = getQuoConfig();
  if (!config.configured) {
    return NextResponse.json({ error: "Quo is not configured." }, { status: 503 });
  }

  const parsed = schema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "Invalid enrich request." }, { status: 400 });

  if (parsed.data.callSessionId) {
    const session = await db.callSession.findUnique({ where: { id: parsed.data.callSessionId } });
    if (!session) return NextResponse.json({ error: "Call session not found." }, { status: 404 });
    const quoCallId =
      parsed.data.quoCallId ||
      session.providerCallId ||
      (safeJson(session.metadata)?.quoCallId as string | undefined) ||
      (safeJson(session.structuredData)?.quoCallId as string | undefined);
    if (!quoCallId) {
      return NextResponse.json({ error: "No Quo call id on this session." }, { status: 400 });
    }
    const result = await enrichCallSessionFromQuo({ callSessionId: session.id, quoCallId });
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });
    return NextResponse.json({
      ok: true,
      enriched: 1,
      hasTranscript: Boolean(result.enrichment.transcriptText),
      hasRecording: Boolean(result.enrichment.recordingUrl),
      hasSummary: Boolean(result.enrichment.summaryText),
    });
  }

  if (!parsed.data.clinicId) {
    return NextResponse.json({ error: "clinicId or callSessionId required." }, { status: 400 });
  }

  const clinic = await db.clinic.findUnique({ where: { id: parsed.data.clinicId } });
  if (!clinic) return NextResponse.json({ error: "Clinic not found." }, { status: 404 });
  const participant = normalizeToE164(clinic.primaryPhone);
  if (!participant) {
    return NextResponse.json({ error: "Clinic has no valid phone number." }, { status: 400 });
  }

  const caller = await resolveQuoCaller();
  if (!caller.phoneNumberId) {
    return NextResponse.json({ error: "No Quo phone number on workspace." }, { status: 503 });
  }

  const quoCalls = await listQuoCalls({
    phoneNumberId: caller.phoneNumberId,
    participants: [participant],
    maxResults: 20,
  });

  let enriched = 0;
  let created = 0;
  const details: Array<Record<string, unknown>> = [];

  for (const call of quoCalls) {
    let session = await db.callSession.findFirst({
      where: { provider: "quo", providerCallId: call.id },
    });

    if (!session) {
      // Prefer attaching to a recent open Quo click-to-call session for this clinic.
      session = await db.callSession.findFirst({
        where: {
          clinicId: clinic.id,
          provider: "quo",
          OR: [{ providerCallId: null }, { outcome: "not_started" }],
          startedAt: { gte: new Date(Date.now() - 2 * 60 * 60 * 1000) },
        },
        orderBy: { startedAt: "desc" },
      });
    }

    if (!session) {
      const completed = call.status === "completed" || Boolean(call.completedAt);
      const answered = Boolean(call.answeredAt) || ["in-progress", "completed"].includes(String(call.status ?? ""));
      const durationSec = typeof call.duration === "number" ? Math.max(0, Math.round(call.duration)) : 0;
      session = await db.callSession.create({
        data: {
          clinicId: clinic.id,
          adminId: admin.id,
          startedAt: call.createdAt ? new Date(call.createdAt) : new Date(),
          endedAt: call.completedAt ? new Date(call.completedAt) : completed ? new Date() : null,
          durationSec,
          attemptNumber: Number(clinic.callAttempts ?? 0) + created + 1,
          answered,
          provider: "quo",
          providerCallId: call.id,
          callEnvironment: "live",
          status: completed ? "saved" : "connected",
          outcome: answered ? "connected" : "no_answer",
          connectedAt: call.answeredAt ? new Date(call.answeredAt) : undefined,
          externalNumber: participant,
          direction: call.direction === "incoming" ? "inbound" : "outbound",
          notes: `Synced from Quo (${call.status ?? "unknown"})`,
          metadata: JSON.stringify({ syncedFromQuo: true, quoCallId: call.id }),
          structuredData: JSON.stringify({ provider: "quo", mode: "quo_enrich", quoCallId: call.id }),
          providerMetadata: { mode: "quo_enrich", source: "quo-enrich-api", quoCallId: call.id },
        } as never,
      });
      created += 1;
    }

    const result = await enrichCallSessionFromQuo({ callSessionId: session.id, quoCallId: call.id });
    if (result.ok) {
      enriched += 1;
      details.push({
        callSessionId: session.id,
        quoCallId: call.id,
        hasTranscript: Boolean(result.enrichment.transcriptText),
        hasRecording: Boolean(result.enrichment.recordingUrl),
        hasSummary: Boolean(result.enrichment.summaryText),
      });
    }
  }

  return NextResponse.json({
    ok: true,
    fetched: quoCalls.length,
    created,
    enriched,
    details,
  });
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
