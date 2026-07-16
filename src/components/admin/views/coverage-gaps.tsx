"use client";

import { useEffect, useMemo, useState } from "react";
import { useNav } from "@/components/admin/admin-app";
import {
  PageHeader, MetricCard, LoadingState, EmptyState, SectionCard,
  ScoreBadge, DataTable, type Column,
} from "@/components/admin/shared";
import { Button } from "@/components/ui/button";
import {
  Target, AlertTriangle, MapPin, Building2, Users,
} from "lucide-react";
import { demandService } from "@/services";
import type { MarketData } from "@/types";
import { formatCurrency } from "@/lib/format";
import { SERVICE_CATALOG } from "@/lib/constants";
import { toast } from "sonner";

const treatmentName = (slug: string) =>
  SERVICE_CATALOG.find((s) => s.slug === slug)?.name ?? slug;

export function CoverageGapsView({ params }: { params?: Record<string, unknown> | null }) {
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

  const sorted = useMemo(
    () => [...markets].sort((a, b) => b.supplyDemandGap - a.supplyDemandGap),
    [markets],
  );

  const totals = useMemo(() => {
    const totalGap = sorted.reduce((s, m) => s + Math.max(0, m.supplyDemandGap), 0);
    const underserved = sorted.filter((m) => m.supplyDemandGap > 50).length;
    const totalDemand = sorted.reduce((s, m) => s + m.patientDemand, 0);
    const totalSupply = sorted.reduce((s, m) => s + m.clinicSupply, 0);
    return { totalGap, underserved, totalDemand, totalSupply };
  }, [sorted]);

  // Highlight preset market if navigated with params.marketId
  const highlightId = params?.marketId ? String(params.marketId) : null;

  const columns: Column<MarketData>[] = [
    {
      key: "geography",
      header: "Market",
      render: (m) => (
        <div className="min-w-0">
          <div className={"font-medium truncate inline-flex items-center gap-1.5 " + (highlightId === m.id ? "text-primary" : "")}>
            <MapPin className="size-3.5 text-muted-foreground" />
            {m.geography}
            {highlightId === m.id && <span className="size-1.5 rounded-full bg-primary" />}
          </div>
          <div className="text-xs text-muted-foreground truncate">{m.topTreatments.map(treatmentName).join(" · ")}</div>
        </div>
      ),
      sortValue: (m) => m.geography,
    },
    {
      key: "demand",
      header: "Demand",
      render: (m) => (
        <span className="tabular-nums text-sm inline-flex items-center gap-1">
          <Users className="size-3 text-muted-foreground" />
          {m.patientDemand}
        </span>
      ),
      sortValue: (m) => m.patientDemand,
    },
    {
      key: "supply",
      header: "Supply",
      render: (m) => (
        <span className="tabular-nums text-sm inline-flex items-center gap-1">
          <Building2 className="size-3 text-muted-foreground" />
          {m.clinicSupply}
        </span>
      ),
      sortValue: (m) => m.clinicSupply,
    },
    {
      key: "gap",
      header: "Gap",
      render: (m) => (
        <span className={"tabular-nums text-sm font-medium " + (m.supplyDemandGap > 50 ? "text-rose-600" : m.supplyDemandGap > 20 ? "text-amber-600" : "text-emerald-600")}>
          {m.supplyDemandGap > 0 ? "+" : ""}{m.supplyDemandGap}
        </span>
      ),
      sortValue: (m) => m.supplyDemandGap,
    },
    {
      key: "opportunity",
      header: "Opp",
      render: (m) => <ScoreBadge score={m.opportunityScore} />,
      sortValue: (m) => m.opportunityScore,
      hideOnMobile: true,
    },
    {
      key: "volume",
      header: "Volume",
      render: (m) => <span className="tabular-nums text-sm">{m.searchVolume.toLocaleString()}</span>,
      sortValue: (m) => m.searchVolume,
      hideOnMobile: true,
    },
    {
      key: "cpc",
      header: "CPC",
      render: (m) => <span className="tabular-nums text-sm">{formatCurrency(m.avgCpc)}</span>,
      sortValue: (m) => m.avgCpc,
      hideOnMobile: true,
    },
    {
      key: "actions",
      header: "",
      render: (m) => (
        <Button
          size="sm"
          variant="outline"
          onClick={(e) => {
            e.stopPropagation();
            toast.success(`Searching for clinics in ${m.geography}`, {
              description: `Demand ${m.patientDemand} / Supply ${m.clinicSupply} — gap of ${m.supplyDemandGap}.`,
            });
            navigate("clinics", null, { marketId: m.id, state: m.state, city: m.city });
          }}
        >
          <Building2 className="size-3.5" /> Find Clinics
        </Button>
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        title="Coverage Gaps"
        description="Most underserved markets — sorted by supply/demand gap (descending)"
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
        <MetricCard label="Total Gap" value={totals.totalGap} icon={AlertTriangle} tone="rose" hint="Sum of positive gaps" />
        <MetricCard label="Underserved Markets" value={totals.underserved} icon={Target} tone="amber" hint="Gap > 50" />
        <MetricCard label="Total Demand" value={totals.totalDemand} icon={Users} tone="teal" hint="Across all markets" />
        <MetricCard label="Total Supply" value={totals.totalSupply} icon={Building2} tone="violet" hint="Clinics tracked" />
      </div>

      {/* Visual gap bars */}
      <SectionCard
        title="Top 6 Underserved Markets"
        description="Visual representation of demand vs supply gap"
        bodyClassName="p-4"
      >
        <div className="space-y-2.5">
          {sorted.slice(0, 6).map((m) => {
            const total = m.patientDemand + m.clinicSupply;
            const supplyPct = total > 0 ? (m.clinicSupply / total) * 100 : 0;
            const demandPct = total > 0 ? (m.patientDemand / total) * 100 : 0;
            return (
              <div key={m.id} className="space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-medium inline-flex items-center gap-1">
                    <MapPin className="size-3 text-muted-foreground" />
                    {m.geography}
                  </span>
                  <span className="tabular-nums text-muted-foreground">
                    <span className="text-rose-600 font-medium">{m.patientDemand}</span>
                    {" / "}
                    <span className="text-emerald-600 font-medium">{m.clinicSupply}</span>
                    {" · Gap "}
                    <span className={m.supplyDemandGap > 50 ? "text-rose-600 font-semibold" : "text-amber-600 font-semibold"}>
                      +{m.supplyDemandGap}
                    </span>
                  </span>
                </div>
                <div className="h-2.5 rounded-full overflow-hidden flex bg-muted">
                  <div className="bg-rose-400 h-full" style={{ width: `${demandPct}%` }} title={`Demand: ${m.patientDemand}`} />
                  <div className="bg-emerald-500 h-full" style={{ width: `${supplyPct}%` }} title={`Supply: ${m.clinicSupply}`} />
                </div>
              </div>
            );
          })}
        </div>
        <div className="flex items-center gap-4 mt-3 pt-3 border-t border-border/60 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1.5">
            <span className="size-2.5 rounded-sm bg-rose-400" /> Demand
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="size-2.5 rounded-sm bg-emerald-500" /> Supply
          </span>
        </div>
      </SectionCard>

      <div className="mt-5">
        {loading ? (
          <SectionCard>
            <LoadingState label="Loading coverage gaps…" />
          </SectionCard>
        ) : sorted.length === 0 ? (
          <SectionCard>
            <EmptyState title="No markets" description="Markets will appear here when data is available." />
          </SectionCard>
        ) : (
          <SectionCard
            title="All Markets — Coverage Gaps"
            description="Click 'Find Clinics' to surface matching clinics in the clinics directory"
            bodyClassName="p-0"
          >
            <DataTable
              columns={columns}
              data={sorted}
              pageSize={15}
              emptyTitle="No markets"
            />
          </SectionCard>
        )}
      </div>
    </div>
  );
}
