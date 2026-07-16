"use client";

import { useEffect, useMemo, useState } from "react";
import { useNav } from "@/components/admin/admin-app";
import {
  PageHeader, MetricCard, FilterBar, DataTable, LoadingState, EmptyState,
  ScoreBadge, SectionCard, ConfirmationDialog, type Column,
} from "@/components/admin/shared";
import { Button } from "@/components/ui/button";
import {
  Route, Inbox, Timer, CheckCircle2, RefreshCw, XCircle,
  MapPin, Stethoscope, Clock,
} from "lucide-react";
import { patientService } from "@/services";
import type { PatientLead } from "@/types";
import { relativeTime } from "@/lib/format";
import { SERVICE_CATALOG } from "@/lib/constants";
import { toast } from "sonner";

const FILTERS = [
  {
    key: "treatment",
    label: "Treatment",
    options: SERVICE_CATALOG.map((s) => ({ value: s.slug, label: s.name })),
  },
];

export function LeadRoutingView() {
  const { refreshKey, navigate } = useNav();
  const [leads, setLeads] = useState<PatientLead[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [activeFilters, setActiveFilters] = useState<Record<string, string>>({});
  const [disqualifyTarget, setDisqualifyTarget] = useState<PatientLead | null>(null);

  useEffect(() => {
    setLoading(true);
    patientService
      .listLeads("new")
      .then((d) => setLeads(d.leads))
      .finally(() => setLoading(false));
  }, [refreshKey]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return leads.filter((l) => {
      if (q && !`${l.name} ${l.email ?? ""} ${l.city ?? ""} ${l.state ?? ""}`.toLowerCase().includes(q)) return false;
      if (activeFilters.treatment && l.treatmentInterest !== activeFilters.treatment) return false;
      return true;
    });
  }, [leads, search, activeFilters]);

  const avgQual = leads.length
    ? Math.round(leads.reduce((s, l) => s + l.qualificationScore, 0) / leads.length)
    : 0;
  const avgUrgency = leads.length
    ? Math.round(leads.reduce((s, l) => s + l.urgencyScore, 0) / leads.length)
    : 0;
  const highUrgency = leads.filter((l) => l.urgencyScore >= 70).length;

  const treatmentName = (slug: string) =>
    SERVICE_CATALOG.find((s) => s.slug === slug)?.name ?? slug;

  function routeLead(lead: PatientLead) {
    toast.success(`Lead routed · ${lead.name}`, {
      description: `Marked ready for clinic matching (treatment: ${treatmentName(lead.treatmentInterest)}).`,
    });
    setLeads((prev) => prev.filter((l) => l.id !== lead.id));
  }

  function reassign(lead: PatientLead) {
    toast.info(`Reassign initiated · ${lead.name}`, {
      description: "Re-running lead qualification & clinic matching.",
    });
  }

  function confirmDisqualify() {
    if (!disqualifyTarget) return;
    toast.error(`Disqualified · ${disqualifyTarget.name}`, {
      description: "Lead removed from routing queue.",
    });
    setLeads((prev) => prev.filter((l) => l.id !== disqualifyTarget.id));
    setDisqualifyTarget(null);
  }

  const columns: Column<PatientLead>[] = [
    {
      key: "name",
      header: "Patient",
      render: (l) => (
        <div className="min-w-0">
          <div className="font-medium truncate">{l.name}</div>
          <div className="text-xs text-muted-foreground truncate">
            {l.city ? `${l.city}, ${l.state ?? ""}` : l.state ?? "—"}
            {" · "}{relativeTime(l.createdAt)}
          </div>
        </div>
      ),
      sortValue: (l) => l.name,
    },
    {
      key: "treatment",
      header: "Treatment",
      render: (l) => (
        <span className="text-sm inline-flex items-center gap-1.5">
          <Stethoscope className="size-3.5 text-muted-foreground" />
          {treatmentName(l.treatmentInterest)}
        </span>
      ),
      hideOnMobile: true,
    },
    {
      key: "location",
      header: "Market",
      render: (l) => (
        <span className="text-sm text-muted-foreground inline-flex items-center gap-1">
          <MapPin className="size-3" />
          {l.state ?? "—"}
        </span>
      ),
      sortValue: (l) => l.state ?? "",
      hideOnMobile: true,
    },
    {
      key: "qualification",
      header: "Qual",
      render: (l) => <ScoreBadge score={l.qualificationScore} />,
      sortValue: (l) => l.qualificationScore,
    },
    {
      key: "urgency",
      header: "Urgency",
      render: (l) => <ScoreBadge score={l.urgencyScore} />,
      sortValue: (l) => l.urgencyScore,
    },
    {
      key: "actions",
      header: "Actions",
      render: (l) => (
        <div className="flex items-center gap-1.5">
          <Button
            size="sm"
            className="h-7"
            onClick={(e) => {
              e.stopPropagation();
              routeLead(l);
            }}
          >
            <Route className="size-3.5" /> Route
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="h-7"
            onClick={(e) => {
              e.stopPropagation();
              navigate("clinic-matching", null, { leadId: l.id });
            }}
          >
            Match
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="h-7 text-muted-foreground"
            onClick={(e) => {
              e.stopPropagation();
              reassign(l);
            }}
          >
            <RefreshCw className="size-3.5" />
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="h-7 text-rose-600 hover:text-rose-700"
            onClick={(e) => {
              e.stopPropagation();
              setDisqualifyTarget(l);
            }}
          >
            <XCircle className="size-3.5" />
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        title="Lead Routing Queue"
        description="Unassigned patient leads awaiting clinic routing — sorted by qualification & urgency"
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
        <MetricCard label="Open Queue" value={leads.length} icon={Inbox} tone="teal" hint="Status: New" />
        <MetricCard label="High Urgency" value={highUrgency} icon={Timer} tone="rose" hint="Urgency ≥ 70" />
        <MetricCard label="Avg Qualification" value={avgQual} icon={CheckCircle2} tone="amber" hint="Mean qual score" />
        <MetricCard label="Avg Urgency" value={avgUrgency} icon={Clock} tone="violet" hint="Mean urgency score" />
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
        searchPlaceholder="Search by patient name, email, market…"
      />

      {loading ? (
        <SectionCard>
          <LoadingState label="Loading routing queue…" />
        </SectionCard>
      ) : filtered.length === 0 ? (
        <SectionCard>
          <EmptyState
            icon={CheckCircle2}
            title="Queue is clear"
            description="No new patient leads are awaiting routing. New submissions will appear here automatically."
          />
        </SectionCard>
      ) : (
        <SectionCard bodyClassName="p-0">
          <DataTable
            columns={columns}
            data={filtered}
            pageSize={15}
            emptyTitle="No routable leads"
          />
        </SectionCard>
      )}

      <ConfirmationDialog
        open={!!disqualifyTarget}
        onOpenChange={(o) => !o && setDisqualifyTarget(null)}
        title="Disqualify Lead?"
        description={
          disqualifyTarget
            ? `${disqualifyTarget.name} will be removed from the routing queue and marked as disqualified. This action cannot be undone in this session.`
            : ""
        }
        confirmLabel="Disqualify"
        destructive
        onConfirm={confirmDisqualify}
      />
    </div>
  );
}
