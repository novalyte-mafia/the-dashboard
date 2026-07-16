"use client";

import { useEffect, useMemo, useState } from "react";
import { useNav } from "@/components/admin/admin-app";
import {
  PageHeader, LoadingState, EmptyState, MetricCard, SectionCard, DealStageBadge,
} from "@/components/admin/shared";
import { Card } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { TrendingUp, Scale, DollarSign, Target, ArrowRight } from "lucide-react";
import { formatCurrency, formatCurrencyFull, formatDate } from "@/lib/format";
import { DEAL_STAGES, DEAL_STAGE_MAP } from "@/lib/constants";
import { dealService } from "@/services";
import type { Deal } from "@/types";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export function PipelineView() {
  const { openClinic, refresh, refreshKey } = useNav();
  const [deals, setDeals] = useState<Deal[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    dealService
      .list()
      .then((d) => setDeals(d.deals))
      .catch(() => toast.error("Failed to load pipeline"))
      .finally(() => setLoading(false));
  }, [refreshKey]);

  const boardStages = DEAL_STAGES.filter((s) => !["won", "lost", "paused"].includes(s.id));

  const stageStats = useMemo(() => {
    return boardStages.map((s) => {
      const stageDeals = deals.filter((d) => d.stage === s.id);
      const value = stageDeals.reduce((sum, d) => sum + d.estimatedTotalValue, 0);
      const weighted = stageDeals.reduce((sum, d) => sum + d.estimatedTotalValue * (d.probability / 100), 0);
      return { stage: s, deals: stageDeals, value, weighted, count: stageDeals.length };
    });
  }, [deals, boardStages]);

  const totalOpen = deals.filter((d) => !["won", "lost"].includes(d.stage)).reduce((s, d) => s + d.estimatedTotalValue, 0);
  const totalWeighted = deals.filter((d) => !["won", "lost"].includes(d.stage)).reduce((s, d) => s + d.estimatedTotalValue * (d.probability / 100), 0);
  const wonRevenue = deals.filter((d) => d.stage === "active" || d.stage === "won").reduce((s, d) => s + d.estimatedTotalValue, 0);
  const mrr = deals.filter((d) => d.stage === "active" || d.stage === "won").reduce((s, d) => s + d.estimatedMonthlyValue, 0);
  const activeDeals = deals.filter((d) => !["won", "lost"].includes(d.stage)).length;

  function moveStage(dealId: string, toStage: string) {
    setDeals((cur) => cur.map((d) => (d.id === dealId ? { ...d, stage: toStage as Deal["stage"], probability: DEAL_STAGE_MAP[toStage]?.probability ?? d.probability } : d)));
    toast.success(`Stage → ${DEAL_STAGE_MAP[toStage]?.label}`);
    setTimeout(() => refresh(), 600);
  }

  if (loading) return <LoadingState label="Loading pipeline…" />;

  return (
    <div>
      <PageHeader
        title="Pipeline"
        description="Full-width kanban view of all deals by stage"
      />

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-5">
        <MetricCard label="Open Pipeline" value={formatCurrency(totalOpen)} icon={TrendingUp} tone="teal" />
        <MetricCard label="Weighted" value={formatCurrency(totalWeighted)} icon={Scale} tone="violet" />
        <MetricCard label="Won Revenue" value={formatCurrency(wonRevenue)} icon={DollarSign} tone="green" />
        <MetricCard label="MRR" value={formatCurrencyFull(mrr)} icon={Target} tone="teal" />
        <MetricCard label="Active Deals" value={activeDeals} icon={TrendingUp} tone="default" />
      </div>

      {deals.length === 0 ? (
        <SectionCard>
          <EmptyState icon={TrendingUp} title="No deals in pipeline" description="Deals will appear here as clinics progress." />
        </SectionCard>
      ) : (
        <div className="overflow-x-auto nv-scroll pb-4">
          <div className="flex gap-3 min-w-max">
            {stageStats.map(({ stage, deals: stageDeals, value, weighted, count }) => (
              <div key={stage.id} className="w-72 shrink-0">
                <Card className="p-0 mb-2 sticky top-0 z-10 bg-muted/40 backdrop-blur">
                  <div className="px-3 py-2.5 border-b border-border/60">
                    <div className="flex items-center justify-between gap-2">
                      <DealStageBadge stage={stage.id} />
                      <span className="text-xs text-muted-foreground tabular-nums">{count}</span>
                    </div>
                    <div className="flex items-center justify-between mt-1.5 text-xs">
                      <span className="text-muted-foreground tabular-nums">{formatCurrency(value)}</span>
                      <span className="text-muted-foreground/70 tabular-nums">wt. {formatCurrency(weighted)}</span>
                    </div>
                  </div>
                </Card>
                <div className="space-y-2 min-h-[100px]">
                  {stageDeals.map((d) => (
                    <Card key={d.id} className="p-3 gap-0 hover:shadow-sm transition-shadow">
                      <button onClick={() => d.clinicId && openClinic(d.clinicId)} className="text-left w-full">
                        <p className="text-sm font-medium leading-snug">{d.name}</p>
                        {d.clinicName && <p className="text-xs text-muted-foreground mt-0.5 truncate">{d.clinicName}</p>}
                      </button>
                      <div className="flex items-center justify-between mt-2 text-xs">
                        <span className="font-semibold tabular-nums">{formatCurrency(d.estimatedTotalValue)}</span>
                        <span className={cn(
                          "tabular-nums px-1.5 py-0.5 rounded",
                          d.probability >= 70 ? "bg-emerald-50 text-emerald-700"
                          : d.probability >= 40 ? "bg-amber-50 text-amber-700"
                          : "bg-slate-100 text-slate-600"
                        )}>{d.probability}%</span>
                      </div>
                      {d.expectedCloseDate && (
                        <p className="text-[10px] text-muted-foreground mt-1">Close: {formatDate(d.expectedCloseDate)}</p>
                      )}
                      <Select value={d.stage} onValueChange={(v) => moveStage(d.id, v)}>
                        <SelectTrigger className="h-7 text-xs mt-2"><SelectValue /></SelectTrigger>
                        <SelectContent className="max-h-72">{DEAL_STAGES.map((s) => <SelectItem key={s.id} value={s.id}>{s.label}</SelectItem>)}</SelectContent>
                      </Select>
                    </Card>
                  ))}
                  {stageDeals.length === 0 && (
                    <div className="text-center text-xs text-muted-foreground py-8 border border-dashed rounded-md">No deals</div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
