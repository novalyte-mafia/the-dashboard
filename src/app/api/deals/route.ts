import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSessionAdmin, requireAdminRole } from "@/lib/auth";
import { logActivity } from "@/lib/data";

export async function GET(req: NextRequest) {
  const admin = await getSessionAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const params = req.nextUrl.searchParams;
  const view = params.get("view"); // open | proposals | expected | won | lost

  const deals = await db.deal.findMany({
    where: view === "won" ? { stage: { in: ["won", "active"] } }
      : view === "lost" ? { stage: "lost" }
      : view === "proposals" ? { stage: "proposal_sent" }
      : view === "expected" ? { stage: { in: ["proposal_sent", "negotiation", "contract_sent", "contract_signed", "payment_pending"] } }
      : { archived: false, stage: { notIn: ["won", "lost"] } },
    include: {
      clinic: { select: { id: true, name: true, city: true, state: true } },
      contact: { select: { id: true, firstName: true, lastName: true } },
      owner: { select: { firstName: true, lastName: true } },
    },
    orderBy: { updatedAt: "desc" },
    take: 200,
  });

  const totals = await db.deal.aggregate({
    _sum: { estimatedTotalValue: true, setupFee: true, estimatedMonthlyValue: true },
    _count: true,
    where: { archived: false },
  });
  const weighted = await db.deal.findMany({
    where: { archived: false, stage: { notIn: ["won", "lost"] } },
    select: { estimatedTotalValue: true, probability: true },
  });
  const weightedPipeline = weighted.reduce((s, d) => s + d.estimatedTotalValue * (d.probability / 100), 0);
  const won = await db.deal.aggregate({ _sum: { estimatedTotalValue: true }, where: { stage: { in: ["won", "active"] } } });
  const monthlyRecurring = await db.deal.aggregate({ _sum: { estimatedMonthlyValue: true }, where: { stage: { in: ["won", "active"] } } });

  return NextResponse.json({
    deals,
    metrics: {
      openPipeline: totals._sum.estimatedTotalValue ?? 0,
      weightedPipeline,
      wonRevenue: won._sum.estimatedTotalValue ?? 0,
      mrr: monthlyRecurring._sum.estimatedMonthlyValue ?? 0,
      avgDealValue: totals._count > 0 ? Math.round((totals._sum.estimatedTotalValue ?? 0) / totals._count) : 0,
      count: totals._count,
    },
  });
}

export async function POST(req: NextRequest) {
  const admin = await requireAdminRole(["admin", "operations", "sales"]);
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = (await req.json()) as Record<string, unknown>;
  if (!body.name) return NextResponse.json({ error: "Deal name required" }, { status: 400 });

  const deal = await db.deal.create({
    data: {
      name: String(body.name),
      clinicId: (body.clinicId as string) ?? null,
      contactId: (body.contactId as string) ?? null,
      offer: (body.offer as string) ?? null,
      ownerId: admin.id,
      stage: String(body.stage ?? "opportunity_identified"),
      estimatedMonthlyValue: Number(body.estimatedMonthlyValue ?? 0),
      setupFee: Number(body.setupFee ?? 0),
      performanceFee: Number(body.performanceFee ?? 0),
      estimatedTotalValue: Number(body.estimatedTotalValue ?? 0),
      probability: Number(body.probability ?? 10),
      expectedCloseDate: body.expectedCloseDate ? new Date(body.expectedCloseDate as string) : null,
      notes: (body.notes as string) ?? null,
    },
  });
  await db.dealStageHistory.create({ data: { dealId: deal.id, toStage: deal.stage, changedById: admin.id, note: "Deal created" } });
  await logActivity({
    entityType: "deal",
    entityId: deal.id,
    action: "deal_created",
    summary: `Deal created — ${deal.name}`,
    adminId: admin.id,
    metadata: { stage: deal.stage, value: deal.estimatedTotalValue, clinicId: deal.clinicId },
  });
  return NextResponse.json({ deal });
}
