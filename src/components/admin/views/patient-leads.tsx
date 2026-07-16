"use client";

import { useEffect, useMemo, useState } from "react";
import { useNav } from "@/components/admin/admin-app";
import {
  PageHeader, MetricCard, FilterBar, DataTable, LoadingState, EmptyState,
  StatusBadge, ScoreBadge, DetailDrawer, SectionCard, type Column,
} from "@/components/admin/shared";
import { Button } from "@/components/ui/button";
import {
  Users, Flame, MapPin, ArrowRightCircle, Phone, Mail, MessageSquare,
  Building2, CalendarClock, Stethoscope, Activity, Inbox,
} from "lucide-react";
import { patientService } from "@/services";
import type { PatientLead } from "@/types";
import { formatPhone, relativeTime, formatDate } from "@/lib/format";
import { SERVICE_CATALOG, US_STATES } from "@/lib/constants";

const STATUS_COLOR: Record<string, string> = {
  new: "teal",
  qualified: "green",
  contacted: "amber",
  routed: "violet",
  booked: "green",
  lost: "rose",
  disqualified: "rose",
  duplicate: "slate",
};

const SOURCE_LABEL: Record<string, string> = {
  google_ads: "Google Ads",
  organic_search: "Organic Search",
  directory: "Directory",
  referral: "Referral",
  facebook: "Facebook",
  direct: "Direct",
};

const FILTERS = [
  {
    key: "status",
    label: "Status",
    options: [
      { value: "new", label: "New" },
      { value: "qualified", label: "Qualified" },
      { value: "contacted", label: "Contacted" },
      { value: "routed", label: "Routed" },
      { value: "booked", label: "Booked" },
      { value: "lost", label: "Lost" },
      { value: "disqualified", label: "Disqualified" },
      { value: "duplicate", label: "Duplicate" },
    ],
  },
  {
    key: "treatment",
    label: "Treatment",
    options: SERVICE_CATALOG.map((s) => ({ value: s.slug, label: s.name })),
  },
  {
    key: "source",
    label: "Source",
    options: Object.entries(SOURCE_LABEL).map(([value, label]) => ({ value, label })),
  },
  {
    key: "state",
    label: "State",
    options: US_STATES.map((s) => ({ value: s, label: s })),
  },
];

