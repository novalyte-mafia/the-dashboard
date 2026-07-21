import { NextRequest, NextResponse } from "next/server";
import { requireAdminRole } from "@/lib/auth";
import { logActivity } from "@/lib/data";
import { generateCampaignPages, getCampaign } from "@/lib/campaigns/store";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const admin = await requireAdminRole(["admin", "operations"]);
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  try {
    const campaign = await getCampaign(id);
    if (!campaign) {
      return NextResponse.json({ error: "Campaign not found." }, { status: 404 });
    }

    const { pages, jobs } = await generateCampaignPages(id, admin.id);

    await logActivity({
      adminId: admin.id,
      entityType: "cs_campaign",
      entityId: id,
      action: "campaign_pages_generated",
      summary: `Generated ${pages.length} pages for campaign ${campaign.name}`,
      metadata: { pageCount: pages.length, jobCount: jobs.length },
    }).catch(() => undefined);

    return NextResponse.json({ pages, jobs }, { status: 201 });
  } catch (error) {
    console.error("campaign generate", error);
    const message = error instanceof Error ? error.message : "Unable to generate pages.";
    const status = /not found|no included targets/i.test(message) ? 400 : 502;
    return NextResponse.json({ error: message }, { status });
  }
}
