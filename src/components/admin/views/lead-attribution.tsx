"use client";

import * as React from "react";
import { useEffect, useMemo, useState } from "react";
import { useNav } from "@/components/admin/admin-app";
import {
  PageHeader, MetricCard, LoadingState, EmptyState, SectionCard,
  ScoreBadge, ChartCard, DataTable, type Column,
} from "@/components/admin/shared";
import { Users, Filter, TrendingUp, Target, GitBranch } from "lucide-react";
import { patientService } from "@/services";
import type { PatientLead } from "@/types";

const SOURCE_LABEL: Record<string, string> = {
  google_ads: "Google Ads",
  organic_search: "Organic Search",
  directory: "Directory",
  referral: "Referral",
  facebook: "Facebook",
  direct: "Direct",
};

const SOURCE_COLOR: Record<string, string> = {
  google_ads: "#0d9488",
  organic_search: "#14b8a6",
  directory: "#8b5cf6",
  referral: "#f59e0b",
  facebook: "#3b82f6",
  direct: "#64748b",
};

interface SourceRow {
  id: string;
  source: string;
  sourceLabel: string;
  leads: number;
  qualified: number;
  contacted: number;
  routed: number;
  booked: number;
  conversionRate: number;
  qualificationRate: number;
}

export function LeadAttributionView() {
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

  const rows = useMemo<SourceRow[]>(() => {
    const sources = Array.from(new Set(leads.map((l) => l.leadSource)));
    return sources
      .map((source) => {
        const sourceLeads = leads.filter((l) => l.leadSource === source);
        const totalLeads = sourceLeads.length;
        const qualified = sourceLeads.filter((l) =>
          ["qualified", "contacted", "routed", "booked"].includes(l.status),
        ).length;
        const contacted = sourceLeads.filter((l) =>
          ["contacted", "routed", "booked"].includes(l.status),
        ).length;
        const routed = sourceLeads.filter((l) => ["routed", "booked"].includes(l.status)).length;
        const booked = sourceLeads.filter((l) => l.status === "booked").length;
        return {
          id: source,
          source,
          sourceLabel: SOURCE_LABEL[source] ?? source,
          leads: totalLeads,
          qualified,
          contacted,
          routed,
          booked,
          conversionRate: totalLeads > 0 ? Math.round((booked / totalLeads) * 100) : 0,
          qualificationRate: totalLeads > 0 ? Math.round((qualified / totalLeads) * 100) : 0,
        };
      })
      .sort((a, b) => b.leads - a.leads);
  }, [leads]);

  const totals = useMemo(() => {
    const totalLeads = leads.length;
    const totalQualified = leads.filter((l) =>
      ["qualified", "contacted", "routed", "booked"].includes(l.status),
    ).length;
    const totalBooked = leads.filter((l) => l.status === "booked").length;
    const avgQual = totalLeads > 0 ? Math.round((totalQualified / totalLeads) * 100) : 0;
    const avgConv = totalLeads > 0 ? Math.round((totalBooked / totalLeads) * 100) : 0;
    const topSource = rows[0];
    return { totalLeads, totalQualified, totalBooked, avgQual, avgConv, topSource };
  }, [leads, rows]);

  const chartData = rows.map((r) => ({
    label: r.sourceLabel,
    value: r.leads,
    color: SOURCE_COLOR[r.source] ?? "#0d9488",
  }));

  const qualifiedChart = rows.map((r) => ({
    label: r.sourceLabel,
    value: r.qualified,
    color: SOURCE_COLOR[r.source] ?? "#14b8a6",
  }));

  const columns: Column<SourceRow>[] = [
    {
      key: "source",
      header: "Lead Source",
      render: (r) => (
        <div className="min-w-0 flex items-center gap-2">
          <span className="size-2.5 rounded-sm shrink-0" style={{ backgroundColor: SOURCE_COLOR[r.source] ?? "#0d9488" }} />
          <div className="min-w-0">
            <div className="font-medium truncate">{r.sourceLabel}</div>
            <div className="text-xs text-muted-foreground truncate">{r.source}</div>
          </div>
        </div>
      ),
      sortValue: (r) => r.sourceLabel,
    },
    {
      key: "leads",
      header: "Leads",
      render: (r) => <span className="tabular-nums text-sm font-medium">{r.leads}</span>,
      sortValue: (r) => r.leads,
    },
    {
      key: "qualified",
      header: "Qualified",
      render: (r) => <span className="tabular-nums text-sm">{r.qualified}</span>,
      sortValue: (r) => r.qualified,
      hideOnMobile: true,
    },
    {
      key: "routed",
      header: "Routed",
      render: (r) => <span className="tabular-nums text-sm">{r.routed}</span>,
      sortValue: (r) => r.routed,
      hideOnMobile: true,
    },
    {
      key: "booked",
      header: "Booked",
      render: (r) => <span className="tabular-nums text-sm font-medium text-emerald-600">{r.booked}</span>,
      sortValue: (r) => r.booked,
    },
    {
      key: "qualRate",
      header: "Qual Rate",
      render: (r) => <ScoreBadge score={r.qualificationRate} />,
      sortValue: (r) => r.qualificationRate,
      hideOnMobile: true,
    },
    {
      key: "convRate",
      header: "Conv Rate",
      render: (r) => (
        <span className={"tabular-nums text-sm font-medium " + (r.conversionRate >= 30 ? "text-emerald-600" : r.conversionRate >= 15 ? "text-amber-600" : "text-rose-600")}>
          {r.conversionRate}%
        </span>
      ),
      sortValue: (r) => r.conversionRate,
    },
  ];

  return (
    <div>
      <PageHeader
        title="Lead Attribution"
        description="Lead source performance — from initial capture through booking"
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
        <MetricCard label="Total Leads" value={totals.totalLeads} icon={Users} tone="teal" hint="Across all sources" />
        <MetricCard label="Qualified" value={totals.totalQualified} icon={Filter} tone="amber" hint={`${totals.avgQual}% of total`} />
        <MetricCard label="Booked" value={totals.totalBooked} icon={Target} tone="green" hint={`${totals.avgConv}% overall conv`} />
        <MetricCard label="Top Source" value={totals.topSource?.sourceLabel ?? "—"} icon={TrendingUp} tone="violet" hint={totals.topSource ? `${totals.topSource.leads} leads` : ""} />
      </div>

      {loading ? (
        <SectionCard>
          <LoadingState label="Loading attribution data…" />
        </SectionCard>
      ) : leads.length === 0 ? (
        <SectionCard>
          <EmptyState title="No leads to attribute" description="Attribution will populate once leads enter the system." />
        </SectionCard>
      ) : (
        <>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 mb-5">
            <ChartCard title="Leads by Source" data={chartData} type="bar" />
            <ChartCard title="Qualified Leads by Source" data={qualifiedChart} type="bar" />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 mb-5">
            {rows.slice(0, 3).map((r) => (
              <SectionCard
                key={r.id}
                title={r.sourceLabel}
                description={`${r.leads} total leads · ${r.conversionRate}% conv rate`}
              >
                <div className="space-y-2 text-sm">
                  <StageRow label="Leads" value={r.leads} total={r.leads} color="#0d9488" />
                  <StageRow label="Qualified" value={r.qualified} total={r.leads} color="#14b8a6" />
                  <StageRow label="Contacted" value={r.contacted} total={r.leads} color="#8b5cf6" />
                  <StageRow label="Routed" value={r.routed} total={r.leads} color="#f59e0b" />
                  <StageRow label="Booked" value={r.booked} total={r.leads} color="#10b981" />
                </div>
              </SectionCard>
            ))}
          </div>

          <SectionCard
            title="Attribution by Source"
            description="Lead volume and conversion through each stage of the funnel"
            bodyClassName="p-0"
          >
            <DataTable
              columns={columns}
              data={rows}
              pageSize={15}
              emptyTitle="No attribution data"
            />
          </SectionCard>

          <div className="mt-5">
            <SectionCard title="Insights" description="Auto-generated observations from attribution data">
              <ul className="space-y-2 text-sm">
                {totals.topSource && (
                  <Insight icon={TrendingUp} tone="text-emerald-600">
                    <strong>{totals.topSource.sourceLabel}</strong> is the top-performing source by volume ({totals.topSource.leads} leads).
                  </Insight>
                )}
                {rows.find((r) => r.conversionRate === Math.max(...rows.map((x) => x.conversionRate)) && r.leads >= 2) && (
                  <Insight icon={Target} tone="text-teal-600">
                    <strong>
                      {rows.find((r) => r.conversionRate === Math.max(...rows.map((x) => x.conversionRate)) && r.leads >= 2)?.sourceLabel}
                    </strong>{" "}
                    has the highest conversion rate (
                    {rows.find((r) => r.conversionRate === Math.max(...rows.map((x) => x.conversionRate)) && r.leads >= 2)?.conversionRate}%).
                  </Insight>
                )}
                {rows.find((r) => r.qualificationRate < totals.avgQual && r.leads >= 3) && (
                  <Insight icon={GitBranch} tone="text-amber-600">
                    <strong>{rows.find((r) => r.qualificationRate < totals.avgQual && r.leads >= 3)?.sourceLabel}</strong> is underperforming on qualification ({rows.find((r) => r.qualificationRate < totals.avgQual && r.leads >= 3)?.qualificationRate}% vs {totals.avgQual}% avg).
                  </Insight>
                )}
              </ul>
            </SectionCard>
          </div>
        </>
      )}
    </div>
  );
}

function StageRow({ label, value, total, color }: { label: string; value: number; total: number; color: string }) {
  const pct = total > 0 ? Math.round((value / total) * 100) : 0;
  return (
    <div>
      <div className="flex items-center justify-between text-xs mb-1">
        <span className="text-muted-foreground">{label}</span>
        <span className="tabular-nums">
          <span className="font-medium">{value}</span>
          <span className="text-muted-foreground"> · {pct}%</span>
        </span>
      </div>
      <div className="h-1.5 rounded-full bg-muted overflow-hidden">
        <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: color }} />
      </div>
    </div>
  );
}

function Insight({ icon: Icon, tone, children }: { icon: any; tone: string; children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-2">
      <Icon className={"size-4 mt-0.5 shrink-0 " + tone} />
      <span>{children}</span>
    </li>
  );
}
