"use client";

import { useEffect, useMemo, useState } from "react";
import { useNav } from "@/components/admin/admin-app";
import {
  PageHeader, MetricCard, SectionCard, LoadingState, EmptyState, DataTable,
  ChartCard, StatusBadge, type Column,
} from "@/components/admin/shared";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  TrendingUp, DollarSign, Scale, Target, Calendar, ArrowRight, Trophy, Receipt, Percent,
} from "lucide-react";
import { dealService } from "@/services";
import type { Deal } from "@/types";
import { formatCurrency, formatCurrencyFull, formatDate } from "@/lib/format";
import { DEAL_STAGE_MAP, DEAL_STAGES } from "@/lib/constants";
import { toast } from "sonner";

type DealMetrics = {
  openPipeline: number;
  weightedPipeline: number;
  wonRevenue: number;
  mrr: number;
  avgDealValue: number;
  count: number;
};

export function RevenueOverviewView() {
  const { navigate, refreshKey } = useNav();
  const [deals, setDeals] = useState<Deal[]>([]);
  const [metrics, setMetrics] = useState<DealMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<string>("open");

  useEffect(() => {
    setLoading(true);
    dealService
      .list(view)
      .then((d) => {
        setDeals(d.deals);
        setMetrics(d.metrics);
      })
      .catch(() => toast.error("Failed to load revenue data"))
      .finally(() => setLoading(false));
  }, [view, refreshKey]);

  const topDeals = useMemo(
    () => [...deals].sort((a, b) => b.estimatedTotalValue - a.estimatedTotalValue).slice(0, 8),
    [deals]
  );

  // Expected to close this month
  const now = useMemo(() => new Date(), [deals]);
  const closingThisMonth = useMemo(
    () =>
      deals.filter((d) => {
        if (!d.expectedCloseDate) return false;
        const close = new Date(d.expectedCloseDate);
        return close.getMonth() === now.getMonth() && close.getFullYear() === now.getFullYear();
      }).sort((a, b) => (a.expectedCloseDate ?? "").localeCompare(b.expectedCloseDate ?? "")),
    [deals, now]
  );

  // Monthly revenue trend (mock aggregation from won deals)
  const monthlyTrend = useMemo(() => {
    const months: { label: string; value: number }[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const label = d.toLocaleString("en-US", { month: "short" });
      const monthWon = deals
        .filter((x) => x.stage === "active" || x.stage === "won")
        .reduce((s, x) => s + x.estimatedMonthlyValue, 0);
      const factor = 1 + (5 - i) * 0.12;
      months.push({ label, value: Math.round(monthWon * factor) });
    }
    return months;
  }, [deals, now]);

  if (loading && !metrics) return <LoadingState label="Loading revenue overview…" />;

  return (
    <div>
      <PageHeader
        title="Revenue Overview"
        description="Pipeline, weighted forecast, and won revenue across all deals"
        action={
          <Button variant="outline" onClick={() => navigate("deals")}>
            Open Deals <ArrowRight className="size-4" />
          </Button>
        }
      />

      {metrics && (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 mb-6">
          <MetricCard label="Open Pipeline" value={formatCurrency(metrics.openPipeline)} icon={TrendingUp} tone="teal" onClick={() => navigate("pipeline")} />
          <MetricCard label="Weighted" value={formatCurrency(metrics.weightedPipeline)} icon={Scale} tone="violet" hint="Probability-adjusted" />
          <MetricCard label="Won Revenue" value={formatCurrency(metrics.wonRevenue)} icon={DollarSign} tone="green" onClick={() => navigate("revenue")} />
          <MetricCard label="MRR" value={formatCurrencyFull(metrics.mrr)} icon={Target} tone="teal" hint="Monthly recurring" onClick={() => navigate("revenue")} />
          <MetricCard label="Avg Deal" value={formatCurrency(metrics.avgDealValue)} icon={Percent} tone="amber" />
          <MetricCard label="Total Deals" value={metrics.count} icon={Receipt} tone="default" onClick={() => navigate("deals")} />
        </div>
      )}

      <Tabs value={view} onValueChange={setView} className="mb-4">
        <TabsList>
          <TabsTrigger value="open">Open</TabsTrigger>
          <TabsTrigger value="proposals">Proposals</TabsTrigger>
          <TabsTrigger value="won">Won</TabsTrigger>
          <TabsTrigger value="lost">Lost</TabsTrigger>
        </TabsList>
      </Tabs>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
        <ChartCard
          title="Monthly Revenue Trend"
          type="line"
          className="lg:col-span-2"
          data={monthlyTrend}
        />
        <SectionCard
          title="Stage Distribution"
          description="Open deals by stage"
          bodyClassName="p-4"
        >
          <ChartCard
            title=""
            type="bar"
            data={DEAL_STAGES
              .filter((s) => !["won", "lost", "paused"].includes(s.id))
              .map((s) => ({
                label: s.label,
                value: deals.filter((d) => d.stage === s.id).length,
              }))
              .filter((d) => d.value > 0)}
          />
        </SectionCard>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <SectionCard
          title="Top Deals by Value"
          description="Highest-impact open opportunities"
          bodyClassName="p-0"
          action={<Button variant="ghost" size="sm" onClick={() => navigate("deals")}>All deals <ArrowRight className="size-3.5" /></Button>}
        >
          {topDeals.length === 0 ? (
            <EmptyState icon={Trophy} title="No deals yet" />
          ) : (
            <div className="divide-y divide-border/60">
              {topDeals.map((d) => (
                <button
                  key={d.id}
                  onClick={() => d.clinicId && navigate("clinic-detail", d.clinicId)}
                  className="w-full flex items-center gap-3 px-4 py-3 hover:bg-accent/50 transition-colors text-left"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{d.name}</p>
                    <p className="text-xs text-muted-foreground truncate">
                      {d.clinicName ?? "—"} · {DEAL_STAGE_MAP[d.stage]?.label}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-sm font-semibold tabular-nums">{formatCurrency(d.estimatedTotalValue)}</p>
                    <p className="text-xs text-muted-foreground">{d.probability}% prob</p>
                  </div>
                </button>
              ))}
            </div>
          )}
        </SectionCard>

        <SectionCard
          title="Closing This Month"
          description={`${closingThisMonth.length} deal${closingThisMonth.length === 1 ? "" : "s"} with expected close in ${now.toLocaleString("en-US", { month: "long" })}`}
          bodyClassName="p-0"
        >
          {closingThisMonth.length === 0 ? (
            <EmptyState icon={Calendar} title="Nothing closing this month" />
          ) : (
            <div className="divide-y divide-border/60">
              {closingThisMonth.map((d) => (
                <button
                  key={d.id}
                  onClick={() => d.clinicId && navigate("clinic-detail", d.clinicId)}
                  className="w-full flex items-center gap-3 px-4 py-3 hover:bg-accent/50 transition-colors text-left"
                >
                  <Calendar className="size-4 text-amber-500 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{d.name}</p>
                    <p className="text-xs text-muted-foreground truncate">{d.clinicName ?? "—"}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-sm font-semibold tabular-nums">{formatCurrency(d.estimatedTotalValue)}</p>
                    <p className="text-xs text-muted-foreground">{formatDate(d.expectedCloseDate)}</p>
                  </div>
                </button>
              ))}
            </div>
          )}
        </SectionCard>
      </div>
    </div>
  );
}
