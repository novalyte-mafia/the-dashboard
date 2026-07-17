import { NextRequest, NextResponse } from "next/server";
import { requireAdminRole } from "@/lib/auth";

export async function GET(req: NextRequest) {
  const admin = await requireAdminRole(["admin", "operations", "sales", "directory_reviewer"]);
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const apiKey = process.env.TELNYX_API_KEY?.trim();
  const credentialId = process.env.TELNYX_CREDENTIAL_ID?.trim();

  if (!apiKey || !credentialId) {
    return NextResponse.json(
      { error: "Telnyx credentials (TELNYX_API_KEY and TELNYX_CREDENTIAL_ID) are not configured." },
      { status: 503 }
    );
  }

  try {
    const res = await fetch(`https://api.telnyx.com/v2/telephony_credentials/${credentialId}/token`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Telnyx token request failed: ${res.status} ${errText}`);
    }

    const payload = await res.json();
    const token = payload.data || payload.token || payload;
    return NextResponse.json({ token });
  } catch (error) {
    console.error("Failed to generate Telnyx token:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
