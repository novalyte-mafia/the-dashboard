import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSessionAdmin, requireAdminRole } from "@/lib/auth";
import { logActivity } from "@/lib/data";

export async function GET(req: NextRequest) {
  const admin = await getSessionAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const params = req.nextUrl.searchParams;
  const view = params.get("view") ?? "all"; // today | overdue | upcoming | completed | all

  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const endOfToday = new Date();
  endOfToday.setHours(23, 59, 59, 999);

  const where: any = {};
  if (view === "today") {
    where.status = { in: ["open", "in_progress"] };
    where.dueDate = { gte: startOfToday, lte: endOfToday };
  } else if (view === "overdue") {
    where.status = { in: ["open", "in_progress"] };
    where.dueDate = { lt: startOfToday };
  } else if (view === "upcoming") {
    where.status = { in: ["open", "in_progress"] };
    where.dueDate = { gt: endOfToday };
  } else if (view === "completed") {
    where.status = "completed";
  }

  const tasks = await db.followUpTask.findMany({
    where,
    include: {
      clinic: true,
      contact: true,
      admin: true,
      deal: true,
    },
    orderBy: { dueDate: "asc" },
    take: 200,
  });

  return NextResponse.json({ tasks });
}

export async function POST(req: NextRequest) {
  const admin = await requireAdminRole(["admin", "operations", "sales"]);
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = (await req.json()) as Record<string, unknown>;
  if (!body.title) return NextResponse.json({ error: "Title required" }, { status: 400 });

  const task = await db.followUpTask.create({
    data: {
      title: String(body.title),
      clinicId: (body.clinicId as string) ?? null,
      contactId: (body.contactId as string) ?? null,
      relatedCallId: (body.relatedCallId as string) ?? null,
      relatedDealId: (body.relatedDealId as string) ?? null,
      taskType: String(body.taskType ?? "general_task"),
      priority: String(body.priority ?? "normal"),
      dueDate: body.dueDate ? new Date(body.dueDate as string) : null,
      dueTime: (body.dueTime as string) ?? null,
      notes: (body.notes as string) ?? null,
      assignedAdminId: admin.id,
      status: "open",
    },
  });

  await logActivity({
    entityType: "followup",
    entityId: task.id,
    action: "followup_created",
    summary: `Follow-up created — ${task.title}`,
    adminId: admin.id,
    metadata: { clinicId: task.clinicId, taskType: task.taskType },
  });

  return NextResponse.json({ task });
}
