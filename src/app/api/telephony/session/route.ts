import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireAdminRole } from "@/lib/auth";

const schema = z.object({
  clinicId: z.string().min(1),
  callEnvironment: z.enum(["live", "practice"]).default("live"),
  idempotencyKey: z.string().min(8).max(120).optional(),
});

export async function POST(req: NextRequest) {
  const admin = await requireAdminRole(["admin", "operations", "sales"]);
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const parsed = schema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "Invalid telephony session request." }, { status: 400 });

  const { clinicId, callEnvironment, idempotencyKey } = parsed.data;

  const clinic = await db.clinic.findUnique({ where: { id: clinicId } });
  if (!clinic) return NextResponse.json({ error: "Clinic not found." }, { status: 404 });
  if (clinic.doNotCall || clinic.archived) {
    return NextResponse.json({ error: "This clinic is not callable." }, { status: 409 });
  }
  if (!clinic.primaryPhone && callEnvironment === "live") {
    return NextResponse.json({ error: "This clinic has no primary phone number." }, { status: 400 });
  }

  if (idempotencyKey) {
    const existing = await db.callSession.findFirst({
      where: { clinicId, metadata: { contains: idempotencyKey } },
      orderBy: { startedAt: "desc" },
    });
    if (existing && ["initiated", "configuring", "connecting", "dialing", "ringing", "connected", "on_hold"].includes(existing.status)) {
      return NextResponse.json({ callSessionId: existing.id, status: existing.status, deduplicated: true });
    }
  }

  const attemptNumber = Number(clinic.callAttempts ?? 0) + 1;
  const session = await db.callSession.create({
    data: {
      clinicId,
      adminId: admin.id,
      startedAt: new Date(),
      attemptNumber,
      provider: callEnvironment === "practice" ? "vapi_practice" : "telnyx",
      callEnvironment,
      status: "initiated",
      outcome: "not_started",
      metadata: JSON.stringify({
        phoneNumber: clinic.primaryPhone ?? null,
        idempotencyKey: idempotencyKey ?? null,
      }),
      structuredData: JSON.stringify({ callEnvironment, isPractice: callEnvironment === "practice" }),
    },
  });

  return NextResponse.json({ callSessionId: session.id, status: session.status });
}
