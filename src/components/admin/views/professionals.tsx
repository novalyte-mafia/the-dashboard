"use client";

import { useEffect, useMemo, useState } from "react";
import { useNav } from "@/components/admin/admin-app";
import { workforceService } from "@/services";
import type { Professional } from "@/types";
import {
  PageHeader, MetricCard, DataTable, FilterBar, DetailDrawer, LoadingState,
  StatusBadge, ScoreBadge,
} from "@/components/admin/shared/index";
import { Button } from "@/components/ui/button";
import {
  Users, UserCheck, ShieldCheck, MapPin, BriefcaseBusiness, Award, Linkedin, FileText,
  CheckCircle2, XCircle, PauseCircle,
} from "lucide-react";
import { relativeTime } from "@/lib/format";
import { toast } from "sonner";

const AVAILABILITY_OPTIONS = [
  { value: "available", label: "Available" },
  { value: "open", label: "Open" },
  { value: "placed", label: "Placed" },
  { value: "unavailable", label: "Unavailable" },
];

const CREDENTIAL_OPTIONS = [
  { value: "verified", label: "Verified" },
  { value: "pending", label: "Pending" },
  { value: "expired", label: "Expired" },
  { value: "rejected", label: "Rejected" },
];

const AVAIL_COLOR: Record<string, string> = {
  available: "green", open: "teal", placed: "violet", unavailable: "slate",
};
const CRED_COLOR: Record<string, string> = {
  verified: "green", pending: "amber", expired: "rose", rejected: "rose",
};

const REVIEW_COLOR: Record<string, string> = {
  approved: "green",
  pending_review: "amber",
  rejected: "rose",
  suspended: "slate",
};

const REVIEW_LABEL: Record<string, string> = {
  approved: "Approved",
  pending_review: "Pending Review",
  rejected: "Rejected",
  suspended: "Suspended",
};

