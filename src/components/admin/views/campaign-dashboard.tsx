"use client";

import { useEffect, useMemo, useState } from "react";
import { useNav } from "@/components/admin/admin-app";
import {
  PageHeader, MetricCard, LoadingState, EmptyState, SectionCard,
  StatusBadge, FilterBar, DataTable, ChartCard, type Column,
} from "@/components/admin/shared";
import { Button } from "@/components/ui/button";
import {
  Megaphone, DollarSign, Users, Target, AlertTriangle, Plus,
  Activity, Pause, PlayCircle,
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

const STATUS_COLOR: Record<string, string> = {
  active: "green",
  paused: "amber",
  ended: "slate",
  draft: "slate",
  review: "violet",
};

const FILTERS = [
  {
    key: "platform",
    label: "Platform",
    options: Object.entries(PLATFORM_LABEL).map(([value, label]) => ({ value, label })),
  },
  {
    key: "status",
    label: "Status",
    options: [
      { value: "active", label: "Active" },
      { value: "paused", label: "Paused" },
      { value: "ended", label: "Ended" },
      { value: "draft", label: "Draft" },
      { value: "review", label: "In Review" },
    ],
  },
];

export function CampaignDashboardView() {
  const { refreshKey, navigate } = useNav();
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [activeFilters, setActiveFilters] = useState<Record<string, string>>({});

  useEffect(() => {
    setLoading(true);
    campaignService
      .list()
      .then((d) => setCampaigns(d.campaigns))
      .finally(() => setLoading(false));
  }, [refreshKey]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return campaigns.filter((c) => {
      if (q && !`${c.name} ${c.targeting ?? ""} ${PLATFORM_LABEL[c.platform] ?? c.platform}`.toLowerCase().includes(q)) return false;
      if (activeFilters.platform && c.platform !== activeFilters.platform) return false;
      if (activeFilters.status && c.status !== activeFilters.status) return false;
      return true;
    });
  }, [campaigns, search, activeFilters]);

  const totals = useMemo(() => {
    const totalSpend = campaigns.reduce((s, c) => s + c.spent, 0);
    const totalLeads = campaigns.reduce((s, c) => s + c.leads, 0);
    const totalBudget = campaigns.reduce((s, c) => s + c.budget, 0);
    const avgCpl = totalLeads > 0 ? Math.round(totalSpend / totalLeads) : 0;
    const active = campaigns.filter((c) => c.status === "active").length;
    const overBudget = campaigns.filter((c) => c.budget > 0 && c.spent > c.budget * 0.95).length;
    const totalImpressions = campaigns.reduce((s, c) => s + c.impressions, 0);
    const totalClicks = campaigns.reduce((s, c) => s + c.clicks, 0);
    const avgCtr = totalImpressions > 0 ? Math.round((totalClicks / totalImpressions) * 1000) / 10 : 0;
    return { totalSpend, totalLeads, totalBudget, avgCpl, active, overBudget, avgCtr };
  }, [campaigns]);

  const overBudgetCampaigns = campaigns.filter((c) => c.budget > 0 && c.spent > c.budget * 0.95);

  const platformChart = useMemo(() => {
    const map = new Map<string, number>();
    for (const c of campaigns) {
      map.set(c.platform, (map.get(c.platform) ?? 0) + c.spent);
    }
    return Array.from(map.entries()).map(([platform, spent]) => ({
      label: PLATFORM_LABEL[platform] ?? platform,
      value: spent,
    }));
  }, [campaigns]);

  const columns: Column<Campaign>[] = [
    {
      key: "name",
      header: "Campaign",
      render: (c) => (
        <div className="min-w-0">
          <div className="font-medium truncate">{c.name}</div>
          <div className="text-xs text-muted-foreground truncate inline-flex items-center gap-1.5">
            <Megaphone className="size-3" />
            {PLATFORM_LABEL[c.platform] ?? c.platform}
            {c.targeting && <span className="truncate">· {c.targeting}</span>}
          </div>
        </div>
      ),
      sortValue: (c) => c.name,
    },
    {
      key: "status",
      header: "Status",
      render: (c) => <StatusBadge label={c.status} color={STATUS_COLOR[c.status] ?? "slate"} />,
      sortValue: (c) => c.status,
    },
    {
      key: "budget",
      header: "Budget",
      render: (c) => <span className="tabular-nums text-sm">{formatCurrency(c.budget)}</span>,
      sortValue: (c) => c.budget,
      hideOnMobile: true,
    },
    {
      key: "spent",
      header: "Spent",
      render: (c) => (
        <div className="min-w-[100px]">
          <div className="flex items-center justify-between text-xs">
            <span className="tabular-nums font-medium">{formatCurrency(c.spent)}</span>
            <span className="text-muted-foreground tabular-nums">
              {c.budget > 0 ? Math.round((c.spent / c.budget) * 100) : 0}%
            </span>
          </div>
          <div className="mt-1 h-1.5 rounded-full bg-muted overflow-hidden">
            <div
              className={
                "h-full rounded-full " +
                (c.budget > 0 && c.spent > c.budget * 0.95
                  ? "bg-rose-500"
                  : c.budget > 0 && c.spent > c.budget * 0.75
                  ? "bg-amber-500"
                  : "bg-emerald-500")
              }
              style={{ width: `${c.budget > 0 ? Math.min(100, (c.spent / c.budget) * 100) : 0}%` }}
            />
          </div>
        </div>
      ),
      sortValue: (c) => c.spent,
    },
    {
      key: "leads",
      header: "Leads",
      render: (c) => <span className="tabular-nums text-sm">{c.leads}</span>,
      sortValue: (c) => c.leads,
    },
    {
      key: "cpl",
      header: "CPL",
      render: (c) => (
        <span className={"tabular-nums text-sm " + (c.costPerLead === 0 ? "text-muted-foreground" : c.costPerLead > 80 ? "text-rose-600 font-medium" : "text-emerald-600 font-medium")}>
          {c.costPerLead > 0 ? formatCurrency(c.costPerLead) : "—"}
        </span>
      ),
      sortValue: (c) => c.costPerLead,
      hideOnMobile: true,
    },
    {
      key: "ctr",
      header: "CTR",
      render: (c) => <span className="tabular-nums text-sm text-muted-foreground">{c.ctr}%</span>,
      sortValue: (c) => c.ctr,
      hideOnMobile: true,
    },
    {
      key: "actions",
      header: "",
      render: (c) => (
        <Button
          size="sm"
          variant="ghost"
          onClick={(e) => {
            e.stopPropagation();
            toast.success(`${c.status === "active" ? "Paused" : "Resumed"} · ${c.name}`);
          }}
        >
          {c.status === "active" ? <Pause className="size-3.5" /> : <PlayCircle className="size-3.5" />}
        </Button>
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        title="Campaign Dashboard"
        description="Active advertising campaigns across Google, Meta, TikTok, LinkedIn & Email"
        action={
          <Button onClick={() => navigate("campaign-builder")}>
            <Plus className="size-4" /> New Campaign
          </Button>
        }
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
        <MetricCard label="Total Spend" value={formatCurrencyFull(totals.totalSpend)} icon={DollarSign} tone="teal" hint={`of ${formatCurrency(totals.totalBudget)} budget`} />
        <MetricCard label="Total Leads" value={totals.totalLeads} icon={Users} tone="violet" hint="Across all campaigns" />
        <MetricCard label="Avg CPL" value={formatCurrency(totals.avgCpl)} icon={Target} tone="amber" hint="Cost per lead" />
        <MetricCard label="Active Campaigns" value={totals.active} icon={Activity} tone="green" hint={`${totals.overBudget} over budget`} />
      </div>

      {overBudgetCampaigns.length > 0 && (
        <SectionCard
          title="Over-Budget Alerts"
          description="Campaigns spending > 95% of budget"
          className="mb-5 border-amber-200"
        >
          <div className="space-y-2">
            {overBudgetCampaigns.map((c) => (
              <div
                key={c.id}
                className="flex items-center gap-3 rounded-md border border-amber-200 bg-amber-50 px-3 py-2"
              >
                <AlertTriangle className="size-4 text-amber-600 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-amber-900 truncate">{c.name}</p>
                  <p className="text-xs text-amber-700">
                    {formatCurrencyFull(c.spent)} of {formatCurrencyFull(c.budget)} ({Math.round((c.spent / c.budget) * 100)}% used)
                  </p>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  className="border-amber-300 text-amber-700 hover:bg-amber-100"
                  onClick={() => navigate("budget-management", null, { campaignId: c.id })}
                >
                  Manage
                </Button>
              </div>
            ))}
          </div>
        </SectionCard>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 mb-5">
        <div className="lg:col-span-2">
          <ChartCard title="Spend by Platform" data={platformChart} type="bar" />
        </div>
        <SectionCard title="Performance Summary">
          <dl className="space-y-2.5 text-sm">
            <Row label="Total Budget" value={formatCurrencyFull(totals.totalBudget)} />
            <Row label="Total Spend" value={formatCurrencyFull(totals.totalSpend)} />
            <Row label="Budget Utilization" value={`${totals.totalBudget > 0 ? Math.round((totals.totalSpend / totals.totalBudget) * 100) : 0}%`} />
            <Row label="Avg CTR" value={`${totals.avgCtr}%`} />
            <Row label="Avg CPL" value={formatCurrencyFull(totals.avgCpl)} />
            <Row label="Total Leads" value={totals.totalLeads.toString()} />
          </dl>
        </SectionCard>
      </div>

      <FilterBar
        search={search}
        onSearchChange={setSearch}
        filters={FILTERS}
        activeFilters={activeFilters}
        onFilterChange={(k, v) => setActiveFilters((prev) => {
          const next = { ...prev };
          if (v) next[k] = v; else delete next[k];
          return next;
        })}
        onClear={() => setActiveFilters({})}
        searchPlaceholder="Search by campaign name, targeting, platform…"
      />

      {loading ? (
        <SectionCard>
          <LoadingState label="Loading campaigns…" />
        </SectionCard>
      ) : filtered.length === 0 ? (
        <SectionCard>
          <EmptyState
            icon={Megaphone}
            title="No campaigns found"
            description="Try adjusting filters or create a new campaign to get started."
            action={
              <Button onClick={() => navigate("campaign-builder")}>
                <Plus className="size-4" /> New Campaign
              </Button>
            }
          />
        </SectionCard>
      ) : (
        <SectionCard bodyClassName="p-0">
          <DataTable
            columns={columns}
            data={filtered}
            pageSize={15}
            emptyTitle="No campaigns"
          />
        </SectionCard>
      )}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="text-sm font-medium tabular-nums">{value}</dd>
    </div>
  );
}
