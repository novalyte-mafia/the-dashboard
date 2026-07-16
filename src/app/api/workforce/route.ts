import { NextRequest, NextResponse } from "next/server";
import { getSessionAdmin } from "@/lib/auth";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

export async function GET(req: NextRequest) {
  if (!(await getSessionAdmin())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const resource = req.nextUrl.searchParams.get("resource") ?? "professionals";
  const table = resource === "jobs" ? "JobPosting" : resource === "applications" ? "JobApplication" : "Professional";
  const { data, error } = await getSupabaseAdmin().from(table).select("*").order("createdAt", { ascending: false }).limit(500);
  if (error) return NextResponse.json({ error: "Unable to load workforce records." }, { status: 502 });

  if (resource === "professionals") {
    return NextResponse.json({ professionals: (data ?? []).map((p: any) => ({
      id: p.id, name: p.name ?? "Unnamed professional", title: p.title ?? "Professional",
      city: p.city ?? undefined, state: p.state ?? undefined, remote: Boolean(p.remote),
      licenses: p.licenses ? String(p.licenses).split(",").map((v) => v.trim()).filter(Boolean) : [],
      licensedStates: p.licensedStates ? String(p.licensedStates).split(",").map((v) => v.trim()).filter(Boolean) : [],
      certifications: p.certifications ? String(p.certifications).split(",").map((v) => v.trim()).filter(Boolean) : [],
      yearsExperience: Number(p.yearsExperience ?? 0), availability: p.availability ?? "unavailable",
      employmentPref: p.employmentPref ?? "full-time", bio: p.bio ?? undefined,
      verified: Boolean(p.verified), credentialStatus: p.verified ? "verified" : "pending",
      verificationStatus: p.verified ? "verified" : "pending", createdAt: p.createdAt,
      dataSource: "live",
    })) });
  }
  if (resource === "jobs") {
    return NextResponse.json({ jobs: (data ?? []).map((j: any) => ({
      id: j.id, title: j.title, employerName: j.clinicName ?? "Unknown employer", employerId: j.clinicId ?? j.id,
      specialty: j.treatmentSpecialties ?? "Healthcare", city: j.city ?? undefined, state: j.state ?? undefined,
      type: j.employmentType === "part-time" ? "part_time" : j.employmentType === "contract" ? "contract" : "full_time",
      salaryMin: j.compMin ?? undefined, salaryMax: j.compMax ?? undefined, status: j.status ?? "draft",
      applicationsCount: 0, createdAt: j.createdAt, dataSource: "live",
    })) });
  }
  return NextResponse.json({ applications: (data ?? []).map((a: any) => ({
    id: a.id, jobId: a.jobId, jobTitle: a.jobTitle ?? "Job application", employerName: a.employerName ?? "Unknown employer",
    professionalId: a.professionalId, professionalName: a.professionalName ?? "Professional",
    status: a.status ?? "submitted", appliedAt: a.createdAt ?? a.appliedAt, matchScore: a.matchScore ?? undefined, dataSource: "live",
  })) });
}
