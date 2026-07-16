"use client";

import { useEffect, useMemo, useState } from "react";
import { useNav } from "@/components/admin/admin-app";
import {
  PageHeader, MetricCard, LoadingState, EmptyState, SectionCard,
  StatusBadge,
} from "@/components/admin/shared";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { MapPin, Layers, Flame, ArrowLeft, Building2 } from "lucide-react";
import { demandService } from "@/services";
import type { MarketData } from "@/types";
import { SERVICE_CATALOG, US_STATES } from "@/lib/constants";

const STATE_NAME: Record<string, string> = Object.fromEntries(
  US_STATES.map((s) => [s, s]),
);

const treatmentName = (slug: string) =>
  SERVICE_CATALOG.find((s) => s.slug === slug)?.name ?? slug;

export function GeographicDemandView() {
  const { refreshKey } = useNav();
  const [markets, setMarkets] = useState<MarketData[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedState, setSelectedState] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    demandService
      .listMarkets()
      .then((d) => setMarkets(d.markets))
      .finally(() => setLoading(false));
  }, [refreshKey]);

  // Group by state
  const byState = useMemo(() => {
    const map = new Map<string, MarketData[]>();
    for (const m of markets) {
      if (!map.has(m.state)) map.set(m.state, []);
      map.get(m.state)!.push(m);
    }
    return Array.from(map.entries())
      .map(([state, items]) => {
        const totalVol = items.reduce((s, m) => s + m.searchVolume, 0);
        const totalSupply = items.reduce((s, m) => s + m.clinicSupply, 0);
        const totalDemand = items.reduce((s, m) => s + m.patientDemand, 0);
        const avgGap = Math.round((totalDemand - totalSupply) / Math.max(items.length, 1));
        const avgTrend = Math.round(items.reduce((s, m) => s + m.searchTrend, 0) / items.length);
        const avgOpp = Math.round(items.reduce((s, m) => s + m.opportunityScore, 0) / items.length);
        const rising = items.some((m) => m.rising);
        return {
          state,
          stateName: STATE_NAME[state] ?? state,
          markets: items.sort((a, b) => b.searchVolume - a.searchVolume),
          totalVol,
          totalSupply,
          totalDemand,
          avgGap,
          avgTrend,
          avgOpp,
          rising,
          intensity: Math.min(100, Math.round(avgOpp)),
        };
      })
      .sort((a, b) => b.avgOpp - a.avgOpp);
  }, [markets]);

  const stateSummary = useMemo(() => {
    if (!selectedState) return null;
    return byState.find((s) => s.state === selectedState) ?? null;
  }, [byState, selectedState]);

  function intensityClass(intensity: number): string {
    // teal scale by intensity
    if (intensity >= 85) return "bg-teal-600 text-white border-teal-700";
    if (intensity >= 70) return "bg-teal-500 text-white border-teal-600";
    if (intensity >= 55) return "bg-teal-400 text-teal-900 border-teal-500";
    if (intensity >= 40) return "bg-teal-200 text-teal-900 border-teal-300";
    if (intensity >= 25) return "bg-teal-100 text-teal-800 border-teal-200";
    return "bg-muted text-muted-foreground border-border";
  }

  return (
    <div>
      <PageHeader
        title="Geographic Demand"
        description="Heat-map of demand intensity by state — drill into markets for city-level signals"
        action={
          selectedState ? (
            <Button variant="outline" onClick={() => setSelectedState(null)}>
              <ArrowLeft className="size-4" /> Back to Map
            </Button>
          ) : undefined
        }
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
        <MetricCard label="States Tracked" value={byState.length} icon={MapPin} tone="teal" hint="With active market data" />
        <MetricCard
          label="Total Volume"
          value={`${(markets.reduce((s, m) => s + m.searchVolume, 0) / 1000).toFixed(0)}k`}
          icon={Layers}
          tone="violet"
          hint="All markets combined"
        />
        <MetricCard
          label="Rising States"
          value={byState.filter((s) => s.rising).length}
          icon={Flame}
          tone="rose"
          hint="At least one rising market"
        />
        <MetricCard
          label="Top State Opp"
          value={byState[0]?.avgOpp ?? 0}
          icon={MapPin}
          tone="green"
          hint={byState[0] ? byState[0].stateName : "—"}
        />
      </div>

      {loading ? (
        <SectionCard>
          <LoadingState label="Loading geographic data…" />
        </SectionCard>
      ) : !selectedState ? (
        <>
          <SectionCard
            title="Demand Heat Map"
            description="Tile intensity = avg opportunity score. Click a state to drill in."
            bodyClassName="p-4"
          >
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2">
              {byState.map((s) => (
                <button
                  key={s.state}
                  onClick={() => setSelectedState(s.state)}
                  className={
                    "rounded-md border p-3 text-left transition-transform hover:scale-[1.02] hover:shadow-sm " +
                    intensityClass(s.intensity)
                  }
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold uppercase tracking-wide">{s.state}</span>
                    {s.rising && <Flame className="size-3 opacity-80" />}
                  </div>
                  <div className="text-lg font-semibold tabular-nums mt-1">{s.avgOpp}</div>
                  <div className="text-[10px] opacity-90 mt-0.5">
                    Vol {(s.totalVol / 1000).toFixed(0)}k · Gap {s.avgGap > 0 ? "+" : ""}{s.avgGap}
                  </div>
                </button>
              ))}
            </div>
          </SectionCard>

          <SectionCard
            title="State Ranking"
            description="States sorted by opportunity score"
            bodyClassName="p-0"
          >
            <div className="divide-y divide-border/60">
              {byState.map((s, i) => (
                <button
                  key={s.state}
                  onClick={() => setSelectedState(s.state)}
                  className="w-full flex items-center justify-between px-4 py-3 hover:bg-accent/40 transition-colors text-left"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="size-6 rounded-full bg-primary/10 text-primary text-xs font-semibold inline-flex items-center justify-center shrink-0">
                      {i + 1}
                    </span>
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{s.stateName}</p>
                      <p className="text-xs text-muted-foreground truncate">
                        {s.markets.length} markets · Vol {s.totalVol.toLocaleString()}/mo
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <div className="text-right">
                      <p className="text-xs text-muted-foreground">Opp Score</p>
                      <p className="text-sm font-semibold tabular-nums">{s.avgOpp}</p>
                    </div>
                    {s.rising && <Flame className="size-4 text-amber-500" />}
                  </div>
                </button>
              ))}
            </div>
          </SectionCard>
        </>
      ) : stateSummary ? (
        <div className="space-y-3">
          <Card className="p-4 gap-0">
            <div className="flex items-start justify-between gap-3 flex-wrap">
              <div>
                <h3 className="text-base font-semibold">{stateSummary.stateName}</h3>
                <p className="text-sm text-muted-foreground mt-0.5">
                  {stateSummary.markets.length} markets · Vol {stateSummary.totalVol.toLocaleString()}/mo · Avg trend +{stateSummary.avgTrend}%
                </p>
              </div>
              <div className="flex items-center gap-2">
                <StatusBadge label={`Gap ${stateSummary.avgGap > 0 ? "+" : ""}${stateSummary.avgGap}`} color={stateSummary.avgGap > 50 ? "rose" : stateSummary.avgGap > 20 ? "amber" : "green"} />
                <StatusBadge label={`Opp ${stateSummary.avgOpp}`} color="teal" />
              </div>
            </div>
          </Card>

          <SectionCard
            title={`Markets in ${stateSummary.stateName}`}
            description="Sorted by search volume"
            bodyClassName="p-0"
          >
            <div className="overflow-x-auto nv-scroll">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/40 text-left">
                    <th className="font-medium text-muted-foreground px-3 py-2.5">Market</th>
                    <th className="font-medium text-muted-foreground px-3 py-2.5 hidden md:table-cell">Type</th>
                    <th className="font-medium text-muted-foreground px-3 py-2.5">Volume</th>
                    <th className="font-medium text-muted-foreground px-3 py-2.5 hidden md:table-cell">Trend</th>
                    <th className="font-medium text-muted-foreground px-3 py-2.5">Supply</th>
                    <th className="font-medium text-muted-foreground px-3 py-2.5">Demand</th>
                    <th className="font-medium text-muted-foreground px-3 py-2.5">Gap</th>
                    <th className="font-medium text-muted-foreground px-3 py-2.5">Opp</th>
                  </tr>
                </thead>
                <tbody>
                  {stateSummary.markets.map((m) => (
                    <tr key={m.id} className="border-b last:border-0 hover:bg-accent/40">
                      <td className="px-3 py-2.5">
                        <div className="font-medium">{m.geography}</div>
                        <div className="text-xs text-muted-foreground">{m.topTreatments.map(treatmentName).join(" · ")}</div>
                      </td>
                      <td className="px-3 py-2.5 hidden md:table-cell">
                        <StatusBadge label={m.type} color={m.type === "state" ? "violet" : m.type === "city" ? "teal" : "amber"} />
                      </td>
                      <td className="px-3 py-2.5 tabular-nums">{m.searchVolume.toLocaleString()}</td>
                      <td className="px-3 py-2.5 tabular-nums hidden md:table-cell">
                        <span className={m.searchTrend >= 20 ? "text-emerald-600" : "text-amber-600"}>+{m.searchTrend}%</span>
                      </td>
                      <td className="px-3 py-2.5 tabular-nums">
                        <span className="inline-flex items-center gap-1">
                          <Building2 className="size-3 text-muted-foreground" />
                          {m.clinicSupply}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 tabular-nums">{m.patientDemand}</td>
                      <td className={"px-3 py-2.5 tabular-nums font-medium " + (m.supplyDemandGap > 50 ? "text-rose-600" : m.supplyDemandGap > 20 ? "text-amber-600" : "text-emerald-600")}>
                        {m.supplyDemandGap > 0 ? "+" : ""}{m.supplyDemandGap}
                      </td>
                      <td className="px-3 py-2.5 tabular-nums font-semibold">{m.opportunityScore}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </SectionCard>
        </div>
      ) : (
        <SectionCard>
          <EmptyState title="State not found" />
        </SectionCard>
      )}
    </div>
  );
}
