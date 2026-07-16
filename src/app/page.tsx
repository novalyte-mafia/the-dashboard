import { AdminApp } from "@/components/admin/admin-app";
import { LoginScreen } from "@/components/admin/login-screen";
import { getSessionAdmin } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function Home() {
  const admin = await getSessionAdmin();
  if (!admin) return <LoginScreen />;

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
