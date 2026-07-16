"use client";

import { useEffect, useMemo, useState } from "react";
import { automationService } from "@/services";
import type { Automation } from "@/types";
import {
  PageHeader, MetricCard, DataTable, FilterBar, LoadingState, EmptyState,
  StatusBadge, SectionCard,
} from "@/components/admin/shared/index";
import { Button } from "@/components/ui/button";
import {
  AlertTriangle, RefreshCw, Bug, Clock, Activity, XCircle, ChevronDown, ChevronRight,
} from "lucide-react";
import { formatDateTime, relativeTime } from "@/lib/format";
import { toast } from "sonner";

const STATUS_COLOR: Record<string, string> = {
  active: "green", paused: "slate", error: "rose", draft: "amber",
};

// Mock error details for automations with failures
const ERROR_DETAILS: Record<string, { error: string; stack: string; firstFailedAt: string; lastFailedAt: string; failedRuns: number }> = {
  auto_5: {
    error: "OpenAI API timeout after 30000ms",
    stack: "Error: Request timed out\n    at OpenAI.generate (/var/task/automation.js:42:11)\n    at async runAutomation (/var/task/runner.js:128:5)\n    at async processEvent (/var/task/handler.js:67:3)",
    firstFailedAt: new Date(Date.now() - 2 * 86400000).toISOString(),
    lastFailedAt: new Date(Date.now() - 6 * 3600000).toISOString(),
    failedRuns: 8,
  },
  auto_4: {
    error: "Slack webhook URL not configured",
    stack: "Error: Missing env var SLACK_WEBHOOK_URL\n    at sendAlert (/var/task/actions.js:88:7)\n    at async runAutomation (/var/task/runner.js:142:3)",
    firstFailedAt: new Date(Date.now() - 14 * 3600000).toISOString(),
    lastFailedAt: new Date(Date.now() - 12 * 3600000).toISOString(),
    failedRuns: 1,
  },
  auto_1: {
    error: "Database connection pool exhausted",
    stack: "Error: ConnectionTimeoutError\n    at Pool.acquire (/var/task/db.js:24:9)\n    at async scoreLead (/var/task/scoring.js:55:5)\n    at async runAutomation (/var/task/runner.js:128:5)",
    firstFailedAt: new Date(Date.now() - 5 * 3600000).toISOString(),
    lastFailedAt: new Date(Date.now() - 5 * 3600000).toISOString(),
    failedRuns: 2,
  },
};

interface FailedJobRow {
  id: string;
  name: string;
  trigger: string;
  status: string;
  failureCount: number;
  lastRunAt?: string;
  error?: string;
  errorStack?: string;
  firstFailedAt?: string;
  lastFailedAt?: string;
  failedRuns?: number;
}

