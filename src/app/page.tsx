import { AdminApp } from "@/components/admin/admin-app";
import { LoginScreen } from "@/components/admin/login-screen";
import { getSessionAdmin } from "@/lib/auth";
import { OUTREACH_SUBVIEWS } from "@/lib/outreach/types";

export const dynamic = "force-dynamic";

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const admin = await getSessionAdmin();
  if (!admin) return <LoginScreen />;

  const params = await searchParams;
  const rawView = typeof params.view === "string" ? params.view.trim() : undefined;
  const clinicId = typeof params.clinicId === "string" ? params.clinicId.trim() : null;
  const submission =
    (typeof params.submission === "string" && params.submission.trim()) ||
    (typeof params.submissionId === "string" && params.submissionId.trim()) ||
    null;

  const initialParams: Record<string, unknown> = {};
  if (submission) initialParams.submissionId = submission;

  // Outreach subviews live under /outreach; ignore them on the home route.
  const initialView =
    rawView && !(OUTREACH_SUBVIEWS as readonly string[]).includes(rawView) ? rawView : undefined;

  return (
    <AdminApp
      admin={{
        id: admin.id,
        email: admin.email,
        role: admin.role,
        firstName: admin.firstName,
        lastName: admin.lastName,
      }}
      initialView={initialView}
      initialClinicId={clinicId}
      initialParams={Object.keys(initialParams).length ? initialParams : undefined}
    />
  );
}
