import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireAdminRole } from "@/lib/auth";
import { normalizeToE164 } from "@/lib/dialpad/phone";
import { getQuoConfig } from "@/lib/quo/env";
import { QuoApiError, listQuoCalls, resolveQuoCaller } from "@/lib/quo/client";
import { enrichCallSessionFromQuo } from "@/lib/quo/enrich";

const syncSchema = z.object({
  clinicId: z.string().min(1),
  phoneNumber: z.string().min(7).max(32).optional(),
  maxResults: z.number().int().min(1).max(50).optional(),
});

/** Pull recent Quo calls for this clinic phone into call history (deduped by providerCallId). */
export async function POST(req: NextRequest) {
  const admin = await requireAdminRole(["admin", "operations", "sales"]);
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const config = getQuoConfig();
  if (!config.configured) {
    return NextResponse.json({ error: "Quo is not configured." }, { status: 503 });
  }

  const parsed = syncSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "Invalid sync request." }, { status: 400 });

  const clinic = await db.clinic.findUnique({ where: { id: parsed.data.clinicId } });
  if (!clinic) return NextResponse.json({ error: "Clinic not found." }, { status: 404 });

  const participant = normalizeToE164(parsed.data.phoneNumber?.trim() || clinic.primaryPhone);
  if (!participant) {
    return NextResponse.json({ error: "Clinic has no valid phone number to sync." }, { status: 400 });
  }

  try {
    const caller = await resolveQuoCaller();
    if (!caller.phoneNumberId) {
      return NextResponse.json({ error: "No Quo phone number on workspace." }, { status: 503 });
    }

    const calls = await listQuoCalls({
      phoneNumberId: caller.phoneNumberId,
      participants: [participant],
      maxResults: parsed.data.maxResults ?? 20,
    });

    let imported = 0;
    let skipped = 0;
    let enriched = 0;

    for (const call of calls) {
      const existing = await db.callSession.findFirst({
        where: { provider: "quo", providerCallId: call.id },
      });
      if (existing) {
        skipped += 1;
        const result = await enrichCallSessionFromQuo({ callSessionId: existing.id, quoCallId: call.id });
        if (result.ok) enriched += 1;
        continue;
      }

      const completed = call.status === "completed" || Boolean(call.completedAt);
      const answered =
        Boolean(call.answeredAt) || ["in-progress", "completed"].includes(String(call.status ?? ""));
      const durationSec = typeof call.duration === "number" ? Math.max(0, Math.round(call.duration)) : 0;

      const created = await db.callSession.create({
        data: {
          clinicId: clinic.id,
          adminId: admin.id,
          startedAt: call.createdAt ? new Date(call.createdAt) : new Date(),
          endedAt: call.completedAt ? new Date(call.completedAt) : completed ? new Date() : null,
          durationSec,
          attemptNumber: Number(clinic.callAttempts ?? 0) + imported + 1,
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
          structuredData: JSON.stringify({
            provider: "quo",
            mode: "quo_sync",
            quoStatus: call.status ?? null,
            quoDirection: call.direction ?? null,
            quoCallId: call.id,
          }),
          providerMetadata: { mode: "quo_sync", source: "quo-api-sync", quoCallId: call.id },
        } as never,
      });
      imported += 1;
      const result = await enrichCallSessionFromQuo({ callSessionId: created.id, quoCallId: call.id });
      if (result.ok) enriched += 1;
    }

    return NextResponse.json({
      ok: true,
      participant,
      fetched: calls.length,
      imported,
      skipped,
      enriched,
    });
  } catch (err) {
    const message = err instanceof QuoApiError ? err.message : "Quo sync failed";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
