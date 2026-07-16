"use client";

import { useEffect, useState } from "react";
import { useNav } from "@/components/admin/admin-app";
import { workforceService } from "@/services";
import type { Professional, JobListing, JobApplication } from "@/types";
import {
  PageHeader, MetricCard, SectionCard, DataTable, LoadingState, EmptyState,
  StatusBadge, ScoreBadge,
} from "@/components/admin/shared/index";
import { Button } from "@/components/ui/button";
import {
  Users, UserCheck, Briefcase, FileText, ShieldCheck, ArrowRight, Award,
} from "lucide-react";
import { relativeTime } from "@/lib/format";
import { toast } from "sonner";

export function WorkforceOverviewView() {
  const { navigate, refreshKey } = useNav();
  const [professionals, setProfessionals] = useState<Professional[]>([]);
  const [jobs, setJobs] = useState<JobListing[]>([]);
  const [applications, setApplications] = useState<JobApplication[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      workforceService.listProfessionals(),
      workforceService.listJobs(),
      workforceService.listApplications(),
    ])
      .then(([p, j, a]) => {
        setProfessionals(p.professionals);
        setJobs(j.jobs);
        setApplications(a.applications);
      })
      .finally(() => setLoading(false));
  }, [refreshKey]);

  if (loading) return <LoadingState label="Loading workforce overview…" />;

  const availableNow = professionals.filter((p) => p.availability === "available").length;
  const openJobs = jobs.filter((j) => j.status === "open").length;
  const pendingApplications = applications.filter((a) => a.status === "submitted" || a.status === "reviewing").length;
  const credentialReviewsPending = professionals.filter(
    (p) => p.credentialStatus === "pending" || p.credentialStatus === "expired"
  ).length;

  const recentApplications = [...applications]
    .sort((a, b) => new Date(b.appliedAt).getTime() - new Date(a.appliedAt).getTime())
    .slice(0, 6);

  return (
    <div>
      <PageHeader
        title="Workforce"
        description="Healthcare talent pipeline, placements, and credentialing"
        action={
          <Button variant="outline" onClick={() => toast.info("Export started — you'll be notified when ready.")}>
            Export
          </Button>
        }
      />

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3 mb-6">
        <MetricCard
          label="Professionals"
          value={professionals.length}
          icon={Users}
          tone="teal"
          hint="Total in network"
          onClick={() => navigate("professionals")}
        />
        <MetricCard
          label="Available Now"
          value={availableNow}
          icon={UserCheck}
          tone="green"
          hint="Ready to place"
          onClick={() => navigate("professionals")}
        />
        <MetricCard
          label="Open Jobs"
          value={openJobs}
          icon={Briefcase}
          tone="default"
          hint="Active requisitions"
          onClick={() => navigate("jobs")}
        />
        <MetricCard
          label="Pending Applications"
          value={pendingApplications}
          icon={FileText}
          tone="amber"
          hint="Awaiting review"
          onClick={() => navigate("applications")}
        />
        <MetricCard
          label="Credential Reviews"
          value={credentialReviewsPending}
          icon={ShieldCheck}
          tone="rose"
          hint="Pending or expired"
          onClick={() => navigate("credentials")}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <SectionCard
          title="Recent Applications"
          description="Latest submissions across open roles"
          className="lg:col-span-2"
          bodyClassName="p-0"
          action={
            <Button variant="ghost" size="sm" onClick={() => navigate("applications")}>
              View all <ArrowRight className="size-3.5" />
            </Button>
          }
        >
          {recentApplications.length === 0 ? (
            <EmptyState title="No applications yet" description="Submissions will appear here." />
          ) : (
            <DataTable
              data={recentApplications}
              pageSize={6}
              onRowClick={() => navigate("applications")}
              columns={[
                {
                  key: "professional",
                  header: "Professional",
                  render: (a) => (
                    <div>
                      <div className="font-medium">{a.professionalName}</div>
                      <div className="text-xs text-muted-foreground">{a.jobTitle}</div>
                    </div>
                  ),
                },
                {
                  key: "employer",
                  header: "Employer",
                  hideOnMobile: true,
                  render: (a) => <span className="text-sm">{a.employerName}</span>,
                },
                {
                  key: "match",
                  header: "Match",
                  render: (a) => (a.matchScore != null ? <ScoreBadge score={a.matchScore} /> : "—"),
                },
                {
                  key: "status",
                  header: "Status",
                  render: (a) => {
                    const colorMap: Record<string, string> = {
                      submitted: "slate", reviewing: "amber", interview: "teal",
                      offered: "violet", hired: "green", rejected: "rose",
                    };
                    return <StatusBadge label={a.status} color={colorMap[a.status] ?? "slate"} />;
                  },
                },
                {
                  key: "applied",
                  header: "Applied",
                  hideOnMobile: true,
                  render: (a) => <span className="text-xs text-muted-foreground">{relativeTime(a.appliedAt)}</span>,
                },
              ]}
            />
          )}
        </SectionCard>

        <SectionCard
          title="Pipeline Health"
          description="Workforce at-a-glance"
        >
          <div className="space-y-3">
            <PipelineRow
              icon={<Briefcase className="size-4 text-teal-600" />}
              label="Open Jobs"
              value={openJobs}
              hint={`${jobs.length} total requisitions`}
              onClick={() => navigate("jobs")}
            />
            <PipelineRow
              icon={<FileText className="size-4 text-amber-600" />}
              label="Applications in Review"
              value={pendingApplications}
              hint={`${applications.length} total submissions`}
              onClick={() => navigate("applications")}
            />
            <PipelineRow
              icon={<ShieldCheck className="size-4 text-rose-600" />}
              label="Credential Reviews"
              value={credentialReviewsPending}
              hint="Verify licenses & certifications"
              onClick={() => navigate("credentials")}
            />
            <PipelineRow
              icon={<Award className="size-4 text-emerald-600" />}
              label="Top Match Available"
              value={professionals.filter((p) => (p.matchScore ?? 0) >= 85 && p.availability === "available").length}
              hint="Match score ≥ 85"
              onClick={() => navigate("professionals")}
            />
            <PipelineRow
              icon={<UserCheck className="size-4 text-teal-600" />}
              label="Placed Professionals"
              value={professionals.filter((p) => p.availability === "placed").length}
              hint="Currently on assignment"
            />
          </div>
        </SectionCard>
      </div>
    </div>
  );
}

function PipelineRow({
  icon, label, value, hint, onClick,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  hint?: string;
  onClick?: () => void;
}) {
  return (
    <button
      onClick={onClick}
      disabled={!onClick}
      className="w-full flex items-center justify-between gap-3 p-2.5 rounded-md border border-border/60 hover:bg-accent/40 transition-colors disabled:cursor-default text-left"
    >
      <div className="flex items-center gap-3 min-w-0">
        <div className="size-8 rounded-md bg-muted/60 flex items-center justify-center shrink-0">{icon}</div>
        <div className="min-w-0">
          <div className="text-sm font-medium truncate">{label}</div>
          {hint && <div className="text-xs text-muted-foreground truncate">{hint}</div>}
        </div>
      </div>
      <div className="text-lg font-semibold tabular-nums">{value}</div>
    </button>
  );
}
