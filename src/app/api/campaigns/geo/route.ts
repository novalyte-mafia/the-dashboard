import { NextRequest, NextResponse } from "next/server";
import { getSessionAdmin } from "@/lib/auth";
import { listGeoEntities } from "@/lib/campaigns/store";

export async function GET(req: NextRequest) {
  if (!(await getSessionAdmin())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const kind = req.nextUrl.searchParams.get("kind") ?? undefined;
  const parent = req.nextUrl.searchParams.get("parent") ?? undefined;

  try {
    const geo = await listGeoEntities({
      kind,
      parentId: parent,
    });
    return NextResponse.json({ geo });
  } catch (error) {
    console.error("campaign geo", error);
    const message = error instanceof Error ? error.message : "Unable to load geo entities.";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
