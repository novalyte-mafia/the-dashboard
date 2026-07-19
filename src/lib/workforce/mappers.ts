import type {
  ClinicClaim,
  JobApplication,
  JobListing,
  Professional,
  ProfessionalDocument,
  ProfessionalReviewStatus,
} from "@/types";

type ProfileRow = {
  id: string;
  name: string;
  title: string;
  specialty: string | null;
  city: string;
  state: string;
  experience: number | null;
  availability: string | null;
  review_status: string;
  status: string | null;
  createdAt: string;
};

type LicenseRow = {
  profileId: string;
  type: string;
  state: string;
  number: string;
  expires: string | null;
  status: string | null;
};

type CertificationRow = {
  profileId: string;
  name: string;
  authority: string;
  expires: string | null;
};

type DocumentRow = {
  id: string;
  profileId: string;
  name: string;
  type: string;
  verification_status?: string | null;
  status?: string | null;
  createdAt: string;
  verified_at?: string | null;
};

function mapReviewStatus(value: string): ProfessionalReviewStatus {
  if (value === "approved" || value === "rejected" || value === "suspended" || value === "pending_review") {
    return value;
  }
  return "pending_review";
}

function mapAvailability(value: string | null): Professional["availability"] {
  const normalized = (value ?? "").toLowerCase();
  if (normalized === "available" || normalized === "open" || normalized === "placed" || normalized === "unavailable") {
    return normalized;
  }
  return "unavailable";
}

function deriveCredentialStatus(
  reviewStatus: string,
  docStatuses: string[],
  licenseExpires: (string | null)[],
): Professional["credentialStatus"] {
  const now = Date.now();
  if (licenseExpires.some((expires) => expires && new Date(expires).getTime() < now)) {
    return "expired";
  }
  if (reviewStatus === "rejected" || docStatuses.includes("rejected")) return "rejected";
  if (reviewStatus === "pending_review" || docStatuses.includes("pending")) return "pending";
  if (reviewStatus === "approved" && docStatuses.every((s) => s === "verified" || !s)) return "verified";
  if (reviewStatus === "approved") return "pending";
  return "pending";
}

function deriveVerificationStatus(
  reviewStatus: string,
  credentialStatus: Professional["credentialStatus"],
): Professional["verificationStatus"] {
  if (credentialStatus === "rejected" || reviewStatus === "rejected") return "rejected";
  if (credentialStatus === "verified" && reviewStatus === "approved") return "verified";
  return "pending";
}

export function mapProfessionals(
  profiles: ProfileRow[],
  licenses: LicenseRow[],
  certifications: CertificationRow[],
  documents: DocumentRow[],
): Professional[] {
  const licensesByProfile = new Map<string, LicenseRow[]>();
  const certsByProfile = new Map<string, CertificationRow[]>();
  const docsByProfile = new Map<string, DocumentRow[]>();

  for (const row of licenses) {
    const list = licensesByProfile.get(row.profileId) ?? [];
    list.push(row);
    licensesByProfile.set(row.profileId, list);
  }
  for (const row of certifications) {
    const list = certsByProfile.get(row.profileId) ?? [];
    list.push(row);
    certsByProfile.set(row.profileId, list);
  }
  for (const row of documents) {
    const list = docsByProfile.get(row.profileId) ?? [];
    list.push(row);
    docsByProfile.set(row.profileId, list);
  }

  return profiles.map((profile) => {
    const profileLicenses = licensesByProfile.get(profile.id) ?? [];
    const profileCerts = certsByProfile.get(profile.id) ?? [];
    const profileDocs = docsByProfile.get(profile.id) ?? [];
    const docStatuses = profileDocs.map((doc) => doc.verification_status ?? doc.status ?? "pending");
    const reviewStatus = mapReviewStatus(profile.review_status);
    const credentialStatus = deriveCredentialStatus(
      reviewStatus,
      docStatuses,
      profileLicenses.map((license) => license.expires),
    );

    return {
      id: profile.id,
      name: profile.name,
      role: profile.title,
      specialty: profile.specialty ?? profile.title,
      city: profile.city,
      state: profile.state,
      licenses: profileLicenses.map((license) => `${license.state} ${license.type}-${license.number}`),
      certifications: profileCerts.map((cert) => cert.name),
      yearsExperience: Number(profile.experience ?? 0),
      availability: mapAvailability(profile.availability),
      credentialStatus,
      verificationStatus: deriveVerificationStatus(reviewStatus, credentialStatus),
      reviewStatus,
      status: profile.status ?? undefined,
      createdAt: profile.createdAt,
      dataSource: "live" as const,
      nextCredentialExpiry: profileLicenses
        .map((license) => license.expires)
        .filter(Boolean)
        .sort()[0] ?? undefined,
    };
  });
}

