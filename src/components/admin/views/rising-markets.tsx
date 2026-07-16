"use client";

import { useEffect, useMemo, useState } from "react";
import { useNav } from "@/components/admin/admin-app";
import {
  PageHeader, MetricCard, LoadingState, EmptyState, SectionCard,
  StatusBadge, ScoreBadge, ChartCard,
} from "@/components/admin/shared";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Flame, TrendingUp, ArrowUpRight, MapPin, Target } from "lucide-react";
import { demandService } from "@/services";
import type { MarketData } from "@/types";
import { formatCurrency } from "@/lib/format";
import { SERVICE_CATALOG } from "@/lib/constants";

const treatmentName = (slug: string) =>
  SERVICE_CATALOG.find((s) => s.slug === slug)?.name ?? slug;

const TYPE_COLOR: Record<string, string> = {
  state: "violet",
  city: "teal",
  zip: "amber",
};

export function RisingMarketsView() {
  const { refreshKey, navigate } = useNav();
  const [markets, setMarkets] = useState<MarketData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    demandService
      .listMarkets()
      .then((d) => setMarkets(d.markets.filter((m) => m.rising)))
      .finally(() => setLoading(false));
  }, [refreshKey]);

  const sorted = useMemo(() => [...markets].sort((a, b) => b.searchTrend - a.searchTrend), [markets]);

  const totals = useMemo(() => {
    const totalVolume = sorted.reduce((s, m) => s + m.searchVolume, 0);
    const avgTrend = sorted.length ? Math.round(sorted.reduce((s, m) => s + m.searchTrend, 0) / sorted.length) : 0;
    const topTrend = sorted[0]?.searchTrend ?? 0;
    const topOpp = sorted.reduce((max, m) => Math.max(max, m.opportunityScore), 0);
    return { totalVolume, avgTrend, topTrend, topOpp };
  }, [sorted]);

  const chartData = sorted.slice(0, 8).map((m) => ({
    label: m.geography,
    value: m.searchTrend,
    color: "#f59e0b",
  }));

  return (
    <div>
      <PageHeader
        title="Rising Markets"
        description="Markets with search-volume trend > 20% — fastest-growing demand signals"
        action={
          <Button variant="outline" onClick={() => navigate("coverage-gaps")}>
            <Target className="size-4" /> View Coverage Gaps
          </Button>
        }
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
        <MetricCard label="Rising Markets" value={sorted.length} icon={Flame} tone="rose" hint="Trend > 20%" />
        <MetricCard label="Avg Trend" value={`+${totals.avgTrend}%`} icon={TrendingUp} tone="amber" hint="Across rising markets" />
        <MetricCard label="Top Trend" value={`+${totals.topTrend}%`} icon={ArrowUpRight} tone="teal" hint={sorted[0]?.geography ?? "—"} />
        <MetricCard
          label="Combined Volume"
          value={`${(totals.totalVolume / 1000).toFixed(0)}k`}
          icon={TrendingUp}
          tone="violet"
          hint="Monthly searches"
        />
      </div>

      {loading ? (
        <SectionCard>
          <LoadingState label="Loading rising markets…" />
        </SectionCard>
      ) : sorted.length === 0 ? (
        <SectionCard>
          <EmptyState
            icon={Flame}
            title="No rising markets"
            description="No markets currently exceed the 20% trend threshold."
          />
        </SectionCard>
      ) : (
        <>
          <div className="mb-5">
            <ChartCard title="Trend % by Market" data={chartData} type="bar" />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {sorted.map((m, i) => (
              <Card key={m.id} className="p-4 gap-0 hover:shadow-sm transition-shadow">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="size-5 rounded-full bg-amber-100 text-amber-700 text-[10px] font-semibold inline-flex items-center justify-center">
                        {i + 1}
                      </span>
                      <h3 className="text-sm font-semibold truncate inline-flex items-center gap-1.5">
                        <MapPin className="size-3.5 text-muted-foreground" />
                        {m.geography}
                      </h3>
                      <StatusBadge label={m.type} color={TYPE_COLOR[m.type] ?? "slate"} />
                    </div>
                    <p className="text-xs text-muted-foreground mt-1 truncate">
                      {m.topTreatments.map(treatmentName).join(" · ")}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="text-2xl font-semibold text-amber-600 tabular-nums inline-flex items-center gap-1">
                      <ArrowUpRight className="size-5" />
                      {m.searchTrend}%
                    </div>
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Trend</p>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2 mt-3 text-xs">
                  <Stat label="Search Volume" value={m.searchVolume.toLocaleString()} />
                  <Stat label="Supply / Demand" value={`${m.clinicSupply} / ${m.patientDemand}`} />
                  <Stat label="Gap" value={`${m.supplyDemandGap > 0 ? "+" : ""}${m.supplyDemandGap}`} highlight={m.supplyDemandGap > 50} />
                  <Stat label="Avg CPC" value={formatCurrency(m.avgCpc)} />
                  <Stat label="Competition" value={`${m.competitionScore}/100`} />
                  <Stat label="Opp Score" value={m.opportunityScore} highlight={m.opportunityScore >= 80} />
                </div>

                <div className="flex items-center justify-between mt-3 pt-3 border-t border-border/60">
                  <ScoreBadge score={m.opportunityScore} />
                  <Button size="sm" variant="ghost" onClick={() => navigate("coverage-gaps", null, { marketId: m.id })}>
                    Find Clinics <ArrowUpRight className="size-3.5" />
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function Stat({ label, value, highlight }: { label: string; value: string | number; highlight?: boolean }) {
  return (
    <div className="rounded-md border border-border/70 px-2 py-1.5">
      <p className="text-[10px] uppercase text-muted-foreground tracking-wide">{label}</p>
      <p className={"text-sm font-medium tabular-nums " + (highlight ? "text-rose-600" : "")}>{value}</p>
    </div>
  );
}
