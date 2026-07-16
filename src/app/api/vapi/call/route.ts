import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireAdminRole } from "@/lib/auth";
import { createVapiOutboundCall } from "@/lib/providers/vapi";

const schema = z.object({ clinicId: z.string().min(1) });

export async function POST(req: NextRequest) {
  const admin = await requireAdminRole(["admin", "operations", "sales"]);
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const { clinicId } = schema.parse(await req.json());
    const clinic = await db.clinic.findUnique({ where: { id: clinicId } });
    if (!clinic) return NextResponse.json({ error: "Clinic not found." }, { status: 404 });
    if (clinic.doNotCall || clinic.archived) return NextResponse.json({ error: "This clinic is not callable." }, { status: 409 });
    if (!clinic.primaryPhone) return NextResponse.json({ error: "This clinic has no primary phone number." }, { status: 400 });

    // Create the attempt before contacting the provider. This preserves failed,
    // denied, and unavailable attempts instead of losing operational history.
    const attemptNumber = Number(clinic.callAttempts ?? 0) + 1;
    const session = await db.callSession.create({
      data: {
        clinicId,
        adminId: admin.id,
        startedAt: new Date(),
        attemptNumber,
        provider: "vapi",
        status: "initiated",
        outcome: "not_started",
        metadata: JSON.stringify({ phoneNumber: clinic.primaryPhone }),
      },
    });

    const assistantId = process.env.VAPI_ASSISTANT_ID?.trim();
    const phoneNumberId = process.env.VAPI_PHONE_NUMBER_ID?.trim();
    if (!assistantId || !phoneNumberId) {
      await db.callSession.update({ where: { id: session.id }, data: {
        status: "provider_unavailable",
        failureCode: "VAPI_CONFIGURATION_MISSING",
        failureMessage: "Configure VAPI_ASSISTANT_ID and VAPI_PHONE_NUMBER_ID.",
        endedAt: new Date(),
        outcome: "provider_unavailable",
      } });
      return NextResponse.json({ error: "Vapi is not ready. Configure VAPI_ASSISTANT_ID and VAPI_PHONE_NUMBER_ID.", callSessionId: session.id }, { status: 503 });
    }

    try {
      await db.callSession.update({ where: { id: session.id }, data: { status: "connecting" } });
      const call = await createVapiOutboundCall({ phoneNumber: clinic.primaryPhone, assistantId, phoneNumberId, clinicId, clinicName: clinic.name });
      await db.callSession.update({ where: { id: session.id }, data: { providerCallId: call.id, status: call.status === "ringing" ? "ringing" : "connecting" } });
      return NextResponse.json({ callId: call.id, callSessionId: session.id, status: call.status ?? "queued", provider: "vapi" });
    } catch (providerError) {
      const message = providerError instanceof Error ? providerError.message : "Vapi call request failed.";
      await db.callSession.update({ where: { id: session.id }, data: { status: "failed", failureCode: "VAPI_REQUEST_FAILED", failureMessage: message, endedAt: new Date(), outcome: "failed" } });
      return NextResponse.json({ error: message, callSessionId: session.id }, { status: 502 });
    }
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Vapi call request failed." }, { status: 502 });
  }
}
