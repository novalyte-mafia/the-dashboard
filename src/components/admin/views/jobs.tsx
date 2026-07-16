"use client";

import { useEffect, useMemo, useState } from "react";
import { useNav } from "@/components/admin/admin-app";
import { workforceService } from "@/services";
import type { JobListing } from "@/types";
import {
  PageHeader, MetricCard, DataTable, FilterBar, DetailDrawer, LoadingState,
  StatusBadge,
} from "@/components/admin/shared/index";
import { Button } from "@/components/ui/button";
import {
  Briefcase, Building2, MapPin, Users, DollarSign, Calendar, Plus,
} from "lucide-react";
import { formatCurrencyFull, relativeTime } from "@/lib/format";
import { toast } from "sonner";

const STATUS_OPTIONS = [
  { value: "open", label: "Open" },
  { value: "closed", label: "Closed" },
  { value: "filled", label: "Filled" },
  { value: "draft", label: "Draft" },
];

const STATUS_COLOR: Record<string, string> = {
  open: "green", closed: "slate", filled: "violet", draft: "amber",
};

const TYPE_LABEL: Record<string, string> = {
  full_time: "Full-time",
  part_time: "Part-time",
  contract: "Contract",
  locum: "Locum",
};

export function JobsView() {
  const { navigate, refreshKey } = useNav();
  const [data, setData] = useState<JobListing[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filters, setFilters] = useState<Record<string, string>>({});
  const [selected, setSelected] = useState<JobListing | null>(null);

  useEffect(() => {
    setLoading(true);
    workforceService.listJobs()
      .then((d) => setData(d.jobs))
      .finally(() => setLoading(false));
  }, [refreshKey]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    return data.filter((j) => {
      if (q && !`${j.title} ${j.employerName} ${j.specialty} ${j.city ?? ""} ${j.state ?? ""}`.toLowerCase().includes(q)) return false;
      if (filters.status && j.status !== filters.status) return false;
      if (filters.type && j.type !== filters.type) return false;
      return true;
    });
  }, [data, search, filters]);

  if (loading) return <LoadingState label="Loading jobs…" />;

  const open = data.filter((j) => j.status === "open").length;
  const drafts = data.filter((j) => j.status === "draft").length;
  const totalApps = data.reduce((s, j) => s + j.applicationsCount, 0);

  return (
    <div>
      <PageHeader
        title="Jobs"
        description={`${data.length} requisitions across partner clinics`}
        action={
          <Button onClick={() => toast.info("Job builder coming soon — for now create via employer onboarding.")}>
            <Plus className="size-4" /> Post Job
          </Button>
        }
      />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <MetricCard label="Open Jobs" value={open} icon={Briefcase} tone="green" />
        <MetricCard label="Drafts" value={drafts} icon={Briefcase} tone="amber" onClick={() => setFilters({ status: "draft" })} />
        <MetricCard label="Total Applications" value={totalApps} icon={Users} tone="teal" onClick={() => navigate("applications")} />
        <MetricCard label="Partner Employers" value={new Set(data.map((j) => j.employerId)).size} icon={Building2} tone="default" />
      </div>

      <FilterBar
        search={search}
        onSearchChange={setSearch}
        filters={[
          { key: "status", label: "Status", options: STATUS_OPTIONS },
          {
            key: "type",
            label: "Type",
            options: [
              { value: "full_time", label: "Full-time" },
              { value: "part_time", label: "Part-time" },
              { value: "contract", label: "Contract" },
              { value: "locum", label: "Locum" },
            ],
          },
        ]}
        activeFilters={filters}
        onFilterChange={(k, v) => setFilters((f) => ({ ...f, [k]: v }))}
        onClear={() => { setSearch(""); setFilters({}); }}
        searchPlaceholder="Search by title, employer, specialty, location…"
      />

      <DataTable
        data={filtered}
        onRowClick={(j) => setSelected(j)}
        emptyTitle="No jobs match"
        emptyDescription="Try adjusting filters or status."
        columns={[
          {
            key: "title",
            header: "Title",
            sortValue: (j) => j.title,
            render: (j) => (
              <div>
                <div className="font-medium">{j.title}</div>
                <div className="text-xs text-muted-foreground">{TYPE_LABEL[j.type] ?? j.type}</div>
              </div>
            ),
          },
          {
            key: "employer",
            header: "Employer",
            sortValue: (j) => j.employerName,
            render: (j) => (
              <span className="inline-flex items-center gap-1.5 text-sm">
                <Building2 className="size-3.5 text-muted-foreground" />
                {j.employerName}
              </span>
            ),
          },
          {
            key: "specialty",
            header: "Specialty",
            hideOnMobile: true,
            sortValue: (j) => j.specialty,
            render: (j) => <span className="text-sm">{j.specialty}</span>,
          },
          {
            key: "location",
            header: "Location",
            hideOnMobile: true,
            sortValue: (j) => `${j.state ?? ""}${j.city ?? ""}`,
            render: (j) => (
              <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                <MapPin className="size-3" />
                {[j.city, j.state].filter(Boolean).join(", ") || "—"}
              </span>
            ),
          },
          {
            key: "salary",
            header: "Salary Range",
            hideOnMobile: true,
            sortValue: (j) => j.salaryMin ?? 0,
            render: (j) => (
              <span className="text-sm tabular-nums">
                {j.salaryMin != null && j.salaryMax != null
                  ? `${formatCurrencyFull(j.salaryMin)} – ${formatCurrencyFull(j.salaryMax)}`
                  : "—"}
              </span>
            ),
          },
          {
            key: "apps",
            header: "Apps",
            sortValue: (j) => j.applicationsCount,
            render: (j) => (
              <button
                onClick={(e) => { e.stopPropagation(); navigate("applications"); }}
                className="text-sm font-medium text-teal-700 hover:underline tabular-nums"
              >
                {j.applicationsCount}
              </button>
            ),
          },
          {
            key: "status",
            header: "Status",
            sortValue: (j) => j.status,
            render: (j) => <StatusBadge label={j.status} color={STATUS_COLOR[j.status] ?? "slate"} />,
          },
        ]}
      />

      <DetailDrawer
        open={!!selected}
        onOpenChange={(o) => !o && setSelected(null)}
        title={selected?.title ?? ""}
      >
        {selected && (
          <div className="space-y-5">
            <div>
              <div className="text-xs text-muted-foreground">Employer</div>
              <div className="text-sm font-medium mt-0.5">{selected.employerName}</div>
            </div>

            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <div className="text-xs text-muted-foreground">Specialty</div>
                <div className="font-medium">{selected.specialty}</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Type</div>
                <div className="font-medium">{TYPE_LABEL[selected.type] ?? selected.type}</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Location</div>
                <div className="font-medium">{[selected.city, selected.state].filter(Boolean).join(", ") || "—"}</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Status</div>
                <div><StatusBadge label={selected.status} color={STATUS_COLOR[selected.status]} /></div>
              </div>
            </div>

            <div className="p-3 rounded-md bg-muted/60">
              <div className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Salary Range</div>
              <div className="text-lg font-semibold tabular-nums">
                {selected.salaryMin != null && selected.salaryMax != null
                  ? `${formatCurrencyFull(selected.salaryMin)} – ${formatCurrencyFull(selected.salaryMax)}`
                  : "Not specified"}
              </div>
              <div className="text-xs text-muted-foreground mt-0.5 inline-flex items-center gap-1">
                <DollarSign className="size-3" />
                Annual base
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <div className="text-xs text-muted-foreground">Applications</div>
                <div className="font-medium tabular-nums">{selected.applicationsCount}</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Posted</div>
                <div className="font-medium inline-flex items-center gap-1">
                  <Calendar className="size-3" />
                  {relativeTime(selected.createdAt)}
                </div>
              </div>
            </div>

            <div className="flex gap-2 pt-2 border-t">
              <Button
                size="sm"
                className="ml-auto"
                onClick={() => { navigate("applications"); }}
              >
                <Users className="size-3.5" /> View Applicants
              </Button>
            </div>
          </div>
        )}
      </DetailDrawer>
    </div>
  );
}
