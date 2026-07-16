import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { timingSafeEqual } from "node:crypto";
import { db } from "@/lib/db";
import { createSessionToken, setSessionCookie } from "@/lib/auth";
import { logActivity } from "@/lib/data";

const schema = z.object({
  accessCode: z.string().min(1).max(128),
});

function isValidAccessCode(candidate: string) {
  const configured = process.env.NOVALYTE_ACCESS_CODE?.trim();
  if (!configured) return false;
  const candidateBuffer = Buffer.from(candidate);
  const configuredBuffer = Buffer.from(configured);
  return candidateBuffer.length === configuredBuffer.length && timingSafeEqual(candidateBuffer, configuredBuffer);
}

export async function POST(req: NextRequest) {
  try {
    const body = schema.parse(await req.json());
    if (!isValidAccessCode(body.accessCode)) {
      return NextResponse.json({ error: "Invalid access code." }, { status: 401 });
    }
    const configuredEmail = process.env.NOVALYTE_ADMIN_EMAIL?.trim().toLowerCase();
    const admin = configuredEmail
      ? await db.adminMember.findUnique({ where: { email: configuredEmail } })
      : await db.adminMember.findFirst({ where: { status: "active" }, orderBy: { createdAt: "asc" } });
    if (!admin || admin.status !== "active") {
      return NextResponse.json({ error: "Invalid credentials or inactive account." }, { status: 401 });
    }
    await db.adminMember.update({
      where: { id: admin.id },
      data: { lastLoginAt: new Date() },
    });
    const token = createSessionToken({ adminId: admin.id, email: admin.email, role: admin.role });
    await setSessionCookie(token);
    await logActivity({
      entityType: "admin",
      entityId: admin.id,
      action: "admin_signed_in",
      summary: `${admin.firstName} ${admin.lastName} signed in`,
      adminId: admin.id,
    });
    return NextResponse.json({
      admin: {
        id: admin.id,
        email: admin.email,
        role: admin.role,
        firstName: admin.firstName,
        lastName: admin.lastName,
      },
    });
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }
}
