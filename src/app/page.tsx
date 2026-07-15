import { AdminApp } from "@/components/admin/admin-app";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function Home() {
  // Login screen removed for now — load the first active admin directly.
  let admin = await db.adminMember.findFirst({
    where: { status: "active" },
    orderBy: { createdAt: "asc" },
  });

  // Fallback: ensure a founder exists so the app always renders.
  if (!admin) {
    const { hashPassword } = await import("@/lib/auth");
    admin = await db.adminMember.create({
      data: {
        email: "founder@novalyte.io",
        passwordHash: hashPassword("novalyte2025"),
        role: "founder",
        status: "active",
        firstName: "Jordan",
        lastName: "Ellis",
      },
    });
  }

  return (
    <AdminApp
      admin={{
        id: admin.id,
        email: admin.email,
        role: admin.role,
        firstName: admin.firstName,
        lastName: admin.lastName,
      }}
    />
  );
}
