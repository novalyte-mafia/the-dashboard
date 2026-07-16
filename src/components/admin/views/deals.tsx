"use client";

import { useEffect, useMemo, useState } from "react";
import { useNav } from "@/components/admin/admin-app";
import {
  PageHeader, LoadingState, EmptyState, MetricCard, DataTable, DealStageBadge, SectionCard,
  type Column,
} from "@/components/admin/shared";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, TrendingUp, DollarSign, Target, Scale, LayoutGrid, List } from "lucide-react";
import { formatCurrency, formatCurrencyFull, formatDate } from "@/lib/format";
import { DEAL_STAGES, DEAL_STAGE_MAP } from "@/lib/constants";
import { dealService } from "@/services";
import type { Deal } from "@/types";
import { toast } from "sonner";
import { CreateDealDialog } from "@/components/admin/create-deal-dialog";

type Metrics = {
  openPipeline: number;
  weightedPipeline: number;
  wonRevenue: number;
  mrr: number;
  avgDealValue: number;
  count: number;
};

export function DealsView() {
  const { openClinic, refresh, refreshKey } = useNav();
  const [deals, setDeals] = useState<Deal[]>([]);
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState("open");
  const [layout, setLayout] = useState<"board" | "table">("board");
  const [createOpen, setCreateOpen] = useState(false);

  useEffect(() => {
    setLoading(true);
    dealService
      .list(view)
      .then((d) => {
        setDeals(d.deals);
        setMetrics(d.metrics);
      })
      .catch(() => toast.error("Failed to load deals"))
      .finally(() => setLoading(false));
  }, [view, refreshKey]);

  // Optimistic stage movement (mock mode)
  async function moveStage(dealId: string, toStage: string) {
    const prevDeals = deals;
    setDeals((cur) => cur.map((d) => (d.id === dealId ? { ...d, stage: toStage as Deal["stage"], probability: DEAL_STAGE_MAP[toStage]?.probability ?? d.probability, updatedAt: new Date().toISOString() } : d)));
    toast.success(`Stage → ${DEAL_STAGE_MAP[toStage]?.label}`);
    // In live mode, the change would be persisted via dealService.updateStage(dealId, toStage)
    // For mock mode, we keep the optimistic update and refresh quietly.
    setTimeout(() => refresh(), 600);
  }

  // Board columns: all "open" stages
  const boardStages = DEAL_STAGES.filter((s) => !["won", "lost", "paused"].includes(s.id));

  const columns: Column<Deal>[] = useMemo(() => [
    {
      key: "name",
      header: "Deal",
      render: (d) => (
        <div className="min-w-0">
          <p className="font-medium truncate max-w-[220px]">{d.name}</p>
          {d.offer && <p className="text-xs text-muted-foreground truncate">{d.offer}</p>}
        </div>
      ),
      sortValue: (d) => d.name,
    },
    {
      key: "clinic",
      header: "Clinic",
      render: (d) => <span className="text-muted-foreground text-sm">{d.clinicName ?? "—"}</span>,
      sortValue: (d) => d.clinicName ?? "",
      hideOnMobile: true,
    },
    {
      key: "stage",
      header: "Stage",
      render: (d) => <DealStageBadge stage={d.stage} />,
      sortValue: (d) => d.stage,
    },
    {
      key: "monthly",
      header: "Monthly",
      render: (d) => <span className="tabular-nums">{formatCurrency(d.estimatedMonthlyValue)}</span>,
      sortValue: (d) => d.estimatedMonthlyValue,
      hideOnMobile: true,
    },
    {
      key: "total",
      header: "Total",
      render: (d) => <span className="tabular-nums font-medium">{formatCurrency(d.estimatedTotalValue)}</span>,
      sortValue: (d) => d.estimatedTotalValue,
    },
    {
      key: "prob",
      header: "Prob",
      render: (d) => <span className="tabular-nums text-muted-foreground">{d.probability}%</span>,
      sortValue: (d) => d.probability,
      hideOnMobile: true,
    },
    {
      key: "close",
      header: "Expected Close",
      render: (d) => <span className="text-xs text-muted-foreground">{d.expectedCloseDate ? formatDate(d.expectedCloseDate) : "—"}</span>,
      sortValue: (d) => d.expectedCloseDate ?? "",
      hideOnMobile: true,
    },
  ], []);

  return (
    <div>
      <PageHeader
        title="Deals"
        description="Revenue opportunities & pipeline"
        action={
          <div className="flex items-center gap-2">
            <div className="flex rounded-md border overflow-hidden">
              <Button variant={layout === "board" ? "default" : "ghost"} size="sm" onClick={() => setLayout("board")} className="rounded-none"><LayoutGrid className="size-4" /></Button>
              <Button variant={layout === "table" ? "default" : "ghost"} size="sm" onClick={() => setLayout("table")} className="rounded-none"><List className="size-4" /></Button>
            </div>
            <Button onClick={() => setCreateOpen(true)}><Plus className="size-4" /> New Deal</Button>
          </div>
        }
      />

      {metrics && (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 mb-5">
          <MetricCard label="Open Pipeline" value={formatCurrency(metrics.openPipeline)} icon={TrendingUp} tone="teal" />
          <MetricCard label="Weighted" value={formatCurrency(metrics.weightedPipeline)} icon={Scale} tone="violet" hint="Probability-adjusted" />
          <MetricCard label="Won Revenue" value={formatCurrency(metrics.wonRevenue)} icon={DollarSign} tone="green" />
          <MetricCard label="Monthly Recurring" value={formatCurrencyFull(metrics.mrr)} icon={Target} tone="teal" />
          <MetricCard label="Avg Deal" value={formatCurrency(metrics.avgDealValue)} icon={DollarSign} tone="amber" />
          <MetricCard label="Total Deals" value={metrics.count} icon={TrendingUp} tone="default" />
        </div>
      )}

      <Tabs value={view} onValueChange={setView} className="mb-4">
        <TabsList>
          <TabsTrigger value="open">Open</TabsTrigger>
          <TabsTrigger value="proposals">Proposals Out</TabsTrigger>
          <TabsTrigger value="won">Won</TabsTrigger>
          <TabsTrigger value="lost">Lost</TabsTrigger>
        </TabsList>
      </Tabs>

      {loading ? (
        <LoadingState label="Loading deals…" />
      ) : deals.length === 0 ? (
        <EmptyState
          icon={TrendingUp}
          title="No deals here"
          description="Create a deal when a clinic shows commercial interest."
          action={<Button onClick={() => setCreateOpen(true)}><Plus className="size-4" /> New Deal</Button>}
        />
      ) : layout === "board" ? (
        <div className="overflow-x-auto nv-scroll pb-2">
          <div className="flex gap-3 min-w-max">
            {boardStages.map((stage) => {
              const stageDeals = deals.filter((d) => d.stage === stage.id);
              const stageValue = stageDeals.reduce((s, d) => s + d.estimatedTotalValue, 0);
              return (
                <div key={stage.id} className="w-72 shrink-0">
                  <div className="flex items-center justify-between mb-2 px-1">
                    <div className="flex items-center gap-2">
                      <DealStageBadge stage={stage.id} />
                      <span className="text-xs text-muted-foreground tabular-nums">{stageDeals.length}</span>
                    </div>
                    <span className="text-xs font-medium text-muted-foreground tabular-nums">{formatCurrency(stageValue)}</span>
                  </div>
                  <div className="space-y-2 min-h-[60px]">
                    {stageDeals.map((d) => (
                      <Card key={d.id} className="p-3 gap-0 hover:shadow-sm transition-shadow">
                        <button onClick={() => d.clinicId && openClinic(d.clinicId)} className="text-left w-full">
                          <p className="text-sm font-medium leading-snug">{d.name}</p>
                          {d.clinicName && <p className="text-xs text-muted-foreground mt-0.5 truncate">{d.clinicName}</p>}
                        </button>
                        <div className="flex items-center justify-between mt-2">
                          <span className="text-sm font-semibold tabular-nums">{formatCurrency(d.estimatedTotalValue)}</span>
                          <span className="text-xs text-muted-foreground">{d.probability}%</span>
                        </div>
                        <Select value={d.stage} onValueChange={(v) => moveStage(d.id, v)}>
                          <SelectTrigger className="h-7 text-xs mt-2"><SelectValue /></SelectTrigger>
                          <SelectContent className="max-h-72">{DEAL_STAGES.map((s) => <SelectItem key={s.id} value={s.id}>{s.label}</SelectItem>)}</SelectContent>
                        </Select>
                      </Card>
                    ))}
                    {stageDeals.length === 0 && (
                      <div className="text-center text-xs text-muted-foreground py-6 border border-dashed rounded-md">No deals</div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <SectionCard bodyClassName="p-0">
          <DataTable
            columns={columns}
            data={deals}
            onRowClick={(d) => d.clinicId && openClinic(d.clinicId)}
            pageSize={25}
          />
        </SectionCard>
      )}

      <CreateDealDialog open={createOpen} onOpenChange={setCreateOpen} onCreated={() => refresh()} />
    </div>
  );
}
