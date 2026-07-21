import { NextResponse } from "next/server";
import { getSessionAdmin } from "@/lib/auth";
import { listVerticals } from "@/lib/campaigns/store";

export async function GET() {
  if (!(await getSessionAdmin())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const verticals = await listVerticals();
    return NextResponse.json({ verticals });
  } catch (error) {
    console.error("campaign verticals", error);
    const message = error instanceof Error ? error.message : "Unable to load verticals.";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
