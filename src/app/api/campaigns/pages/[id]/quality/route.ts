import { NextRequest, NextResponse } from "next/server";
import { requireAdminRole } from "@/lib/auth";
import { logActivity } from "@/lib/data";
import { runQualityChecks } from "@/lib/campaigns/quality";
import { getPage, storeQualityReport } from "@/lib/campaigns/store";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const admin = await requireAdminRole(["admin", "operations"]);
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  try {
    const page = await getPage(id);
    if (!page) {
      return NextResponse.json({ error: "Page not found." }, { status: 404 });
    }

    const result = runQualityChecks(page);
    const report = await storeQualityReport(id, result);

    await logActivity({
      adminId: admin.id,
      entityType: "cs_page",
      entityId: id,
      action: "campaign_page_quality_check",
      summary: `Quality check on ${page.path}: score ${result.score}`,
      metadata: { score: result.score, blocking: result.blocking },
    }).catch(() => undefined);

    return NextResponse.json({ result, report });
  } catch (error) {
    console.error("campaign page quality", error);
    const message = error instanceof Error ? error.message : "Unable to run quality checks.";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
