import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSessionAdmin } from "@/lib/auth";
import { logActivity, recalcReadiness } from "@/lib/data";
import { STAGE_MAP } from "@/lib/constants";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = await getSessionAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const body = (await req.json()) as { toStage: string; reason?: string; note?: string; relatedCallId?: string; relatedTaskId?: string };
  if (!body.toStage) return NextResponse.json({ error: "toStage required" }, { status: 400 });

  const clinic = await db.clinic.findUnique({ where: { id } });
  if (!clinic) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const fromStage = clinic.pipelineStage;
  const toStage = body.toStage;

  // Update derived flags based on target stage
  const derived: Record<string, unknown> = { pipelineStage: toStage, updatedById: admin.id };
  if (toStage === "do_not_call") derived.doNotCall = true;
  if (toStage === "not_interested" || toStage === "lost" || toStage === "invalid") derived.interested = false;
  if (toStage === "paid" || toStage === "won") { derived.paid = true; derived.interested = true; }
  if (STAGE_MAP[toStage]?.category === "engaged" || STAGE_MAP[toStage]?.category === "commercial") {
    derived.interested = true;
  }

  await db.clinic.update({ where: { id }, data: derived });
  await db.clinicPipelineHistory.create({
    data: {
      clinicId: id,
      fromStage,
      toStage,
      changedById: admin.id,
      reason: body.reason ?? null,
      note: body.note ?? null,
      relatedCallId: body.relatedCallId ?? null,
      relatedTaskId: body.relatedTaskId ?? null,
    },
  });
  await recalcReadiness(id);
  await logActivity({
    entityType: "clinic",
    entityId: id,
    action: "stage_changed",
    summary: `Stage changed: ${STAGE_MAP[fromStage]?.label ?? fromStage} → ${STAGE_MAP[toStage]?.label ?? toStage}`,
    adminId: admin.id,
    metadata: { from: fromStage, to: toStage, reason: body.reason ?? null },
  });

  return NextResponse.json({ ok: true, fromStage, toStage });
}
