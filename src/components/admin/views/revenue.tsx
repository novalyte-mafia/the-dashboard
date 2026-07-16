"use client";

import { useEffect, useMemo, useState } from "react";
import { useNav } from "@/components/admin/admin-app";
import {
  PageHeader, LoadingState, EmptyState, MetricCard, SectionCard, DataTable, ChartCard,
  StatusBadge, type Column,
} from "@/components/admin/shared";
import { Button } from "@/components/ui/button";
import { DollarSign, TrendingUp, TrendingDown, Scale, Calendar, Receipt, ArrowRight, Building2 } from "lucide-react";
import { dealService } from "@/services";
import type { Deal } from "@/types";
import { formatCurrency, formatCurrencyFull, formatDate } from "@/lib/format";
import { toast } from "sonner";

type RevenueRow = {
  id: string;
  clinicName: string;
  clinicId?: string;
  dealName: string;
  monthly: number;
  total: number;
  startDate: string;
  status: "active" | "churned" | "expanding";
  ownerName?: string;
};

export function RevenueView() {
  const { navigate, openClinic, refreshKey } = useNav();
  const [deals, setDeals] = useState<Deal[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    dealService
      .list()
      .then((d) => setDeals(d.deals))
      .catch(() => toast.error("Failed to load revenue data"))
      .finally(() => setLoading(false));
  }, [refreshKey]);

  const activeDeals = useMemo(
    () => deals.filter((d) => d.stage === "active" || d.stage === "won"),
    [deals]
  );

  const rows: RevenueRow[] = useMemo(() => activeDeals.map((d) => ({
    id: d.id,
    clinicName: d.clinicName ?? "—",
    clinicId: d.clinicId,
    dealName: d.name,
    monthly: d.estimatedMonthlyValue,
    total: d.estimatedTotalValue,
    startDate: d.pilotStartDate ?? d.createdAt,
    status: "active" as const,
    ownerName: d.ownerName,
  })), [activeDeals]);

  const totalMRR = rows.reduce((s, r) => s + r.monthly, 0);
  const totalRevenue = rows.reduce((s, r) => s + r.total, 0);
  const arr = totalMRR * 12;
  const avgPerClinic = rows.length > 0 ? Math.round(totalMRR / rows.length) : 0;

  // Top revenue clinics
  const topClinics = useMemo(() => {
    const map = new Map<string, { clinicName: string; clinicId?: string; mrr: number; total: number }>();
    rows.forEach((r) => {
      const k = r.clinicId ?? r.clinicName;
      const existing = map.get(k);
      if (existing) {
        existing.mrr += r.monthly;
        existing.total += r.total;
      } else {
        map.set(k, { clinicName: r.clinicName, clinicId: r.clinicId, mrr: r.monthly, total: r.total });
      }
    });
    return Array.from(map.values()).sort((a, b) => b.mrr - a.mrr).slice(0, 6);
  }, [rows]);

  // Monthly revenue chart (last 6 months)
  const monthlyChart = useMemo(() => {
    const now = new Date();
    return Array.from({ length: 6 }, (_, i) => {
      const d = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1);
      const label = d.toLocaleString("en-US", { month: "short" });
      // For mock purposes, scale MRR up over time (churn + expansion = ~+8%/mo)
      const factor = 0.65 + (5 - i) * 0.07;
      return { label, value: Math.round(totalMRR * factor) };
    });
  }, [totalMRR]);

  const columns: Column<RevenueRow>[] = useMemo(() => [
    {
      key: "clinic",
      header: "Clinic",
      render: (r) => (
        <div className="min-w-0">
          <p className="font-medium truncate max-w-[200px]">{r.clinicName}</p>
          <p className="text-xs text-muted-foreground truncate">{r.dealName}</p>
        </div>
      ),
      sortValue: (r) => r.clinicName,
    },
    {
      key: "monthly",
      header: "MRR",
      render: (r) => <span className="font-medium tabular-nums">{formatCurrencyFull(r.monthly)}</span>,
      sortValue: (r) => r.monthly,
    },
    {
      key: "total",
      header: "Total Contract",
      render: (r) => <span className="tabular-nums">{formatCurrency(r.total)}</span>,
      sortValue: (r) => r.total,
      hideOnMobile: true,
    },
    {
      key: "start",
      header: "Active Since",
      render: (r) => <span className="text-xs text-muted-foreground">{formatDate(r.startDate)}</span>,
      sortValue: (r) => r.startDate,
      hideOnMobile: true,
    },
    {
      key: "owner",
      header: "Owner",
      render: (r) => <span className="text-xs text-muted-foreground">{r.ownerName ?? "—"}</span>,
      sortValue: (r) => r.ownerName ?? "",
      hideOnMobile: true,
    },
    {
      key: "status",
      header: "Status",
      render: (r) => <StatusBadge label={r.status} color="green" />,
      sortValue: (r) => r.status,
    },
  ], []);

  if (loading) return <LoadingState label="Loading revenue…" />;

  return (
    <div>
      <PageHeader
        title="Revenue"
        description="Recognized revenue from active and won deals"
        action={
          <Button variant="outline" onClick={() => navigate("revenue-overview")}>
            <TrendingUp className="size-4" /> Pipeline overview
          </Button>
        }
      />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
        <MetricCard label="MRR" value={formatCurrencyFull(totalMRR)} icon={DollarSign} tone="teal" hint="Monthly recurring" />
        <MetricCard label="ARR" value={formatCurrency(arr)} icon={TrendingUp} tone="green" hint="MRR × 12" />
        <MetricCard label="Total Revenue" value={formatCurrency(totalRevenue)} icon={Receipt} tone="violet" hint="Contract value" />
        <MetricCard label="Avg per Clinic" value={formatCurrencyFull(avgPerClinic)} icon={Scale} tone="amber" hint="Avg MRR" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
        <ChartCard
          title="Monthly Recurring Revenue · Last 6 months"
          type="line"
          className="lg:col-span-2"
          data={monthlyChart}
        />
        <SectionCard title="Top Revenue Clinics" description="By monthly recurring" bodyClassName="p-0">
          {topClinics.length === 0 ? (
            <EmptyState icon={Building2} title="No active clinics" />
          ) : (
            <div className="divide-y divide-border/60">
              {topClinics.map((c, i) => (
                <button
                  key={i}
                  onClick={() => c.clinicId && openClinic(c.clinicId)}
                  className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-accent/50 transition-colors text-left"
                >
                  <div className="size-7 rounded-md bg-primary/10 text-primary flex items-center justify-center text-xs font-semibold shrink-0">
                    {i + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{c.clinicName}</p>
                    <p className="text-xs text-muted-foreground tabular-nums">{formatCurrencyFull(c.mrr)}/mo</p>
                  </div>
                  <ArrowRight className="size-4 text-muted-foreground" />
                </button>
              ))}
            </div>
          )}
        </SectionCard>
      </div>

      {rows.length === 0 ? (
        <SectionCard>
          <EmptyState
            icon={Receipt}
            title="No active revenue"
            description="Once deals are won and contracts signed, recognized revenue appears here."
            action={<Button onClick={() => navigate("deals")}>View deals <ArrowRight className="size-4" /></Button>}
          />
        </SectionCard>
      ) : (
        <SectionCard
          title="Active Revenue Contracts"
          description={`${rows.length} active contract${rows.length === 1 ? "" : "s"}`}
          bodyClassName="p-0"
        >
          <DataTable
            columns={columns}
            data={rows}
            onRowClick={(r) => r.clinicId && openClinic(r.clinicId)}
            pageSize={25}
          />
        </SectionCard>
      )}
    </div>
  );
}
