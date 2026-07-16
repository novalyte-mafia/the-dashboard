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
import { MapPin, Building2, Users, DollarSign, TrendingUp, Flame } from "lucide-react";
import { demandService, clinicService, dealService } from "@/services";
import { formatCurrency, formatCurrencyFull } from "@/lib/format";
import type { MarketData, Clinic, Deal } from "@/types";

const RANGES = [
  { value: "7d", label: "Last 7 days" },
  { value: "30d", label: "Last 30 days" },
  { value: "90d", label: "Last 90 days" },
];

export function GeographicAnalyticsView() {
  const { refreshKey } = useNav();
  const [range, setRange] = useState("30d");
  const [markets, setMarkets] = useState<MarketData[]>([]);
  const [clinics, setClinics] = useState<Clinic[]>([]);
  const [deals, setDeals] = useState<Deal[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      demandService.listMarkets(),
      clinicService.list(),
      dealService.list(),
    ]).then(([m, c, d]) => {
      setMarkets(m.markets);
      setClinics(c.clinics);
      setDeals(d.deals);
    }).finally(() => setLoading(false));
  }, [refreshKey]);

  // Clinics by state
  const clinicsByState = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const c of clinics) if (c.state) counts[c.state] = (counts[c.state] ?? 0) + 1;
    return Object.entries(counts).map(([s, n]) => ({ state: s, count: n })).sort((a, b) => b.count - a.count);
  }, [clinics]);

  // Patient leads by state — derived from markets demand
  const leadsByState = useMemo(() => {
    const states = markets.filter((m) => m.type === "state" || m.type === "city");
    const seen = new Set<string>();
    const arr: { label: string; value: number; color: string }[] = [];
    for (const m of states) {
      if (seen.has(m.state)) continue;
      seen.add(m.state);
      const total = markets.filter((mm) => mm.state === m.state).reduce((s, mm) => s + mm.patientDemand, 0);
      arr.push({ label: m.state, value: total, color: "var(--primary)" });
    }
    return arr.sort((a, b) => b.value - a.value).slice(0, 10);
  }, [markets]);

  // Revenue by state (derived from deals' clinic state — but deals don't have state; use clinicId lookup)
  const revenueByState = useMemo(() => {
    const map = new Map<string, number>();
    for (const d of deals) {
      const clinic = clinics.find((c) => c.id === d.clinicId);
      const state = clinic?.state ?? "Unknown";
      map.set(state, (map.get(state) ?? 0) + d.estimatedTotalValue);
    }
    return Array.from(map.entries())
      .map(([state, total]) => ({ label: state, value: Math.round(total / 1000), color: "var(--primary)" }))
      .sort((a, b) => b.value - a.value);
  }, [deals, clinics]);

  // Demand heatmap-style cards (top markets by opportunity)
  const topMarkets = useMemo(() => {
    return [...markets].sort((a, b) => b.opportunityScore - a.opportunityScore).slice(0, 6);
  }, [markets]);

  const totalStates = new Set(clinics.map((c) => c.state).filter(Boolean)).size;
  const totalClinics = clinics.length;
  const totalDemand = markets.reduce((s, m) => s + m.patientDemand, 0);
  const totalRevenue = deals.filter((d) => d.stage === "active" || d.stage === "won").reduce((s, d) => s + d.estimatedTotalValue, 0);

  if (loading) {
    return (
      <div>
        <PageHeader
          title="Geographic Analytics"
          description="Clinics, patient demand & revenue by state — with market opportunity cards"
          action={<RangeSelect value={range} onChange={setRange} />}
        />
        <LoadingState label="Loading geographic analytics…" />
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="Geographic Analytics"
        description="Clinics, patient demand & revenue by state — with market opportunity cards"
        action={<RangeSelect value={range} onChange={setRange} />}
      />

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 mb-5">
        <MetricCard label="States Covered" value={totalStates} icon={MapPin} tone="teal" />
        <MetricCard label="Total Clinics" value={totalClinics} icon={Building2} tone="default" />
        <MetricCard label="Patient Demand (idx)" value={totalDemand.toLocaleString()} icon={Users} tone="amber" hint="Across all markets" />
        <MetricCard label="Revenue (Won)" value={formatCurrency(totalRevenue)} icon={DollarSign} tone="green" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
        <ChartCard title="Patient Demand by State" data={leadsByState} type="bar" />
        <ChartCard title="Revenue by State ($k)" data={revenueByState} type="bar" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
        <SectionCard title="Top Markets by Opportunity" description="Heatmap-style demand/supply cards">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {topMarkets.map((m) => {
              const tone = m.opportunityScore >= 80 ? "rose" : m.opportunityScore >= 60 ? "amber" : "teal";
              const bg =
                tone === "rose" ? "bg-rose-50 border-rose-200" :
                tone === "amber" ? "bg-amber-50 border-amber-200" :
                "bg-teal-50 border-teal-200";
              const text =
                tone === "rose" ? "text-rose-700" :
                tone === "amber" ? "text-amber-700" :
                "text-teal-700";
              return (
                <div key={m.id} className={`rounded-md border p-3 ${bg}`}>
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold truncate">{m.geography}</p>
                      <p className="text-xs text-muted-foreground capitalize">{m.type}</p>
                    </div>
                    <span className={`text-xs font-semibold tabular-nums ${text}`}>{m.opportunityScore}</span>
                  </div>
                  <div className="mt-2 grid grid-cols-2 gap-1 text-[11px]">
                    <div className="text-muted-foreground">Demand: <span className="font-medium text-foreground tabular-nums">{m.patientDemand}</span></div>
                    <div className="text-muted-foreground">Supply: <span className="font-medium text-foreground tabular-nums">{m.clinicSupply}</span></div>
                    <div className="text-muted-foreground">Gap: <span className={`font-medium tabular-nums ${text}`}>+{m.supplyDemandGap}</span></div>
                    <div className="text-muted-foreground">Trend: <span className={`font-medium tabular-nums ${m.rising ? "text-emerald-600" : "text-muted-foreground"}`}>{m.rising ? "↑" : "→"} {m.searchTrend}%</span></div>
                  </div>
                </div>
              );
            })}
          </div>
        </SectionCard>

        <Card className="p-0">
          <div className="px-4 py-3 border-b">
            <h3 className="text-sm font-semibold">Clinics by State</h3>
            <p className="text-xs text-muted-foreground mt-0.5">Distribution of pipeline clinics</p>
          </div>
          <DataTable
            data={clinicsByState.map((s, i) => ({ id: `s${i}`, ...s }))}
            columns={[
              { key: "state", header: "State", render: (r) => <span className="font-medium">{r.state}</span> },
              {
                key: "count",
                header: "Clinics",
                render: (r) => (
                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden max-w-[100px]">
                      <div className="h-full bg-primary rounded-full" style={{ width: `${(r.count / (clinicsByState[0]?.count || 1)) * 100}%` }} />
                    </div>
                    <span className="tabular-nums text-sm">{r.count}</span>
                  </div>
                ),
                sortValue: (r) => r.count,
              },
            ]}
            pageSize={10}
          />
        </Card>
      </div>

      <Card className="p-0">
        <div className="px-4 py-3 border-b">
          <h3 className="text-sm font-semibold">Market Demand Intelligence</h3>
          <p className="text-xs text-muted-foreground mt-0.5">All markets with supply/demand gap</p>
        </div>
        <DataTable
          data={markets}
          columns={[
            {
              key: "geography",
              header: "Market",
              render: (m) => (
                <div>
                  <p className="font-medium">{m.geography}</p>
                  <p className="text-xs text-muted-foreground capitalize">{m.type} · {m.state}</p>
                </div>
              ),
              sortValue: (m) => m.geography,
            },
            {
              key: "demand",
              header: "Demand",
              render: (m) => <span className="tabular-nums">{m.patientDemand}</span>,
              sortValue: (m) => m.patientDemand,
              hideOnMobile: true,
            },
            {
              key: "supply",
              header: "Supply",
              render: (m) => <span className="tabular-nums">{m.clinicSupply}</span>,
              sortValue: (m) => m.clinicSupply,
              hideOnMobile: true,
            },
            {
              key: "gap",
              header: "Gap",
              render: (m) => (
                <StatusBadge label={`+${m.supplyDemandGap}`} color={m.supplyDemandGap >= 60 ? "rose" : m.supplyDemandGap >= 30 ? "amber" : "teal"} />
              ),
              sortValue: (m) => m.supplyDemandGap,
            },
            {
              key: "trend",
              header: "Trend",
              render: (m) => (
                <span className={m.rising ? "text-emerald-600 font-medium tabular-nums" : "text-muted-foreground tabular-nums"}>
                  {m.rising ? "↑" : "→"} {m.searchTrend}%
                </span>
              ),
              sortValue: (m) => m.searchTrend,
              hideOnMobile: true,
            },
            {
              key: "opportunity",
              header: "Opp Score",
              render: (m) => (
                <StatusBadge label={String(m.opportunityScore)} color={m.opportunityScore >= 80 ? "rose" : m.opportunityScore >= 60 ? "amber" : "teal"} />
              ),
              sortValue: (m) => m.opportunityScore,
            },
          ]}
          pageSize={12}
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
