"use client";

import { useEffect, useMemo, useState } from "react";
import { automationService } from "@/services";
import type { AIUsageRecord } from "@/types";
import {
  PageHeader, MetricCard, ChartCard, LoadingState, EmptyState, SectionCard,
  DataTable,
} from "@/components/admin/shared/index";
import {
  DollarSign, Cpu, Zap, TrendingUp, Activity, Brain, Sparkles,
} from "lucide-react";
import { formatDate } from "@/lib/format";

const MODEL_COLOR: Record<string, string> = {
  "gpt-4o": "#a78bfa",
  "gpt-4o-mini": "#14b8a6",
  "text-embedding-3": "#f59e0b",
};

const FEATURE_COLOR: Record<string, string> = {
  article_generation: "#a78bfa",
  lead_scoring: "#f59e0b",
  call_transcript: "#14b8a6",
  clinic_research: "#10b981",
};

export function AiCostTrackingView() {
  const [data, setData] = useState<AIUsageRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    automationService.listAIUsage()
      .then((d) => setData(d.records))
      .finally(() => setLoading(false));
  }, []);

  const totalCost = useMemo(() => data.reduce((s, r) => s + r.cost, 0), [data]);
  const totalTokens = useMemo(() => data.reduce((s, r) => s + r.promptTokens + r.completionTokens, 0), [data]);
  const totalRequests = data.length;

  const costByDay = useMemo(() => {
    const map = new Map<string, number>();
    data.forEach((r) => {
      const key = new Date(r.timestamp).toISOString().slice(0, 10);
      map.set(key, (map.get(key) ?? 0) + r.cost);
    });
    return Array.from(map.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([date, value]) => ({
        label: new Date(date).toLocaleDateString("en-US", { month: "numeric", day: "numeric" }),
        value: Math.round(value * 1000) / 1000,
        color: "#14b8a6",
      }));
  }, [data]);

  const costByModel = useMemo(() => {
    const map = new Map<string, number>();
    data.forEach((r) => {
      map.set(r.model, (map.get(r.model) ?? 0) + r.cost);
    });
    return Array.from(map.entries())
      .map(([label, value]) => ({
        label,
        value: Math.round(value * 1000) / 1000,
        color: MODEL_COLOR[label] ?? "#94a3b8",
      }))
      .sort((a, b) => b.value - a.value);
  }, [data]);

  const costByFeature = useMemo(() => {
    const map = new Map<string, number>();
    data.forEach((r) => {
      map.set(r.feature, (map.get(r.feature) ?? 0) + r.cost);
    });
    return Array.from(map.entries())
      .map(([label, value]) => ({
        label: label.replace(/_/g, " "),
        value: Math.round(value * 1000) / 1000,
        color: FEATURE_COLOR[label] ?? "#94a3b8",
      }))
      .sort((a, b) => b.value - a.value);
  }, [data]);

  const aggregated = useMemo(() => {
    const map = new Map<string, { model: string; feature: string; requests: number; promptTokens: number; completionTokens: number; cost: number; lastUsed: string }>();
    data.forEach((r) => {
      const key = `${r.model}|${r.feature}`;
      const cur = map.get(key) ?? {
        model: r.model,
        feature: r.feature,
        requests: 0,
        promptTokens: 0,
        completionTokens: 0,
        cost: 0,
        lastUsed: r.timestamp,
      };
      cur.requests += 1;
      cur.promptTokens += r.promptTokens;
      cur.completionTokens += r.completionTokens;
      cur.cost += r.cost;
      if (new Date(r.timestamp) > new Date(cur.lastUsed)) cur.lastUsed = r.timestamp;
      map.set(key, cur);
    });
    return Array.from(map.values())
      .map((r) => ({ id: `${r.model}-${r.feature}`, ...r }))
      .sort((a, b) => b.cost - a.cost);
  }, [data]);

  if (loading) return <LoadingState label="Loading AI cost tracking…" />;

  const avgCostPerRequest = totalRequests > 0 ? (totalCost / totalRequests) : 0;
  const projectedMonthly = totalCost * (30 / Math.max(1, costByDay.length));

  return (
    <div>
      <PageHeader
        title="AI Cost Tracking"
        description="Usage and spend across AI models and features"
      />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <MetricCard label="Total Cost (30d)" value={`$${totalCost.toFixed(2)}`} icon={DollarSign} tone="teal" trend={8} />
        <MetricCard label="Total Tokens" value={totalTokens.toLocaleString()} icon={Activity} tone="violet" hint="Prompt + completion" />
        <MetricCard label="API Requests" value={totalRequests} icon={Zap} tone="amber" />
        <MetricCard label="Projected Monthly" value={`$${projectedMonthly.toFixed(2)}`} icon={TrendingUp} tone="green" hint="At current rate" />
      </div>

      <ChartCard
        title="Daily Cost (Last 30 Days)"
        data={costByDay}
        type="line"
        className="mb-4"
      />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
        <ChartCard
          title="Cost by Model"
          data={costByModel}
          type="bar"
        />
        <ChartCard
          title="Cost by Feature"
          data={costByFeature}
          type="bar"
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
        <SectionCard title="Avg Cost / Request">
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-semibold tabular-nums">${avgCostPerRequest.toFixed(4)}</span>
            <span className="text-xs text-muted-foreground">per call</span>
          </div>
        </SectionCard>
        <SectionCard title="Avg Tokens / Request">
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-semibold tabular-nums">{totalRequests > 0 ? Math.round(totalTokens / totalRequests).toLocaleString() : 0}</span>
            <span className="text-xs text-muted-foreground">tokens</span>
          </div>
        </SectionCard>
        <SectionCard title="Most Used Model">
          <div className="flex items-center gap-2">
            <Cpu className="size-5 text-violet-600" />
            <span className="text-lg font-semibold">{costByModel[0]?.label ?? "—"}</span>
          </div>
          {costByModel[0] && (
            <div className="text-xs text-muted-foreground mt-1">
              ${costByModel[0].value.toFixed(2)} spent
            </div>
          )}
        </SectionCard>
      </div>

      <SectionCard
        title="Usage Breakdown"
        description="Cost and token usage by model and feature"
        bodyClassName="p-0"
      >
        {aggregated.length === 0 ? (
          <EmptyState icon={Brain} title="No AI usage recorded" description="Usage will appear here once AI features are used." />
        ) : (
          <DataTable
            data={aggregated}
            emptyTitle="No usage data"
            columns={[
              {
                key: "model",
                header: "Model",
                sortValue: (r) => r.model,
                render: (r) => (
                  <div className="flex items-center gap-2">
                    <div
                      className="size-2 rounded-full"
                      style={{ backgroundColor: MODEL_COLOR[r.model] ?? "#94a3b8" }}
                    />
                    <span className="font-mono text-sm">{r.model}</span>
                  </div>
                ),
              },
              {
                key: "feature",
                header: "Feature",
                sortValue: (r) => r.feature,
                render: (r) => <span className="text-sm capitalize">{r.feature.replace(/_/g, " ")}</span>,
              },
              {
                key: "requests",
                header: "Requests",
                sortValue: (r) => r.requests,
                render: (r) => <span className="text-sm tabular-nums">{r.requests}</span>,
              },
              {
                key: "promptTokens",
                header: "Prompt Tokens",
                hideOnMobile: true,
                sortValue: (r) => r.promptTokens,
                render: (r) => <span className="text-xs text-muted-foreground tabular-nums">{r.promptTokens.toLocaleString()}</span>,
              },
              {
                key: "completionTokens",
                header: "Completion Tokens",
                hideOnMobile: true,
                sortValue: (r) => r.completionTokens,
                render: (r) => <span className="text-xs text-muted-foreground tabular-nums">{r.completionTokens.toLocaleString()}</span>,
              },
              {
                key: "totalTokens",
                header: "Total Tokens",
                hideOnMobile: true,
                sortValue: (r) => r.promptTokens + r.completionTokens,
                render: (r) => <span className="text-sm tabular-nums">{(r.promptTokens + r.completionTokens).toLocaleString()}</span>,
              },
              {
                key: "cost",
                header: "Cost",
                sortValue: (r) => r.cost,
                render: (r) => <span className="text-sm font-semibold tabular-nums">${r.cost.toFixed(4)}</span>,
              },
              {
                key: "lastUsed",
                header: "Last Used",
                hideOnMobile: true,
                sortValue: (r) => new Date(r.lastUsed).getTime(),
                render: (r) => <span className="text-xs text-muted-foreground">{formatDate(r.lastUsed)}</span>,
              },
            ]}
          />
        )}
      </SectionCard>

      <SectionCard
        title="Cost Optimization Tips"
        className="mt-4"
      >
        <div className="space-y-2 text-sm">
          <div className="flex items-start gap-2">
            <Sparkles className="size-4 text-teal-600 mt-0.5 shrink-0" />
            <span><span className="font-medium">Switch article drafts to gpt-4o-mini</span> — saves ~70% per call with minimal quality loss for first drafts.</span>
          </div>
          <div className="flex items-start gap-2">
            <Sparkles className="size-4 text-teal-600 mt-0.5 shrink-0" />
            <span><span className="font-medium">Cache clinic research results</span> — repeated lookups for the same clinic currently account for ~22% of clinic_research cost.</span>
          </div>
          <div className="flex items-start gap-2">
            <Sparkles className="size-4 text-teal-600 mt-0.5 shrink-0" />
            <span><span className="font-medium">Batch lead scoring</span> — scoring in batches of 10 vs. individual scoring could reduce per-lead cost by 35%.</span>
          </div>
        </div>
      </SectionCard>
    </div>
  );
}
