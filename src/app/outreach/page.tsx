import { AdminApp } from "@/components/admin/admin-app";
import { LoginScreen } from "@/components/admin/login-screen";
import { getSessionAdmin } from "@/lib/auth";
import { resolveOutreachSubview } from "@/lib/outreach/routing";

export const dynamic = "force-dynamic";

export default async function OutreachPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const admin = await getSessionAdmin();
  if (!admin) return <LoginScreen />;

  const params = await searchParams;
  const rawView = typeof params.view === "string" ? params.view.trim() : null;

  return (
    <AdminApp
      initialView="outreach"
      initialParams={{ outreachSubview: resolveOutreachSubview(rawView) }}
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
