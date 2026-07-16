"use client";

import { useEffect, useMemo, useState } from "react";
import { useNav } from "@/components/admin/admin-app";
import {
  PageHeader, MetricCard, LoadingState, EmptyState, SectionCard,
  ScoreBadge, StatusBadge, ChartCard, type Column, DataTable,
} from "@/components/admin/shared";
import { Button } from "@/components/ui/button";
import {
  DollarSign, Flame, Target, MapPin, BarChart3, ArrowUpRight,
} from "lucide-react";
import { demandService } from "@/services";
import type { MarketData } from "@/types";
import { formatCurrency } from "@/lib/format";
import { SERVICE_CATALOG } from "@/lib/constants";

const TYPE_COLOR: Record<string, string> = {
  state: "violet",
  city: "teal",
  zip: "amber",
};

const treatmentName = (slug: string) =>
  SERVICE_CATALOG.find((s) => s.slug === slug)?.name ?? slug;

export function DemandOverviewView() {
  const { refreshKey, navigate } = useNav();
  const [markets, setMarkets] = useState<MarketData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    demandService
      .listMarkets()
      .then((d) => setMarkets(d.markets))
      .finally(() => setLoading(false));
  }, [refreshKey]);

  const totals = useMemo(() => {
    const totalVolume = markets.reduce((s, m) => s + m.searchVolume, 0);
    const avgCpc = markets.length
      ? Math.round((markets.reduce((s, m) => s + m.avgCpc, 0) / markets.length) * 100) / 100
      : 0;
    const risingCount = markets.filter((m) => m.rising).length;
    const topOpp = markets.reduce((max, m) => (m.opportunityScore > max ? m.opportunityScore : max), 0);
    return { totalVolume, avgCpc, risingCount, topOpp };
  }, [markets]);

  const topMarkets = useMemo(
    () => [...markets].sort((a, b) => b.opportunityScore - a.opportunityScore).slice(0, 10),
    [markets],
  );

  const topVolumeChart = useMemo(
    () =>
      [...markets]
        .sort((a, b) => b.searchVolume - a.searchVolume)
        .slice(0, 6)
        .map((m) => ({ label: m.geography, value: m.searchVolume })),
    [markets],
  );

  const columns: Column<MarketData>[] = [
    {
      key: "geography",
      header: "Market",
      render: (m) => (
        <div className="min-w-0">
          <div className="font-medium truncate inline-flex items-center gap-1.5">
            <MapPin className="size-3.5 text-muted-foreground" />
            {m.geography}
          </div>
          <div className="text-xs text-muted-foreground mt-0.5">
            {m.topTreatments.map(treatmentName).join(" · ")}
          </div>
        </div>
      ),
      sortValue: (m) => m.geography,
    },
    {
      key: "type",
      header: "Type",
      render: (m) => <StatusBadge label={m.type} color={TYPE_COLOR[m.type] ?? "slate"} />,
      sortValue: (m) => m.type,
      hideOnMobile: true,
    },
    {
      key: "searchVolume",
      header: "Search Volume",
      render: (m) => (
        <span className="tabular-nums text-sm">{m.searchVolume.toLocaleString()}/mo</span>
      ),
      sortValue: (m) => m.searchVolume,
    },
    {
      key: "avgCpc",
      header: "Avg CPC",
      render: (m) => <span className="tabular-nums text-sm">{formatCurrency(m.avgCpc)}</span>,
      sortValue: (m) => m.avgCpc,
      hideOnMobile: true,
    },
    {
      key: "searchTrend",
      header: "Trend",
      render: (m) => (
        <span className={"tabular-nums text-sm inline-flex items-center gap-1 " + (m.searchTrend >= 20 ? "text-emerald-600" : m.searchTrend >= 0 ? "text-amber-600" : "text-rose-600")}>
          <ArrowUpRight className="size-3" />
          {m.searchTrend}%
          {m.rising && <Flame className="size-3 text-amber-500" />}
        </span>
      ),
      sortValue: (m) => m.searchTrend,
    },
    {
      key: "gap",
      header: "Supply/Demand Gap",
      render: (m) => (
        <span className={"tabular-nums text-sm " + (m.supplyDemandGap > 50 ? "text-rose-600 font-medium" : m.supplyDemandGap > 20 ? "text-amber-600" : "text-emerald-600")}>
          {m.supplyDemandGap > 0 ? "+" : ""}{m.supplyDemandGap}
        </span>
      ),
      sortValue: (m) => m.supplyDemandGap,
      hideOnMobile: true,
    },
    {
      key: "opportunity",
      header: "Opp Score",
      render: (m) => <ScoreBadge score={m.opportunityScore} />,
      sortValue: (m) => m.opportunityScore,
    },
    {
      key: "actions",
      header: "",
      render: (m) => (
        <Button size="sm" variant="ghost" onClick={() => navigate("coverage-gaps", null, { marketId: m.id })}>
          Details
        </Button>
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        title="Demand Intelligence"
        description="Search-volume, CPC, and supply/demand signals across men's-health markets"
        action={
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={() => navigate("rising-markets")}>
              <Flame className="size-4" /> Rising Markets
            </Button>
            <Button variant="outline" onClick={() => navigate("coverage-gaps")}>
              <Target className="size-4" /> Coverage Gaps
            </Button>
          </div>
        }
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
        <MetricCard
          label="Total Search Volume"
          value={`${(totals.totalVolume / 1000).toFixed(0)}k`}
          icon={BarChart3}
          tone="teal"
          hint="Across all tracked markets"
        />
        <MetricCard label="Avg CPC" value={formatCurrency(totals.avgCpc)} icon={DollarSign} tone="amber" hint="Blended across markets" />
        <MetricCard label="Rising Markets" value={totals.risingCount} icon={Flame} tone="rose" hint="Trend > 20% YoY" />
        <MetricCard label="Top Opportunity" value={totals.topOpp} icon={Target} tone="green" hint="Highest opp score" />
      </div>

      {loading ? (
        <SectionCard>
          <LoadingState label="Loading market data…" />
        </SectionCard>
      ) : markets.length === 0 ? (
        <SectionCard>
          <EmptyState title="No market data" description="Demand intelligence data will populate here." />
        </SectionCard>
      ) : (
        <>
          <div className="mb-5">
            <ChartCard title="Top Markets by Search Volume" data={topVolumeChart} type="bar" />
          </div>

          <SectionCard
            title="Top Opportunity Markets"
            description="Sorted by opportunity score (supply/demand gap + trend)"
            bodyClassName="p-0"
          >
            <DataTable
              columns={columns}
              data={topMarkets}
              pageSize={10}
              emptyTitle="No markets"
            />
          </SectionCard>
        </>
      )}
    </div>
  );
}
