import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { getDialpadConfig } from "@/lib/dialpad/env";
import { runEnrichmentJobs } from "@/lib/dialpad/service";
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
 * Durable post-call enrichment worker. Claims due dialpad_enrichment_jobs
 * rows atomically and retrieves call details, transcripts, and recording
 * metadata with retry backoff. Invoked by Vercel Cron (CRON_SECRET) or by an
 * authorized admin for manual retry.
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

  const report = await runEnrichmentJobs(10);
  return NextResponse.json({ ok: true, report });
}

export async function POST(req: NextRequest) {
  return run(req);
}

/** Vercel Cron invokes GET. */
export async function GET(req: NextRequest) {
  return run(req);
}
