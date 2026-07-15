import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { verifyPassword, createSessionToken, setSessionCookie } from "@/lib/auth";
import { logActivity } from "@/lib/data";

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export async function POST(req: NextRequest) {
  try {
    const body = schema.parse(await req.json());
    const admin = await db.adminMember.findUnique({ where: { email: body.email.toLowerCase() } });
    if (!admin || admin.status !== "active") {
      return NextResponse.json({ error: "Invalid credentials or inactive account." }, { status: 401 });
    }
    if (!verifyPassword(body.password, admin.passwordHash)) {
      return NextResponse.json({ error: "Invalid credentials." }, { status: 401 });
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
