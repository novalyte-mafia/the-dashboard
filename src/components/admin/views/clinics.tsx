"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { useNav } from "@/components/admin/admin-app";
import {
  PageHeader,
  LoadingState,
  EmptyState,
  FilterBar,
  DataTable,
  StageBadge,
  PriorityBadge,
  ReadinessScore,
} from "@/components/admin/shared";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Building2,
  Search,
  SlidersHorizontal,
  PhoneCall,
  Plus,
  Inbox,
  MapPin,
  Phone,
} from "lucide-react";
import { formatCurrency, relativeTime, formatPhone, stageLabel } from "@/lib/format";
import {
  DEFAULT_SAVED_VIEWS,
  US_STATES,
  US_TIMEZONES,
  SERVICE_CATALOG,
  PIPELINE_STAGES,
} from "@/lib/constants";
import { clinicService } from "@/services";
import { toast } from "sonner";
import type { Clinic } from "@/types";

const FILTERS = [
  { key: "stage", label: "Stage", options: PIPELINE_STAGES.filter((s) => s.active).map((s) => ({ value: s.id, label: s.label })) },
  { key: "priority", label: "Priority", options: [{ value: "critical", label: "Critical" }, { value: "high", label: "High" }, { value: "normal", label: "Normal" }, { value: "low", label: "Low" }] },
  { key: "state", label: "State", options: US_STATES.map((s) => ({ value: s, label: s })) },
];

