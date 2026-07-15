import { NextResponse } from "next/server";
import { getSessionAdmin } from "@/lib/auth";
import { roleLabel } from "@/lib/constants";

export async function GET() {
  const admin = await getSessionAdmin();
  if (!admin) return NextResponse.json({ admin: null });
  return NextResponse.json({
    admin: {
      id: admin.id,
      email: admin.email,
      role: admin.role,
      roleLabel: roleLabel(admin.role),
      firstName: admin.firstName,
      lastName: admin.lastName,
      lastLoginAt: admin.lastLoginAt,
    },
  });
}
