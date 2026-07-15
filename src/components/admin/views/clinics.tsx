"use client";

import { useEffect, useState, useCallback } from "react";
import { useNav } from "@/components/admin/admin-app";
import { PageHeader, LoadingState, EmptyState, StageBadge, PriorityBadge, ReadinessScore } from "@/components/admin/shared";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Building2, Search, SlidersHorizontal, PhoneCall, Plus, Inbox, ChevronLeft, ChevronRight, MapPin, Phone, Mail } from "lucide-react";
import { formatCurrency, relativeTime, formatPhone } from "@/lib/format";
import { DEFAULT_SAVED_VIEWS, US_STATES, US_TIMEZONES, SERVICE_CATALOG, PIPELINE_STAGES } from "@/lib/constants";
import { toast } from "sonner";
import { AddClinicDialog } from "@/components/admin/add-clinic-dialog";

interface ClinicRow {
  id: string;
  name: string;
  city: string | null;
  state: string | null;
  primaryPhone: string | null;
  generalEmail: string | null;
  pipelineStage: string;
  priority: string;
  readinessScore: number;
  lastContactedAt: string | null;
  nextAction: string | null;
  nextActionAt: string | null;
  callAttempts: number;
  directoryStatus: string;
  dealValue: number;
  interested: boolean;
  hasDecisionMaker: boolean;
  primaryContact: { id: string; firstName: string; lastName: string; title: string | null } | null;
  services: { name: string; slug: string }[];
}

const FILTERS = [
  { key: "stage", label: "Stage", options: PIPELINE_STAGES.filter((s) => s.active).map((s) => ({ value: s.id, label: s.label })) },
  { key: "priority", label: "Priority", options: [{ value: "critical", label: "Critical" }, { value: "high", label: "High" }, { value: "normal", label: "Normal" }, { value: "low", label: "Low" }] },
  { key: "state", label: "State", options: US_STATES.map((s) => ({ value: s, label: s })) },
  { key: "timezone", label: "Timezone", options: US_TIMEZONES.map((t) => ({ value: t.id, label: t.label })) },
  { key: "directoryStatus", label: "Directory", options: [{ value: "imported", label: "Imported" }, { value: "unclaimed", label: "Unclaimed" }, { value: "approved", label: "Approved" }, { value: "published", label: "Published" }, { value: "archived", label: "Archived" }] },
  { key: "service", label: "Service", options: SERVICE_CATALOG.map((s) => ({ value: s.slug, label: s.name })) },
];