export function ProfessionalsView() {
  const { navigate, refreshKey } = useNav();
  const [data, setData] = useState<Professional[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filters, setFilters] = useState<Record<string, string>>({});
  const [selected, setSelected] = useState<Professional | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function loadProfessionals() {
    setLoading(true);
    try {
      const result = await workforceService.listProfessionals();
      setData(result.professionals);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to load professionals.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadProfessionals();
  }, [refreshKey]);

  async function updateReviewStatus(
    professional: Professional,
    reviewStatus: "approved" | "rejected" | "suspended" | "pending_review",
  ) {
    setSubmitting(true);
    try {
      await workforceService.setProfessionalReviewStatus(professional.id, reviewStatus);
      await loadProfessionals();
      setSelected((current) =>
        current?.id === professional.id ? { ...current, reviewStatus } : current,
      );
      toast.success(`${professional.name} marked ${REVIEW_LABEL[reviewStatus] ?? reviewStatus}.`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to update review status.");
    } finally {
      setSubmitting(false);
    }
  }

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    return data.filter((p) => {
      if (q && !`${p.name} ${p.role} ${p.specialty} ${p.city ?? ""} ${p.state ?? ""}`.toLowerCase().includes(q)) return false;
      if (filters.availability && p.availability !== filters.availability) return false;
      if (filters.credentialStatus && p.credentialStatus !== filters.credentialStatus) return false;
      return true;
    });
  }, [data, search, filters]);

  if (loading) return <LoadingState label="Loading professionals…" />;

  const available = data.filter((p) => p.availability === "available").length;
  const credPending = data.filter((p) => p.credentialStatus === "pending" || p.credentialStatus === "expired").length;
  const avgMatch = data.length > 0
    ? Math.round(data.filter((p) => p.matchScore != null).reduce((s, p) => s + (p.matchScore ?? 0), 0) / Math.max(1, data.filter((p) => p.matchScore != null).length))
    : 0;

  return (
    <div>
      <PageHeader
        title="Professionals"
        description={`${data.length} healthcare professionals in the network`}
        action={
          <Button onClick={() => toast.info("Invite flow opening soon — professionals will receive onboarding link.")}>
            <Users className="size-4" /> Invite Professional
          </Button>
        }
      />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <MetricCard label="Total" value={data.length} icon={Users} tone="default" />
        <MetricCard label="Available Now" value={available} icon={UserCheck} tone="green" onClick={() => setFilters((f) => ({ ...f, availability: "available" }))} />
        <MetricCard label="Cred Reviews" value={credPending} icon={ShieldCheck} tone="amber" onClick={() => navigate("credentials")} />
        <MetricCard label="Avg Match Score" value={avgMatch || "—"} icon={Award} tone="teal" hint="Of scored professionals" />
      </div>

      <FilterBar
        search={search}
        onSearchChange={setSearch}
        filters={[
          { key: "availability", label: "Availability", options: AVAILABILITY_OPTIONS },
          { key: "credentialStatus", label: "Credential", options: CREDENTIAL_OPTIONS },
        ]}
        activeFilters={filters}
        onFilterChange={(k, v) => setFilters((f) => ({ ...f, [k]: v }))}
        onClear={() => { setSearch(""); setFilters({}); }}
        searchPlaceholder="Search by name, role, specialty, location…"
      />

      <DataTable
        data={filtered}
        onRowClick={(p) => setSelected(p)}
        emptyTitle="No professionals match"
        emptyDescription="Try adjusting filters or search."
        columns={[
          {
            key: "name",
            header: "Professional",
            sortValue: (p) => p.name,
            render: (p) => (
              <div>
                <div className="font-medium">{p.name}</div>
                <div className="text-xs text-muted-foreground">{p.role}</div>
              </div>
            ),
          },
          {
            key: "specialty",
            header: "Specialty",
            hideOnMobile: true,
            sortValue: (p) => p.specialty,
            render: (p) => <span className="text-sm">{p.specialty}</span>,
          },
          {
            key: "location",
            header: "Location",
            hideOnMobile: true,
            sortValue: (p) => `${p.state ?? ""}${p.city ?? ""}`,
            render: (p) => (
              <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                <MapPin className="size-3" />
                {[p.city, p.state].filter(Boolean).join(", ") || "—"}
              </span>
            ),
          },
          {
            key: "experience",
            header: "Experience",
            hideOnMobile: true,
            sortValue: (p) => p.yearsExperience,
            render: (p) => <span className="text-sm tabular-nums">{p.yearsExperience} yrs</span>,
          },
          {
            key: "availability",
            header: "Availability",
            sortValue: (p) => p.availability,
            render: (p) => <StatusBadge label={p.availability} color={AVAIL_COLOR[p.availability] ?? "slate"} />,
          },
          {
            key: "credentialStatus",
            header: "Credentials",
            sortValue: (p) => p.credentialStatus,
            render: (p) => <StatusBadge label={p.credentialStatus} color={CRED_COLOR[p.credentialStatus] ?? "slate"} />,
          },
          {
            key: "reviewStatus",
            header: "Review",
            hideOnMobile: true,
            sortValue: (p) => p.reviewStatus ?? "pending_review",
            render: (p) => (
              <StatusBadge
                label={REVIEW_LABEL[p.reviewStatus ?? "pending_review"] ?? p.reviewStatus ?? "Pending Review"}
                color={REVIEW_COLOR[p.reviewStatus ?? "pending_review"] ?? "slate"}
              />
            ),
          },
          {
            key: "matchScore",
            header: "Match",
            sortValue: (p) => p.matchScore ?? 0,
            render: (p) => (p.matchScore != null ? <ScoreBadge score={p.matchScore} /> : "—"),
          },
        ]}
      />

      <DetailDrawer
        open={!!selected}
        onOpenChange={(o) => !o && setSelected(null)}
        title={selected?.name ?? ""}
      >
        {selected && (
          <div className="space-y-5">
            <div>
              <div className="text-xs text-muted-foreground uppercase tracking-wide">Role</div>
              <div className="text-sm font-medium mt-0.5">{selected.role}</div>
              <div className="text-sm text-muted-foreground">{selected.specialty}</div>
            </div>

            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <div className="text-xs text-muted-foreground">Location</div>
                <div className="font-medium">{[selected.city, selected.state].filter(Boolean).join(", ") || "—"}</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Experience</div>
                <div className="font-medium tabular-nums">{selected.yearsExperience} years</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Availability</div>
                <div><StatusBadge label={selected.availability} color={AVAIL_COLOR[selected.availability]} /></div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Credentials</div>
                <div><StatusBadge label={selected.credentialStatus} color={CRED_COLOR[selected.credentialStatus]} /></div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Review Status</div>
                <div>
                  <StatusBadge
                    label={REVIEW_LABEL[selected.reviewStatus ?? "pending_review"] ?? selected.reviewStatus ?? "Pending Review"}
                    color={REVIEW_COLOR[selected.reviewStatus ?? "pending_review"] ?? "slate"}
                  />
                </div>
              </div>
              {selected.matchScore != null && (
                <div>
                  <div className="text-xs text-muted-foreground">Match Score</div>
                  <div><ScoreBadge score={selected.matchScore} /></div>
                </div>
              )}
              <div>
                <div className="text-xs text-muted-foreground">Joined</div>
                <div className="font-medium">{relativeTime(selected.createdAt)}</div>
              </div>
            </div>

            <div>
              <div className="text-xs text-muted-foreground uppercase tracking-wide mb-1.5">Licenses</div>
              {selected.licenses.length === 0 ? (
                <p className="text-sm text-muted-foreground">No licenses recorded.</p>
              ) : (
                <div className="flex flex-wrap gap-1.5">
                  {selected.licenses.map((l) => (
                    <StatusBadge key={l} label={l} color="teal" />
                  ))}
                </div>
              )}
            </div>

            <div>
              <div className="text-xs text-muted-foreground uppercase tracking-wide mb-1.5">Certifications</div>
              {selected.certifications.length === 0 ? (
                <p className="text-sm text-muted-foreground">No certifications recorded.</p>
              ) : (
                <div className="flex flex-wrap gap-1.5">
                  {selected.certifications.map((c) => (
                    <StatusBadge key={c} label={c} color="violet" />
                  ))}
                </div>
              )}
            </div>

            <div className="flex flex-wrap gap-2 pt-2 border-t">
              {selected.linkedinUrl && (
                <Button variant="outline" size="sm" asChild>
                  <a href={selected.linkedinUrl} target="_blank" rel="noopener noreferrer">
                    <Linkedin className="size-3.5" /> LinkedIn
                  </a>
                </Button>
              )}
              {selected.resumeUrl && (
                <Button variant="outline" size="sm" asChild>
                  <a href={selected.resumeUrl} target="_blank" rel="noopener noreferrer">
                    <FileText className="size-3.5" /> Resume
                  </a>
                </Button>
              )}
              {(selected.reviewStatus === "pending_review" || selected.reviewStatus === "rejected" || !selected.reviewStatus) && (
                <>
                  <Button
                    size="sm"
                    disabled={submitting}
                    onClick={() => void updateReviewStatus(selected, "approved")}
                  >
                    <CheckCircle2 className="size-3.5" /> Approve
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="text-rose-600 hover:text-rose-700"
                    disabled={submitting}
                    onClick={() => void updateReviewStatus(selected, "rejected")}
                  >
                    <XCircle className="size-3.5" /> Reject
                  </Button>
                </>
              )}
              {selected.reviewStatus === "approved" && (
                <Button
                  size="sm"
                  variant="outline"
                  disabled={submitting}
                  onClick={() => void updateReviewStatus(selected, "suspended")}
                >
                  <PauseCircle className="size-3.5" /> Suspend
                </Button>
              )}
              {selected.reviewStatus === "suspended" && (
                <Button
                  size="sm"
                  disabled={submitting}
                  onClick={() => void updateReviewStatus(selected, "approved")}
                >
                  <CheckCircle2 className="size-3.5" /> Reinstate
                </Button>
              )}
              <Button
                size="sm"
                variant="outline"
                className="ml-auto"
                onClick={() => toast.success(`Match search started for ${selected.name}.`)}
              >
                <BriefcaseBusiness className="size-3.5" /> Find Matches
              </Button>
            </div>
          </div>
        )}
      </DetailDrawer>
    </div>
  );
}
