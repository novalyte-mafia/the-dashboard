"use client";

import { useEffect, useMemo, useState } from "react";
import { useNav } from "@/components/admin/admin-app";
import {
  PageHeader, MetricCard, LoadingState, EmptyState, SectionCard,
  StatusBadge, ScoreBadge, ChartCard, SavedViewSelector,
} from "@/components/admin/shared";
import { Card } from "@/components/ui/card";
import {
  GitBranch, Clock, CheckCircle2, XCircle, Filter,
} from "lucide-react";
import { patientService } from "@/services";
import type { PatientLead, PatientLeadStatus } from "@/types";
import { relativeTime, formatDateTime } from "@/lib/format";
import { SERVICE_CATALOG } from "@/lib/constants";

const STAGES: { id: PatientLeadStatus; label: string; color: string }[] = [
  { id: "new", label: "New", color: "teal" },
  { id: "qualified", label: "Qualified", color: "amber" },
  { id: "contacted", label: "Contacted", color: "violet" },
  { id: "routed", label: "Routed", color: "teal" },
  { id: "booked", label: "Booked", color: "green" },
];

const STATUS_COLOR: Record<string, string> = {
  new: "teal",
  qualified: "amber",
  contacted: "violet",
  routed: "teal",
  booked: "green",
  lost: "rose",
  disqualified: "rose",
  duplicate: "slate",
};

const STAGE_ORDER: Record<string, number> = {
  new: 0,
  qualified: 1,
  contacted: 2,
  routed: 3,
  booked: 4,
  lost: -1,
  disqualified: -1,
  duplicate: -1,
};

const VIEW_OPTIONS = ["All Journeys", "Active Only", "Booked", "Lost / Disqualified"];

