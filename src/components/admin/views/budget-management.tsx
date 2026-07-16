"use client";

import { useEffect, useMemo, useState } from "react";
import { useNav } from "@/components/admin/admin-app";
import {
  PageHeader, MetricCard, LoadingState, EmptyState, SectionCard,
  ChartCard, DataTable, type Column,
} from "@/components/admin/shared";
import { Button } from "@/components/ui/button";
import {
  DollarSign, Wallet, AlertTriangle, TrendingUp, Target,
} from "lucide-react";
import { campaignService } from "@/services";
import type { Campaign } from "@/types";
import { formatCurrency, formatCurrencyFull } from "@/lib/format";
import { toast } from "sonner";

const PLATFORM_LABEL: Record<string, string> = {
  google: "Google",
  meta: "Meta",
  tiktok: "TikTok",
  linkedin: "LinkedIn",
  email: "Email",
};

export function BudgetManagementView({ params }: { params?: Record<string, unknown> | null }) {
  const { refreshKey, navigate } = useNav();
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    campaignService
      .list()
      .then((d) => setCampaigns(d.campaigns))
      .finally(() => setLoading(false));
  }, [refreshKey]);

  const totals = useMemo(() => {
    const totalBudget = campaigns.reduce((s, c) => s + c.budget, 0);
    const totalSpent = campaigns.reduce((s, c) => s + c.spent, 0);
    const totalRemaining = totalBudget - totalSpent;
    const utilization = totalBudget > 0 ? Math.round((totalSpent / totalBudget) * 100) : 0;
    const overBudget = campaigns.filter((c) => c.budget > 0 && c.spent > c.budget * 0.95);
    return { totalBudget, totalSpent, totalRemaining, utilization, overBudgetCount: overBudget.length, overBudget };
  }, [campaigns]);

  const byPlatform = useMemo(() => {
    const map = new Map<string, { platform: string; budget: number; spent: number; count: number }>();
    for (const c of campaigns) {
      if (!map.has(c.platform)) map.set(c.platform, { platform: c.platform, budget: 0, spent: 0, count: 0 });
      const e = map.get(c.platform)!;
      e.budget += c.budget;
      e.spent += c.spent;
      e.count += 1;
    }
    return Array.from(map.values()).sort((a, b) => b.spent - a.spent);
  }, [campaigns]);

  const spendVsBudgetChart = byPlatform.map((p) => ({
    label: PLATFORM_LABEL[p.platform] ?? p.platform,
    value: p.spent,
  }));

  const highlightId = params?.campaignId ? String(params.campaignId) : null;

  const columns: Column<Campaign>[] = [
    {
      key: "name",
      header: "Campaign",
      render: (c) => (
        <div className="min-w-0">
          <div className={"font-medium truncate " + (highlightId === c.id ? "text-primary" : "")}>
            {c.name}
            {highlightId === c.id && <span className="ml-1 size-1.5 rounded-full bg-primary inline-block" />}
          </div>
          <div className="text-xs text-muted-foreground">{PLATFORM_LABEL[c.platform] ?? c.platform}</div>
        </div>
      ),
      sortValue: (c) => c.name,
    },
    {
      key: "budget",
      header: "Budget",
      render: (c) => <span className="tabular-nums text-sm">{formatCurrencyFull(c.budget)}</span>,
      sortValue: (c) => c.budget,
      hideOnMobile: true,
    },
    {
      key: "spent",
      header: "Spent",
      render: (c) => <span className="tabular-nums text-sm font-medium">{formatCurrencyFull(c.spent)}</span>,
      sortValue: (c) => c.spent,
    },
    {
      key: "remaining",
      header: "Remaining",
      render: (c) => {
        const remaining = c.budget - c.spent;
        return (
          <span className={"tabular-nums text-sm " + (remaining < 0 ? "text-rose-600 font-medium" : "text-emerald-600")}>
            {formatCurrencyFull(remaining)}
          </span>
        );
      },
      sortValue: (c) => c.budget - c.spent,
      hideOnMobile: true,
    },
    {
      key: "pctUsed",
      header: "% Used",
      render: (c) => {
        const pct = c.budget > 0 ? Math.round((c.spent / c.budget) * 100) : 0;
        const tone = pct >= 95 ? "rose" : pct >= 75 ? "amber" : "green";
        return (
          <div className="min-w-[120px]">
            <div className="flex items-center justify-between text-xs">
              <span className={"font-medium tabular-nums " + (tone === "rose" ? "text-rose-600" : tone === "amber" ? "text-amber-600" : "text-emerald-600")}>
                {pct}%
              </span>
              {pct >= 95 && <AlertTriangle className="size-3 text-rose-500" />}
            </div>
            <div className="mt-1 h-1.5 rounded-full bg-muted overflow-hidden">
              <div
                className={"h-full rounded-full " + (tone === "rose" ? "bg-rose-500" : tone === "amber" ? "bg-amber-500" : "bg-emerald-500")}
                style={{ width: `${Math.min(100, pct)}%` }}
              />
            </div>
          </div>
        );
      },
      sortValue: (c) => (c.budget > 0 ? c.spent / c.budget : 0),
    },
    {
      key: "actions",
      header: "",
      render: (c) => (
        <Button
          size="sm"
          variant="outline"
          onClick={(e) => {
            e.stopPropagation();
            toast.info(`Adjust budget · ${c.name}`, {
              description: `Current: ${formatCurrencyFull(c.budget)} · Spent: ${formatCurrencyFull(c.spent)}`,
            });
          }}
        >
          Adjust
        </Button>
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        title="Budget Management"
        description="Monitor spend vs budget across all campaigns & platforms"
        action={
          <Button variant="outline" onClick={() => navigate("campaign-dashboard")}>
            <Target className="size-4" /> View Campaigns
          </Button>
        }
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
        <MetricCard label="Total Budget" value={formatCurrencyFull(totals.totalBudget)} icon={Wallet} tone="teal" hint="Across all campaigns" />
        <MetricCard label="Total Spent" value={formatCurrencyFull(totals.totalSpent)} icon={DollarSign} tone="violet" hint={`${totals.utilization}% utilized`} />
        <MetricCard label="Remaining" value={formatCurrencyFull(Math.max(0, totals.totalRemaining))} icon={TrendingUp} tone="green" hint="Available to spend" />
        <MetricCard label="Over Budget" value={totals.overBudgetCount} icon={AlertTriangle} tone="rose" hint="> 95% utilized" />
      </div>

      {/* Over-budget alerts */}
      {totals.overBudget.length > 0 && (
        <SectionCard
          title="Budget Alerts"
          description="Campaigns at risk of exceeding budget"
          className="mb-5 border-amber-200"
        >
          <div className="space-y-2">
            {totals.overBudget.map((c) => {
              const pct = c.budget > 0 ? Math.round((c.spent / c.budget) * 100) : 0;
              return (
                <div
                  key={c.id}
                  className="flex items-center gap-3 rounded-md border border-amber-200 bg-amber-50 px-3 py-2"
                >
                  <AlertTriangle className="size-4 text-amber-600 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-amber-900 truncate">{c.name}</p>
                    <p className="text-xs text-amber-700">
                      {formatCurrencyFull(c.spent)} of {formatCurrencyFull(c.budget)} ({pct}% used)
                      {pct >= 100 && " · OVER BUDGET"}
                    </p>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    className="border-amber-300 text-amber-700 hover:bg-amber-100"
                    onClick={() => toast.info(`Pause suggested for ${c.name}`)}
                  >
                    Pause
                  </Button>
                </div>
              );
            })}
          </div>
        </SectionCard>
      )}

      {loading ? (
        <SectionCard>
          <LoadingState label="Loading budget data…" />
        </SectionCard>
      ) : campaigns.length === 0 ? (
        <SectionCard>
          <EmptyState title="No campaigns" description="Create a campaign to start tracking budget." />
        </SectionCard>
      ) : (
        <>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 mb-5">
            <ChartCard title="Spend by Platform" data={spendVsBudgetChart} type="bar" />
            <SectionCard title="Platform Breakdown">
              <div className="space-y-2.5">
                {byPlatform.map((p) => {
                  const pct = p.budget > 0 ? Math.round((p.spent / p.budget) * 100) : 0;
                  return (
                    <div key={p.platform} className="rounded-md border border-border/70 p-3">
                      <div className="flex items-center justify-between gap-2 mb-2">
                        <div className="min-w-0">
                          <p className="text-sm font-medium truncate">{PLATFORM_LABEL[p.platform] ?? p.platform}</p>
                          <p className="text-xs text-muted-foreground">{p.count} campaign(s)</p>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="text-sm font-semibold tabular-nums">{formatCurrency(p.spent)}</p>
                          <p className="text-xs text-muted-foreground">of {formatCurrency(p.budget)}</p>
                        </div>
                      </div>
                      <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                        <div
                          className={"h-full rounded-full " + (pct >= 95 ? "bg-rose-500" : pct >= 75 ? "bg-amber-500" : "bg-emerald-500")}
                          style={{ width: `${Math.min(100, pct)}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </SectionCard>
          </div>

          <SectionCard
            title="Campaign Budgets"
            description="Per-campaign spend, remaining, and utilization"
            bodyClassName="p-0"
          >
            <DataTable
              columns={columns}
              data={campaigns}
              pageSize={15}
              emptyTitle="No campaigns"
            />
          </SectionCard>
        </>
      )}
    </div>
  );
}
