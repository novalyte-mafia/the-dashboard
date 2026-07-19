import { NextRequest, NextResponse } from "next/server";
import { requireAdminRole } from "@/lib/auth";
import { endDialpadCall } from "@/lib/dialpad/service";
import { toDialpadError } from "@/lib/dialpad/errors";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Ends an active Dialpad call from the Founder-Led console. */
export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdminRole(["admin", "operations", "sales"]);
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  try {
    const result = await endDialpadCall({ callSessionId: id, adminId: admin.id });
    return NextResponse.json({
      ...result,
      message:
        result.mode === "mock"
          ? "Mock call ended. Log the outcome below."
          : "Call marked ended in the dashboard. Hang up in the Dialpad app if it is still ringing.",
    });
  } catch (err) {
    const normalized = toDialpadError(err);
    return NextResponse.json({ error: normalized.userMessage, code: normalized.code }, { status: normalized.apiStatus });
  }
}
