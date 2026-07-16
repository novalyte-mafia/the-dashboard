import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAdminRole } from "@/lib/auth";
import { logActivity } from "@/lib/data";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdminRole(["admin", "operations", "directory_reviewer"]);
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const body = (await req.json()) as Record<string, unknown>;

  const existing = await db.directoryProfile.findUnique({
    where: { id },
    include: {
      clinic: {
        select: {
          id: true,
          name: true,
          city: true,
          state: true,
          zip: true,
          primaryPhone: true,
          generalEmail: true,
          website: true,
          notes: true
        }
      }
    }
  });
  
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

  // Publication is an approval boundary. Verification and publication are
  // intentionally separate states; importing a prospect must never make it
  // public or verified by itself.
  if (data.listingStatus === "published" && existing.listingStatus !== "published") {
    if (String(data.verificationStatus ?? existing.verificationStatus) !== "verified") {
      return NextResponse.json({ error: "A directory profile must be verified before it can be published." }, { status: 409 });
    }
    // Check if it already exists in public table to prevent duplicates
    let publicClinic = await db.publicClinic.findFirst({
      where: { name: existing.clinic.name, city: existing.clinic.city, state: existing.clinic.state }
    });

    if (!publicClinic) {
      // Generate a unique slug
      let slug = existing.clinic.name.toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/(^-|-$)/g, "");
      const count = await db.publicClinic.count({ where: { slug } });
      if (count > 0) {
        slug = `${slug}-${Math.random().toString(36).substring(2, 6)}`;
      }

      // Create entry in the public Clinic table
      publicClinic = await db.publicClinic.create({
        data: {
          name: existing.clinic.name,
          slug,
          overview: existing.clinic.notes || `Medical clinic specializing in health services in ${existing.clinic.city}, ${existing.clinic.state}.`,
          city: existing.clinic.city,
          state: existing.clinic.state,
          zip: existing.clinic.zip || "",
          phone: existing.clinic.primaryPhone,
          email: existing.clinic.generalEmail,
          website: existing.clinic.website,
          specialties: "Men's Health",
          verified: true,
          verificationStatus: "verified",
          claimStatus: existing.claimStatus || "unclaimed",
          profileCompleteness: data.profileCompleteness || existing.profileCompleteness || 50,
        }
      });

      // Copy associated locations to the public ClinicLocation table
      const locs = await db.clinicLocation.findMany({ where: { clinicId: existing.clinicId } });
      for (const loc of locs) {
        await db.publicClinicLocation.create({
          data: {
            clinicId: publicClinic.id,
            name: loc.label || "Main Location",
            address: loc.address || "",
            phone: loc.phone || publicClinic.phone || "",
            hours: loc.hours || "",
            onSiteLab: false,
            phlebotomy: false
          }
        });
      }

      data.publicClinicId = publicClinic.id;
    }
    data.publicationStatus = "published";
  }

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
