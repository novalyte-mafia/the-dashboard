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
    include: { clinic: { select: { id: true, name: true, city: true, state: true, primaryPhone: true, website: true, services: { include: { service: { select: { name: true, slug: true } } } } } }, reviewedBy: { select: { firstName: true, lastName: true } } },
    orderBy: { updatedAt: "desc" },
    take: 200,
  });

  return NextResponse.json({
    profiles: profiles.map((p) => ({ ...p, clinic: { ...p.clinic, services: p.clinic.services.map((s) => s.service) } })),
  });
}
