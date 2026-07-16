"use client";

import { useEffect, useMemo, useState } from "react";
import { useNav } from "@/components/admin/admin-app";
import {
  PageHeader, MetricCard, SectionCard, EmptyState, LoadingState, FilterBar, DataTable,
  StatusBadge, type Column,
} from "@/components/admin/shared";
import { Button } from "@/components/ui/button";
import {
  Megaphone, MousePointer, DollarSign, TrendingUp, Target, Activity, Pause, Play,
} from "lucide-react";
import { campaignService } from "@/services";
import type { Campaign } from "@/types";
import { formatCurrency, formatCurrencyFull, formatDate } from "@/lib/format";
import { toast } from "sonner";

const PLATFORM_LABEL: Record<string, string> = {
  google: "Google Ads",
  meta: "Meta Ads",
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

export function CampaignsView() {
  const { navigate, refreshKey } = useNav();
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [activeFilters, setActiveFilters] = useState<Record<string, string>>({});

  useEffect(() => {
    setLoading(true);
    campaignService
      .list()
      .then((d) => setCampaigns(d.campaigns))
      .catch(() => toast.error("Failed to load campaigns"))
      .finally(() => setLoading(false));
  }, [refreshKey]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return campaigns.filter((c) => {
      if (q && !`${c.name} ${c.platform} ${c.targeting ?? ""}`.toLowerCase().includes(q)) return false;
      if (activeFilters.status && c.status !== activeFilters.status) return false;
      if (activeFilters.platform && c.platform !== activeFilters.platform) return false;
      return true;
    });
  }, [campaigns, search, activeFilters]);

  const totalBudget = campaigns.reduce((s, c) => s + c.budget, 0);
  const totalSpent = campaigns.reduce((s, c) => s + c.spent, 0);
  const totalLeads = campaigns.reduce((s, c) => s + c.leads, 0);
  const totalImpressions = campaigns.reduce((s, c) => s + c.impressions, 0);
  const totalClicks = campaigns.reduce((s, c) => s + c.clicks, 0);
  const avgCpl = totalLeads > 0 ? totalSpent / totalLeads : 0;
  const overallCtr = totalImpressions > 0 ? (totalClicks / totalImpressions) * 100 : 0;
  const activeCount = campaigns.filter((c) => c.status === "active").length;

  const columns: Column<Campaign>[] = useMemo(() => [
    {
      key: "name",
      header: "Campaign",
      render: (c) => (
        <div className="min-w-0">
          <p className="font-medium truncate max-w-[220px]">{c.name}</p>
          <p className="text-xs text-muted-foreground truncate">{PLATFORM_LABEL[c.platform] ?? c.platform}{c.targeting ? ` · ${c.targeting}` : ""}</p>
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
      header: "Budget / Spent",
      render: (c) => (
        <div>
          <p className="font-medium tabular-nums">{formatCurrency(c.budget)}</p>
          <p className="text-xs text-muted-foreground tabular-nums">{formatCurrency(c.spent)} spent</p>
        </div>
      ),
      sortValue: (c) => c.budget,
    },
    {
      key: "impressions",
      header: "Impressions",
      render: (c) => <span className="tabular-nums">{c.impressions.toLocaleString()}</span>,
      sortValue: (c) => c.impressions,
      hideOnMobile: true,
    },
    {
      key: "clicks",
      header: "Clicks",
      render: (c) => <span className="tabular-nums">{c.clicks.toLocaleString()}</span>,
      sortValue: (c) => c.clicks,
      hideOnMobile: true,
    },
    {
      key: "ctr",
      header: "CTR",
      render: (c) => <span className="tabular-nums text-muted-foreground">{c.ctr.toFixed(1)}%</span>,
      sortValue: (c) => c.ctr,
      hideOnMobile: true,
    },
    {
      key: "leads",
      header: "Leads",
      render: (c) => <span className="tabular-nums font-medium">{c.leads}</span>,
      sortValue: (c) => c.leads,
    },
    {
      key: "cpl",
      header: "CPL",
      render: (c) => <span className="tabular-nums font-medium">{c.costPerLead > 0 ? formatCurrencyFull(c.costPerLead) : "—"}</span>,
      sortValue: (c) => c.costPerLead,
    },
    {
      key: "cvr",
      header: "CVR",
      render: (c) => <span className="tabular-nums text-muted-foreground">{c.conversionRate.toFixed(1)}%</span>,
      sortValue: (c) => c.conversionRate,
      hideOnMobile: true,
    },
  ], []);

  if (loading) return <LoadingState label="Loading campaigns…" />;

  return (
    <div>
      <PageHeader
        title="Outreach Campaigns"
        description="Performance metrics across all ad & email campaigns"
        action={
          <Button variant="outline" onClick={() => navigate("campaign-dashboard")}>
            <TrendingUp className="size-4" /> Dashboard
          </Button>
        }
      />

      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3 mb-5">
        <MetricCard label="Active Campaigns" value={activeCount} icon={Play} tone="green" hint={`${campaigns.length} total`} />
        <MetricCard label="Total Budget" value={formatCurrency(totalBudget)} icon={DollarSign} tone="teal" hint={`${formatCurrency(totalSpent)} spent`} />
        <MetricCard label="Total Leads" value={totalLeads} icon={Target} tone="violet" />
        <MetricCard label="Avg CPL" value={formatCurrencyFull(avgCpl)} icon={Activity} tone="amber" hint="Cost per lead" />
        <MetricCard label="Impressions" value={totalImpressions.toLocaleString()} icon={Megaphone} tone="teal" />
        <MetricCard label="Avg CTR" value={`${overallCtr.toFixed(1)}%`} icon={MousePointer} tone="violet" />
      </div>

      <FilterBar
        search={search}
        onSearchChange={setSearch}
        filters={[
          {
            key: "status", label: "Status", options: [
              { value: "active", label: "Active" },
              { value: "paused", label: "Paused" },
              { value: "ended", label: "Ended" },
              { value: "draft", label: "Draft" },
              { value: "review", label: "Review" },
            ],
          },
          {
            key: "platform", label: "Platform", options: Object.entries(PLATFORM_LABEL).map(([value, label]) => ({ value, label })),
          },
        ]}
        activeFilters={activeFilters}
        onFilterChange={(k, v) => setActiveFilters((prev) => {
          const next = { ...prev };
          if (v) next[k] = v; else delete next[k];
          return next;
        })}
        onClear={() => setActiveFilters({})}
        searchPlaceholder="Search campaigns by name, platform, targeting…"
      />

      {filtered.length === 0 ? (
        <SectionCard>
          <EmptyState
            icon={Megaphone}
            title="No campaigns match"
            description="Adjust filters or create a new campaign."
            action={<Button onClick={() => navigate("campaign-builder")}>Build campaign</Button>}
          />
        </SectionCard>
      ) : (
        <SectionCard bodyClassName="p-0">
          <DataTable
            columns={columns}
            data={filtered}
            onRowClick={() => navigate("campaign-dashboard")}
            pageSize={25}
          />
        </SectionCard>
      )}
    </div>
  );
}
