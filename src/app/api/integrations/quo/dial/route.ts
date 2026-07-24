import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireAdminRole } from "@/lib/auth";
import { normalizeToE164 } from "@/lib/dialpad/phone";
import { getQuoConfig } from "@/lib/quo/env";
import { QuoApiError, listQuoCalls, resolveQuoCaller } from "@/lib/quo/client";
import { buildQuoDialLinks } from "@/lib/quo/dial";

const dialSchema = z.object({
  clinicId: z.string().min(1),
  phoneNumber: z.string().min(7).max(32).optional(),
  idempotencyKey: z.string().min(8).max(120).optional(),
});

/**
 * Start a Quo click-to-call session.
 * Quo cannot place calls via API — returns tel: / openphone:// links for the Quo app.
 */
export async function POST(req: NextRequest) {
  const admin = await requireAdminRole(["admin", "operations", "sales"]);
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const config = getQuoConfig();
  if (!config.configured) {
    return NextResponse.json({ error: "Quo is not configured. Set QUO_API_KEY." }, { status: 503 });
  }

  const parsed = dialSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "Invalid Quo dial request." }, { status: 400 });

  const clinic = await db.clinic.findUnique({ where: { id: parsed.data.clinicId } });
  if (!clinic) return NextResponse.json({ error: "Clinic not found." }, { status: 404 });
  if (clinic.doNotCall || clinic.archived) {
    return NextResponse.json({ error: "This clinic is not callable." }, { status: 409 });
  }

  const destination = normalizeToE164(parsed.data.phoneNumber?.trim() || clinic.primaryPhone);
  if (!destination) {
    return NextResponse.json({ error: "This clinic has no valid phone number." }, { status: 400 });
  }

  if (parsed.data.idempotencyKey) {
    const existing = await db.callSession.findFirst({
      where: { clinicId: clinic.id, metadata: { contains: parsed.data.idempotencyKey } },
      orderBy: { startedAt: "desc" },
    });
    if (
      existing &&
      ["initiated", "configuring", "connecting", "dialing", "ringing", "connected", "on_hold"].includes(existing.status)
    ) {
      let caller;
      try {
        caller = await resolveQuoCaller();
      } catch {
        caller = { fromNumber: config.fromNumber ?? null, phoneNumberId: config.phoneNumberId ?? null };
      }
      const links = buildQuoDialLinks(destination, caller.fromNumber);
      return NextResponse.json({
        callSessionId: existing.id,
        status: existing.status,
        deduplicated: true,
        provider: "quo",
        mode: "quo_click_to_call",
        externalNumber: destination,
        fromNumber: caller.fromNumber,
        phoneNumberId: caller.phoneNumberId,
        dial: links,
      });
    }
  }

  let caller;
  try {
    caller = await resolveQuoCaller();
  } catch (err) {
    const message = err instanceof QuoApiError ? err.message : "Failed to resolve Quo number";
    return NextResponse.json({ error: message }, { status: 502 });
  }

  const links = buildQuoDialLinks(destination, caller.fromNumber);
  if (!links) return NextResponse.json({ error: "Could not build dial link." }, { status: 400 });

  const attemptNumber = Number(clinic.callAttempts ?? 0) + 1;
  const session = await db.callSession.create({
    data: {
      clinicId: clinic.id,
      adminId: admin.id,
      startedAt: new Date(),
      attemptNumber,
      provider: "quo",
      callEnvironment: "live",
      status: "connected",
      outcome: "not_started",
      connectedAt: new Date(),
      externalNumber: destination,
      metadata: JSON.stringify({
        phoneNumber: destination,
        idempotencyKey: parsed.data.idempotencyKey ?? null,
        mode: "quo_click_to_call",
        quoPhoneNumberId: caller.phoneNumberId,
        quoFromNumber: caller.fromNumber,
      }),
      structuredData: JSON.stringify({
        callEnvironment: "live",
        mode: "quo_click_to_call",
        provider: "quo",
        audio: "quo_app",
      }),
      providerMetadata: {
        mode: "quo_click_to_call",
        source: "founder-led-quo",
        audio: "quo_app",
        quoPhoneNumberId: caller.phoneNumberId,
        quoFromNumber: caller.fromNumber,
      },
    },
  });

  // Mark contacted immediately so the queue won't re-offer this clinic as "to call".
  await db.clinic.update({
    where: { id: clinic.id },
    data: {
      lastContactedAt: new Date(),
      callAttempts: attemptNumber,
      ...(clinic.pipelineStage === "ready_to_call" ? { pipelineStage: "attempted" } : {}),
      updatedById: admin.id,
    },
  });

  return NextResponse.json({
    callSessionId: session.id,
    status: session.status,
    provider: "quo",
    mode: "quo_click_to_call",
    externalNumber: destination,
    fromNumber: caller.fromNumber,
    phoneNumberId: caller.phoneNumberId,
    dial: links,
    instruction:
      "Set Quo as your default calling app, then tel: opens Quo with this number. On mobile, openphone:// can auto-dial. Save the outcome here when done.",
  });
}
