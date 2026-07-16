import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSessionAdmin } from "@/lib/auth";
import { logActivity } from "@/lib/data";

export async function GET(req: NextRequest) {
  const admin = await getSessionAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const params = req.nextUrl.searchParams;
  const stage = params.get("stage");

  const where = stage ? { listingStatus: stage } : {};
  const profiles = await db.directoryProfile.findMany({
    where,
    include: { clinic: true },
    orderBy: { updatedAt: "desc" },
    take: 200,
  });

  return NextResponse.json({
    profiles: profiles.map((p) => ({ ...p, clinic: p.clinic ? { ...p.clinic, services: [] } : null })),
  });
}
