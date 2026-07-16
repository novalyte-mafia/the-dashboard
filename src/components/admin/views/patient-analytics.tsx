"use client";

import { useEffect, useMemo, useState } from "react";
import { useNav } from "@/components/admin/admin-app";
import {
  PageHeader,
  MetricCard,
  SectionCard,
  ChartCard,
  LoadingState,
  DataTable,
  StatusBadge,
} from "@/components/admin/shared";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card } from "@/components/ui/card";
import { Users, UserCheck, Route, CalendarCheck, Filter, Activity } from "lucide-react";
import { patientService } from "@/services";
import { formatDate, relativeTime } from "@/lib/format";
import { SERVICE_CATALOG } from "@/lib/constants";
import type { PatientLead } from "@/types";

const RANGES = [
  { value: "7d", label: "Last 7 days" },
  { value: "30d", label: "Last 30 days" },
  { value: "90d", label: "Last 90 days" },
];

export function PatientAnalyticsView() {
  const { refreshKey } = useNav();
  const [range, setRange] = useState("30d");
  const [leads, setLeads] = useState<PatientLead[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    patientService.listLeads().then((d) => setLeads(d.leads)).finally(() => setLoading(false));
  }, [refreshKey]);

  // Leads by source
  const leadsBySource = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const l of leads) counts[l.leadSource] = (counts[l.leadSource] ?? 0) + 1;
    const palette = ["#0d9488", "#d97706", "#e11d48", "#059669", "#64748b", "#8b5cf6"];
    return Object.entries(counts).map(([src, count], i) => ({
      label: src.replace(/_/g, " "),
      value: count,
      color: palette[i % palette.length],
    }));
  }, [leads]);

  // Leads by treatment
  const leadsByTreatment = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const l of leads) counts[l.treatmentInterest] = (counts[l.treatmentInterest] ?? 0) + 1;
    return Object.entries(counts).map(([slug, count]) => {
      const svc = SERVICE_CATALOG.find((s) => s.slug === slug);
      return { label: svc?.name ?? slug, value: count, color: "var(--primary)" };
    });
  }, [leads]);

  // Lead funnel over time (mock)
  const funnelTrend = useMemo(() => {
    const weeks = ["W1", "W2", "W3", "W4", "W5", "W6"];
    return weeks.map((w, i) => ({
      label: w,
      value: [18, 22, 28, 31, 38, 42][i],
      color: "var(--primary)",
    }));
  }, []);

  const total = leads.length;
  const qualified = leads.filter((l) => ["qualified", "contacted", "routed", "booked"].includes(l.status)).length;
  const routed = leads.filter((l) => l.status === "routed" || l.status === "booked").length;
  const booked = leads.filter((l) => l.status === "booked").length;
  const qualRate = total ? Math.round((qualified / total) * 100) : 0;
  const routeRate = qualified ? Math.round((routed / qualified) * 100) : 0;
  const bookRate = routed ? Math.round((booked / routed) * 100) : 0;

  if (loading) {
    return (
      <div>
        <PageHeader
          title="Patient Analytics"
          description="Lead funnel, sources, qualification, routing & booking performance"
          action={<RangeSelect value={range} onChange={setRange} />}
        />
        <LoadingState label="Loading patient analytics…" />
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="Patient Analytics"
        description="Lead funnel, sources, qualification, routing & booking performance"
        action={<RangeSelect value={range} onChange={setRange} />}
      />

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 mb-5">
        <MetricCard label="Total Leads" value={total} icon={Users} tone="teal" trend={22} />
        <MetricCard label="Qualification Rate" value={`${qualRate}%`} icon={Filter} tone="amber" hint={`${qualified} qualified`} />
        <MetricCard label="Routing Success" value={`${routeRate}%`} icon={Route} tone="violet" hint={`${routed} routed`} />
        <MetricCard label="Booking Rate" value={`${bookRate}%`} icon={CalendarCheck} tone="green" hint={`${booked} booked`} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
        <ChartCard title="Leads by Source" data={leadsBySource} type="bar" />
        <ChartCard title="Leads by Treatment" data={leadsByTreatment} type="bar" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
        <ChartCard title="Lead Volume (6 weeks)" data={funnelTrend} type="line" />
        <SectionCard title="Lead Funnel" description="Stage-by-stage conversion">
          <div className="space-y-3">
            <FunnelStage label="New Leads" value={total} color="teal" />
            <FunnelStage label="Qualified" value={qualified} color="amber" />
            <FunnelStage label="Routed to Clinic" value={routed} color="violet" />
            <FunnelStage label="Booked Appointment" value={booked} color="green" />
          </div>
          <div className="mt-4 pt-3 border-t grid grid-cols-2 gap-3 text-xs">
            <div>
              <p className="text-muted-foreground">Qualification Rate</p>
              <p className="text-base font-semibold text-amber-700 tabular-nums">{qualRate}%</p>
            </div>
            <div>
              <p className="text-muted-foreground">Routing Success</p>
              <p className="text-base font-semibold text-violet-700 tabular-nums">{routeRate}%</p>
            </div>
            <div>
              <p className="text-muted-foreground">Booking Rate</p>
              <p className="text-base font-semibold text-emerald-700 tabular-nums">{bookRate}%</p>
            </div>
            <div>
              <p className="text-muted-foreground">End-to-End Conv.</p>
              <p className="text-base font-semibold text-teal-700 tabular-nums">
                {total ? Math.round((booked / total) * 100) : 0}%
              </p>
            </div>
          </div>
        </SectionCard>
      </div>

      <Card className="p-0">
        <div className="px-4 py-3 border-b">
          <h3 className="text-sm font-semibold">Recent Patient Leads</h3>
        </div>
        <DataTable
          data={leads}
          columns={[
            {
              key: "name",
              header: "Lead",
              render: (l) => (
                <div>
                  <p className="font-medium">{l.name}</p>
                  <p className="text-xs text-muted-foreground">{[l.city, l.state].filter(Boolean).join(", ") || "—"}</p>
                </div>
              ),
              sortValue: (l) => l.name,
            },
            {
              key: "treatment",
              header: "Treatment",
              render: (l) => {
                const svc = SERVICE_CATALOG.find((s) => s.slug === l.treatmentInterest);
                return <span className="text-sm">{svc?.name ?? l.treatmentInterest}</span>;
              },
              hideOnMobile: true,
            },
            {
              key: "source",
              header: "Source",
              render: (l) => <span className="text-muted-foreground capitalize">{l.leadSource.replace(/_/g, " ")}</span>,
              hideOnMobile: true,
            },
            {
              key: "status",
              header: "Status",
              render: (l) => {
                const tone =
                  l.status === "booked" ? "green" :
                  l.status === "routed" ? "teal" :
                  l.status === "qualified" || l.status === "contacted" ? "amber" :
                  l.status === "lost" || l.status === "disqualified" ? "rose" : "slate";
                return <StatusBadge label={l.status} color={tone} />;
              },
            },
            {
              key: "createdAt",
              header: "Created",
              render: (l) => <span className="text-xs text-muted-foreground">{relativeTime(l.createdAt)}</span>,
              sortValue: (l) => l.createdAt,
            },
          ]}
          pageSize={10}
        />
      </Card>
    </div>
  );
}

function RangeSelect({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="w-40 h-9">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {RANGES.map((r) => (
          <SelectItem key={r.value} value={r.value}>
            {r.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function FunnelStage({ label, value, color }: { label: string; value: number; color: "teal" | "amber" | "violet" | "green" }) {
  const colorClass =
    color === "teal" ? "bg-teal-500" :
    color === "amber" ? "bg-amber-500" :
    color === "violet" ? "bg-violet-500" :
    "bg-emerald-500";
  const textClass =
    color === "teal" ? "text-teal-700" :
    color === "amber" ? "text-amber-700" :
    color === "violet" ? "text-violet-700" :
    "text-emerald-700";
  return (
    <div>
      <div className="flex items-center justify-between text-sm mb-1">
        <span className="text-muted-foreground">{label}</span>
        <span className={`font-semibold tabular-nums ${textClass}`}>{value}</span>
      </div>
      <div className="h-2 bg-muted rounded-full overflow-hidden">
        <div className={`h-full ${colorClass} rounded-full transition-all`} style={{ width: `${Math.min(100, value * 4)}%` }} />
      </div>
    </div>
  );
}
