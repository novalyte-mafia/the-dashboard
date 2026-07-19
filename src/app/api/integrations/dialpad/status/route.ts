import { NextRequest, NextResponse } from "next/server";
import { getSessionAdmin } from "@/lib/auth";
import { getIntegrationStatus } from "@/lib/dialpad/service";
import { getDialpadConfig } from "@/lib/dialpad/env";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Sanitized Dialpad integration diagnostics for the Calls page and admin
 * troubleshooting. Never returns secrets or key material.
 */
export async function GET(req: NextRequest) {
  const admin = await getSessionAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const checkConnection = req.nextUrl.searchParams.get("checkConnection") === "true";
  const status = await getIntegrationStatus({ checkConnection });
  const config = getDialpadConfig();

  return NextResponse.json({
    status,
    cti: {
      enabled: config.ctiEnabled,
      provisioned: Boolean(config.ctiClientId),
      message: config.ctiClientId
        ? undefined
        : "Embedded Dialpad requires a CTI client ID and dashboard-origin approval from Dialpad.",
    },
  });
}
