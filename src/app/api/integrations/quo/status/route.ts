import { NextResponse } from "next/server";
import { requireAdminRole } from "@/lib/auth";
import { getQuoConfig } from "@/lib/quo/env";
import { QuoApiError, resolveQuoCaller } from "@/lib/quo/client";

export async function GET() {
  const admin = await requireAdminRole(["admin", "operations", "sales", "directory_reviewer"]);
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const config = getQuoConfig();
  if (!config.enabled) {
    return NextResponse.json({
      status: {
        provider: "quo",
        enabled: false,
        configured: false,
        configErrors: ["QUO_INTEGRATION_ENABLED=false"],
        phoneNumberId: null,
        fromNumber: null,
        name: null,
        dialMode: "click_to_call",
        note: "Quo API cannot place calls programmatically; click-to-call opens the Quo app.",
      },
    });
  }

  if (!config.configured) {
    return NextResponse.json({
      status: {
        provider: "quo",
        enabled: true,
        configured: false,
        configErrors: config.configErrors,
        phoneNumberId: null,
        fromNumber: null,
        name: null,
        dialMode: "click_to_call",
        note: "Quo API cannot place calls programmatically; click-to-call opens the Quo app.",
      },
    });
  }

  try {
    const caller = await resolveQuoCaller();
    const configErrors = [...config.configErrors];
    if (!caller.fromNumber) configErrors.push("No Quo phone number on workspace");

    return NextResponse.json({
      status: {
        provider: "quo",
        enabled: true,
        configured: configErrors.length === 0,
        configErrors,
        phoneNumberId: caller.phoneNumberId,
        fromNumber: caller.fromNumber,
        name: caller.name,
        dialMode: "click_to_call",
        note: "Quo API cannot place calls programmatically; click-to-call opens the Quo app (set Quo as default calling app).",
      },
    });
  } catch (err) {
    const message = err instanceof QuoApiError ? err.message : "Failed to reach Quo API";
    return NextResponse.json({
      status: {
        provider: "quo",
        enabled: true,
        configured: false,
        configErrors: [message],
        phoneNumberId: null,
        fromNumber: null,
        name: null,
        dialMode: "click_to_call",
        note: "Quo API cannot place calls programmatically; click-to-call opens the Quo app.",
      },
    });
  }
}
