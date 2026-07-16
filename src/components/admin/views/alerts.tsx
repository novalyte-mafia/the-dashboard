"use client";

import { useEffect, useMemo, useState } from "react";
import { useNav } from "@/components/admin/admin-app";
import {
  PageHeader, MetricCard, SectionCard, LoadingState, EmptyState, FilterBar, PriorityBadge,
} from "@/components/admin/shared";
import { Button } from "@/components/ui/button";
import { Bell, AlertTriangle, CheckCircle2, BellOff, Filter } from "lucide-react";
import { notificationService } from "@/services";
import type { NotificationItem } from "@/types";
import { relativeTime, formatDateTime } from "@/lib/format";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const CATEGORY_OPTIONS = [
  { value: "followup", label: "Follow-Ups" },
  { value: "meeting", label: "Meetings" },
  { value: "patient_lead", label: "Patient Leads" },
  { value: "clinic", label: "Clinics" },
  { value: "campaign", label: "Campaigns" },
  { value: "automation", label: "Automation" },
  { value: "directory", label: "Directory" },
  { value: "integration", label: "Integrations" },
];

export function AlertsView() {
  const { navigate, refreshKey } = useNav();
  const [alerts, setAlerts] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [activeFilters, setActiveFilters] = useState<Record<string, string>>({});
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    setLoading(true);
    notificationService
      .list()
      .then((d) => setAlerts(d.notifications))
      .catch(() => toast.error("Failed to load alerts"))
      .finally(() => setLoading(false));
  }, [refreshKey]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return alerts.filter((a) => {
      if (dismissedIds.has(a.id)) return false;
      if (q && !`${a.title} ${a.message}`.toLowerCase().includes(q)) return false;
      if (activeFilters.category && !a.type.includes(activeFilters.category) && !a.relatedEntityType?.includes(activeFilters.category)) return false;
      if (activeFilters.priority && a.priority !== activeFilters.priority) return false;
      if (activeFilters.status === "unread" && a.isRead) return false;
      if (activeFilters.status === "read" && !a.isRead) return false;
      return true;
    });
  }, [alerts, search, activeFilters, dismissedIds]);

  const grouped = useMemo(() => {
    const order: Record<string, number> = { critical: 0, high: 1, normal: 2, low: 3 };
    return [...filtered].sort((a, b) => (order[a.priority] ?? 2) - (order[b.priority] ?? 2));
  }, [filtered]);

  const critical = grouped.filter((a) => a.priority === "critical");
  const high = grouped.filter((a) => a.priority === "high");
  const normal = grouped.filter((a) => a.priority === "normal" || a.priority === "low");

  function dismiss(id: string) {
    setDismissedIds((prev) => new Set(prev).add(id));
    toast.success("Alert dismissed");
  }

  function dismissAll() {
    setDismissedIds(new Set(filtered.map((a) => a.id)));
    toast.success(`Dismissed ${filtered.length} alerts`);
  }

  function handleAlertClick(a: NotificationItem) {
    if (a.relatedEntityType === "clinic") navigate("clinics");
    else if (a.relatedEntityType === "patient_lead") navigate("patient-leads");
    else if (a.relatedEntityType === "followup") navigate("follow-ups");
    else if (a.relatedEntityType === "automation") navigate("automations");
    else if (a.relatedEntityType === "directory") navigate("directory");
    else if (a.relatedEntityType === "campaign") navigate("campaigns");
  }

  if (loading) return <LoadingState label="Loading alerts…" />;

  return (
    <div>
      <PageHeader
        title="Alerts"
        description="Prioritized notifications across revenue operations"
        action={
          <Button variant="outline" onClick={dismissAll} disabled={filtered.length === 0}>
            <CheckCircle2 className="size-4" /> Dismiss visible
          </Button>
        }
      />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
        <MetricCard label="Critical" value={critical.length} icon={AlertTriangle} tone="rose" hint="Action required" />
        <MetricCard label="High Priority" value={high.length} icon={Bell} tone="amber" />
        <MetricCard label="Normal" value={normal.length} icon={Bell} tone="teal" />
        <MetricCard label="Unread" value={alerts.filter((a) => !a.isRead).length} icon={BellOff} tone="violet" />
      </div>

      <FilterBar
        search={search}
        onSearchChange={setSearch}
        filters={[
          { key: "category", label: "Category", options: CATEGORY_OPTIONS },
          {
            key: "priority", label: "Priority", options: [
              { value: "critical", label: "Critical" },
              { value: "high", label: "High" },
              { value: "normal", label: "Normal" },
              { value: "low", label: "Low" },
            ],
          },
          {
            key: "status", label: "Status", options: [
              { value: "unread", label: "Unread" },
              { value: "read", label: "Read" },
            ],
          },
        ]}
        activeFilters={activeFilters}
        onFilterChange={(k, v) => setActiveFilters((prev) => {
          const next = { ...prev };
          if (v) next[k] = v; else delete next[k];
          return next;
        })}
        onClear={() => setActiveFilters({})}
        searchPlaceholder="Search alert title or message…"
      />

      {filtered.length === 0 ? (
        <SectionCard>
          <EmptyState
            icon={CheckCircle2}
            title="No alerts match"
            description="You're caught up, or adjust filters to see more."
          />
        </SectionCard>
      ) : (
        <>
          {critical.length > 0 && (
            <AlertGroup title="Critical" tone="rose" count={critical.length}>
              {critical.map((a) => (
                <AlertRow key={a.id} alert={a} onClick={() => handleAlertClick(a)} onDismiss={() => dismiss(a.id)} />
              ))}
            </AlertGroup>
          )}
          {high.length > 0 && (
            <AlertGroup title="High Priority" tone="amber" count={high.length}>
              {high.map((a) => (
                <AlertRow key={a.id} alert={a} onClick={() => handleAlertClick(a)} onDismiss={() => dismiss(a.id)} />
              ))}
            </AlertGroup>
          )}
          {normal.length > 0 && (
            <AlertGroup title="Normal" tone="teal" count={normal.length}>
              {normal.map((a) => (
                <AlertRow key={a.id} alert={a} onClick={() => handleAlertClick(a)} onDismiss={() => dismiss(a.id)} />
              ))}
            </AlertGroup>
          )}
        </>
      )}
    </div>
  );
}

