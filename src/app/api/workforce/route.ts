import { NextRequest, NextResponse } from "next/server";
import { getSessionAdmin } from "@/lib/auth";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import {
  mapClinicClaim,
  mapJobApplication,
  mapJobListing,
  mapProfessionalDocuments,
  mapProfessionals,
} from "@/lib/workforce/mappers";

/** Supabase embed joins can type as object or array depending on generated types. */
function normalizeRelation<T extends Record<string, unknown>>(row: T): T {
  const next: Record<string, unknown> = { ...row };
  for (const key of Object.keys(next)) {
    const value = next[key];
    if (Array.isArray(value) && value.length <= 1 && value[0] && typeof value[0] === "object") {
      next[key] = value[0];
    }
  }
  return next as T;
}

export async function GET(req: NextRequest) {
  if (!(await getSessionAdmin())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const resource = req.nextUrl.searchParams.get("resource") ?? "professionals";
  const supabase = getSupabaseAdmin();

  try {
    if (resource === "professionals") {
      const { data: profiles, error } = await supabase
        .from("workforce_professional_profiles")
        .select(
          "id, name, title, specialty, city, state, experience, availability, review_status, status, createdAt",
        )
        .order("createdAt", { ascending: false })
        .limit(500);
      if (error) throw error;

      const profileIds = (profiles ?? []).map((profile) => profile.id);
      const [licensesResult, certificationsResult, documentsResult] = await Promise.all([
        profileIds.length
          ? supabase
              .from("professional_licenses")
              .select("profileId, type, state, number, expires, status")
              .in("profileId", profileIds)
          : Promise.resolve({ data: [], error: null }),
        profileIds.length
          ? supabase
              .from("professional_certifications")
              .select("profileId, name, authority, expires")
              .in("profileId", profileIds)
          : Promise.resolve({ data: [], error: null }),
        profileIds.length
          ? supabase
              .from("professional_documents")
              .select("id, profileId, name, type, verification_status, status, createdAt, verified_at")
              .in("profileId", profileIds)
          : Promise.resolve({ data: [], error: null }),
      ]);

      if (licensesResult.error) throw licensesResult.error;
      if (certificationsResult.error) throw certificationsResult.error;
      if (documentsResult.error) throw documentsResult.error;

      return NextResponse.json({
        professionals: mapProfessionals(
          profiles ?? [],
          licensesResult.data ?? [],
          certificationsResult.data ?? [],
          documentsResult.data ?? [],
        ),
      });
    }

    if (resource === "documents") {
      const { data: documents, error } = await supabase
        .from("professional_documents")
        .select("id, profileId, name, type, verification_status, status, createdAt, verified_at")
        .order("createdAt", { ascending: false })
        .limit(500);
      if (error) throw error;

      const profileIds = [...new Set((documents ?? []).map((doc) => doc.profileId))];
      const { data: profiles, error: profileError } = profileIds.length
        ? await supabase
            .from("workforce_professional_profiles")
            .select("id, name, title, specialty")
            .in("id", profileIds)
        : { data: [], error: null };
      if (profileError) throw profileError;

      return NextResponse.json({
        documents: mapProfessionalDocuments(documents ?? [], profiles ?? []),
      });
    }

    if (resource === "jobs") {
      const { data: jobs, error } = await supabase
        .from("JobPosting")
        .select(
          "id, title, clinicName, organization_id, treatmentSpecialties, city, state, employmentType, compMin, compMax, status, createdAt",
        )
        .order("createdAt", { ascending: false })
        .limit(500);
      if (error) throw error;

      const jobIds = (jobs ?? []).map((job) => job.id);
      const orgIds = [...new Set((jobs ?? []).map((job) => job.organization_id).filter(Boolean))] as string[];

      const [applicationsResult, orgsResult] = await Promise.all([
        jobIds.length
          ? supabase.from("JobApplication").select("jobPostingId").in("jobPostingId", jobIds).is("withdrawn_at", null)
          : Promise.resolve({ data: [], error: null }),
        orgIds.length
          ? supabase.from("employer_organizations").select("id, public_name, legal_name").in("id", orgIds)
          : Promise.resolve({ data: [], error: null }),
      ]);
      if (applicationsResult.error) throw applicationsResult.error;
      if (orgsResult.error) throw orgsResult.error;

      const counts = new Map<string, number>();
      for (const row of applicationsResult.data ?? []) {
        counts.set(row.jobPostingId, (counts.get(row.jobPostingId) ?? 0) + 1);
      }
      const orgNames = new Map<string, string>(
        ((orgsResult.data ?? []) as Array<{ id: string; public_name: string | null; legal_name: string | null }>).map(
          (org) => [org.id, org.public_name ?? org.legal_name ?? "Unknown employer"] as const,
        ),
      );

      return NextResponse.json({
        jobs: (jobs ?? []).map((job) =>
          mapJobListing(
            job,
            counts.get(job.id) ?? 0,
            job.organization_id ? orgNames.get(job.organization_id) : job.clinicName,
          ),
        ),
      });
    }

    if (resource === "applications") {
      const { data, error } = await supabase
        .from("JobApplication")
        .select(
          `
          id,
          jobPostingId,
          workforce_profile_id,
          applicantName,
          status,
          createdAt,
          JobPosting:jobPostingId (title, clinicName, organization_id),
          profile:workforce_profile_id (name)
        `,
        )
        .is("withdrawn_at", null)
        .order("createdAt", { ascending: false })
        .limit(500);
      if (error) throw error;

      return NextResponse.json({
        applications: ((data ?? []) as unknown[]).map((row) => mapJobApplication(normalizeRelation(row as Record<string, unknown>) as any)),
      });
    }

    if (resource === "clinic-claims") {
      const { data, error } = await supabase
        .from("clinic_claims")
        .select(
          `
          id,
          clinic_id,
          organization_id,
          claimant_user_id,
          status,
          reviewer_notes,
          reviewed_by,
          reviewed_at,
          created_at,
          updated_at,
          Clinic:clinic_id (name, city, state),
          employer:organization_id (public_name, legal_name)
        `,
        )
        .order("created_at", { ascending: false })
        .limit(500);
      if (error) throw error;

      return NextResponse.json({
        claims: ((data ?? []) as unknown[]).map((row) => mapClinicClaim(normalizeRelation(row as Record<string, unknown>) as any)),
      });
    }

    return NextResponse.json({ error: "Unknown workforce resource." }, { status: 400 });
  } catch (error) {
    console.error("workforce GET error", error);
    return NextResponse.json({ error: "Unable to load workforce records." }, { status: 502 });
  }
}
