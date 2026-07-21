import { NextResponse } from "next/server";
import { getSessionAdmin } from "@/lib/auth";
import { listTemplatesWithVersions } from "@/lib/campaigns/store";

export async function GET() {
  if (!(await getSessionAdmin())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const templates = await listTemplatesWithVersions();
    return NextResponse.json({ templates });
  } catch (error) {
    console.error("campaign templates", error);
    const message = error instanceof Error ? error.message : "Unable to load templates.";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
