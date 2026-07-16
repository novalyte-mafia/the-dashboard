"use client";

import { useEffect, useMemo, useState } from "react";
import { useNav } from "@/components/admin/admin-app";
import { workforceService } from "@/services";
import type { JobApplication, Professional, JobListing } from "@/types";
import {
  PageHeader, MetricCard, ChartCard, LoadingState, SectionCard, StatusBadge,
} from "@/components/admin/shared/index";
import {
  Users, UserCheck, Briefcase, TrendingUp, Award, Clock, CheckCircle2,
} from "lucide-react";
import { relativeTime } from "@/lib/format";

const CRED_COLOR: Record<string, string> = {
  verified: "green", pending: "amber", expired: "rose", rejected: "rose",
};

const STATUS_COLOR: Record<string, string> = {
  submitted: "slate", reviewing: "amber", interview: "teal",
  offered: "violet", hired: "green", rejected: "rose",
};

const STAGE_COLORS = ["#94a3b8", "#fcd34d", "#5eead4", "#a78bfa", "#10b981"];

export function WorkforceAnalyticsView() {
  const { refreshKey } = useNav();
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

  const placementsOverTime = useMemo(() => {
    // Group applications by week for last 8 weeks
    const weeks: { label: string; value: number }[] = [];
    const now = Date.now();
    for (let i = 7; i >= 0; i--) {
      const start = now - i * 7 * 86400000;
      const end = start + 7 * 86400000;
      const date = new Date(start);
      const label = `${date.getMonth() + 1}/${date.getDate()}`;
      const value = applications.filter((a) => {
        const t = new Date(a.appliedAt).getTime();
        return t >= start && t < end;
      }).length;
      weeks.push({ label, value });
    }
    return weeks;
  }, [applications]);

  const applicationsBySpecialty = useMemo(() => {
    const map = new Map<string, number>();
    professionals.forEach((p) => {
      const baseSpecialty = String(p.specialty ?? "Unspecified")
        .split(" & ")[0]
        .split(" — ")[0]
        .trim() || "Unspecified";
      map.set(baseSpecialty, (map.get(baseSpecialty) ?? 0) + 1);
    });
    return Array.from(map.entries())
      .map(([label, value]) => ({ label, value, color: "#14b8a6" }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 8);
  }, [professionals]);

  const credentialBreakdown = useMemo(() => {
    const map = new Map<string, number>();
    professionals.forEach((p) => {
      map.set(p.credentialStatus, (map.get(p.credentialStatus) ?? 0) + 1);
    });
    return [
      { label: "Verified", value: map.get("verified") ?? 0, color: "#10b981" },
      { label: "Pending", value: map.get("pending") ?? 0, color: "#f59e0b" },
      { label: "Expired", value: map.get("expired") ?? 0, color: "#f43f5e" },
      { label: "Rejected", value: map.get("rejected") ?? 0, color: "#94a3b8" },
    ];
  }, [professionals]);

  const hiringFunnel = useMemo(() => {
    const stages = ["submitted", "reviewing", "interview", "offered", "hired"] as const;
    const colors = STAGE_COLORS;
    return stages.map((s, i) => ({
      label: s.charAt(0).toUpperCase() + s.slice(1),
      value: applications.filter((a) => a.status === s).length,
      color: colors[i],
    }));
  }, [applications]);

  if (loading) return <LoadingState label="Loading workforce analytics…" />;

  const totalPlacements = applications.filter((a) => a.status === "hired").length;
  const conversionRate = applications.length > 0 ? Math.round((totalPlacements / applications.length) * 100) : 0;
  const avgMatch = applications.length > 0
    ? Math.round(applications.filter((a) => a.matchScore != null).reduce((s, a) => s + (a.matchScore ?? 0), 0) / Math.max(1, applications.filter((a) => a.matchScore != null).length))
    : 0;
  const openJobs = jobs.filter((j) => j.status === "open").length;

  return (
    <div>
      <PageHeader
        title="Workforce Analytics"
        description="Trends and conversion across the talent pipeline"
      />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <MetricCard label="Total Placements" value={totalPlacements} icon={CheckCircle2} tone="green" hint="All-time hires" />
        <MetricCard label="Conversion Rate" value={`${conversionRate}%`} icon={TrendingUp} tone="teal" hint="Submit → Hire" />
        <MetricCard label="Avg Match Score" value={avgMatch || "—"} icon={Award} tone="violet" />
        <MetricCard label="Open Requisitions" value={openJobs} icon={Briefcase} tone="default" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
        <ChartCard
          title="Placements & Applications Over Time"
          data={placementsOverTime}
          type="line"
        />
        <ChartCard
          title="Applications by Specialty"
          data={applicationsBySpecialty}
          type="bar"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ChartCard
          title="Credential Status Breakdown"
          data={credentialBreakdown}
          type="bar"
        />
        <ChartCard
          title="Hiring Funnel (Current Cycle)"
          data={hiringFunnel}
          type="bar"
        />
      </div>

      <SectionCard
        title="Recent Hires"
        description="Most recent successful placements"
        className="mt-4"
        bodyClassName="p-0"
      >
        {applications.filter((a) => a.status === "hired").length === 0 ? (
          <div className="p-4 text-sm text-muted-foreground">No hires recorded yet.</div>
        ) : (
          <div className="divide-y divide-border/60">
            {applications.filter((a) => a.status === "hired").map((a) => (
              <div key={a.id} className="px-4 py-3 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-sm font-medium truncate">{a.professionalName}</div>
                  <div className="text-xs text-muted-foreground truncate">{a.jobTitle} · {a.employerName}</div>
                </div>
                <div className="text-xs text-muted-foreground shrink-0">{relativeTime(a.appliedAt)}</div>
              </div>
            ))}
          </div>
        )}
      </SectionCard>
    </div>
  );
}
