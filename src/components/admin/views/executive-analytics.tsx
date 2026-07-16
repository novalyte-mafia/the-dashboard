"use client";

import { useEffect, useMemo, useState } from "react";
import { useNav } from "@/components/admin/admin-app";
import {
  PageHeader,
  MetricCard,
  SectionCard,
  ChartCard,
  LoadingState,
  StatusBadge,
} from "@/components/admin/shared";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  TrendingUp,
  DollarSign,
  Users,
  Building2,
  PhoneCall,
  Target,
  Flame,
  Activity,
} from "lucide-react";
import { dashboardService, dealService } from "@/services";
import { formatCurrency, formatCurrencyFull } from "@/lib/format";

const RANGES = [
  { value: "7d", label: "Last 7 days" },
  { value: "30d", label: "Last 30 days" },
  { value: "90d", label: "Last 90 days" },
];

export function ExecutiveAnalyticsView() {
  const { refreshKey, navigate } = useNav();
  const [range, setRange] = useState("30d");
  const [overview, setOverview] = useState<Awaited<ReturnType<typeof dashboardService.getOverview>> | null>(null);
  const [dealsData, setDealsData] = useState<Awaited<ReturnType<typeof dealService.list>> | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    Promise.all([dashboardService.getOverview(), dealService.list()])
      .then(([o, d]) => {
        setOverview(o);
        setDealsData(d);
      })
      .finally(() => setLoading(false));
  }, [refreshKey]);

  // Build revenue trend (monthly, last 6 months — mock derived from deals)
  const revenueTrend = useMemo(() => {
    const base = [142, 168, 154, 198, 215, 246]; // $k per month
    return base.map((v, i) => ({
      label: ["Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][i],
      value: v,
      color: "var(--primary)",
    }));
  }, []);

  // Pipeline movement (mock derived from pipelineSnapshot)
  const pipelineMovement = useMemo(() => {
    if (!overview) return [];
    return overview.pipelineSnapshot.map((s) => ({
      label: s.label,
      value: s.count,
      color: "var(--primary)",
    }));
  }, [overview]);

  // Clinic acquisition rate (mock)
  const acquisitionRate = useMemo(() => {
    return [
      { label: "Imported", value: 16, color: "var(--primary)" },
      { label: "Researched", value: 12, color: "var(--primary)" },
      { label: "Contacted", value: 9, color: "var(--primary)" },
      { label: "Engaged", value: 6, color: "var(--primary)" },
      { label: "Directory", value: 4, color: "var(--primary)" },
      { label: "Paid", value: 2, color: "var(--primary)" },
    ];
  }, []);

  // Patient growth (mock monthly)
  const patientGrowth = useMemo(() => {
    return [
      { label: "Jul", value: 18, color: "var(--primary)" },
      { label: "Aug", value: 24, color: "var(--primary)" },
      { label: "Sep", value: 32, color: "var(--primary)" },
      { label: "Oct", value: 41, color: "var(--primary)" },
      { label: "Nov", value: 53, color: "var(--primary)" },
      { label: "Dec", value: 68, color: "var(--primary)" },
    ];
  }, []);

  if (loading || !overview || !dealsData) {
    return (
      <div>
        <PageHeader
          title="Executive Analytics"
          description="High-level performance across revenue, pipeline, acquisition & growth"
          action={<RangeSelect value={range} onChange={setRange} />}
        />
        <LoadingState label="Loading executive analytics…" />
      </div>
    );
  }

  const m = overview.metrics;
  const c = overview.conversionMetrics;
  const wonRevenue = dealsData.metrics.wonRevenue;
  const mrr = dealsData.metrics.mrr;
  const openPipeline = dealsData.metrics.openPipeline;
  const weighted = dealsData.metrics.weightedPipeline;

  return (
    <div>
      <PageHeader
        title="Executive Analytics"
        description="High-level performance across revenue, pipeline, acquisition & growth"
        action={<RangeSelect value={range} onChange={setRange} />}
      />

      {/* KPI row */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 mb-5">
        <MetricCard label="Revenue (Won)" value={formatCurrency(wonRevenue)} icon={DollarSign} tone="green" trend={18} onClick={() => navigate("revenue-analytics")} />
        <MetricCard label="MRR" value={formatCurrency(mrr)} icon={TrendingUp} tone="teal" trend={12} hint="Active deals" />
        <MetricCard label="Open Pipeline" value={formatCurrency(openPipeline)} icon={Target} tone="teal" hint={`${dealsData.metrics.count} deals`} onClick={() => navigate("revenue-analytics")} />
        <MetricCard label="Weighted Pipeline" value={formatCurrency(weighted)} icon={Activity} tone="violet" hint="By probability" />
        <MetricCard label="Active Clinics" value={m.clinicCount} icon={Building2} tone="default" hint="In pipeline" onClick={() => navigate("clinics")} />
        <MetricCard label="Interested" value={m.interestedClinics} icon={Flame} tone="amber" hint="Showing buying intent" />
        <MetricCard label="Patient Leads" value={m.patientLeads} icon={Users} tone="teal" trend={22} hint={`${m.qualifiedPatientLeads} qualified`} onClick={() => navigate("patient-analytics")} />
        <MetricCard label="Calls Today" value={m.callsCompletedToday} icon={PhoneCall} tone="green" hint="Answered" onClick={() => navigate("call-analytics")} />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
        <ChartCard title="Revenue Trend (6 months)" data={revenueTrend} type="line" />
        <ChartCard title="Pipeline Movement (by stage)" data={pipelineMovement} type="bar" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
        <ChartCard title="Clinic Acquisition Funnel" data={acquisitionRate} type="bar" />
        <ChartCard title="Patient Lead Growth (6 months)" data={patientGrowth} type="line" />
      </div>

      {/* Conversion + priorities */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <SectionCard title="Conversion Rates" description="End-to-end funnel performance">
          <div className="grid grid-cols-2 gap-3">
            <ConversionStat label="Dial → Connect" value={c.dialToConnect} />
            <ConversionStat label="Connect → Conversation" value={c.connectToConversation} />
            <ConversionStat label="Conversation → Interest" value={c.conversationToInterest} />
            <ConversionStat label="Interest → Meeting" value={c.interestToMeeting} />
            <ConversionStat label="Meeting → Proposal" value={c.meetingToProposal} />
            <ConversionStat label="Proposal → Close" value={c.proposalToClose} />
            <ConversionStat label="Lead → Booking" value={c.leadToBooking} />
            <ConversionStat label="Follow-Up Completion" value={c.followUpCompletion} />
          </div>
          <div className="mt-4 pt-3 border-t flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Avg Deal Value</span>
            <span className="font-semibold tabular-nums">{formatCurrencyFull(c.avgDealValue)}</span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Avg Sales Cycle</span>
            <span className="font-semibold tabular-nums">{c.avgSalesCycle} days</span>
          </div>
        </SectionCard>

        <SectionCard title="Top Priorities" description="Generated from live data">
          <div className="space-y-1.5">
            {overview.priorities.map((p, i) => (
              <button
                key={i}
                onClick={() => navigate(p.href)}
                className="w-full flex items-center gap-3 px-2 py-2 rounded-md hover:bg-accent/50 transition-colors text-left"
              >
                <StatusBadge
                  label={String(p.count)}
                  color={p.tone === "rose" ? "rose" : p.tone === "amber" ? "amber" : p.tone === "teal" ? "teal" : p.tone === "violet" ? "violet" : "green"}
                />
                <span className="text-sm flex-1 truncate">{p.label}</span>
                <span className="text-xs text-muted-foreground">→</span>
              </button>
            ))}
          </div>
        </SectionCard>
      </div>
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

function ConversionStat({ label, value }: { label: string; value: number }) {
  const tone = value >= 50 ? "green" : value >= 30 ? "amber" : "rose";
  const colorClass =
    tone === "green" ? "text-emerald-700" : tone === "amber" ? "text-amber-700" : "text-rose-700";
  return (
    <div className="rounded-md border border-border/70 p-2.5">
      <p className="text-xs text-muted-foreground truncate">{label}</p>
      <p className={`text-lg font-semibold tabular-nums ${colorClass}`}>{value}%</p>
    </div>
  );
}
