import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSessionAdmin } from "@/lib/auth";

/** Live call history for analytics / recent-call surfaces. */
export async function GET(req: NextRequest) {
  const admin = await getSessionAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const take = Math.min(Number(req.nextUrl.searchParams.get("limit") ?? 100) || 100, 250);
  const clinicId = req.nextUrl.searchParams.get("clinicId");

  const calls = await db.callSession.findMany({
    where: clinicId ? { clinicId } : undefined,
    orderBy: { startedAt: "desc" },
    take,
    include: { clinic: true },
  });

  return NextResponse.json({
    calls: (calls ?? []).map((call: Record<string, unknown>) => {
      const clinic = call.clinic as { name?: string } | null | undefined;
      return {
        ...call,
        clinicName: clinic?.name ?? (call.clinicName as string | undefined) ?? "Clinic",
      };
    }),
  });
}
