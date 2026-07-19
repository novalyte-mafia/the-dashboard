import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { getDialpadConfig } from "@/lib/dialpad/env";
import { reconcileRecentCalls } from "@/lib/dialpad/service";
import { requireAdminRole } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

function isAuthorizedCron(req: NextRequest): boolean {
  const secret = getDialpadConfig().cronSecret;
  if (!secret) return false;
  const header = req.headers.get("authorization") ?? "";
  const expected = `Bearer ${secret}`;
  const a = Buffer.from(header);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

/**
 * Reconciliation: repairs missed webhooks by comparing recently concluded
 * Dialpad calls against local sessions. Matching uses provider call id, then
 * custom_data; phone number alone is never treated as identity.
 */
async function run(req: NextRequest) {
  if (!isAuthorizedCron(req)) {
    const admin = await requireAdminRole(["admin", "operations"]);
    if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const config = getDialpadConfig();
  if (!config.enabled) {
    return NextResponse.json({ ok: true, skipped: "integration_disabled" });
  }

  const lookback = Number(req.nextUrl.searchParams.get("lookbackMinutes") ?? 120);
  const report = await reconcileRecentCalls(Number.isFinite(lookback) ? Math.min(lookback, 24 * 60) : 120);
  return NextResponse.json({ ok: true, report });
}

export async function POST(req: NextRequest) {
  return run(req);
}

export async function GET(req: NextRequest) {
  return run(req);
}