function AlertGroup({ title, tone, count, children }: { title: string; tone: string; count: number; children: React.ReactNode }) {
  const toneClasses: Record<string, string> = {
    rose: "border-rose-200 bg-rose-50/50",
    amber: "border-amber-200 bg-amber-50/50",
    teal: "border-teal-200 bg-teal-50/50",
  };
  return (
    <div className={cn("rounded-lg border mb-4 overflow-hidden", toneClasses[tone])}>
      <div className="px-4 py-2 border-b border-current/10 flex items-center justify-between">
        <h3 className="text-sm font-semibold">{title}</h3>
        <span className="text-xs text-muted-foreground tabular-nums">{count}</span>
      </div>
      <div className="divide-y divide-border/60 bg-card">{children}</div>
    </div>
  );
}

function AlertRow({ alert, onClick, onDismiss }: { alert: NotificationItem; onClick: () => void; onDismiss: () => void }) {
  return (
    <div className="px-4 py-3 flex items-start gap-3 hover:bg-accent/40 transition-colors">
      <button onClick={onClick} className="flex-1 min-w-0 text-left flex items-start gap-3">
        <div className={cn(
          "size-2 rounded-full shrink-0 mt-2",
          alert.priority === "critical" ? "bg-rose-500"
          : alert.priority === "high" ? "bg-amber-500"
          : alert.priority === "normal" ? "bg-teal-500"
          : "bg-slate-400"
        )} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="text-sm font-medium truncate">{alert.title}</p>
            {!alert.isRead && <span className="size-1.5 rounded-full bg-primary shrink-0" />}
          </div>
          <p className="text-sm text-muted-foreground mt-0.5">{alert.message}</p>
          <p className="text-xs text-muted-foreground mt-1">{relativeTime(alert.createdAt)} · {formatDateTime(alert.createdAt)}</p>
        </div>
      </button>
      <PriorityBadge priority={alert.priority} />
      <Button variant="ghost" size="sm" className="h-7 text-xs shrink-0" onClick={onDismiss}>
        Dismiss
      </Button>
    </div>
  );
}
