"use client";

import { useEffect, useMemo, useState } from "react";
import { useNav } from "@/components/admin/admin-app";
import {
  PageHeader, MetricCard, LoadingState, EmptyState, SectionCard, ChartCard,
} from "@/components/admin/shared";
import { Card } from "@/components/ui/card";
import { TrendingDown, Filter, ArrowRight } from "lucide-react";
import { patientService } from "@/services";
import type { PatientLead } from "@/types";

const STAGES: { id: string; label: string; color: string }[] = [
  { id: "new", label: "Leads", color: "#0d9488" },
  { id: "qualified", label: "Qualified", color: "#14b8a6" },
  { id: "contacted", label: "Contacted", color: "#8b5cf6" },
  { id: "routed", label: "Routed", color: "#f59e0b" },
  { id: "booked", label: "Booked", color: "#10b981" },
];

export function ConversionFunnelView() {
  const { refreshKey } = useNav();
  const [leads, setLeads] = useState<PatientLead[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    patientService
      .listLeads()
      .then((d) => setLeads(d.leads))
      .finally(() => setLoading(false));
  }, [refreshKey]);

  // Funnel logic: a lead that has reached stage X has passed through all previous stages.
  // Stage order index — duplicate/lost/disqualified exit the funnel.
  const STAGE_INDEX: Record<string, number> = {
    new: 0,
    qualified: 1,
    contacted: 2,
    routed: 3,
    booked: 4,
  };

  const funnelData = useMemo(() => {
    return STAGES.map((s, i) => {
      // Count leads whose stage index >= i (they passed through this stage)
      const reached = leads.filter((l) => {
        const idx = STAGE_INDEX[l.status];
        if (idx == null) return false; // lost/disqualified/duplicate — never "reached" any of the 5 stages
        return idx >= i;
      }).length;
      return { ...s, count: reached };
    });
  }, [leads]);

  const maxCount = Math.max(1, ...funnelData.map((s) => s.count));

  // Conversion rates between adjacent stages
  const transitions = funnelData.map((stage, i) => {
    const prev = i === 0 ? stage.count : funnelData[i - 1].count;
    const rate = prev === 0 ? 0 : Math.round((stage.count / prev) * 100);
    return { from: i === 0 ? null : STAGES[i - 1].label, to: stage.label, rate, count: stage.count };
  });

  const overallConversion = funnelData.length > 1 && funnelData[0].count > 0
    ? Math.round((funnelData[funnelData.length - 1].count / funnelData[0].count) * 100)
    : 0;

  const totalLeads = leads.length;
  const bookedCount = leads.filter((l) => l.status === "booked").length;
  const lostCount = leads.filter((l) => ["lost", "disqualified", "duplicate"].includes(l.status)).length;
  const activeCount = totalLeads - lostCount;

  const chartData = funnelData.map((s) => ({ label: s.label, value: s.count, color: s.color }));

  return (
    <div>
      <PageHeader
        title="Conversion Funnel"
        description="Lead-to-booking conversion across the patient journey"
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
        <MetricCard label="Total Leads" value={totalLeads} icon={Filter} tone="teal" hint="Top of funnel" />
        <MetricCard label="Active in Funnel" value={activeCount} icon={ArrowRight} tone="violet" hint="Not lost/disqualified" />
        <MetricCard label="Booked" value={bookedCount} icon={ArrowRight} tone="green" hint="Bottom of funnel" />
        <MetricCard label="Lead → Booking" value={`${overallConversion}%`} icon={TrendingDown} tone="amber" hint="Overall conversion" />
      </div>

      {loading ? (
        <SectionCard>
          <LoadingState label="Loading funnel…" />
        </SectionCard>
      ) : totalLeads === 0 ? (
        <SectionCard>
          <EmptyState title="No leads to analyze" description="Funnel will populate once leads enter the system." />
        </SectionCard>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
          <div className="lg:col-span-2 space-y-3">
            <Card className="p-4 gap-0">
              <h3 className="text-sm font-semibold mb-4">Funnel Visualization</h3>
              <div className="space-y-2">
                {funnelData.map((stage, i) => {
                  const widthPct = (stage.count / maxCount) * 100;
                  const widthAdj = 100 - i * 8; // visual narrowing
                  return (
                    <div key={stage.id} className="flex items-center gap-3">
                      <div className="w-20 text-xs text-muted-foreground text-right shrink-0">{stage.label}</div>
                      <div className="flex-1 relative h-10 rounded-md overflow-hidden bg-muted/40">
                        <div
                          className="h-full flex items-center justify-end pr-3 rounded-md transition-all"
                          style={{
                            width: `${Math.max(widthPct, 6)}%`,
                            marginLeft: `${(100 - widthAdj) / 2}%`,
                            backgroundColor: stage.color,
                          }}
                        >
                          <span className="text-xs font-semibold text-white drop-shadow">{stage.count.toLocaleString()}</span>
                        </div>
                      </div>
                      <div className="w-16 text-xs text-muted-foreground shrink-0 tabular-nums text-right">
                        {i === 0 ? "—" : `${transitions[i].rate}%`}
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="mt-4 pt-4 border-t border-border/60 flex items-center justify-between text-xs text-muted-foreground">
                <span>Stage-by-stage conversion rate (right column)</span>
                <span>Overall: <strong className="text-foreground">{overallConversion}%</strong></span>
              </div>
            </Card>

            <ChartCard title="Funnel by Volume (bar)" data={chartData} type="bar" />
          </div>

          <SectionCard title="Stage Transitions" description="Conversion rate between adjacent stages">
            <div className="space-y-3">
              {transitions.map((t, i) => (
                <div key={i} className="rounded-md border border-border/70 p-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs text-muted-foreground">
                      {t.from ? `${t.from} → ${t.to}` : `Entry → ${t.to}`}
                    </span>
                    <span className={"text-sm font-semibold tabular-nums " + (t.rate >= 60 ? "text-emerald-600" : t.rate >= 30 ? "text-amber-600" : "text-rose-600")}>
                      {t.rate}%
                    </span>
                  </div>
                  <div className="mt-2 h-1.5 rounded-full bg-muted overflow-hidden">
                    <div
                      className={t.rate >= 60 ? "bg-emerald-500 h-full" : t.rate >= 30 ? "bg-amber-500 h-full" : "bg-rose-400 h-full"}
                      style={{ width: `${Math.min(100, t.rate)}%` }}
                    />
                  </div>
                  <p className="text-[10px] text-muted-foreground mt-1.5">
                    {t.count.toLocaleString()} leads reached this stage
                  </p>
                </div>
              ))}
            </div>

            <div className="mt-4 pt-4 border-t border-border/60">
              <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">Drop-off Hotspots</h4>
              <ul className="space-y-1.5 text-xs">
                {transitions
                  .slice(1)
                  .map((t, i) => ({ ...t, idx: i + 1 }))
                  .sort((a, b) => a.rate - b.rate)
                  .slice(0, 2)
                  .map((t) => (
                    <li key={t.idx} className="flex items-start gap-2">
                      <span className="size-1.5 rounded-full bg-rose-500 mt-1.5 shrink-0" />
                      <span>
                        <strong className="text-rose-700">{100 - t.rate}%</strong> drop between{" "}
                        <strong>{t.from}</strong> → <strong>{t.to}</strong>
                      </span>
                    </li>
                  ))}
              </ul>
            </div>
          </SectionCard>
        </div>
      )}
    </div>
  );
}