export function mapProfessionalDocuments(
  documents: DocumentRow[],
  profiles: Pick<ProfileRow, "id" | "name" | "title" | "specialty">[],
): ProfessionalDocument[] {
  const profileById = new Map(profiles.map((profile) => [profile.id, profile]));

  return documents.map((doc) => {
    const profile = profileById.get(doc.profileId);
    return {
      id: doc.id,
      profileId: doc.profileId,
      profileName: profile?.name ?? "Unknown professional",
      profileRole: profile?.title ?? "Professional",
      profileSpecialty: profile?.specialty ?? profile?.title ?? "Healthcare",
      name: doc.name,
      type: doc.type,
      verificationStatus: (doc.verification_status ?? doc.status ?? "pending") as ProfessionalDocument["verificationStatus"],
      createdAt: doc.createdAt,
      verifiedAt: doc.verified_at ?? undefined,
      dataSource: "live" as const,
    };
  });
}

export function mapJobListing(
  job: {
    id: string;
    title: string;
    clinicName: string;
    organization_id?: string | null;
    treatmentSpecialties?: string | null;
    city?: string;
    state?: string;
    employmentType?: string;
    compMin?: number | null;
    compMax?: number | null;
    status?: string;
    createdAt: string;
  },
  applicationsCount = 0,
  employerName?: string,
): JobListing {
  const employmentType = job.employmentType ?? "full-time";
  return {
    id: job.id,
    title: job.title,
    employerName: employerName ?? job.clinicName ?? "Unknown employer",
    employerId: job.organization_id ?? job.id,
    specialty: job.treatmentSpecialties ?? "Healthcare",
    city: job.city,
    state: job.state,
    type:
      employmentType === "part-time"
        ? "part_time"
        : employmentType === "contract"
          ? "contract"
          : employmentType === "locum"
            ? "locum"
            : "full_time",
    salaryMin: job.compMin ?? undefined,
    salaryMax: job.compMax ?? undefined,
    status: (job.status ?? "draft") as JobListing["status"],
    applicationsCount,
    createdAt: job.createdAt,
    dataSource: "live",
  };
}

export function mapJobApplication(
  row: {
    id: string;
    jobPostingId: string;
    workforce_profile_id?: string | null;
    applicantName: string;
    status?: string;
    createdAt: string;
    JobPosting?: { title?: string; clinicName?: string; organization_id?: string | null } | null;
    profile?: { name?: string } | null;
  },
): JobApplication {
  const job = row.JobPosting;
  return {
    id: row.id,
    jobId: row.jobPostingId,
    jobTitle: job?.title ?? "Job application",
    employerName: job?.clinicName ?? "Unknown employer",
    professionalId: row.workforce_profile_id ?? "",
    professionalName: row.profile?.name ?? row.applicantName ?? "Professional",
    status: (row.status ?? "submitted") as JobApplication["status"],
    appliedAt: row.createdAt,
    dataSource: "live",
  };
}

export function mapClinicClaim(row: {
  id: string;
  clinic_id: string;
  organization_id: string;
  claimant_user_id: string;
  status: string;
  reviewer_notes?: string | null;
  reviewed_by?: string | null;
  reviewed_at?: string | null;
  created_at: string;
  updated_at: string;
  Clinic?: { name?: string; city?: string; state?: string } | null;
  employer?: { public_name?: string | null; legal_name?: string } | null;
}): ClinicClaim {
  return {
    id: row.id,
    clinicId: row.clinic_id,
    clinicName: row.Clinic?.name ?? "Unknown clinic",
    clinicCity: row.Clinic?.city ?? undefined,
    clinicState: row.Clinic?.state ?? undefined,
    organizationId: row.organization_id,
    organizationName: row.employer?.public_name ?? row.employer?.legal_name ?? "Unknown organization",
    claimantUserId: row.claimant_user_id,
    status: row.status as ClinicClaim["status"],
    reviewerNotes: row.reviewer_notes ?? undefined,
    reviewedBy: row.reviewed_by ?? undefined,
    reviewedAt: row.reviewed_at ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    dataSource: "live",
  };
}
