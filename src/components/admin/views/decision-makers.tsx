"use client";

import { useEffect, useMemo, useState } from "react";
import { useNav } from "@/components/admin/admin-app";
import {
  PageHeader, MetricCard, SectionCard, EmptyState, LoadingState, FilterBar, DataTable,
  StatusBadge, ScoreBadge, type Column,
} from "@/components/admin/shared";
import { Button } from "@/components/ui/button";
import {
  Crown, Phone, Mail, Building2, ArrowRight, UserCheck, Target, Zap, Star,
} from "lucide-react";
import { clinicService } from "@/services";
import type { Clinic, ClinicContact } from "@/types";
import { formatPhone, fullName, relativeTime, localTime, isWithinCallingHours } from "@/lib/format";
import { contactTypeLabel } from "@/lib/constants";
import { toast } from "sonner";

type DMRow = ClinicContact & {
  clinicName: string;
  clinicCity?: string;
  clinicState?: string;
  clinicStage: string;
  clinicPriority: string;
  clinicReadiness: number;
  clinicTimezone: string;
  clinicId: string;
};

export function DecisionMakersView() {
  const { openClinic, navigate, refreshKey } = useNav();
  const [clinics, setClinics] = useState<Clinic[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [activeFilters, setActiveFilters] = useState<Record<string, string>>({});

  useEffect(() => {
    setLoading(true);
    clinicService
      .list()
      .then((d) => setClinics(d.clinics))
      .catch(() => toast.error("Failed to load decision-makers"))
      .finally(() => setLoading(false));
  }, [refreshKey]);

  const dms: DMRow[] = useMemo(() => {
    const out: DMRow[] = [];
    clinics.forEach((c) => {
      c.contacts.filter((ct) => ct.isDecisionMaker).forEach((ct) => {
        out.push({
          ...ct,
          clinicName: c.name,
          clinicCity: c.city,
          clinicState: c.state,
          clinicStage: c.pipelineStage,
          clinicPriority: c.priority,
          clinicReadiness: c.readinessScore,
          clinicTimezone: c.timezone,
          clinicId: c.id,
        });
      });
    });
    return out;
  }, [clinics]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return dms.filter((c) => {
      if (q && !`${c.firstName} ${c.lastName} ${c.email ?? ""} ${c.directPhone ?? ""} ${c.mobilePhone ?? ""} ${c.clinicName} ${c.title ?? ""}`.toLowerCase().includes(q)) return false;
      if (activeFilters.stage && c.clinicStage !== activeFilters.stage) return false;
      if (activeFilters.priority && c.clinicPriority !== activeFilters.priority) return false;
      if (activeFilters.callable === "yes" && !isWithinCallingHours(c.clinicTimezone)) return false;
      return true;
    });
  }, [dms, search, activeFilters]);

  const callableNow = dms.filter((d) => isWithinCallingHours(d.clinicTimezone)).length;
  const highPriority = dms.filter((d) => d.clinicPriority === "high" || d.clinicPriority === "critical").length;
  const avgReadiness = dms.length > 0 ? Math.round(dms.reduce((s, d) => s + d.clinicReadiness, 0) / dms.length) : 0;
  const neverContacted = dms.filter((d) => !d.lastContactedAt).length;

  const columns: Column<DMRow>[] = useMemo(() => [
    {
      key: "name",
      header: "Decision-Maker",
      render: (c) => (
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <Crown className="size-3.5 text-amber-500 shrink-0" />
            <p className="font-medium truncate">{fullName(c.firstName, c.lastName)}</p>
            {c.isPrimary && <Star className="size-3 text-violet-500 shrink-0" />}
          </div>
          {c.title && <p className="text-xs text-muted-foreground truncate">{c.title}</p>}
        </div>
      ),
      sortValue: (c) => `${c.firstName} ${c.lastName}`,
    },
    {
      key: "clinic",
      header: "Clinic",
      render: (c) => (
        <div className="min-w-0">
          <p className="text-sm truncate">{c.clinicName}</p>
          <p className="text-xs text-muted-foreground truncate">
            {[c.clinicCity, c.clinicState].filter(Boolean).join(", ")} · {localTime(c.clinicTimezone)}
          </p>
        </div>
      ),
      sortValue: (c) => c.clinicName,
    },
    {
      key: "phone",
      header: "Phone",
      render: (c) => (
        <span className="text-sm tabular-nums text-muted-foreground">
          {formatPhone(c.directPhone ?? c.mobilePhone)}
        </span>
      ),
      sortValue: (c) => c.directPhone ?? c.mobilePhone ?? "",
      hideOnMobile: true,
    },
    {
      key: "email",
      header: "Email",
      render: (c) => c.email ? (
        <span className="text-sm text-muted-foreground truncate inline-block max-w-[160px]">{c.email}</span>
      ) : <span className="text-xs text-muted-foreground">—</span>,
      sortValue: (c) => c.email ?? "",
      hideOnMobile: true,
    },
    {
      key: "readiness",
      header: "Readiness",
      render: (c) => <ScoreBadge score={c.clinicReadiness} />,
      sortValue: (c) => c.clinicReadiness,
    },
    {
      key: "priority",
      header: "Priority",
      render: (c) => <StatusBadge label={c.clinicPriority} color={c.clinicPriority === "critical" ? "rose" : c.clinicPriority === "high" ? "amber" : c.clinicPriority === "normal" ? "teal" : "slate"} />,
      sortValue: (c) => c.clinicPriority,
      hideOnMobile: true,
    },
    {
      key: "callable",
      header: "Callable Now",
      render: (c) => (
        <span className={`inline-flex items-center gap-1 text-xs ${isWithinCallingHours(c.clinicTimezone) ? "text-emerald-600" : "text-muted-foreground"}`}>
          <span className={`size-1.5 rounded-full ${isWithinCallingHours(c.clinicTimezone) ? "bg-emerald-500" : "bg-slate-300"}`} />
          {isWithinCallingHours(c.clinicTimezone) ? "Yes" : "Outside hours"}
        </span>
      ),
      sortValue: (c) => isWithinCallingHours(c.clinicTimezone) ? 1 : 0,
    },
    {
      key: "actions",
      header: "",
      render: (c) => (
        <Button
          variant="outline"
          size="sm"
          className="h-7 text-xs"
          onClick={(e) => {
            e.stopPropagation();
            navigate("calls", c.clinicId);
          }}
        >
          <Phone className="size-3.5" /> Log call
        </Button>
      ),
      hideOnMobile: true,
    },
  ], [navigate]);

  if (loading) return <LoadingState label="Loading decision-makers…" />;

  return (
    <div>
      <PageHeader
        title="Decision-Makers"
        description="Key contacts with authority to make purchasing decisions"
        action={
          <Button variant="outline" onClick={() => navigate("contacts")}>
            <Building2 className="size-4" /> All contacts
          </Button>
        }
      />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
        <MetricCard label="Decision-Makers" value={dms.length} icon={Crown} tone="amber" />
        <MetricCard label="Callable Now" value={callableNow} icon={Phone} tone="green" hint="Within calling hours" />
        <MetricCard label="High Priority" value={highPriority} icon={Target} tone="rose" />
        <MetricCard label="Avg Readiness" value={avgReadiness} icon={Zap} tone="teal" hint="Score / 100" />
      </div>

      <FilterBar
        search={search}
        onSearchChange={setSearch}
        filters={[
          {
            key: "priority", label: "Priority", options: [
              { value: "critical", label: "Critical" },
              { value: "high", label: "High" },
              { value: "normal", label: "Normal" },
              { value: "low", label: "Low" },
            ],
          },
          {
            key: "stage", label: "Stage", options: [
              { value: "ready_to_call", label: "Ready to Call" },
              { value: "attempted", label: "Attempted" },
              { value: "connected", label: "Connected" },
              { value: "interested", label: "Interested" },
              { value: "meeting_booked", label: "Meeting Booked" },
              { value: "proposal_sent", label: "Proposal Sent" },
              { value: "paid", label: "Paid" },
            ],
          },
          { key: "callable", label: "Callable Now", options: [{ value: "yes", label: "Yes" }] },
        ]}
        activeFilters={activeFilters}
        onFilterChange={(k, v) => setActiveFilters((prev) => {
          const next = { ...prev };
          if (v) next[k] = v; else delete next[k];
          return next;
        })}
        onClear={() => setActiveFilters({})}
        searchPlaceholder="Search decision-makers by name, clinic, phone…"
      />

      {filtered.length === 0 ? (
        <SectionCard>
          <EmptyState
            icon={Crown}
            title="No decision-makers found"
            description="Add decision-maker contacts to clinics to see them here."
            action={<Button onClick={() => navigate("clinics")}>Browse clinics <ArrowRight className="size-4" /></Button>}
          />
        </SectionCard>
      ) : (
        <SectionCard bodyClassName="p-0">
          <DataTable
            columns={columns}
            data={filtered}
            onRowClick={(c) => openClinic(c.clinicId)}
            pageSize={25}
          />
        </SectionCard>
      )}

      {/* High-priority DM spotlight */}
      {filtered.length > 0 && (
        <SectionCard
          title="High-Priority Decision-Makers"
          description="Critical & high-priority DMs ready for outreach"
          className="mt-4"
          bodyClassName="p-0"
        >
          {filtered.filter((d) => d.clinicPriority === "critical" || d.clinicPriority === "high").slice(0, 5).map((d) => (
            <button
              key={d.id}
              onClick={() => openClinic(d.clinicId)}
              className="w-full flex items-center gap-3 px-4 py-3 hover:bg-accent/50 transition-colors text-left border-b last:border-0 border-border/60"
            >
              <div className="size-9 rounded-full bg-amber-50 text-amber-700 flex items-center justify-center shrink-0">
                <Crown className="size-4" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{fullName(d.firstName, d.lastName)} {d.title && `· ${d.title}`}</p>
                <p className="text-xs text-muted-foreground truncate">
                  {d.clinicName} · {[d.clinicCity, d.clinicState].filter(Boolean).join(", ")}
                </p>
              </div>
              <ScoreBadge score={d.clinicReadiness} />
              <StatusBadge
                label={d.clinicPriority}
                color={d.clinicPriority === "critical" ? "rose" : "amber"}
              />
              <ArrowRight className="size-4 text-muted-foreground shrink-0" />
            </button>
          ))}
        </SectionCard>
      )}
    </div>
  );
}
