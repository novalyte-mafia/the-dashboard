import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSessionAdmin } from "@/lib/auth";

export async function GET(req: NextRequest) {
  const admin = await getSessionAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const params = req.nextUrl.searchParams;
  const entityType = params.get("entityType");
  const limit = Math.min(200, parseInt(params.get("limit") ?? "100", 10));

  const activities = await db.activity.findMany({
    where: entityType ? { entityType } : {},
    orderBy: { timestamp: "desc" },
    take: limit,
    include: { admin: { select: { firstName: true, lastName: true } } },
  });

  return NextResponse.json({ activities });
}
