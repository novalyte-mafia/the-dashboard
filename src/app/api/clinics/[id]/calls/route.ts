import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSessionAdmin } from "@/lib/auth";
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
  const admin = await getSessionAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const body = (await req.json()) as Record<string, unknown>;

  const clinic = await db.clinic.findUnique({ where: { id }, include: { contacts: { where: { archived: false } } } });
  if (!clinic) return NextResponse.json({ error: "Clinic not found" }, { status: 404 });

  const attemptNumber = (clinic.callAttempts ?? 0) + 1;
  const outcome = String(body.outcome ?? "no_answer");
  const answered = Boolean(body.answered ?? false);
  const decisionMakerReached = Boolean(body.decisionMakerReached ?? false);
  const interestLevel = String(body.interestLevel ?? "unknown");
  const followUpRequired = Boolean(body.followUpRequired ?? false);
  const doNotCall = Boolean(body.doNotCall ?? false) || outcome === "do_not_call";
  const invalidNumber = Boolean(body.invalidNumber ?? false) || outcome === "wrong_number" || outcome === "disconnected_number";

  const call = await db.callSession.create({
    data: {
      clinicId: id,
      contactId: (body.contactId as string) ?? null,
      startedAt: body.startedAt ? new Date(body.startedAt as string) : new Date(),
      endedAt: body.endedAt ? new Date(body.endedAt as string) : null,
      durationSec: Number(body.durationSec ?? 0),
      direction: String(body.direction ?? "outbound"),
      attemptNumber,
      answered,
      decisionMakerReached,
      outcome,
      interestLevel,
      objections: JSON.stringify(body.objections ?? []),
      notes: (body.notes as string) ?? null,
      nextAction: (body.nextAction as string) ?? null,
      nextActionAt: body.nextActionAt ? new Date(body.nextActionAt as string) : null,
      followUpRequired,
      pipelineStageRecommendation: (body.pipelineStageRecommendation as string) ?? null,
      doNotCall,
      invalidNumber,
      adminId: admin.id,
    },
  });

  // Update clinic state
  const updateData: Record<string, unknown> = {
    lastContactedAt: new Date(),
    callAttempts: attemptNumber,
    nextAction: (body.nextAction as string) ?? clinic.nextAction,
    nextActionAt: body.nextActionAt ? new Date(body.nextActionAt as string) : clinic.nextActionAt,
    updatedById: admin.id,
  };
  if (doNotCall) { updateData.doNotCall = true; updateData.pipelineStage = "do_not_call"; }
  if (outcome === "interested" || outcome === "meeting_booked") updateData.interested = true;
  if (outcome === "meeting_booked") updateData.pipelineStage = "meeting_booked";
  if (decisionMakerReached && (clinic.pipelineStage === "connected" || clinic.pipelineStage === "attempted")) {
    updateData.pipelineStage = "decision_maker_reached";
  } else if (answered && clinic.pipelineStage === "ready_to_call") {
    updateData.pipelineStage = "connected";
  } else if (!answered && clinic.pipelineStage === "ready_to_call") {
    updateData.pipelineStage = "attempted";
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
        reason: `Call logged (${outcome})`,
        relatedCallId: call.id,
      },
    });
  }

  // Create follow-up if required
  if (followUpRequired && body.nextAction) {
    await db.followUpTask.create({
      data: {
        title: body.nextAction as string,
        clinicId: id,
        contactId: (body.contactId as string) ?? null,
        relatedCallId: call.id,
        taskType: (body.followUpType as string) ?? "phone_call",
        priority: decisionMakerReached ? "high" : "normal",
        dueDate: body.nextActionAt ? new Date(body.nextActionAt as string) : new Date(Date.now() + 86400000),
        status: "open",
        notes: (body.notes as string) ?? null,
        assignedAdminId: admin.id,
      },
    });
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

  return NextResponse.json({ call });
}
