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
          website: true
        }
      }
    }
  });
  
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const allowed = ["listingStatus", "claimStatus", "verificationStatus",
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

  const requestedListingStatus =
    typeof data.listingStatus === "string" ? data.listingStatus : null;
  const permissionCall =
    requestedListingStatus === "approved" || requestedListingStatus === "published"
      ? await db.callSession.findFirst({
          where: {
            clinicId: existing.clinicId,
            directoryPermissionStatus: "granted",
            callEnvironment: "live",
          },
        })
      : null;

  if (requestedListingStatus === "approved") {
    if (String(data.verificationStatus ?? existing.verificationStatus) !== "verified") {
      return NextResponse.json(
        { error: "Verify the clinic before approving its public profile." },
        { status: 409 },
      );
    }
    if (!permissionCall) {
      return NextResponse.json(
        { error: "A live call with explicit directory permission is required before approval." },
        { status: 409 },
      );
    }
    if (Number(data.profileCompleteness) !== 100) {
      return NextResponse.json(
        { error: "Complete and review every public profile section before approval." },
        { status: 409 },
      );
    }

    data.permissionSourceCallId = permissionCall.id;
    data.permissionGrantedAt =
      permissionCall.endedAt ?? permissionCall.startedAt ?? new Date();
    data.approvedAt = new Date();
    data.publicationStatus = "approved";
  }

  // Publication is an approval boundary. Verification and publication are
  // intentionally separate states; importing a prospect must never make it
  // public or verified by itself.
  if (requestedListingStatus === "published" && existing.listingStatus !== "published") {
    if (existing.listingStatus !== "approved") {
      return NextResponse.json(
        { error: "Approve the completed profile in a separate review step before publishing." },
        { status: 409 },
      );
    }
    if (String(data.verificationStatus ?? existing.verificationStatus) !== "verified") {
      return NextResponse.json({ error: "A directory profile must be verified before it can be published." }, { status: 409 });
    }
    if (!permissionCall) {
      return NextResponse.json(
        { error: "A live call with explicit directory permission is required before publication." },
        { status: 409 },
      );
    }
    if (Number(data.profileCompleteness) !== 100) {
      return NextResponse.json(
        { error: "Complete and review every public profile section before publication." },
        { status: 409 },
      );
    }
    // Check if it already exists in public table to prevent duplicates
    let publicClinic = existing.publicClinicId
      ? await db.publicClinic.findUnique({ where: { id: existing.publicClinicId } })
      : await db.publicClinic.findFirst({
          where: { name: existing.clinic.name, city: existing.clinic.city, state: existing.clinic.state }
        });

    if (!publicClinic) {
      // Generate a unique slug
      const slugBase = `${existing.clinic.name}-${existing.clinic.city}-${existing.clinic.state}`.toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/(^-|-$)/g, "");
      const count = await db.publicClinic.count({ where: { slug: slugBase } });
      const slug = count > 0
        ? `${slugBase}-${String(existing.clinic.id).slice(-6).toLowerCase()}`
        : slugBase;

      // Create entry in the public Clinic table
      publicClinic = await db.publicClinic.create({
        data: {
          name: existing.clinic.name,
          slug,
          overview: "",
          city: existing.clinic.city,
          state: existing.clinic.state,
          zip: existing.clinic.zip || "",
          phone: existing.clinic.primaryPhone,
          email: null,
          website: existing.clinic.website,
          specialties: "",
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
    data.publicClinicId = publicClinic.id;
    data.permissionSourceCallId = permissionCall.id;
    data.permissionGrantedAt =
      permissionCall.endedAt ?? permissionCall.startedAt ?? new Date();
    data.approvedAt = existing.approvedAt ?? new Date();
    data.publishedAt = new Date();
    data.suspendedAt = null;
    data.publicationStatus = "published";
  }

  if (
    requestedListingStatus &&
    ["needs_update", "suspended", "archived"].includes(requestedListingStatus)
  ) {
    data.publicationStatus =
      requestedListingStatus === "suspended" ? "suspended" : "unpublished";
    data.suspendedAt = new Date();
    // Clear the publication timestamp so RLS and public loaders fail closed.
    data.publishedAt = null;
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
