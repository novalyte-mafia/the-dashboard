import { NextRequest, NextResponse } from "next/server";
import { getSessionAdmin } from "@/lib/auth";
import { listPages } from "@/lib/campaigns/store";

export async function GET(req: NextRequest) {
  if (!(await getSessionAdmin())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const campaignId = req.nextUrl.searchParams.get("campaignId") ?? undefined;
  const status = req.nextUrl.searchParams.get("status") ?? undefined;

  try {
    const pages = await listPages({ campaignId, status });
    return NextResponse.json({ pages });
  } catch (error) {
    console.error("campaign pages list", error);
    const message = error instanceof Error ? error.message : "Unable to load pages.";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
