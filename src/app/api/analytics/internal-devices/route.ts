import { createHash, randomBytes } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { requireAdminRole } from "@/lib/auth";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { hashToken } from "@/lib/analytics/classification";

function parseUa(ua: string | null) {
  if (!ua) return { browser: null, os: null, deviceType: "desktop" as const };
  const os = /iPhone|iPad|iPod/i.test(ua)
    ? "iOS"
    : /Android/i.test(ua)
      ? "Android"
      : /Mac OS X/i.test(ua)
        ? "macOS"
        : /Windows/i.test(ua)
          ? "Windows"
          : /Linux/i.test(ua)
            ? "Linux"
            : null;
  const browser = /Edg\//i.test(ua)
    ? "Edge"
    : /Chrome\//i.test(ua)
      ? "Chrome"
      : /Safari\//i.test(ua) && !/Chrome\//i.test(ua)
        ? "Safari"
        : /Firefox\//i.test(ua)
          ? "Firefox"
          : null;
  const deviceType = /Mobile|Android|iPhone/i.test(ua)
    ? "mobile"
    : /iPad|Tablet/i.test(ua)
      ? "tablet"
      : "desktop";
  return { browser, os, deviceType };
}

export async function GET() {
  const admin = await requireAdminRole(["admin", "operations", "founder"]);
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const db = getSupabaseAdmin();
  const { data, error } = await db
    .from("internal_analytics_devices")
    .select(
      "id, owner_user_id, owner_email, label, device_type, browser, operating_system, first_registered_at, last_seen_at, status, revoked_at",
    )
    .order("first_registered_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    devices: data ?? [],
    currentAdminId: admin.id,
    currentAdminEmail: admin.email,
  });
}

export async function POST(request: NextRequest) {
  const admin = await requireAdminRole(["admin", "operations", "founder"]);
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = (await request.json().catch(() => ({}))) as {
    label?: string;
    action?: "register" | "revoke" | "rename" | "heartbeat";
    deviceId?: string;
    token?: string;
  };

  const db = getSupabaseAdmin();
  const action = body.action || "register";

  if (action === "revoke") {
    if (!body.deviceId) {
      return NextResponse.json({ error: "deviceId required" }, { status: 400 });
    }
    const { error } = await db
      .from("internal_analytics_devices")
      .update({
        status: "revoked",
        revoked_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", body.deviceId);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  if (action === "rename") {
    if (!body.deviceId || !body.label?.trim()) {
      return NextResponse.json({ error: "deviceId and label required" }, { status: 400 });
    }
    const { error } = await db
      .from("internal_analytics_devices")
      .update({ label: body.label.trim().slice(0, 120), updated_at: new Date().toISOString() })
      .eq("id", body.deviceId);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  if (action === "heartbeat") {
    if (!body.token) {
      return NextResponse.json({ error: "token required" }, { status: 400 });
    }
    const tokenHash = hashToken(body.token);
    const { data, error } = await db
      .from("internal_analytics_devices")
      .update({ last_seen_at: new Date().toISOString(), updated_at: new Date().toISOString() })
      .eq("token_hash", tokenHash)
      .eq("status", "active")
      .select("id, label, status")
      .maybeSingle();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: Boolean(data), device: data });
  }

  // register
  const ua = request.headers.get("user-agent");
  const parsed = parseUa(ua);
  const label =
    body.label?.trim() ||
    `Jamil — ${parsed.deviceType === "mobile" ? "Android/Mobile" : "Mac"}`;
  const token = randomBytes(32).toString("hex");
  const tokenHash = hashToken(token);
  const uaHash = ua ? createHash("sha256").update(ua).digest("hex").slice(0, 32) : null;

  const { data, error } = await db
    .from("internal_analytics_devices")
    .insert({
      owner_user_id: admin.id,
      owner_email: admin.email,
      label: label.slice(0, 120),
      token_hash: tokenHash,
      device_type: parsed.deviceType,
      browser: parsed.browser,
      operating_system: parsed.os,
      user_agent_hash: uaHash,
      last_seen_at: new Date().toISOString(),
      status: "active",
    })
    .select(
      "id, owner_user_id, owner_email, label, device_type, browser, operating_system, first_registered_at, last_seen_at, status",
    )
    .single();

  if (error || !data) {
    return NextResponse.json({ error: error?.message || "Failed to register" }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    device: data,
    token,
    instructions:
      "Cookies are set in this browser for .novalyte.io. Visit novalyte.io to confirm internal classification. Register Android separately from that device.",
  });
}
