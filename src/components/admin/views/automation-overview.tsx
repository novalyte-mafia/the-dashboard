"use client";

import { useEffect, useMemo, useState } from "react";
import { useNav } from "@/components/admin/admin-app";
import { automationService } from "@/services";
import type { Automation } from "@/types";
import {
  PageHeader, MetricCard, SectionCard, LoadingState, EmptyState,
  StatusBadge,
} from "@/components/admin/shared/index";
import { Button } from "@/components/ui/button";
import {
  Zap, Activity, CheckCircle2, AlertTriangle, Play, Pause, ArrowRight, Clock,
} from "lucide-react";
import { relativeTime } from "@/lib/format";
import { toast } from "sonner";

const STATUS_COLOR: Record<string, string> = {
  active: "green", paused: "slate", error: "rose", draft: "amber",
};

export function AutomationOverviewView() {
  const { navigate, refreshKey } = useNav();
  const [data, setData] = useState<Automation[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    automationService.list()
      .then((d) => setData(d.automations))
      .finally(() => setLoading(false));
  }, [refreshKey]);

  const failedAutomations = useMemo(() => data.filter((a) => a.status === "error" || a.failureCount > 0), [data]);

  const recentRuns = useMemo(() => {
    return [...data]
      .filter((a) => a.lastRunAt)
      .sort((a, b) => new Date(b.lastRunAt!).getTime() - new Date(a.lastRunAt!).getTime())
      .slice(0, 8);
  }, [data]);

  if (loading) return <LoadingState label="Loading automation overview…" />;

  const active = data.filter((a) => a.status === "active").length;
  const totalRunsToday = data.reduce((s, a) => s + a.runCount, 0);
  const totalFailures = data.reduce((s, a) => s + a.failureCount, 0);
  const successRate = totalRunsToday > 0 ? Math.round(((totalRunsToday - totalFailures) / totalRunsToday) * 100) : 100;

  return (
    <div>
      <PageHeader
        title="Automation & AI"
        description="Workflows, AI assistants, and intelligent pipelines"
        action={
          <Button onClick={() => navigate("automations")}>
            <Zap className="size-4" /> Manage Automations
          </Button>
        }
      />

      {failedAutomations.length > 0 && (
        <div className="mb-6 p-4 rounded-lg border border-rose-200 bg-rose-50">
          <div className="flex items-start gap-3">
            <AlertTriangle className="size-5 text-rose-600 mt-0.5 shrink-0" />
            <div className="flex-1 min-w-0">
              <h3 className="text-sm font-semibold text-rose-900">
                {failedAutomations.length} automation{failedAutomations.length > 1 ? "s" : ""} need attention
              </h3>
              <p className="text-xs text-rose-700 mt-1">
                Recent failures detected. Review error details and retry failed runs.
              </p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {failedAutomations.map((a) => (
                  <button
                    key={a.id}
                    onClick={() => navigate("failed-jobs")}
                    className="text-xs font-medium px-2 py-1 rounded-md bg-white border border-rose-200 hover:bg-rose-100 transition-colors"
                  >
                    {a.name} ({a.failureCount})
                  </button>
                ))}
              </div>
            </div>
            <Button size="sm" variant="outline" className="border-rose-300 text-rose-700 hover:bg-rose-100 shrink-0" onClick={() => navigate("failed-jobs")}>
              Review <ArrowRight className="size-3.5" />
            </Button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <MetricCard label="Active Automations" value={active} icon={Zap} tone="green" onClick={() => navigate("automations")} />
        <MetricCard label="Total Runs" value={totalRunsToday.toLocaleString()} icon={Activity} tone="teal" hint="All-time" />
        <MetricCard label="Success Rate" value={`${successRate}%`} icon={CheckCircle2} tone={successRate >= 95 ? "green" : "amber"} />
        <MetricCard label="Failed Runs" value={totalFailures} icon={AlertTriangle} tone="rose" onClick={() => navigate("failed-jobs")} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <SectionCard
          title="Recent Runs"
          description="Latest automation activity"
          className="lg:col-span-2"
          bodyClassName="p-0"
          action={
            <Button variant="ghost" size="sm" onClick={() => navigate("automations")}>
              View all <ArrowRight className="size-3.5" />
            </Button>
          }
        >
          {recentRuns.length === 0 ? (
            <EmptyState title="No runs yet" description="Automations will appear here once triggered." />
          ) : (
            <div className="divide-y divide-border/60">
              {recentRuns.map((a) => (
                <button
                  key={a.id}
                  onClick={() => navigate("automations")}
                  className="w-full px-4 py-3 hover:bg-accent/40 transition-colors text-left flex items-center justify-between gap-3"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className={`size-8 rounded-md flex items-center justify-center shrink-0 ${
                      a.status === "active" ? "bg-emerald-50 text-emerald-600"
                      : a.status === "error" ? "bg-rose-50 text-rose-600"
                      : a.status === "paused" ? "bg-slate-50 text-slate-600"
                      : "bg-amber-50 text-amber-600"
                    }`}>
                      {a.status === "active" ? <Play className="size-3.5" /> : a.status === "paused" ? <Pause className="size-3.5" /> : <AlertTriangle className="size-3.5" />}
                    </div>
                    <div className="min-w-0">
                      <div className="text-sm font-medium truncate">{a.name}</div>
                      <div className="text-xs text-muted-foreground truncate">
                        Trigger: <code className="text-[10px] bg-muted px-1 py-0.5 rounded">{a.trigger}</code>
                      </div>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="text-xs text-muted-foreground inline-flex items-center gap-1">
                      <Clock className="size-3" />
                      {relativeTime(a.lastRunAt)}
                    </div>
                    <div className="text-xs tabular-nums mt-0.5">
                      <span className="text-emerald-700">{a.runCount}</span>
                      {a.failureCount > 0 && <span className="text-rose-600 ml-1.5">· {a.failureCount} fail</span>}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </SectionCard>

        <SectionCard
          title="AI Capabilities"
          description="Available AI assistants"
          bodyClassName="p-0"
          action={
            <Button variant="ghost" size="sm" onClick={() => navigate("ai-assistants")}>
              All <ArrowRight className="size-3.5" />
            </Button>
          }
        >
          <div className="divide-y divide-border/60">
            <AiCapabilityRow name="Call Copilot" desc="Realtime call coaching" status="active" onClick={() => navigate("ai-assistants")} />
            <AiCapabilityRow name="Content Generator" desc="Article drafting & SEO" status="active" onClick={() => navigate("ai-assistants")} />
            <AiCapabilityRow name="Lead Scorer" desc="Patient lead qualification" status="active" onClick={() => navigate("lead-scoring")} />
            <AiCapabilityRow name="Clinic Researcher" desc="Pre-call intelligence" status="active" onClick={() => navigate("ai-assistants")} />
          </div>
        </SectionCard>
      </div>

      <SectionCard
        title="Quick Actions"
        className="mt-4"
      >
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          <Button variant="outline" size="sm" onClick={() => navigate("automations")}>Manage Workflows</Button>
          <Button variant="outline" size="sm" onClick={() => navigate("ai-assistants")}>AI Assistants</Button>
          <Button variant="outline" size="sm" onClick={() => navigate("call-intelligence")}>Call Intelligence</Button>
          <Button variant="outline" size="sm" onClick={() => navigate("ai-cost-tracking")}>Cost Tracking</Button>
          <Button variant="outline" size="sm" onClick={() => navigate("lead-scoring")}>Lead Scoring</Button>
          <Button variant="outline" size="sm" onClick={() => navigate("failed-jobs")}>Failed Jobs</Button>
          <Button variant="outline" size="sm" onClick={() => toast.info("Workflow builder coming soon.")}>New Workflow</Button>
          <Button variant="outline" size="sm" onClick={() => toast.info("Run history opening.")}>Run History</Button>
        </div>
      </SectionCard>
    </div>
  );
}

function AiCapabilityRow({ name, desc, status, onClick }: { name: string; desc: string; status: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="w-full px-4 py-2.5 hover:bg-accent/40 transition-colors text-left flex items-center justify-between gap-3"
    >
      <div className="min-w-0">
        <div className="text-sm font-medium truncate">{name}</div>
        <div className="text-xs text-muted-foreground truncate">{desc}</div>
      </div>
      <StatusBadge label={status} color="green" className="shrink-0" />
    </button>
  );
}
