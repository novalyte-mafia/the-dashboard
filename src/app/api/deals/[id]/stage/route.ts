import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSessionAdmin } from "@/lib/auth";
import { logActivity } from "@/lib/data";
import { DEAL_STAGE_MAP } from "@/lib/constants";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = await getSessionAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const body = (await req.json()) as { toStage: string; note?: string };
  if (!body.toStage) return NextResponse.json({ error: "toStage required" }, { status: 400 });

  const deal = await db.deal.findUnique({ where: { id } });
  if (!deal) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const fromStage = deal.stage;
  const probability = DEAL_STAGE_MAP[body.toStage]?.probability ?? deal.probability;

  await db.deal.update({ where: { id }, data: { stage: body.toStage, probability } });
  await db.dealStageHistory.create({ data: { dealId: id, fromStage, toStage: body.toStage, changedById: admin.id, note: body.note ?? null } });
  await logActivity({
    entityType: "deal",
    entityId: id,
    action: "deal_stage_changed",
    summary: `Deal stage: ${DEAL_STAGE_MAP[fromStage]?.label ?? fromStage} → ${DEAL_STAGE_MAP[body.toStage]?.label ?? body.toStage}`,
    adminId: admin.id,
    metadata: { from: fromStage, to: body.toStage, dealName: deal.name },
  });
  return NextResponse.json({ ok: true });
}
