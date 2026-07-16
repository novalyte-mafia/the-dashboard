import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireAdminRole } from "@/lib/auth";

const schema = z.object({
  status: z.string().max(60).optional(),
  notes: z.string().max(12000).optional(),
  transcript: z.string().max(500000).optional(),
  aiSuggestions: z.string().max(100000).optional(),
  structuredData: z.string().max(50000).optional(),
  failureCode: z.string().max(120).optional().nullable(),
  failureMessage: z.string().max(1000).optional().nullable(),
  durationSec: z.number().int().min(0).max(86400).optional(),
  endedAt: z.string().datetime().optional().nullable(),
});

const ALLOWED_STATUSES = new Set([
  "initiated", "configuring", "connecting", "ringing", "connected", "reconnecting",
  "ended", "failed", "provider_unavailable", "microphone_denied", "transcription_unavailable",
  "ai_unavailable", "saving", "saved", "save_failed",
]);

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdminRole(["admin", "operations", "sales"]);
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: "Invalid call update" }, { status: 400 });

  const existing = await db.callSession.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: "Call session not found" }, { status: 404 });
  const data = parsed.data;
  if (data.status && !ALLOWED_STATUSES.has(data.status)) {
    return NextResponse.json({ error: "Invalid call status" }, { status: 400 });
  }

  const call = await db.callSession.update({
    where: { id },
    data: {
      ...(data.status ? { status: data.status } : {}),
      ...(data.notes !== undefined ? { notes: data.notes } : {}),
      ...(data.transcript !== undefined ? { transcript: data.transcript } : {}),
      ...(data.aiSuggestions !== undefined ? { aiSuggestions: data.aiSuggestions } : {}),
      ...(data.structuredData !== undefined ? { structuredData: data.structuredData } : {}),
      ...(data.failureCode !== undefined ? { failureCode: data.failureCode } : {}),
      ...(data.failureMessage !== undefined ? { failureMessage: data.failureMessage } : {}),
      ...(data.durationSec !== undefined ? { durationSec: data.durationSec } : {}),
      ...(data.endedAt !== undefined ? { endedAt: data.endedAt ? new Date(data.endedAt) : null } : {}),
    },
  });
  return NextResponse.json({ call });
}
