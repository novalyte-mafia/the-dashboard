import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSessionAdmin, requireAdminRole } from "@/lib/auth";
import { logActivity, recalcReadiness } from "@/lib/data";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = await getSessionAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const calls = await db.callSession.findMany({
    where: { clinicId: id },
    orderBy: { startedAt: "desc" },
    include: { contact: { select: { firstName: true, lastName: true } }, admin: { select: { firstName: true, lastName: true } } },
  });
  return NextResponse.json({ calls });
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdminRole(["admin", "operations", "sales"]);
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const body = (await req.json()) as Record<string, unknown>;

  const clinic = await db.clinic.findUnique({ where: { id }, include: { contacts: { where: { archived: false } } } });
  if (!clinic) return NextResponse.json({ error: "Clinic not found" }, { status: 404 });

  const attemptNumber = (clinic.callAttempts ?? 0) + 1;
  const outcome = String(body.outcome ?? "no_answer");
  const answered = Boolean(
    body.answered ??
      ["connected", "permission_granted", "permission_denied", "interested", "meeting_booked", "not_interested", "call_back_requested", "information_requested", "already_has_provider", "at_capacity", "do_not_call"].includes(outcome),
  );
  const decisionMakerReached = Boolean(body.decisionMakerReached ?? false);
  const interestLevel = String(
    body.interestLevel ??
      (outcome === "permission_granted" || outcome === "interested" || outcome === "meeting_booked"
        ? "warm"
        : "unknown"),
  );
  const followUpRequired = Boolean(body.followUpRequired ?? false);
  const doNotCall = Boolean(body.doNotCall ?? false) || outcome === "do_not_call";
  const invalidNumber = Boolean(body.invalidNumber ?? false) || outcome === "wrong_number" || outcome === "disconnected_number";
  const permissionGranted = outcome === "permission_granted" || body.directoryPermissionStatus === "granted";
  const permissionDenied = outcome === "permission_denied" || body.directoryPermissionStatus === "denied";

  const existingCall = body.callSessionId
    ? await db.callSession.findUnique({ where: { id: String(body.callSessionId) } })
    : null;
  if (existingCall && existingCall.clinicId !== id) {
    return NextResponse.json({ error: "Call session does not belong to this clinic" }, { status: 409 });
  }
  const callEnvironment = body.callEnvironment === "practice" ? "practice" : "live";
  const transcriptPayload = body.structuredData && typeof body.structuredData === "object"
    ? JSON.stringify((body.structuredData as { transcript?: unknown }).transcript ?? [])
    : undefined;

  const call = existingCall
    ? await db.callSession.update({
      where: { id: existingCall.id },
      data: {
        endedAt: body.endedAt ? new Date(body.endedAt as string) : new Date(),
        durationSec: Number(body.durationSec ?? existingCall.durationSec ?? 0),
        answered,
        decisionMakerReached,
        outcome,
        interestLevel,
        notes: (body.notes as string) ?? null,
        nextAction: (body.nextAction as string) ?? null,
        nextActionAt: body.nextActionAt ? new Date(body.nextActionAt as string) : null,
        followUpRequired,
        doNotCall,
        invalidNumber,
        status: "saved",
        callEnvironment,
        ...(transcriptPayload ? { transcript: transcriptPayload } : {}),
        structuredData: JSON.stringify({
          ...(typeof body.structuredData === "object" && body.structuredData ? body.structuredData : {}),
          callEnvironment,
          isPractice: callEnvironment === "practice",
        }),
      },
    })
    : await db.callSession.create({
    data: {
      clinicId: id,
      contactId: (body.contactId as string) ?? null,
      adminId: admin.id,
      startedAt: body.startedAt ? new Date(body.startedAt as string) : new Date(),
      endedAt: body.endedAt ? new Date(body.endedAt as string) : new Date(),
      answered,
      outcome,
      notes: (body.notes as string) ?? null,
      callEnvironment,
      provider: callEnvironment === "practice" ? "vapi_practice" : "telnyx",
      transcript: transcriptPayload ?? "[]",
      aiTopicTags: JSON.stringify({
        direction: String(body.direction ?? "outbound"),
        attemptNumber,
        decisionMakerReached,
        interestLevel,
        followUpRequired,
        invalidNumber,
        durationSec: Number(body.durationSec ?? 0),
      }),
      status: "saved",
      structuredData: JSON.stringify({
        ...(typeof body.structuredData === "object" && body.structuredData ? body.structuredData : {}),
        callEnvironment,
        isPractice: callEnvironment === "practice",
      }),
    },
  });

  // Update clinic state if not a practice session
  const isPractice = callEnvironment === "practice";
  if (!isPractice) {
    const updateData: Record<string, unknown> = {
      lastContactedAt: new Date(),
      callAttempts: attemptNumber,
      nextAction: (body.nextAction as string) ?? clinic.nextAction,
      nextActionAt: body.nextActionAt ? new Date(body.nextActionAt as string) : clinic.nextActionAt,
      updatedById: admin.id,
    };
    if (doNotCall) { updateData.doNotCall = true; updateData.pipelineStage = "do_not_call"; }
    if (outcome === "interested" || outcome === "meeting_booked" || permissionGranted) updateData.interested = true;
    if (outcome === "meeting_booked") updateData.pipelineStage = "meeting_booked";
    else if (permissionGranted) updateData.pipelineStage = "directory_approved";
    else if (permissionDenied || outcome === "not_interested") updateData.pipelineStage = "not_interested";
    else if (outcome === "busy" || outcome === "clinic_closed" || outcome === "technical_failure") {
      updateData.pipelineStage = followUpRequired ? "follow_up_required" : "attempted";
    } else if (decisionMakerReached && (clinic.pipelineStage === "connected" || clinic.pipelineStage === "attempted")) {
      updateData.pipelineStage = "decision_maker_reached";
    } else if (answered && ["ready_to_call", "attempted", "imported", "research_complete"].includes(clinic.pipelineStage)) {
      updateData.pipelineStage = "connected";
    } else if (!answered && clinic.pipelineStage === "ready_to_call") {
      updateData.pipelineStage = "attempted";
    }
    if (followUpRequired && !doNotCall && updateData.pipelineStage !== "meeting_booked" && updateData.pipelineStage !== "directory_approved") {
      updateData.pipelineStage = "follow_up_required";
    }

    await db.clinic.update({ where: { id }, data: updateData });

    // Pipeline history if stage changed
    if (updateData.pipelineStage && updateData.pipelineStage !== clinic.pipelineStage) {
      await db.clinicPipelineHistory.create({
        data: {
          clinicId: id,
          fromStage: clinic.pipelineStage,
          toStage: updateData.pipelineStage as string,
          changedById: admin.id,
          notes: `Call logged (${outcome}); call ${call.id}`,
        },
      });
    }

    // Create follow-up if required — attach relatedCallId when the column exists.
    if (followUpRequired && body.nextAction) {
      const followUpBase = {
        title: body.nextAction as string,
        clinicId: id,
        contactId: (body.contactId as string) ?? null,
        taskType: (body.followUpType as string) ?? "phone_call",
        priority: decisionMakerReached || permissionGranted ? "high" : "normal",
        dueDate: body.nextActionAt ? new Date(body.nextActionAt as string) : new Date(Date.now() + 86400000),
        status: "open",
        description: `${(body.notes as string) ?? ""}\nCreated from call ${call.id}`.trim() || null,
        assignedAdminId: admin.id,
      };
      try {
        await db.followUpTask.create({
          data: { ...followUpBase, relatedCallId: call.id },
        });
      } catch (err) {
        const message =
          err instanceof Error
            ? err.message
            : typeof err === "object" && err && "message" in err
              ? String((err as { message: unknown }).message)
              : String(err);
        if (!/relatedCallId/i.test(message)) throw err;
        await db.followUpTask.create({ data: followUpBase });
      }
    }

    await recalcReadiness(id);
    await logActivity({
      entityType: "clinic",
      entityId: id,
      action: "call_logged",
      summary: `Call logged — ${outcome.replace(/_/g, " ")}${decisionMakerReached ? " (DM reached)" : ""}`,
      adminId: admin.id,
      metadata: { outcome, attemptNumber, interestLevel, callId: call.id },
    });
  }

  return NextResponse.json({ call });
}
