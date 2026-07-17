import { NextRequest, NextResponse } from "next/server";
import { requireAdminRole } from "@/lib/auth";

export async function GET(req: NextRequest) {
  const admin = await requireAdminRole(["admin", "operations", "sales", "directory_reviewer"]);
  if (!admin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const apiKey = process.env.DEEPGRAM_API_KEY;
  const projectId = process.env.DEEPGRAM_PROJECT_ID;

  if (!apiKey || !projectId) {
    return NextResponse.json(
      { error: "Deepgram API key or Project ID not configured in environment variables." },
      { status: 500 }
    );
  }

  try {
    const res = await fetch(`https://api.deepgram.com/v1/projects/${projectId}/keys`, {
      method: "POST",
      headers: {
        "Authorization": `Token ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        comment: `Temp client key for ${admin.email || "admin"}`,
        scopes: ["usage:write"],
        time_to_live_in_seconds: 1800, // 30 minutes
      }),
      cache: "no-store",
    });

    const data = await res.json();
    if (!res.ok) {
      console.error("Deepgram API Key generation failed:", data);
      return NextResponse.json(
        { error: data.message || "Failed to generate temporary Deepgram token." },
        { status: res.status }
      );
    }

    return NextResponse.json({ token: data.key });
  } catch (err) {
    console.error("Deepgram Route Error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