export function PatientLeadsView() {
  const { refreshKey, navigate } = useNav();
  const [leads, setLeads] = useState<PatientLead[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [activeFilters, setActiveFilters] = useState<Record<string, string>>({});
  const [selected, setSelected] = useState<PatientLead | null>(null);

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
      if (q && !`${l.name} ${l.email ?? ""} ${l.phone ?? ""} ${l.city ?? ""} ${l.state ?? ""}`.toLowerCase().includes(q)) return false;
      if (activeFilters.status && l.status !== activeFilters.status) return false;
      if (activeFilters.treatment && l.treatmentInterest !== activeFilters.treatment) return false;
      if (activeFilters.source && l.leadSource !== activeFilters.source) return false;
      if (activeFilters.state && l.state !== activeFilters.state) return false;
      return true;
    });
  }, [leads, search, activeFilters]);

  const newCount = leads.filter((l) => l.status === "new").length;
  const qualifiedCount = leads.filter((l) => l.status === "qualified").length;
  const routedCount = leads.filter((l) => l.status === "routed").length;
  const bookedCount = leads.filter((l) => l.status === "booked").length;

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
      header: "Treatment",
      render: (l) => (
        <span className="text-sm">{treatmentName(l.treatmentInterest)}</span>
      ),
      hideOnMobile: true,
    },
    {
      key: "location",
      header: "Location",
      render: (l) => (
        <span className="text-sm text-muted-foreground inline-flex items-center gap-1">
          <MapPin className="size-3" />
          {l.city ? `${l.city}, ${l.state ?? ""}` : l.state ?? "—"}
        </span>
      ),
      sortValue: (l) => `${l.state ?? ""}-${l.city ?? ""}`,
      hideOnMobile: true,
    },
    {
      key: "qualification",
      header: "Qual Score",
      render: (l) => <ScoreBadge score={l.qualificationScore} />,
      sortValue: (l) => l.qualificationScore,
    },
    {
      key: "urgency",
      header: "Urgency",
      render: (l) => <ScoreBadge score={l.urgencyScore} />,
      sortValue: (l) => l.urgencyScore,
      hideOnMobile: true,
    },
    {
      key: "status",
      header: "Status",
      render: (l) => <StatusBadge label={l.status} color={STATUS_COLOR[l.status] ?? "slate"} />,
      sortValue: (l) => l.status,
    },
    {
      key: "clinic",
      header: "Assigned Clinic",
      render: (l) =>
        l.assignedClinicName ? (
          <span className="text-sm truncate inline-flex items-center gap-1">
            <Building2 className="size-3 text-muted-foreground" />
            {l.assignedClinicName}
          </span>
        ) : (
          <span className="text-xs text-muted-foreground">Unassigned</span>
        ),
      hideOnMobile: true,
    },
  ];

  return (
    <div>
      <PageHeader
        title="Patient Leads"
        description="Inbound patient inquiries awaiting qualification, routing, and booking"
        action={
          <Button variant="outline" onClick={() => navigate("lead-routing")}>
            <ArrowRightCircle className="size-4" /> Open Routing Queue
          </Button>
        }
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
        <MetricCard label="New Leads" value={newCount} icon={Users} tone="teal" hint="Awaiting qualification" />
        <MetricCard label="Qualified" value={qualifiedCount} icon={Activity} tone="amber" hint="Ready to route" />
        <MetricCard label="Routed" value={routedCount} icon={ArrowRightCircle} tone="violet" hint="Sent to clinic" />
        <MetricCard label="Booked" value={bookedCount} icon={CalendarClock} tone="green" hint="Appointment set" />
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
        searchPlaceholder="Search by name, email, phone, location…"
      />

      {loading ? (
        <SectionCard>
          <LoadingState label="Loading patient leads…" />
        </SectionCard>
      ) : filtered.length === 0 ? (
        <SectionCard>
          <EmptyState
            icon={Inbox}
            title="No patient leads match"
            description="Try adjusting filters or search to surface matching leads."
          />
        </SectionCard>
      ) : (
        <SectionCard bodyClassName="p-0">
          <DataTable
            columns={columns}
            data={filtered}
            onRowClick={(l) => setSelected(l)}
            pageSize={20}
            emptyTitle="No patient leads"
          />
        </SectionCard>
      )}

      <DetailDrawer
        open={!!selected}
        onOpenChange={(o) => !o && setSelected(null)}
        title={selected ? `Lead · ${selected.name}` : ""}
      >
        {selected && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <StatusBadge label={selected.status} color={STATUS_COLOR[selected.status] ?? "slate"} />
              <ScoreBadge score={selected.qualificationScore} />
            </div>

            <div className="grid grid-cols-2 gap-2 text-sm">
              <Info icon={Stethoscope} label="Treatment" value={treatmentName(selected.treatmentInterest)} />
              <Info icon={MapPin} label="Location" value={selected.city ? `${selected.city}, ${selected.state}` : selected.state ?? "—"} />
              <Info icon={Phone} label="Phone" value={formatPhone(selected.phone)} />
              <Info icon={Mail} label="Email" value={selected.email ?? "—"} />
              <Info icon={MessageSquare} label="Preferred Contact" value={selected.preferredContact} />
              <Info icon={CalendarClock} label="Submitted" value={relativeTime(selected.createdAt)} />
            </div>

            {selected.symptoms && (
              <div>
                <p className="text-xs uppercase text-muted-foreground tracking-wide mb-1">Reported Symptoms</p>
                <p className="text-sm">{selected.symptoms}</p>
              </div>
            )}

            <div className="grid grid-cols-2 gap-2 text-xs">
              <Stat label="Urgency" value={selected.urgencyScore} />
              <Stat label="Assessment" value={selected.assessmentScore ?? 0} />
              <Stat label="Age" value={selected.age ?? "—"} />
              <Stat label="Insurance" value={selected.insurancePreference.replace("_", " ")} />
            </div>

            {selected.assignedClinicName ? (
              <div className="rounded-md border border-violet-200 bg-violet-50 p-3">
                <p className="text-xs text-violet-700 font-medium uppercase tracking-wide">Assigned Clinic</p>
                <p className="text-sm font-medium mt-0.5">{selected.assignedClinicName}</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Referral: {selected.referralStatus ?? "—"} · Booked: {selected.bookingOutcome ?? "—"}
                </p>
              </div>
            ) : (
              <div className="rounded-md border border-teal-200 bg-teal-50 p-3">
                <p className="text-xs text-teal-700 font-medium uppercase tracking-wide">No Clinic Assigned</p>
                <p className="text-sm mt-0.5">Run clinic matching to find the best fit for this lead.</p>
                <Button
                  size="sm"
                  className="mt-2"
                  onClick={() => {
                    navigate("clinic-matching", null, { leadId: selected.id });
                  }}
                >
                  <ArrowRightCircle className="size-4" /> Match with Clinics
                </Button>
              </div>
            )}

            {selected.notes && (
              <div className="rounded-md bg-muted/60 p-3">
                <p className="text-xs uppercase text-muted-foreground tracking-wide mb-1">Notes</p>
                <p className="text-sm">{selected.notes}</p>
              </div>
            )}

            <p className="text-xs text-muted-foreground">
              Lead source: {SOURCE_LABEL[selected.leadSource] ?? selected.leadSource}
              {selected.campaignSource && ` · ${selected.campaignSource}`}
              {" · Created "}{formatDate(selected.createdAt)}
            </p>
          </div>
        )}
      </DetailDrawer>
    </div>
  );
}

function Info({ icon: Icon, label, value }: { icon: any; label: string; value: string }) {
  return (
    <div className="flex items-start gap-2">
      <Icon className="size-3.5 text-muted-foreground mt-0.5" />
      <div className="min-w-0">
        <p className="text-[10px] uppercase text-muted-foreground tracking-wide">{label}</p>
        <p className="text-sm truncate">{value}</p>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-md border border-border/70 px-2.5 py-1.5">
      <p className="text-[10px] uppercase text-muted-foreground tracking-wide">{label}</p>
      <p className="text-sm font-medium tabular-nums">{value}</p>
    </div>
  );
}
