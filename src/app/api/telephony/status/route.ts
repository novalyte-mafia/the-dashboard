import { NextResponse } from "next/server";
import { requireAdminRole } from "@/lib/auth";

/** Sanitized Telnyx softphone readiness for Founder-Led Calls. */
export async function GET() {
  const admin = await requireAdminRole(["admin", "operations", "sales", "directory_reviewer"]);
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const apiKey = Boolean(process.env.TELNYX_API_KEY?.trim());
  const credentialId = Boolean(process.env.TELNYX_CREDENTIAL_ID?.trim());
  const callerNumber = process.env.TELNYX_PHONE_NUMBER?.trim() || null;
  const configErrors: string[] = [];
  if (!apiKey) configErrors.push("TELNYX_API_KEY missing");
  if (!credentialId) configErrors.push("TELNYX_CREDENTIAL_ID missing");
  if (!callerNumber) configErrors.push("TELNYX_PHONE_NUMBER missing");

  const deepgramReady = Boolean(
    process.env.DEEPGRAM_API_KEY?.trim() && process.env.DEEPGRAM_PROJECT_ID?.trim(),
  );

  return NextResponse.json({
    status: {
      provider: "telnyx",
      mode: "browser_webrtc",
      enabled: true,
      configured: configErrors.length === 0,
      configErrors,
      callerNumber,
      dialpadRequired: false,
      audio: "browser",
      // Personal-phone coach only needs Deepgram (mic → transcript → on-screen cues).
      personalPhoneReady: deepgramReady,
      deepgramConfigured: deepgramReady,
    },
  });
}
