import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSessionAdmin, requireAdminRole } from "@/lib/auth";
import { logActivity } from "@/lib/data";
import { createCampaign, listCampaigns } from "@/lib/campaigns/store";

const createSchema = z.object({
  name: z.string().trim().min(1).max(200),
  internalName: z.string().trim().max(200).optional(),
  objective: z.string().trim().max(2000).optional(),
  trafficType: z
    .enum([
      "organic",
      "paid_search",
      "paid_social",
      "directory",
      "education",
      "market_test",
    ])
    .optional(),
  verticalId: z.string().uuid().optional(),
  settings: z.record(z.string(), z.unknown()).optional(),
});

export async function GET(req: NextRequest) {
  if (!(await getSessionAdmin())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const status = req.nextUrl.searchParams.get("status") ?? undefined;
  try {
    const campaigns = await listCampaigns(status);
    return NextResponse.json({ campaigns });
  } catch (error) {
    console.error("campaigns list", error);
    const message = error instanceof Error ? error.message : "Unable to load campaigns.";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}

export async function POST(req: NextRequest) {
  const admin = await requireAdminRole(["admin", "operations"]);
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const parsed = createSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid request.", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  try {
    const campaign = await createCampaign(parsed.data, admin.id);
    await logActivity({
      adminId: admin.id,
      entityType: "cs_campaign",
      entityId: campaign.id,
      action: "campaign_created",
      summary: `Created campaign ${campaign.name}`,
    }).catch(() => undefined);
    return NextResponse.json({ campaign }, { status: 201 });
  } catch (error) {
    console.error("campaigns create", error);
    const message = error instanceof Error ? error.message : "Unable to create campaign.";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
