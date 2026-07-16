import { NextResponse } from "next/server";
import { getSessionAdmin } from "@/lib/auth";
import { getVapiCall } from "@/lib/providers/vapi";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await getSessionAdmin())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const { id } = await params;
    const call = await getVapiCall(id);
    return NextResponse.json({ call: { id: call.id, status: call.status, startedAt: call.startedAt, endedAt: call.endedAt, durationSec: call.durationSec } });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Vapi status request failed." }, { status: 502 });
  }
}
