import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSessionAdmin } from "@/lib/auth";

export async function POST() {
  const admin = await getSessionAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  await db.notification.updateMany({ where: { adminId: admin.id, isRead: false }, data: { isRead: true } });
  return NextResponse.json({ ok: true });
}
