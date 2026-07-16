"use client";

import { useEffect, useMemo, useState } from "react";
import { useNav } from "@/components/admin/admin-app";
import { automationService } from "@/services";
import type { Automation } from "@/types";
import {
  PageHeader, MetricCard, DataTable, FilterBar, DetailDrawer, LoadingState,
  StatusBadge, ConfirmationDialog,
} from "@/components/admin/shared/index";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import {
  Zap, Play, Pause, AlertTriangle, Activity, Plus, Clock, RefreshCw,
} from "lucide-react";
import { relativeTime, formatDateTime } from "@/lib/format";
import { toast } from "sonner";

const STATUS_OPTIONS = [
  { value: "active", label: "Active" },
  { value: "paused", label: "Paused" },
  { value: "error", label: "Error" },
  { value: "draft", label: "Draft" },
];

const STATUS_COLOR: Record<string, string> = {
  active: "green", paused: "slate", error: "rose", draft: "amber",
};

export function AutomationsView() {
  const { refreshKey } = useNav();
  const [data, setData] = useState<Automation[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filters, setFilters] = useState<Record<string, string>>({});
  const [selected, setSelected] = useState<Automation | null>(null);
  const [confirm, setConfirm] = useState<{ type: "pause" | "activate"; auto: Automation } | null>(null);

  useEffect(() => {
    setLoading(true);
    automationService.list()
      .then((d) => setData(d.automations))
      .finally(() => setLoading(false));
  }, [refreshKey]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    return data.filter((a) => {
      if (q && !`${a.name} ${a.trigger} ${a.description ?? ""}`.toLowerCase().includes(q)) return false;
      if (filters.status && a.status !== filters.status) return false;
      return true;
    });
  }, [data, search, filters]);

  if (loading) return <LoadingState label="Loading automations…" />;

  const active = data.filter((a) => a.status === "active").length;
  const errored = data.filter((a) => a.status === "error").length;
  const totalRuns = data.reduce((s, a) => s + a.runCount, 0);
  const totalFailures = data.reduce((s, a) => s + a.failureCount, 0);

  const toggleAutomation = (auto: Automation) => {
    const newStatus: Automation["status"] = auto.status === "active" ? "paused" : "active";
    setData((prev) => prev.map((a) => a.id === auto.id ? { ...a, status: newStatus } : a));
    setSelected((s) => s && s.id === auto.id ? { ...s, status: newStatus } : s);
    toast.success(`${auto.name} ${newStatus === "active" ? "activated" : "paused"}.`);
  };

  return (
    <div>
      <PageHeader
        title="Automations"
        description={`${data.length} workflows · ${active} active`}
        action={
          <Button onClick={() => toast.info("Workflow builder opening soon.")}>
            <Plus className="size-4" /> New Workflow
          </Button>
        }
      />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <MetricCard label="Active" value={active} icon={Play} tone="green" onClick={() => setFilters({ status: "active" })} />
        <MetricCard label="Errors" value={errored} icon={AlertTriangle} tone="rose" onClick={() => setFilters({ status: "error" })} />
        <MetricCard label="Total Runs" value={totalRuns.toLocaleString()} icon={Activity} tone="teal" />
        <MetricCard label="Failures" value={totalFailures} icon={AlertTriangle} tone="amber" />
      </div>

      <FilterBar
        search={search}
        onSearchChange={setSearch}
        filters={[{ key: "status", label: "Status", options: STATUS_OPTIONS }]}
        activeFilters={filters}
        onFilterChange={(k, v) => setFilters((f) => ({ ...f, [k]: v }))}
        onClear={() => { setSearch(""); setFilters({}); }}
        searchPlaceholder="Search by name, trigger, description…"
      />

      <DataTable
        data={filtered}
        onRowClick={(a) => setSelected(a)}
        emptyTitle="No automations match"
        emptyDescription="Try adjusting filters."
        columns={[
          {
            key: "name",
            header: "Workflow",
            sortValue: (a) => a.name,
            render: (a) => (
              <div>
                <div className="font-medium">{a.name}</div>
                {a.description && <div className="text-xs text-muted-foreground truncate max-w-md">{a.description}</div>}
              </div>
            ),
          },
          {
            key: "trigger",
            header: "Trigger",
            hideOnMobile: true,
            sortValue: (a) => a.trigger,
            render: (a) => <code className="text-xs bg-muted px-1.5 py-0.5 rounded">{a.trigger}</code>,
          },
          {
            key: "actions",
            header: "Actions",
            hideOnMobile: true,
            render: (a) => (
              <span className="text-xs text-muted-foreground">{a.actions.length} step{a.actions.length !== 1 ? "s" : ""}</span>
            ),
          },
          {
            key: "status",
            header: "Status",
            sortValue: (a) => a.status,
            render: (a) => <StatusBadge label={a.status} color={STATUS_COLOR[a.status]} />,
          },
          {
            key: "lastRunAt",
            header: "Last Run",
            hideOnMobile: true,
            sortValue: (a) => a.lastRunAt ? new Date(a.lastRunAt).getTime() : 0,
            render: (a) => (
              <span className="text-xs text-muted-foreground inline-flex items-center gap-1">
                <Clock className="size-3" />
                {a.lastRunAt ? relativeTime(a.lastRunAt) : "Never"}
              </span>
            ),
          },
          {
            key: "runCount",
            header: "Runs",
            sortValue: (a) => a.runCount,
            render: (a) => (
              <div className="text-sm tabular-nums">
                <span className="font-medium">{a.runCount.toLocaleString()}</span>
                {a.failureCount > 0 && <span className="text-rose-600 ml-1.5">· {a.failureCount} fail</span>}
              </div>
            ),
          },
          {
            key: "toggle",
            header: "Active",
            render: (a) => (
              <div onClick={(e) => e.stopPropagation()}>
                <Switch
                  checked={a.status === "active"}
                  onCheckedChange={() => setConfirm({ type: a.status === "active" ? "pause" : "activate", auto: a })}
                  disabled={a.status === "error"}
                />
              </div>
            ),
          },
        ]}
      />

      <DetailDrawer
        open={!!selected}
        onOpenChange={(o) => !o && setSelected(null)}
        title={selected?.name ?? ""}
      >
        {selected && (
          <div className="space-y-5">
            {selected.description && (
              <div>
                <div className="text-xs text-muted-foreground">Description</div>
                <div className="text-sm mt-0.5">{selected.description}</div>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <div className="text-xs text-muted-foreground">Status</div>
                <div className="mt-1"><StatusBadge label={selected.status} color={STATUS_COLOR[selected.status]} /></div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Last Run</div>
                <div className="font-medium text-sm">{selected.lastRunAt ? formatDateTime(selected.lastRunAt) : "Never"}</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Total Runs</div>
                <div className="font-medium tabular-nums">{selected.runCount.toLocaleString()}</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Failures</div>
                <div className={`font-medium tabular-nums ${selected.failureCount > 0 ? "text-rose-600" : ""}`}>{selected.failureCount}</div>
              </div>
            </div>

            <div>
              <div className="text-xs text-muted-foreground uppercase tracking-wide mb-2">Trigger</div>
              <div className="p-3 rounded-md bg-muted/60">
                <code className="text-sm font-mono">{selected.trigger}</code>
              </div>
            </div>

            <div>
              <div className="text-xs text-muted-foreground uppercase tracking-wide mb-2">Action Steps ({selected.actions.length})</div>
              <div className="space-y-2">
                {selected.actions.map((action, i) => (
                  <div key={i} className="flex items-start gap-2 p-2.5 rounded-md border border-border/60">
                    <div className="size-5 rounded-full bg-teal-50 text-teal-700 text-xs font-semibold flex items-center justify-center shrink-0 mt-0.5">
                      {i + 1}
                    </div>
                    <div className="min-w-0">
                      <code className="text-sm font-mono">{action}</code>
                      <div className="text-xs text-muted-foreground mt-0.5">Action step {i + 1} of {selected.actions.length}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {selected.failureCount > 0 && (
              <div className="p-3 rounded-md border border-rose-200 bg-rose-50">
                <div className="text-xs text-rose-800 font-medium uppercase tracking-wide inline-flex items-center gap-1.5">
                  <AlertTriangle className="size-3.5" /> {selected.failureCount} failures detected
                </div>
                <div className="text-sm text-rose-700 mt-1">
                  Last failure: API timeout during action execution. Check logs for full trace.
                </div>
              </div>
            )}

            <div className="flex gap-2 pt-2 border-t">
              <Button
                size="sm"
                variant="outline"
                onClick={() => toast.success(`Manual run queued for ${selected.name}.`)}
              >
                <RefreshCw className="size-3.5" /> Run Now
              </Button>
              {selected.status === "active" ? (
                <Button
                  size="sm"
                  variant="outline"
                  className="ml-auto"
                  onClick={() => setConfirm({ type: "pause", auto: selected })}
                >
                  <Pause className="size-3.5" /> Pause
                </Button>
              ) : (
                <Button
                  size="sm"
                  className="ml-auto"
                  onClick={() => setConfirm({ type: "activate", auto: selected })}
                  disabled={selected.status === "error"}
                >
                  <Play className="size-3.5" /> Activate
                </Button>
              )}
            </div>
          </div>
        )}
      </DetailDrawer>

      <ConfirmationDialog
        open={!!confirm}
        onOpenChange={(o) => !o && setConfirm(null)}
        title={confirm?.type === "pause" ? "Pause Automation" : "Activate Automation"}
        description={
          confirm?.type === "pause"
            ? `Pause "${confirm?.auto.name}"? It will no longer trigger on events until reactivated.`
            : `Activate "${confirm?.auto.name}"? It will begin responding to its trigger immediately.`
        }
        confirmLabel={confirm?.type === "pause" ? "Pause" : "Activate"}
        onConfirm={() => {
          if (confirm) toggleAutomation(confirm.auto);
        }}
      />
    </div>
  );
}