export function ClinicsView() {
  const { openClinic, openLogCall, refreshKey } = useNav();
  const [clinics, setClinics] = useState<ClinicRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(25);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [debouncedQ, setDebouncedQ] = useState("");
  const [activeFilters, setActiveFilters] = useState<Record<string, string>>({});
  const [activeView, setActiveView] = useState<string>("All Clinics");
  const [showFilters, setShowFilters] = useState(true);
  const [addOpen, setAddOpen] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQ(q), 300);
    return () => clearTimeout(t);
  }, [q]);

  const buildQuery = useCallback(() => {
    const params = new URLSearchParams();
    if (debouncedQ) params.set("q", debouncedQ);
    params.set("page", String(page));
    params.set("pageSize", String(pageSize));
    for (const [k, v] of Object.entries(activeFilters)) {
      if (v) params.set(k, v);
    }
    return params.toString();
  }, [debouncedQ, page, pageSize, activeFilters]);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/clinics?${buildQuery()}`)
      .then((r) => r.json())
      .then((d) => {
        setClinics(d.clinics ?? []);
        setTotal(d.total ?? 0);
      })
      .catch(() => toast.error("Failed to load clinics"))
      .finally(() => setLoading(false));
  }, [buildQuery, refreshKey]);

  function applySavedView(viewName: string) {
    setActiveView(viewName);
    setPage(1);
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
      if (f.followUpDue) filters.followUpDue = "true";
      if (f.followUpOverdue) filters.followUpOverdue = "true";
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
    setPage(1);
  }

  function clearFilters() {
    setActiveFilters({});
    setActiveView("All Clinics");
    setPage(1);
  }

  const activeFilterCount = Object.keys(activeFilters).length;

  return (
    <div>
      <PageHeader
        title="Clinics"
        description={`${total} ${total === 1 ? "clinic" : "clinics"} in pipeline`}
        action={
          <>
            <Button variant="outline" onClick={() => setAddOpen(true)}>
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
          onClick={() => applySavedView("All Clinics")}
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

      {/* Search + filter toggle */}
      <div className="flex items-center gap-2 mb-3">
        <div className="relative flex-1 max-w-md">
          <Search className="size-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search clinics, cities, phones…"
            className="pl-9 h-9"
          />
        </div>
        <Button variant={showFilters ? "default" : "outline"} size="sm" onClick={() => setShowFilters((s) => !s)} className="h-9">
          <SlidersHorizontal className="size-4" />
          Filters
          {activeFilterCount > 0 && <span className="ml-1 text-xs bg-background/20 rounded px-1.5">{activeFilterCount}</span>}
        </Button>
        {activeFilterCount > 0 && (
          <Button variant="ghost" size="sm" onClick={clearFilters} className="h-9 text-muted-foreground">
            Clear
          </Button>
        )}
      </div>

      {/* Filters panel */}
      {showFilters && (
        <Card className="p-3 mb-3">
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2">
            {FILTERS.map((f) => (
              <div key={f.key} className="space-y-1">
                <label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">{f.label}</label>
                <Select value={activeFilters[f.key] ?? ""} onValueChange={(v) => setFilter(f.key, v === "__all" ? "" : v)}>
                  <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Any" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__all">Any</SelectItem>
                    {f.options.map((o) => (
                      <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ))}
            <div className="space-y-1">
              <label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">Flags</label>
              <div className="flex flex-col gap-1 pt-0.5">
                <label className="flex items-center gap-1.5 text-xs">
                  <Checkbox checked={activeFilters.interested === "true"} onCheckedChange={(v) => setFilter("interested", v ? "true" : "")} /> Interested
                </label>
                <label className="flex items-center gap-1.5 text-xs">
                  <Checkbox checked={activeFilters.hasDecisionMaker === "true"} onCheckedChange={(v) => setFilter("hasDecisionMaker", v ? "true" : "")} /> Has DM
                </label>
                <label className="flex items-center gap-1.5 text-xs">
                  <Checkbox checked={activeFilters.neverContacted === "true"} onCheckedChange={(v) => setFilter("neverContacted", v ? "true" : "")} /> Never contacted
                </label>
              </div>
            </div>
          </div>
        </Card>
      )}

      {/* Table */}
      <Card className="overflow-hidden p-0">
        {loading ? (
          <LoadingState label="Loading clinics…" />
        ) : clinics.length === 0 ? (
          <EmptyState
            icon={Inbox}
            title="No clinics match"
            description="Try adjusting filters or add a new clinic."
            action={<Button onClick={() => setAddOpen(true)}><Plus className="size-4" /> Add Clinic</Button>}
          />
        ) : (
          <div className="overflow-x-auto nv-scroll">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/40 text-left">
                  <th className="font-medium text-muted-foreground px-3 py-2.5 whitespace-nowrap">Clinic</th>
                  <th className="font-medium text-muted-foreground px-3 py-2.5 whitespace-nowrap hidden md:table-cell">Location</th>
                  <th className="font-medium text-muted-foreground px-3 py-2.5 whitespace-nowrap hidden lg:table-cell">Contact</th>
                  <th className="font-medium text-muted-foreground px-3 py-2.5 whitespace-nowrap">Stage</th>
                  <th className="font-medium text-muted-foreground px-3 py-2.5 whitespace-nowrap hidden sm:table-cell">Priority</th>
                  <th className="font-medium text-muted-foreground px-3 py-2.5 whitespace-nowrap">Readiness</th>
                  <th className="font-medium text-muted-foreground px-3 py-2.5 whitespace-nowrap hidden lg:table-cell">Last Activity</th>
                  <th className="font-medium text-muted-foreground px-3 py-2.5 whitespace-nowrap hidden xl:table-cell">Calls</th>
                  <th className="font-medium text-muted-foreground px-3 py-2.5 whitespace-nowrap hidden xl:table-cell">Deal</th>
                  <th className="px-3 py-2.5"></th>
                </tr>
              </thead>
              <tbody>
                {clinics.map((c) => (
                  <tr
                    key={c.id}
                    onClick={() => openClinic(c.id)}
                    className="border-b last:border-0 hover:bg-accent/40 transition-colors cursor-pointer group"
                  >
                    <td className="px-3 py-2.5">
                      <div className="flex items-center gap-2">
                        <div className="size-7 rounded-md bg-primary/10 flex items-center justify-center shrink-0">
                          <Building2 className="size-3.5 text-primary" />
                        </div>
                        <div className="min-w-0">
                          <p className="font-medium truncate max-w-[200px]">{c.name}</p>
                          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                            {c.interested && <span className="size-1.5 rounded-full bg-amber-500" title="Interested" />}
                            <span className="truncate max-w-[160px]">{c.primaryPhone ? formatPhone(c.primaryPhone) : "No phone"}</span>
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-2.5 hidden md:table-cell text-muted-foreground">
                      <span className="flex items-center gap-1 text-xs">
                        <MapPin className="size-3" />
                        {[c.city, c.state].filter(Boolean).join(", ") || "—"}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 hidden lg:table-cell">
                      {c.primaryContact ? (
                        <div className="text-xs">
                          <p className="font-medium truncate max-w-[140px]">{c.primaryContact.firstName} {c.primaryContact.lastName}</p>
                          <p className="text-muted-foreground truncate max-w-[140px]">{c.primaryContact.title || "—"}</p>
                        </div>
                      ) : <span className="text-muted-foreground text-xs">—</span>}
                    </td>
                    <td className="px-3 py-2.5"><StageBadge stage={c.pipelineStage} /></td>
                    <td className="px-3 py-2.5 hidden sm:table-cell"><PriorityBadge priority={c.priority} /></td>
                    <td className="px-3 py-2.5"><ReadinessScore score={c.readinessScore} /></td>
                    <td className="px-3 py-2.5 hidden lg:table-cell text-xs text-muted-foreground">{relativeTime(c.lastContactedAt)}</td>
                    <td className="px-3 py-2.5 hidden xl:table-cell text-xs tabular-nums text-muted-foreground">{c.callAttempts}</td>
                    <td className="px-3 py-2.5 hidden xl:table-cell text-xs tabular-nums">{c.dealValue > 0 ? formatCurrency(c.dealValue) : "—"}</td>
                    <td className="px-3 py-2.5 text-right">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-7 opacity-0 group-hover:opacity-100 transition-opacity"
                        onClick={(e) => { e.stopPropagation(); openLogCall(c.id); }}
                        title="Log call"
                      >
                        <PhoneCall className="size-3.5" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {!loading && clinics.length > 0 && (
          <div className="flex items-center justify-between px-3 py-2.5 border-t text-xs text-muted-foreground">
            <span>Showing {(page - 1) * pageSize + 1}–{Math.min(page * pageSize, total)} of {total}</span>
            <div className="flex items-center gap-1">
              <Button variant="outline" size="icon" className="size-7" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                <ChevronLeft className="size-3.5" />
              </Button>
              <span className="px-2 tabular-nums">{page}</span>
              <Button variant="outline" size="icon" className="size-7" disabled={page * pageSize >= total} onClick={() => setPage((p) => p + 1)}>
                <ChevronRight className="size-3.5" />
              </Button>
            </div>
          </div>
        )}
      </Card>

      <AddClinicDialog open={addOpen} onOpenChange={setAddOpen} onCreated={(id) => openClinic(id)} />
    </div>
  );
}