export function ClinicsView() {
  const { openClinic, openLogCall, refreshKey } = useNav();
  const [clinics, setClinics] = useState<Clinic[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [debouncedQ, setDebouncedQ] = useState("");
  const [activeFilters, setActiveFilters] = useState<Record<string, string>>({});
  const [activeView, setActiveView] = useState<string>("All Clinics");

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQ(q), 300);
    return () => clearTimeout(t);
  }, [q]);

  const fetchFilters = useMemo(() => {
    const filters: Record<string, unknown> = {};
    if (debouncedQ) filters.q = debouncedQ;
    if (activeFilters.stage) filters.stage = activeFilters.stage;
    if (activeFilters.priority) filters.priority = activeFilters.priority;
    if (activeFilters.state) filters.state = activeFilters.state;
    if (activeFilters.interested) filters.interested = true;
    if (activeFilters.hasDecisionMaker) filters.hasDecisionMaker = true;
    if (activeFilters.neverContacted) filters.neverContacted = true;
    return filters;
  }, [debouncedQ, activeFilters]);

  useEffect(() => {
    setLoading(true);
    clinicService.list(fetchFilters).then((d) => {
      setClinics(d.clinics);
      setTotal(d.total);
    }).catch(() => toast.error("Failed to load clinics")).finally(() => setLoading(false));
  }, [fetchFilters, refreshKey]);

  function applySavedView(viewName: string) {
    setActiveView(viewName);
    const found = DEFAULT_SAVED_VIEWS.find((v) => v.name === viewName);
    const filters: Record<string, string> = {};
    if (found) {
      const f = found.filters as Record<string, unknown>;
      if (f.pipelineStage) filters.stage = String(f.pipelineStage);
      if (f.priority) filters.priority = String(f.priority);
      if (f.directoryStatus) filters.directoryStatus = String(f.directoryStatus);
      if (f.interested) filters.interested = "true";
      if (f.paid) filters.paid = "true";
      if (f.hasDecisionMaker) filters.hasDecisionMaker = "true";
      if (f.neverContacted) filters.neverContacted = "true";
    }
    setActiveFilters(filters);
  }

  function setFilter(key: string, value: string) {
    setActiveFilters((prev) => {
      const next = { ...prev };
      if (value) next[key] = value; else delete next[key];
      return next;
    });
    setActiveView("Custom");
  }

  function clearFilters() {
    setActiveFilters({});
    setActiveView("All Clinics");
  }

  const activeFilterCount = Object.values(activeFilters).filter(Boolean).length;

  return (
    <div>
      <PageHeader
        title="Clinics"
        description={`${total} ${total === 1 ? "clinic" : "clinics"} in pipeline`}
        action={
          <>
            <Button variant="outline" onClick={() => toast.info("Add Clinic form — coming soon.")}>
              <Plus className="size-4" />
              <span className="hidden sm:inline">Add Clinic</span>
            </Button>
            <Button onClick={() => openLogCall()}>
              <PhoneCall className="size-4" />
              <span className="hidden sm:inline">Log Call</span>
            </Button>
          </>
        }
      />

      {/* Saved views */}
      <div className="flex items-center gap-2 mb-3 overflow-x-auto nv-scroll pb-1">
        <button
          onClick={() => { applySavedView("All Clinics"); clearFilters(); }}
          className={`shrink-0 text-xs font-medium px-2.5 py-1.5 rounded-md border transition-colors ${activeView === "All Clinics" ? "bg-primary text-primary-foreground border-primary" : "bg-card hover:bg-accent"}`}
        >
          All Clinics
        </button>
        {DEFAULT_SAVED_VIEWS.map((v) => (
          <button
            key={v.name}
            onClick={() => applySavedView(v.name)}
            className={`shrink-0 text-xs font-medium px-2.5 py-1.5 rounded-md border transition-colors ${activeView === v.name ? "bg-primary text-primary-foreground border-primary" : "bg-card hover:bg-accent"}`}
          >
            {v.name}
          </button>
        ))}
      </div>

      <FilterBar
        search={q}
        onSearchChange={setQ}
        searchPlaceholder="Search clinics, cities, phones…"
        filters={FILTERS}
        activeFilters={activeFilters}
        onFilterChange={setFilter}
        onClear={clearFilters}
      />

      {/* Flags row */}
      <div className="flex items-center gap-4 mb-3 text-xs">
        <label className="flex items-center gap-1.5">
          <Checkbox checked={activeFilters.interested === "true"} onCheckedChange={(v) => setFilter("interested", v ? "true" : "")} /> Interested
        </label>
        <label className="flex items-center gap-1.5">
          <Checkbox checked={activeFilters.hasDecisionMaker === "true"} onCheckedChange={(v) => setFilter("hasDecisionMaker", v ? "true" : "")} /> Has DM
        </label>
        <label className="flex items-center gap-1.5">
          <Checkbox checked={activeFilters.neverContacted === "true"} onCheckedChange={(v) => setFilter("neverContacted", v ? "true" : "")} /> Never contacted
        </label>
      </div>

      <Card className="overflow-hidden p-0">
        {loading ? (
          <LoadingState label="Loading clinics…" />
        ) : clinics.length === 0 ? (
          <EmptyState
            icon={Inbox}
            title="No clinics match"
            description="Try adjusting filters or add a new clinic."
          />
        ) : (
          <DataTable
            data={clinics}
            onRowClick={(c) => openClinic(c.id)}
            columns={[
              {
                key: "name",
                header: "Clinic",
                render: (c) => (
                  <div className="flex items-center gap-2">
                    <div className="size-7 rounded-md bg-primary/10 flex items-center justify-center shrink-0">
                      <Building2 className="size-3.5 text-primary" />
                    </div>
                    <div className="min-w-0">
                      <p className="font-medium truncate max-w-[200px]">{c.name}</p>
                      <p className="text-xs text-muted-foreground truncate max-w-[180px]">
                        {c.primaryPhone ? formatPhone(c.primaryPhone) : "No phone"}
                      </p>
                    </div>
                  </div>
                ),
                sortValue: (c) => c.name,
              },
              {
                key: "location",
                header: "Location",
                render: (c) => (
                  <span className="flex items-center gap-1 text-xs text-muted-foreground">
                    <MapPin className="size-3" />
                    {[c.city, c.state].filter(Boolean).join(", ") || "—"}
                  </span>
                ),
                hideOnMobile: true,
              },
              {
                key: "stage",
                header: "Stage",
                render: (c) => <StageBadge stage={c.pipelineStage} />,
                sortValue: (c) => c.pipelineStage,
              },
              {
                key: "priority",
                header: "Priority",
                render: (c) => <PriorityBadge priority={c.priority} />,
                hideOnMobile: true,
              },
              {
                key: "readiness",
                header: "Readiness",
                render: (c) => <ReadinessScore score={c.readinessScore} />,
                sortValue: (c) => c.readinessScore,
              },
              {
                key: "lastContacted",
                header: "Last Activity",
                render: (c) => <span className="text-xs text-muted-foreground">{relativeTime(c.lastContactedAt)}</span>,
                sortValue: (c) => c.lastContactedAt ?? "",
                hideOnMobile: true,
              },
              {
                key: "calls",
                header: "Calls",
                render: (c) => <span className="text-xs tabular-nums text-muted-foreground">{c.callAttempts}</span>,
                sortValue: (c) => c.callAttempts,
                hideOnMobile: true,
              },
              {
                key: "value",
                header: "Deal",
                render: (c) => (
                  <span className="text-xs tabular-nums">
                    {c.estimatedValue > 0 ? formatCurrency(c.estimatedValue) : "—"}
                  </span>
                ),
                sortValue: (c) => c.estimatedValue,
                hideOnMobile: true,
              },
            ]}
            pageSize={25}
          />
        )}
      </Card>
    </div>
  );
}
