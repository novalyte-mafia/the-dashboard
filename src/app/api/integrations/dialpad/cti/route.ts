import { NextResponse } from "next/server";
import { getSessionAdmin } from "@/lib/auth";
import { getDialpadConfig } from "@/lib/dialpad/env";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Exposes the CTI client id (NOT a secret — it is embedded in the public
 * iframe URL) to authenticated admins, only when the server-side CTI flag is
 * enabled and provisioning is complete.
 */
export async function GET() {
  const admin = await getSessionAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const config = getDialpadConfig();
  if (!config.enabled || !config.ctiEnabled || !config.ctiClientId) {
    return NextResponse.json(
      { error: "Embedded Dialpad requires a CTI client ID and dashboard-origin approval from Dialpad." },
      { status: 404 },
    );
  }
  return NextResponse.json({ clientId: config.ctiClientId });
}
