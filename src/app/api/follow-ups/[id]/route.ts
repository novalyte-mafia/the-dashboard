import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSessionAdmin } from "@/lib/auth";
import { logActivity } from "@/lib/data";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = await getSessionAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const body = (await req.json()) as Record<string, unknown>;

  const existing = await db.followUpTask.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const data: Record<string, unknown> = {};
  for (const k of ["title", "taskType", "priority", "status", "notes", "dueDate", "dueTime", "assignedAdminId"]) {
    if (k in body) {
      if (k === "dueDate") data.dueDate = body.dueDate ? new Date(body.dueDate as string) : null;
      else data[k] = body[k];
    }
  }
  if (body.status === "completed") data.completedAt = new Date();
  if (body.status === "rescheduled") data.rescheduledAt = new Date();

  const task = await db.followUpTask.update({ where: { id }, data: data as never });

  if (body.status === "completed") {
    await logActivity({
      entityType: "followup",
      entityId: id,
      action: "followup_completed",
      summary: `Follow-up completed — ${task.title}`,
      adminId: admin.id,
      metadata: { clinicId: task.clinicId },
    });
  }

  return NextResponse.json({ task });
}
