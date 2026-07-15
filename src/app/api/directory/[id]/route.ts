import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSessionAdmin } from "@/lib/auth";
import { logActivity } from "@/lib/data";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = await getSessionAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const body = (await req.json()) as Record<string, unknown>;

  const existing = await db.directoryProfile.findUnique({ where: { id }, include: { clinic: { select: { name: true } } } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const allowed = ["listingStatus", "claimStatus", "verificationStatus", "publicationStatus",
    "servicesCompleted", "providersCompleted", "locationCompleted", "hoursCompleted",
    "pricingCompleted", "imagesCompleted", "bookingLinkCompleted"];

  const data: Record<string, unknown> = { reviewedById: admin.id, lastReviewedAt: new Date() };
  const changed: string[] = [];
  for (const k of allowed) {
    if (k in body) {
      data[k] = body[k];
      changed.push(k);
    }
  }

  // Recompute completeness
  const fields = ["servicesCompleted", "providersCompleted", "locationCompleted", "hoursCompleted", "pricingCompleted", "imagesCompleted", "bookingLinkCompleted"];
  const merged = { ...existing, ...data } as Record<string, boolean>;
  const completed = fields.filter((f) => merged[f]).length;
  data.profileCompleteness = Math.round((completed / fields.length) * 100);

  // Sync clinic.directoryStatus with listingStatus
  if (data.listingStatus) {
    await db.clinic.update({ where: { id: existing.clinicId }, data: { directoryStatus: String(data.listingStatus), updatedById: admin.id } });
  }

  const profile = await db.directoryProfile.update({ where: { id }, data: data as never });

  await logActivity({
    entityType: "directory",
    entityId: id,
    action: "directory_status_changed",
    summary: `Directory profile updated — ${existing.clinic.name}`,
    adminId: admin.id,
    metadata: { changed, completeness: profile.profileCompleteness, clinicId: existing.clinicId },
  });

  return NextResponse.json({ profile });
}
