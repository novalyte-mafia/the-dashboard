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
import { DollarSign, TrendingUp, Target, Receipt, BarChart3 } from "lucide-react";
import { dealService } from "@/services";
import { formatCurrency, formatCurrencyFull } from "@/lib/format";
import { DEAL_STAGES, DEAL_STAGE_MAP } from "@/lib/constants";
import type { Deal } from "@/types";

const RANGES = [
  { value: "7d", label: "Last 7 days" },
  { value: "30d", label: "Last 30 days" },
  { value: "90d", label: "Last 90 days" },
];

export function RevenueAnalyticsView() {
  const { refreshKey } = useNav();
  const [range, setRange] = useState("30d");
  const [deals, setDeals] = useState<Deal[]>([]);
  const [metrics, setMetrics] = useState<{
    openPipeline: number;
    weightedPipeline: number;
    wonRevenue: number;
    mrr: number;
    avgDealValue: number;
    count: number;
  } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    dealService.list().then((d) => {
      setDeals(d.deals);
      setMetrics(d.metrics);
    }).finally(() => setLoading(false));
  }, [refreshKey]);

  // Revenue by month (mock — derived from won deal values)
  const revenueByMonth = useMemo(() => {
    const months = ["Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const values = [142, 168, 154, 198, 215, 246];
    return months.map((m, i) => ({ label: m, value: values[i], color: "var(--primary)" }));
  }, []);

  // MRR trend (mock — monthly recurring)
  const mrrTrend = useMemo(() => {
    const months = ["Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const values = [14, 18, 22, 26, 30, 34];
    return months.map((m, i) => ({ label: m, value: values[i], color: "var(--primary)" }));
  }, []);

  // Revenue by clinic (table)
  const revenueByClinic = useMemo(() => {
    const map = new Map<string, { clinic: string; total: number; monthly: number; deals: number; stage: string }>();
    for (const d of deals) {
      const key = d.clinicId ?? d.clinicName ?? "unknown";
      const existing = map.get(key) ?? { clinic: d.clinicName ?? "—", total: 0, monthly: 0, deals: 0, stage: d.stage };
      existing.total += d.estimatedTotalValue;
      existing.monthly += d.estimatedMonthlyValue;
      existing.deals += 1;
      map.set(key, existing);
    }
    return Array.from(map.values()).sort((a, b) => b.total - a.total);
  }, [deals]);

  // Deal stage distribution
  const stageDistribution = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const d of deals) counts[d.stage] = (counts[d.stage] ?? 0) + 1;
    return DEAL_STAGES.filter((s) => counts[s.id]).map((s) => ({
      label: s.label,
      value: counts[s.id] ?? 0,
      color: "var(--primary)",
    }));
  }, [deals]);

  if (loading || !metrics) {
    return (
      <div>
        <PageHeader
          title="Revenue Analytics"
          description="Revenue, MRR, deal stage distribution & per-clinic contribution"
          action={<RangeSelect value={range} onChange={setRange} />}
        />
        <LoadingState label="Loading revenue analytics…" />
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="Revenue Analytics"
        description="Revenue, MRR, deal stage distribution & per-clinic contribution"
        action={<RangeSelect value={range} onChange={setRange} />}
      />

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 mb-5">
        <MetricCard label="Won Revenue" value={formatCurrency(metrics.wonRevenue)} icon={DollarSign} tone="green" trend={18} />
        <MetricCard label="MRR" value={formatCurrency(metrics.mrr)} icon={TrendingUp} tone="teal" trend={14} hint="Active deals" />
        <MetricCard label="Open Pipeline" value={formatCurrency(metrics.openPipeline)} icon={Target} tone="teal" hint={`${metrics.count} deals`} />
        <MetricCard label="Avg Deal Value" value={formatCurrency(metrics.avgDealValue)} icon={Receipt} tone="violet" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
        <ChartCard title="Revenue by Month ($k)" data={revenueByMonth} type="line" />
        <ChartCard title="MRR Trend ($k)" data={mrrTrend} type="line" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
        <ChartCard title="Deals by Stage" data={stageDistribution} type="bar" />
        <SectionCard title="Revenue Summary" description="Pipeline breakdown">
          <div className="space-y-3">
            <SummaryRow label="Won Revenue" value={formatCurrencyFull(metrics.wonRevenue)} tone="green" />
            <SummaryRow label="Open Pipeline" value={formatCurrencyFull(metrics.openPipeline)} tone="teal" />
            <SummaryRow label="Weighted Pipeline" value={formatCurrencyFull(metrics.weightedPipeline)} tone="violet" />
            <SummaryRow label="Monthly Recurring" value={formatCurrencyFull(metrics.mrr)} tone="default" />
            <div className="pt-2 border-t flex items-center justify-between text-sm">
              <span className="text-muted-foreground flex items-center gap-1.5">
                <BarChart3 className="size-3.5" /> Avg Deal
              </span>
              <span className="font-semibold tabular-nums">{formatCurrencyFull(metrics.avgDealValue)}</span>
            </div>
          </div>
        </SectionCard>
      </div>

      <Card className="p-0">
        <div className="px-4 py-3 border-b">
          <h3 className="text-sm font-semibold">Revenue by Clinic</h3>
          <p className="text-xs text-muted-foreground mt-0.5">Top opportunities by estimated total value</p>
        </div>
        <DataTable
          data={revenueByClinic.map((r, i) => ({ id: `r${i}`, ...r }))}
          columns={[
            { key: "clinic", header: "Clinic", render: (r) => <span className="font-medium">{r.clinic}</span> },
            {
              key: "stage",
              header: "Stage",
              render: (r) => {
                const stage = DEAL_STAGE_MAP[r.stage];
                return <StatusBadge label={stage?.label ?? r.stage} color={stage?.color ?? "slate"} />;
              },
            },
            { key: "deals", header: "Deals", render: (r) => <span className="tabular-nums">{r.deals}</span>, sortValue: (r) => r.deals, hideOnMobile: true },
            { key: "monthly", header: "Monthly", render: (r) => <span className="tabular-nums">{formatCurrency(r.monthly)}</span>, sortValue: (r) => r.monthly, hideOnMobile: true },
            { key: "total", header: "Total Value", render: (r) => <span className="font-semibold tabular-nums">{formatCurrencyFull(r.total)}</span>, sortValue: (r) => r.total },
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

function SummaryRow({ label, value, tone }: { label: string; value: string; tone: "green" | "teal" | "violet" | "default" }) {
  const colorClass =
    tone === "green" ? "text-emerald-700" : tone === "teal" ? "text-teal-700" : tone === "violet" ? "text-violet-700" : "text-foreground";
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className={`font-semibold tabular-nums ${colorClass}`}>{value}</span>
    </div>
  );
}
