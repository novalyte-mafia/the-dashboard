"use client";

import { useEffect, useMemo, useState } from "react";
import { useNav } from "@/components/admin/admin-app";
import { workforceService } from "@/services";
import type { JobApplication } from "@/types";
import {
  PageHeader, MetricCard, DataTable, FilterBar, LoadingState,
  StatusBadge, ScoreBadge, SectionCard,
} from "@/components/admin/shared/index";
import { Button } from "@/components/ui/button";
import {
  FileText, Users, TrendingUp, CalendarCheck, CheckCircle2, Clock,
} from "lucide-react";
import { relativeTime } from "@/lib/format";
import { toast } from "sonner";

const STATUS_OPTIONS = [
  { value: "submitted", label: "Submitted" },
  { value: "reviewing", label: "Reviewing" },
  { value: "interview", label: "Interview" },
  { value: "offered", label: "Offered" },
  { value: "hired", label: "Hired" },
  { value: "rejected", label: "Rejected" },
];

const STATUS_COLOR: Record<string, string> = {
  submitted: "slate", reviewing: "amber", interview: "teal",
  offered: "violet", hired: "green", rejected: "rose",
};

const PIPELINE_STAGES = ["submitted", "reviewing", "interview", "offered", "hired"] as const;

export function ApplicationsView() {
  const { refreshKey } = useNav();
  const [data, setData] = useState<JobApplication[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filters, setFilters] = useState<Record<string, string>>({});

  useEffect(() => {
    setLoading(true);
    workforceService.listApplications()
      .then((d) => setData(d.applications))
      .catch((error) => {
        toast.error(error instanceof Error ? error.message : "Unable to load applications.");
      })
      .finally(() => setLoading(false));
  }, [refreshKey]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    return data.filter((a) => {
      if (q && !`${a.professionalName} ${a.jobTitle} ${a.employerName}`.toLowerCase().includes(q)) return false;
      if (filters.status && a.status !== filters.status) return false;
      return true;
    });
  }, [data, search, filters]);

  if (loading) return <LoadingState label="Loading applications…" />;

  const inReview = data.filter((a) => a.status === "submitted" || a.status === "reviewing").length;
  const interviewing = data.filter((a) => a.status === "interview").length;
  const offered = data.filter((a) => a.status === "offered").length;
  const hired = data.filter((a) => a.status === "hired").length;
  const avgMatch = data.length > 0
    ? Math.round(data.filter((a) => a.matchScore != null).reduce((s, a) => s + (a.matchScore ?? 0), 0) / Math.max(1, data.filter((a) => a.matchScore != null).length))
    : 0;

  const pipelineCounts: Record<string, number> = {};
  PIPELINE_STAGES.forEach((s) => { pipelineCounts[s] = data.filter((a) => a.status === s).length; });
  const maxPipeline = Math.max(1, ...Object.values(pipelineCounts));

  return (
    <div>
      <PageHeader
        title="Applications"
        description={`${data.length} total submissions across open roles`}
        action={
          <Button variant="outline" onClick={() => toast.info("Export queued — CSV will download when ready.")}>
            Export
          </Button>
        }
      />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <MetricCard label="In Review" value={inReview} icon={Clock} tone="amber" hint="Submitted / Reviewing" />
        <MetricCard label="Interviewing" value={interviewing} icon={Users} tone="teal" />
        <MetricCard label="Offers Extended" value={offered} icon={FileText} tone="violet" />
        <MetricCard label="Hires" value={hired} icon={CheckCircle2} tone="green" />
      </div>

      <SectionCard
        title="Application Pipeline"
        description="Submissions → Review → Interview → Offer → Hire"
        className="mb-6"
      >
        <div className="flex items-end gap-2 md:gap-3 overflow-x-auto nv-scroll pb-1">
          {PIPELINE_STAGES.map((stage, i) => (
            <div key={stage} className="flex items-end gap-2 md:gap-3 shrink-0">
              <div className="flex flex-col items-center gap-1.5 w-20 md:w-28">
                <div className="text-xs font-semibold tabular-nums">{pipelineCounts[stage]}</div>
                <div
                  className="w-full rounded-md flex items-end justify-center pb-1"
                  style={{
                    height: `${Math.max(20, (pipelineCounts[stage] / maxPipeline) * 110)}px`,
                    backgroundColor: stage === "hired" ? "var(--primary)" : stage === "offered" ? "#a78bfa" : stage === "interview" ? "#5eead4" : stage === "reviewing" ? "#fcd34d" : "#cbd5e1",
                  }}
                >
                  <span className="text-[10px] text-white/90 font-medium uppercase tracking-wide">{stage}</span>
                </div>
              </div>
              {i < PIPELINE_STAGES.length - 1 && (
                <div className="text-muted-foreground/50 pb-2">→</div>
              )}
            </div>
          ))}
        </div>
      </SectionCard>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-6">
        <MetricCard label="Avg Match Score" value={avgMatch || "—"} icon={TrendingUp} tone="teal" />
        <MetricCard label="Conversion Rate" value={`${data.length > 0 ? Math.round((hired / data.length) * 100) : 0}%`} icon={CalendarCheck} tone="green" hint="Submit → Hire" />
        <MetricCard label="Active Stages" value={PIPELINE_STAGES.filter((s) => pipelineCounts[s] > 0).length} icon={Users} tone="default" hint="Stages with activity" />
      </div>

      <FilterBar
        search={search}
        onSearchChange={setSearch}
        filters={[{ key: "status", label: "Status", options: STATUS_OPTIONS }]}
        activeFilters={filters}
        onFilterChange={(k, v) => setFilters((f) => ({ ...f, [k]: v }))}
        onClear={() => { setSearch(""); setFilters({}); }}
        searchPlaceholder="Search by professional, job, employer…"
      />

      <DataTable
        data={filtered}
        emptyTitle="No applications match"
        emptyDescription="Try adjusting filters or status."
        columns={[
          {
            key: "professional",
            header: "Professional",
            sortValue: (a) => a.professionalName,
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
            sortValue: (a) => a.employerName,
            render: (a) => <span className="text-sm">{a.employerName}</span>,
          },
          {
            key: "status",
            header: "Status",
            sortValue: (a) => a.status,
            render: (a) => <StatusBadge label={a.status} color={STATUS_COLOR[a.status] ?? "slate"} />,
          },
          {
            key: "match",
            header: "Match",
            sortValue: (a) => a.matchScore ?? 0,
            render: (a) => (a.matchScore != null ? <ScoreBadge score={a.matchScore} /> : "—"),
          },
          {
            key: "applied",
            header: "Applied",
            sortValue: (a) => new Date(a.appliedAt).getTime(),
            render: (a) => <span className="text-xs text-muted-foreground">{relativeTime(a.appliedAt)}</span>,
          },
        ]}
      />
    </div>
  );
}
