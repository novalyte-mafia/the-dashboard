import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSessionAdmin, requireAdminRole } from "@/lib/auth";
import { db } from "@/lib/db";
import { getDialpadSession } from "@/lib/dialpad/service";
import { sanitizeSession } from "@/lib/dialpad/sanitize";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Returns the current state of a Dialpad call session. The UI polls this
 * while a call is active; in mock mode the poll also advances the simulated
 * call through the same event pipeline used by real webhooks.
 */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = await getSessionAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const session = await getDialpadSession(id);
  if (!session) return NextResponse.json({ error: "Call session not found." }, { status: 404 });

  return NextResponse.json({ call: sanitizeSession(session) });
}

const patchSchema = z.object({
  trainingReviewStatus: z
    .enum([
      "unreviewed",
      "approved_analytics",
      "approved_evaluation",
      "approved_prompt_example",
      "approved_training",
      "rejected",
      "compliance_hold",
    ])
    .optional(),
  directoryPermissionStatus: z.enum(["pending", "granted", "denied"]).optional(),
  bookingLinkPermissionStatus: z.enum(["pending", "granted", "denied"]).optional(),
});

/** Updates review/permission workflow fields on a Dialpad call session. */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdminRole(["admin", "operations", "sales"]);
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const session = await db.callSession.findUnique({ where: { id } });
  if (!session || session.provider !== "dialpad") {
    return NextResponse.json({ error: "Call session not found." }, { status: 404 });
  }

  const parsed = patchSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "Invalid update." }, { status: 400 });

  const update: Record<string, unknown> = {};
  if (parsed.data.trainingReviewStatus) update.trainingReviewStatus = parsed.data.trainingReviewStatus;
  if (parsed.data.directoryPermissionStatus) update.directoryPermissionStatus = parsed.data.directoryPermissionStatus;
  if (parsed.data.bookingLinkPermissionStatus) {
    update.providerMetadata = {
      ...(session.providerMetadata ?? {}),
      booking_link_permission_status: parsed.data.bookingLinkPermissionStatus,
    };
  }
  if (Object.keys(update).length === 0) {
    return NextResponse.json({ call: sanitizeSession(session) });
  }
  const updated = await db.callSession.update({ where: { id }, data: update });
  return NextResponse.json({ call: sanitizeSession(updated) });
}
