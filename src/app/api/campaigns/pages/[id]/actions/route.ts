import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAdminRole } from "@/lib/auth";
import { logActivity } from "@/lib/data";
import { applyPageAction } from "@/lib/campaigns/store";

const schema = z.object({
  action: z.enum([
    "submit_review",
    "approve",
    "request_changes",
    "publish",
    "pause",
    "archive",
  ]),
  overrideReason: z.string().trim().max(2000).optional(),
  index: z.boolean().optional(),
});

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const admin = await requireAdminRole(["admin", "operations"]);
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const parsed = schema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid request.", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  try {
    const page = await applyPageAction(id, parsed.data.action, {
      overrideReason: parsed.data.overrideReason,
      index: parsed.data.index,
      adminId: admin.id,
    });

    await logActivity({
      adminId: admin.id,
      entityType: "cs_page",
      entityId: id,
      action: `campaign_page_${parsed.data.action}`,
      summary: `${parsed.data.action} on page ${page.path}`,
    }).catch(() => undefined);

    return NextResponse.json({ page });
  } catch (error) {
    console.error("campaign page action", error);
    const message = error instanceof Error ? error.message : "Action failed.";
    let status = 502;
    if (/not found/i.test(message)) status = 404;
    else if (/must be approved|blocking|overrideReason/i.test(message)) status = 400;
    return NextResponse.json({ error: message }, { status });
  }
}