export function PatientJourneyView() {
  const { refreshKey } = useNav();
  const [leads, setLeads] = useState<PatientLead[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState("All Journeys");

  useEffect(() => {
    setLoading(true);
    patientService
      .listLeads()
      .then((d) => setLeads(d.leads))
      .finally(() => setLoading(false));
  }, [refreshKey]);

  const filtered = useMemo(() => {
    if (view === "Active Only") {
      return leads.filter((l) => ["new", "qualified", "contacted", "routed", "booked"].includes(l.status));
    }
    if (view === "Booked") return leads.filter((l) => l.status === "booked");
    if (view === "Lost / Disqualified") return leads.filter((l) => ["lost", "disqualified", "duplicate"].includes(l.status));
    return leads;
  }, [leads, view]);

  const stageCounts = STAGES.map((s) => ({
    label: s.label,
    value: leads.filter((l) => l.status === s.id).length,
    color: s.id === "new" ? "#0d9488" : s.id === "qualified" ? "#f59e0b" : s.id === "contacted" ? "#8b5cf6" : s.id === "routed" ? "#14b8a6" : "#10b981",
  }));

  const activeCount = leads.filter((l) => ["new", "qualified", "contacted", "routed", "booked"].includes(l.status)).length;
  const bookedCount = leads.filter((l) => l.status === "booked").length;
  const lostCount = leads.filter((l) => ["lost", "disqualified", "duplicate"].includes(l.status)).length;
  const avgStage = leads.length
    ? Math.round(leads.reduce((s, l) => Math.max(0, STAGE_ORDER[l.status] ?? 0), 0) / leads.length * 10) / 10
    : 0;

  const treatmentName = (slug: string) =>
    SERVICE_CATALOG.find((s) => s.slug === slug)?.name ?? slug;

  const sorted = [...filtered].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  return (
    <div>
      <PageHeader
        title="Patient Journey"
        description="Lifecycle timeline of every patient lead — from intake through booking"
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
        <MetricCard label="Active Journeys" value={activeCount} icon={GitBranch} tone="teal" hint="In progress" />
        <MetricCard label="Booked" value={bookedCount} icon={CheckCircle2} tone="green" hint="Appointment set" />
        <MetricCard label="Lost / Disqualified" value={lostCount} icon={XCircle} tone="rose" hint="Exited funnel" />
        <MetricCard label="Avg Stage Index" value={avgStage} icon={Clock} tone="violet" hint="0=New · 4=Booked" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 mb-5">
        <div className="lg:col-span-2">
          <ChartCard title="Leads by Lifecycle Stage" data={stageCounts} type="bar" />
        </div>
        <SectionCard title="Stage Legend">
          <ol className="space-y-1.5 text-sm">
            {STAGES.map((s, i) => (
              <li key={s.id} className="flex items-center justify-between gap-2">
                <span className="inline-flex items-center gap-2">
                  <span className="size-5 rounded-full bg-primary/10 text-primary text-[10px] font-semibold inline-flex items-center justify-center">
                    {i + 1}
                  </span>
                  <StatusBadge label={s.label} color={s.color} />
                </span>
                <span className="text-xs text-muted-foreground tabular-nums">
                  {leads.filter((l) => l.status === s.id).length} leads
                </span>
              </li>
            ))}
          </ol>
        </SectionCard>
      </div>

      <div className="mb-3">
        <SavedViewSelector views={VIEW_OPTIONS} active={view} onSelect={setView} />
      </div>

      {loading ? (
        <SectionCard>
          <LoadingState label="Loading patient journeys…" />
        </SectionCard>
      ) : sorted.length === 0 ? (
        <SectionCard>
          <EmptyState
            icon={Filter}
            title="No journeys match this filter"
            description="Switch the filter to see leads in other stages."
          />
        </SectionCard>
      ) : (
        <div className="space-y-3">
          {sorted.map((lead) => {
            const stageIdx = STAGE_ORDER[lead.status] ?? 0;
            const isLost = stageIdx < 0;
            const completedStages = isLost ? STAGES.length - 1 : stageIdx;

            return (
              <Card key={lead.id} className="p-4 gap-0">
                <div className="flex flex-col md:flex-row md:items-start gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2 mb-1">
                      <h3 className="text-sm font-semibold truncate">{lead.name}</h3>
                      <StatusBadge label={lead.status} color={STATUS_COLOR[lead.status] ?? "slate"} />
                      <ScoreBadge score={lead.qualificationScore} />
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {treatmentName(lead.treatmentInterest)}
                      {lead.city ? ` · ${lead.city}, ${lead.state}` : ` · ${lead.state ?? ""}`}
                      {" · Submitted "}{relativeTime(lead.createdAt)}
                    </p>
                    {lead.assignedClinicName && (
                      <p className="text-xs text-violet-700 mt-0.5">
                        Assigned: {lead.assignedClinicName}
                        {lead.bookingOutcome && ` · ${lead.bookingOutcome.replace(/_/g, " ")}`}
                      </p>
                    )}
                  </div>
                </div>

                {/* Timeline */}
                <div className="mt-4 overflow-x-auto nv-scroll">
                  <div className="flex items-center min-w-[560px]">
                    {STAGES.map((s, i) => {
                      const reached = i <= completedStages && !isLost;
                      const isCurrent = !isLost && i === completedStages && lead.status === s.id;
                      return (
                        <div key={s.id} className="flex items-center flex-1 last:flex-none">
                          <div className="flex flex-col items-center text-center w-20">
                            <div
                              className={
                                "size-7 rounded-full flex items-center justify-center text-xs font-semibold " +
                                (reached
                                  ? isCurrent
                                    ? "bg-primary text-primary-foreground ring-2 ring-primary/30 ring-offset-2"
                                    : "bg-primary/15 text-primary"
                                  : "bg-muted text-muted-foreground")
                              }
                            >
                              {reached && !isCurrent ? "✓" : i + 1}
                            </div>
                            <span className={"text-[10px] mt-1 " + (reached ? "text-foreground font-medium" : "text-muted-foreground")}>
                              {s.label}
                            </span>
                          </div>
                          {i < STAGES.length - 1 && (
                            <div className={"flex-1 h-0.5 mx-1 " + (i < completedStages && !isLost ? "bg-primary/40" : "bg-border")} />
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>

                {isLost && (
                  <div className="mt-3 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700 inline-flex items-center gap-2">
                    <XCircle className="size-3.5" />
                    Journey exited at <strong className="font-medium">{lead.status}</strong> · {formatDateTime(lead.createdAt)}
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
