import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSessionAdmin, requireAdminRole } from "@/lib/auth";
import { logActivity } from "@/lib/data";
import {
  getCampaign,
  listCampaignTargets,
  updateCampaign,
} from "@/lib/campaigns/store";

const patchSchema = z.object({
  name: z.string().trim().min(1).max(200).optional(),
  internalName: z.string().trim().max(200).nullable().optional(),
  objective: z.string().trim().max(2000).nullable().optional(),
  trafficType: z
    .enum([
      "organic",
      "paid_search",
      "paid_social",
      "directory",
      "education",
      "market_test",
    ])
    .nullable()
    .optional(),
  verticalId: z.string().uuid().nullable().optional(),
  status: z.enum(["draft", "active", "paused", "archived"]).optional(),
  settings: z.record(z.string(), z.unknown()).optional(),
});

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!(await getSessionAdmin())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  try {
    const campaign = await getCampaign(id);
    if (!campaign) {
      return NextResponse.json({ error: "Campaign not found." }, { status: 404 });
    }
    const targets = await listCampaignTargets(id);
    return NextResponse.json({ campaign, targets });
  } catch (error) {
    console.error("campaign get", error);
    const message = error instanceof Error ? error.message : "Unable to load campaign.";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const admin = await requireAdminRole(["admin", "operations"]);
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const parsed = patchSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid request.", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  try {
    const campaign = await updateCampaign(id, parsed.data);
    await logActivity({
      adminId: admin.id,
      entityType: "cs_campaign",
      entityId: campaign.id,
      action: "campaign_updated",
      summary: `Updated campaign ${campaign.name}`,
    }).catch(() => undefined);
    return NextResponse.json({ campaign });
  } catch (error) {
    console.error("campaign patch", error);
    const message = error instanceof Error ? error.message : "Unable to update campaign.";
    const status = /not found/i.test(message) ? 404 : 502;
    return NextResponse.json({ error: message }, { status });
  }
}
