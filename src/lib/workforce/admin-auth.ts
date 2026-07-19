import { NextResponse } from "next/server";
import { getSessionAdmin, hasRole, type SessionAdmin } from "@/lib/auth";

const WORKFORCE_ADMIN_ROLES = ["founder", "admin", "operations"] as const;

export async function requireWorkforceAdmin(): Promise<
  { admin: SessionAdmin } | { response: NextResponse }
> {
  const admin = await getSessionAdmin();
  if (!admin) {
    return { response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }
  if (!hasRole(admin, WORKFORCE_ADMIN_ROLES)) {
    return { response: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }
  return { admin };
}
