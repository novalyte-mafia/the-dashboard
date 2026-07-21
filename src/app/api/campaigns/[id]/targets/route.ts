import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAdminRole } from "@/lib/auth";
import { logActivity } from "@/lib/data";
import { getCampaign, setCampaignTargets } from "@/lib/campaigns/store";

const targetSchema = z.object({
  verticalId: z.string().uuid().nullable().optional(),
  geoId: z.string().uuid().nullable().optional(),
  intent: z.string().trim().max(120).nullable().optional(),
  clinicIds: z.array(z.string()).optional(),
  include: z.boolean().optional(),
  warnings: z.array(z.unknown()).optional(),
});

const bodySchema = z.object({
  targets: z.array(targetSchema),
});

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const admin = await requireAdminRole(["admin", "operations"]);
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const parsed = bodySchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid request.", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  try {
    const campaign = await getCampaign(id);
    if (!campaign) {
      return NextResponse.json({ error: "Campaign not found." }, { status: 404 });
    }

    const targets = await setCampaignTargets(id, parsed.data.targets);
    await logActivity({
      adminId: admin.id,
      entityType: "cs_campaign",
      entityId: id,
      action: "campaign_targets_set",
      summary: `Set ${targets.length} targets on campaign ${campaign.name}`,
    }).catch(() => undefined);

    return NextResponse.json({ targets });
  } catch (error) {
    console.error("campaign targets", error);
    const message = error instanceof Error ? error.message : "Unable to set targets.";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
