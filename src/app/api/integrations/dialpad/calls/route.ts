import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAdminRole, getSessionAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { initiateDialpadCall } from "@/lib/dialpad/service";
import { toDialpadError } from "@/lib/dialpad/errors";
import { sanitizeSession } from "@/lib/dialpad/sanitize";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const initiateSchema = z.object({
  clinicId: z.string().min(1).max(200),
  contactId: z.string().min(1).max(200).optional(),
  phoneNumber: z.string().min(3).max(40).optional(),
  campaignId: z.string().min(1).max(200).optional(),
  source: z.string().min(1).max(120).optional(),
});

/** Starts an outbound Dialpad call for a clinic. */
export async function POST(req: NextRequest) {
  const admin = await requireAdminRole(["admin", "operations", "sales"]);
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const parsed = initiateSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid Dialpad call request." }, { status: 400 });
  }

  try {
    const result = await initiateDialpadCall({
      admin: { id: admin.id, role: admin.role },
      clinicId: parsed.data.clinicId,
      contactId: parsed.data.contactId ?? null,
      phoneNumber: parsed.data.phoneNumber ?? null,
      campaignId: parsed.data.campaignId ?? null,
      source: parsed.data.source ?? null,
    });
    return NextResponse.json(result);
  } catch (err) {
    const normalized = toDialpadError(err);
    return NextResponse.json(
      {
        error: normalized.userMessage,
        code: normalized.code,
        retryAfterSec: normalized.retryAfterSec,
      },
      { status: normalized.apiStatus === 202 ? 409 : normalized.apiStatus },
    );
  }
}

/** Lists recent Dialpad call sessions (optionally for one clinic). */
export async function GET(req: NextRequest) {
  const admin = await getSessionAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const clinicId = req.nextUrl.searchParams.get("clinicId") ?? undefined;
  const where: Record<string, unknown> = { provider: "dialpad" };
  if (clinicId) where.clinicId = clinicId;

  const sessions = await db.callSession.findMany({
    where,
    orderBy: { startedAt: "desc" },
    take: 50,
  });

  return NextResponse.json({
    calls: sessions.map(sanitizeSession),
  });
}
