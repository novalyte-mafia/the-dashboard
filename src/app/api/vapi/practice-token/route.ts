import { NextResponse } from "next/server";
import { getSessionAdmin } from "@/lib/auth";

export async function POST() {
  if (!(await getSessionAdmin())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const privateKey = process.env.VAPI_API_KEY?.trim();
  if (!privateKey) {
    return NextResponse.json({ error: "Provider-grade practice voice is not configured." }, { status: 503 });
  }

  const tokenResponse = await fetch("https://api.vapi.ai/token?limit=100", {
    headers: { Authorization: `Bearer ${privateKey}` },
    cache: "no-store",
    signal: AbortSignal.timeout(15000),
  });
  const tokens = await tokenResponse.json().catch(() => []);
  const publicToken = Array.isArray(tokens)
    ? tokens.find((token) => token.tag === "public"
      && token.value
      && !token.restrictions?.allowedAssistantIds?.length
      && token.restrictions?.allowTransientAssistant !== false)
    : null;
  if (!tokenResponse.ok || !publicToken?.value) {
    return NextResponse.json({ error: "No Vapi public browser token is available for practice." }, { status: 503 });
  }

  return NextResponse.json({ token: publicToken.value });
}
