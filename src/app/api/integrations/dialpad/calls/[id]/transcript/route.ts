import { NextRequest, NextResponse } from "next/server";
import { getSessionAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { getCallIntelligenceProvider } from "@/lib/dialpad/intelligence";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Post-call transcript for a Dialpad call session. Transcript access follows
 * the same access model as the associated clinic (any active admin can read
 * clinics, so any active admin can read transcripts).
 */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = await getSessionAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const session = await db.callSession.findUnique({ where: { id } });
  if (!session || session.provider !== "dialpad") {
    return NextResponse.json({ error: "Call session not found." }, { status: 404 });
  }

  const status: string = session.transcriptStatus ?? "none";
  if (status === "unavailable") {
    return NextResponse.json({ status, segments: [], summary: null });
  }
  if (status !== "stored") {
    return NextResponse.json(
      { status: status === "none" ? "not_ready" : status, segments: [], summary: null },
      { status: 202 },
    );
  }

  const provider = getCallIntelligenceProvider();
  const [segments, summary] = await Promise.all([
    provider.getPostCallTranscript(id),
    provider.getCallSummary(id),
  ]);
  return NextResponse.json({ status: "stored", segments, summary });
}
