"use client";

import { useEffect, useMemo, useState } from "react";
import { useNav } from "@/components/admin/admin-app";
import {
  PageHeader, MetricCard, FilterBar, DataTable, LoadingState, EmptyState,
  StatusBadge, ScoreBadge, SectionCard, type Column,
} from "@/components/admin/shared";
import { ClipboardList, Stethoscope, CheckCircle2, AlertCircle, FileText, Inbox } from "lucide-react";
import { patientService } from "@/services";
import type { PatientLead } from "@/types";
import { relativeTime } from "@/lib/format";
import { SERVICE_CATALOG } from "@/lib/constants";

// Assessment status is derived from lead status for the mock view:
// new → New, contacted/qualified → Reviewed, routed/booked → Qualified, lost/disqualified/duplicate → Disqualified
const ASSESSMENT_STATUS: Record<string, { label: string; color: string }> = {
  new: { label: "New", color: "teal" },
  qualified: { label: "Reviewed", color: "amber" },
  contacted: { label: "Reviewed", color: "amber" },
  routed: { label: "Qualified", color: "green" },
  booked: { label: "Qualified", color: "green" },
  lost: { label: "Disqualified", color: "rose" },
  disqualified: { label: "Disqualified", color: "rose" },
  duplicate: { label: "Disqualified", color: "slate" },
};

const FILTERS = [
  {
    key: "status",
    label: "Assessment Status",
    options: [
      { value: "new", label: "New" },
      { value: "reviewed", label: "Reviewed" },
      { value: "qualified", label: "Qualified" },
      { value: "disqualified", label: "Disqualified" },
    ],
  },
  {
    key: "treatment",
    label: "Treatment",
    options: SERVICE_CATALOG.map((s) => ({ value: s.slug, label: s.name })),
  },
];

function assessmentStatus(lead: PatientLead): { label: string; color: string; key: string } {
  const m = ASSESSMENT_STATUS[lead.status] ?? { label: "New", color: "slate" };
  // Normalize "Reviewed" / "Qualified" / "Disqualified" / "New" to a key
  const key = m.label.toLowerCase();
  return { ...m, key };
}

export function AssessmentsView() {
  const { refreshKey } = useNav();
  const [leads, setLeads] = useState<PatientLead[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [activeFilters, setActiveFilters] = useState<Record<string, string>>({});

  useEffect(() => {
    setLoading(true);
    patientService
      .listLeads()
      .then((d) => setLeads(d.leads))
      .finally(() => setLoading(false));
  }, [refreshKey]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return leads.filter((l) => {
      if (q && !`${l.name} ${l.email ?? ""} ${l.symptoms ?? ""}`.toLowerCase().includes(q)) return false;
      const a = assessmentStatus(l);
      if (activeFilters.status && a.key !== activeFilters.status) return false;
      if (activeFilters.treatment && l.treatmentInterest !== activeFilters.treatment) return false;
      return true;
    });
  }, [leads, search, activeFilters]);

  const newCount = leads.filter((l) => l.status === "new").length;
  const reviewedCount = leads.filter((l) => l.status === "contacted" || l.status === "qualified").length;
  const qualifiedCount = leads.filter((l) => l.status === "routed" || l.status === "booked").length;
  const disqualifiedCount = leads.filter((l) => ["lost", "disqualified", "duplicate"].includes(l.status)).length;

  const treatmentName = (slug: string) =>
    SERVICE_CATALOG.find((s) => s.slug === slug)?.name ?? slug;

  const columns: Column<PatientLead>[] = [
    {
      key: "name",
      header: "Patient",
      render: (l) => (
        <div className="min-w-0">
          <div className="font-medium truncate">{l.name}</div>
          <div className="text-xs text-muted-foreground truncate">{l.email ?? "—"}</div>
        </div>
      ),
      sortValue: (l) => l.name,
    },
    {
      key: "treatment",
      header: "Treatment Interest",
      render: (l) => (
        <span className="text-sm inline-flex items-center gap-1.5">
          <Stethoscope className="size-3.5 text-muted-foreground" />
          {treatmentName(l.treatmentInterest)}
        </span>
      ),
      hideOnMobile: true,
    },
    {
      key: "symptoms",
      header: "Reported Symptoms",
      render: (l) => (
        <span className="text-sm text-muted-foreground line-clamp-1 max-w-[260px]">
          {l.symptoms ?? "—"}
        </span>
      ),
      hideOnMobile: true,
    },
    {
      key: "assessment",
      header: "Assessment Score",
      render: (l) => <ScoreBadge score={l.assessmentScore ?? 0} />,
      sortValue: (l) => l.assessmentScore ?? 0,
    },
    {
      key: "qualification",
      header: "Qual. Score",
      render: (l) => <ScoreBadge score={l.qualificationScore} />,
      sortValue: (l) => l.qualificationScore,
      hideOnMobile: true,
    },
    {
      key: "submitted",
      header: "Submitted",
      render: (l) => <span className="text-xs text-muted-foreground">{relativeTime(l.createdAt)}</span>,
      sortValue: (l) => new Date(l.createdAt).getTime(),
      hideOnMobile: true,
    },
    {
      key: "status",
      header: "Status",
      render: (l) => {
        const a = assessmentStatus(l);
        return <StatusBadge label={a.label} color={a.color} />;
      },
      sortValue: (l) => assessmentStatus(l).label,
    },
  ];

  return (
    <div>
      <PageHeader
        title="Patient Assessments"
        description="Intake questionnaires & symptom assessments awaiting clinical review"
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
        <MetricCard label="New Submissions" value={newCount} icon={ClipboardList} tone="teal" hint="Awaiting review" />
        <MetricCard label="In Review" value={reviewedCount} icon={FileText} tone="amber" hint="Clinic team reviewing" />
        <MetricCard label="Qualified" value={qualifiedCount} icon={CheckCircle2} tone="green" hint="Eligible to book" />
        <MetricCard label="Disqualified" value={disqualifiedCount} icon={AlertCircle} tone="rose" hint="Not eligible" />
      </div>

      <FilterBar
        search={search}
        onSearchChange={setSearch}
        filters={FILTERS}
        activeFilters={activeFilters}
        onFilterChange={(k, v) => setActiveFilters((prev) => {
          const next = { ...prev };
          if (v) next[k] = v; else delete next[k];
          return next;
        })}
        onClear={() => setActiveFilters({})}
        searchPlaceholder="Search by patient name, email, symptoms…"
      />

      {loading ? (
        <SectionCard>
          <LoadingState label="Loading assessments…" />
        </SectionCard>
      ) : filtered.length === 0 ? (
        <SectionCard>
          <EmptyState
            icon={Inbox}
            title="No assessments found"
            description="Patient intake assessments will appear here once submitted."
          />
        </SectionCard>
      ) : (
        <SectionCard bodyClassName="p-0">
          <DataTable
            columns={columns}
            data={filtered}
            pageSize={20}
            emptyTitle="No assessments"
          />
        </SectionCard>
      )}
    </div>
  );
}