export function FailedJobsView() {
  const [data, setData] = useState<Automation[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [retrying, setRetrying] = useState<Set<string>>(new Set());

  useEffect(() => {
    setLoading(true);
    automationService.list()
      .then((d) => setData(d.automations))
      .finally(() => setLoading(false));
  }, []);

  const failedJobs: FailedJobRow[] = useMemo(() => {
    return data
      .filter((a) => a.status === "error" || a.failureCount > 0)
      .map((a) => {
        const err = ERROR_DETAILS[a.id];
        return {
          id: a.id,
          name: a.name,
          trigger: a.trigger,
          status: a.status,
          failureCount: a.failureCount,
          lastRunAt: a.lastRunAt,
          error: err?.error,
          errorStack: err?.stack,
          firstFailedAt: err?.firstFailedAt,
          lastFailedAt: err?.lastFailedAt,
          failedRuns: err?.failedRuns,
        };
      });
  }, [data]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    return failedJobs.filter((j) => {
      if (q && !`${j.name} ${j.trigger} ${j.error ?? ""}`.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [failedJobs, search]);

  if (loading) return <LoadingState label="Loading failed jobs…" />;

  const totalFailures = failedJobs.reduce((s, j) => s + j.failureCount, 0);
  const erroredAutomations = failedJobs.filter((j) => j.status === "error").length;
  const recentFailures = failedJobs.filter((j) => {
    if (!j.lastFailedAt) return false;
    const hoursAgo = (Date.now() - new Date(j.lastFailedAt).getTime()) / 3600000;
    return hoursAgo < 24;
  }).length;

  const handleRetry = (job: FailedJobRow) => {
    setRetrying((prev) => new Set(prev).add(job.id));
    toast.info(`Retrying ${job.name}…`);
    setTimeout(() => {
      setRetrying((prev) => {
        const next = new Set(prev);
        next.delete(job.id);
        return next;
      });
      toast.success(`${job.name} retry queued. Will run on next trigger.`);
    }, 1500);
  };

  const toggleExpand = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <div>
      <PageHeader
        title="Failed Jobs"
        description={`${failedJobs.length} automations with errors or failures need attention`}
        action={
          <Button
            variant="outline"
            onClick={() => {
              filtered.forEach((j, i) => {
                setTimeout(() => handleRetry(j), i * 300);
              });
              toast.info(`Retrying ${filtered.length} automations…`);
            }}
            disabled={filtered.length === 0}
          >
            <RefreshCw className="size-4" /> Retry All
          </Button>
        }
      />

      {failedJobs.length === 0 ? (
        <EmptyState
          icon={AlertTriangle}
          title="No failed jobs"
          description="All automations are running cleanly."
        />
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
            <MetricCard label="Failed Automations" value={failedJobs.length} icon={Bug} tone="rose" />
            <MetricCard label="In Error State" value={erroredAutomations} icon={XCircle} tone="rose" />
            <MetricCard label="Total Failures" value={totalFailures} icon={AlertTriangle} tone="amber" />
            <MetricCard label="Recent (24h)" value={recentFailures} icon={Clock} tone="teal" hint="Last 24 hours" />
          </div>

          <div className="mb-3 p-3 rounded-md border border-rose-200 bg-rose-50 flex items-start gap-2.5">
            <AlertTriangle className="size-4 text-rose-600 mt-0.5 shrink-0" />
            <div className="text-xs text-rose-800">
              <span className="font-medium">Action required:</span> {failedJobs.length} automation{failedJobs.length > 1 ? "s" : ""} experiencing issues.
              Review error details and retry failed runs to restore normal operation.
            </div>
          </div>

          <FilterBar
            search={search}
            onSearchChange={setSearch}
            activeFilters={{}}
            onFilterChange={() => {}}
            onClear={() => setSearch("")}
            searchPlaceholder="Search by name, trigger, error…"
          />

          {filtered.length === 0 ? (
            <EmptyState icon={Bug} title="No matching failures" description="Try a different search." />
          ) : (
            <SectionCard bodyClassName="p-0">
              <div className="divide-y divide-border/60">
                {filtered.map((job) => {
                  const isOpen = expanded.has(job.id);
                  const isRetrying = retrying.has(job.id);
                  return (
                    <div key={job.id}>
                      <button
                        onClick={() => toggleExpand(job.id)}
                        className="w-full px-4 py-3 hover:bg-accent/40 transition-colors text-left"
                      >
                        <div className="flex items-center gap-3">
                          {isOpen ? (
                            <ChevronDown className="size-4 text-muted-foreground shrink-0" />
                          ) : (
                            <ChevronRight className="size-4 text-muted-foreground shrink-0" />
                          )}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-sm font-medium">{job.name}</span>
                              <StatusBadge label={job.status} color={STATUS_COLOR[job.status]} />
                              <StatusBadge label={`${job.failureCount} failures`} color="rose" className="!text-[10px]" />
                            </div>
                            <div className="text-xs text-muted-foreground mt-0.5 truncate">
                              {job.error ?? "Error details not available"}
                            </div>
                          </div>
                          <div className="text-right shrink-0">
                            <div className="text-xs text-muted-foreground">
                              Last run: {job.lastRunAt ? relativeTime(job.lastRunAt) : "—"}
                            </div>
                          </div>
                        </div>
                      </button>
                      {isOpen && (
                        <div className="px-4 pb-4 pt-1 bg-muted/30 border-t border-border/40">
                          <div className="space-y-3 ml-8">
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                              <div>
                                <div className="text-muted-foreground uppercase tracking-wide">Trigger</div>
                                <code className="font-mono text-foreground mt-0.5 block">{job.trigger}</code>
                              </div>
                              <div>
                                <div className="text-muted-foreground uppercase tracking-wide">Failed Runs</div>
                                <div className="font-medium tabular-nums mt-0.5">{job.failedRuns ?? job.failureCount}</div>
                              </div>
                              <div>
                                <div className="text-muted-foreground uppercase tracking-wide">First Failure</div>
                                <div className="font-medium mt-0.5">{job.firstFailedAt ? formatDateTime(job.firstFailedAt) : "—"}</div>
                              </div>
                              <div>
                                <div className="text-muted-foreground uppercase tracking-wide">Last Failure</div>
                                <div className="font-medium mt-0.5">{job.lastFailedAt ? formatDateTime(job.lastFailedAt) : "—"}</div>
                              </div>
                            </div>

                            <div>
                              <div className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Error</div>
                              <div className="p-2.5 rounded-md bg-rose-50 border border-rose-200 text-rose-900 text-sm font-mono">
                                {job.error ?? "Unknown error"}
                              </div>
                            </div>

                            {job.errorStack && (
                              <div>
                                <div className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Stack Trace</div>
                                <pre className="p-2.5 rounded-md bg-slate-900 text-slate-100 text-xs font-mono overflow-x-auto nv-scroll">
                                  {job.errorStack}
                                </pre>
                              </div>
                            )}

                            <div className="flex gap-2 pt-1">
                              <Button
                                size="sm"
                                onClick={() => handleRetry(job)}
                                disabled={isRetrying}
                              >
                                <RefreshCw className={`size-3.5 ${isRetrying ? "animate-spin" : ""}`} />
                                {isRetrying ? "Retrying…" : "Retry Now"}
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => toast.info("Opening full logs…")}
                              >
                                <Activity className="size-3.5" /> View Logs
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                className="ml-auto"
                                onClick={() => toast.success("Marked as resolved — failures cleared.")}
                              >
                                Mark Resolved
                              </Button>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </SectionCard>
          )}
        </>
      )}
    </div>
  );
}
