"use client";

import { useEffect, useState } from "react";
import { useNav } from "@/components/admin/admin-app";
import { PageHeader, LoadingState, EmptyState, DealStageBadge, StatCard } from "@/components/admin/shared";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, TrendingUp, DollarSign, Target, Scale, LayoutGrid, List, Building2 } from "lucide-react";
import { formatCurrency, formatCurrencyFull, formatDate, fullName } from "@/lib/format";
import { DEAL_STAGES, DEAL_STAGE_MAP } from "@/lib/constants";
import { toast } from "sonner";
import { CreateDealDialog } from "@/components/admin/create-deal-dialog";

interface Deal {
  id: string;
  name: string;
  stage: string;
  offer: string | null;
  estimatedMonthlyValue: number;
  setupFee: number;
  estimatedTotalValue: number;
  probability: number;
  expectedCloseDate: string | null;
  paymentStatus: string;
  contractStatus: string;
  clinic: { id: string; name: string; city: string | null; state: string | null } | null;
  contact: { id: string; firstName: string; lastName: string } | null;
  owner: { firstName: string; lastName: string } | null;
}

interface Metrics {
  openPipeline: number;
  weightedPipeline: number;
  wonRevenue: number;
  mrr: number;
  avgDealValue: number;
  count: number;
}

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
    fetch(`/api/deals?view=${view}`)
      .then((r) => r.json())
      .then((d) => { setDeals(d.deals ?? []); setMetrics(d.metrics ?? null); })
      .catch(() => toast.error("Failed to load deals"))
      .finally(() => setLoading(false));
  }, [view, refreshKey]);

  async function moveStage(dealId: string, toStage: string) {
    const res = await fetch(`/api/deals/${dealId}/stage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ toStage }),
    });
    if (res.ok) { toast.success(`Stage → ${DEAL_STAGE_MAP[toStage]?.label}`); refresh(); }
    else toast.error("Failed to update stage");
  }

  // Board columns
  const boardStages = DEAL_STAGES.filter((s) => !["won", "lost", "paused"].includes(s.id));

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
          <StatCard label="Open Pipeline" value={formatCurrency(metrics.openPipeline)} icon={TrendingUp} tone="teal" />
          <StatCard label="Weighted" value={formatCurrency(metrics.weightedPipeline)} icon={Scale} tone="violet" />
          <StatCard label="Won Revenue" value={formatCurrency(metrics.wonRevenue)} icon={DollarSign} tone="green" />
          <StatCard label="Monthly Recurring" value={formatCurrencyFull(metrics.mrr)} icon={Target} tone="teal" />
          <StatCard label="Avg Deal" value={formatCurrency(metrics.avgDealValue)} icon={DollarSign} tone="amber" />
          <StatCard label="Total Deals" value={metrics.count} icon={TrendingUp} tone="default" />
        </div>
      )}

      <Tabs value={view} onValueChange={setView} className="mb-4">
        <TabsList>
          <TabsTrigger value="open">Open</TabsTrigger>
          <TabsTrigger value="proposals">Proposals Out</TabsTrigger>
          <TabsTrigger value="expected">Expected</TabsTrigger>
          <TabsTrigger value="won">Won</TabsTrigger>
          <TabsTrigger value="lost">Lost</TabsTrigger>
        </TabsList>
      </Tabs>

      {loading ? (
        <LoadingState label="Loading deals…" />
      ) : deals.length === 0 ? (
        <EmptyState icon={TrendingUp} title="No deals here" description="Create a deal when a clinic shows commercial interest." action={<Button onClick={() => setCreateOpen(true)}><Plus className="size-4" /> New Deal</Button>} />
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
                        <button onClick={() => d.clinic && openClinic(d.clinic.id)} className="text-left w-full">
                          <p className="text-sm font-medium leading-snug">{d.name}</p>
                          {d.clinic && <p className="text-xs text-muted-foreground mt-0.5 truncate">{d.clinic.name}</p>}
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
        <Card className="overflow-hidden p-0">
          <div className="overflow-x-auto nv-scroll">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/40 text-left">
                  <th className="font-medium text-muted-foreground px-3 py-2.5">Deal</th>
                  <th className="font-medium text-muted-foreground px-3 py-2.5 hidden md:table-cell">Clinic</th>
                  <th className="font-medium text-muted-foreground px-3 py-2.5">Stage</th>
                  <th className="font-medium text-muted-foreground px-3 py-2.5 text-right">Monthly</th>
                  <th className="font-medium text-muted-foreground px-3 py-2.5 text-right">Total</th>
                  <th className="font-medium text-muted-foreground px-3 py-2.5 text-right">Prob</th>
                  <th className="font-medium text-muted-foreground px-3 py-2.5 hidden lg:table-cell">Expected Close</th>
                </tr>
              </thead>
              <tbody>
                {deals.map((d) => (
                  <tr key={d.id} className="border-b last:border-0 hover:bg-accent/40 cursor-pointer" onClick={() => d.clinic && openClinic(d.clinic.id)}>
                    <td className="px-3 py-2.5"><p className="font-medium truncate max-w-[200px]">{d.name}</p>{d.offer && <p className="text-xs text-muted-foreground truncate">{d.offer}</p>}</td>
                    <td className="px-3 py-2.5 hidden md:table-cell text-muted-foreground text-xs">{d.clinic?.name ?? "—"}</td>
                    <td className="px-3 py-2.5"><DealStageBadge stage={d.stage} /></td>
                    <td className="px-3 py-2.5 text-right tabular-nums">{formatCurrency(d.estimatedMonthlyValue)}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums font-medium">{formatCurrency(d.estimatedTotalValue)}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums text-muted-foreground">{d.probability}%</td>
                    <td className="px-3 py-2.5 hidden lg:table-cell text-xs text-muted-foreground">{d.expectedCloseDate ? formatDate(d.expectedCloseDate) : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      <CreateDealDialog open={createOpen} onOpenChange={setCreateOpen} onCreated={() => refresh()} />
    </div>
  );
}
