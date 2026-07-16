"use client";

import { useEffect, useState, useMemo } from "react";
import { useNav } from "@/components/admin/admin-app";
import {
  PageHeader, MetricCard, SectionCard, EmptyState, LoadingState, PriorityBadge,
} from "@/components/admin/shared";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Card } from "@/components/ui/card";
import {
  PhoneCall, CalendarCheck, AlertTriangle, Flame, FileText, Users, Zap,
  CheckCircle2, Clock, ChevronRight, ListChecks, ArrowRight,
} from "lucide-react";
import { dashboardService, followUpService } from "@/services";
import type { FollowUpTask } from "@/types";
import { FOLLOWUP_TYPES, priorityBadgeClass } from "@/lib/constants";
import { relativeTime, formatDateTime, fullName } from "@/lib/format";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

type OverviewData = Awaited<ReturnType<typeof dashboardService.getOverview>>;

const PRIORITY_TONE: Record<string, string> = {
  teal: "bg-teal-500",
  amber: "bg-amber-500",
  rose: "bg-rose-500",
  violet: "bg-violet-500",
  green: "bg-emerald-500",
};

const PRIORITY_ICON: Record<string, any> = {
  "call-queue": PhoneCall,
  "follow-ups": CalendarCheck,
  "clinics": Flame,
  "deals": FileText,
  "patient-leads": Users,
  "automation": Zap,
};

export function PrioritiesView() {
  const { navigate, refreshKey, refresh } = useNav();
  const [overview, setOverview] = useState<OverviewData | null>(null);
  const [tasks, setTasks] = useState<FollowUpTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [completedIds, setCompletedIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    let active = true;
    setLoading(true);
    Promise.all([
      dashboardService.getOverview(),
      followUpService.list("today"),
    ])
      .then(([o, t]) => {
        if (!active) return;
        setOverview(o);
        setTasks(t.tasks);
      })
      .catch(() => active && toast.error("Failed to load priorities"))
      .finally(() => active && setLoading(false));
    return () => { active = false; };
  }, [refreshKey]);

  const totalPriorities = overview?.priorities.reduce((s, p) => s + p.count, 0) ?? 0;
  const completedCount = completedIds.size;

  const sortedTasks = useMemo(() => {
    const order: Record<string, number> = { critical: 0, high: 1, normal: 2, low: 3 };
    return [...tasks].sort((a, b) => (order[a.priority] ?? 2) - (order[b.priority] ?? 2));
  }, [tasks]);

  function toggleComplete(task: FollowUpTask) {
    setCompletedIds((prev) => {
      const next = new Set(prev);
      if (next.has(task.id)) next.delete(task.id);
      else next.add(task.id);
      return next;
    });
  }

  if (loading || !overview) return <LoadingState label="Loading priorities…" />;

  return (
    <div>
      <PageHeader
        title="Today's Priorities"
        description="Actionable tasks & ranked priorities for today"
        action={
          <Button variant="outline" onClick={refresh}>
            <CheckCircle2 className="size-4" /> Refresh
          </Button>
        }
      />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <MetricCard label="Open Priorities" value={totalPriorities} icon={ListChecks} tone="teal" />
        <MetricCard label="Tasks Today" value={tasks.length} icon={CalendarCheck} tone="amber" hint="Due today" />
        <MetricCard label="Overdue" value={overview.overdueTasks.length} icon={AlertTriangle} tone="rose" onClick={() => navigate("follow-ups")} />
        <MetricCard label="Completed" value={completedCount} icon={CheckCircle2} tone="green" hint="This session" />
      </div>

      {/* Priority checklist */}
      <SectionCard
        title="Priority Checklist"
        description="Top actions across revenue operations"
        className="mb-6"
        bodyClassName="p-0"
      >
        {overview.priorities.length === 0 ? (
          <EmptyState icon={ListChecks} title="No priorities" description="You're all caught up." />
        ) : (
          <div className="divide-y divide-border/60">
            {overview.priorities.map((p, i) => {
              const Icon = PRIORITY_ICON[p.href] ?? ListChecks;
              return (
                <button
                  key={i}
                  onClick={() => navigate(p.href)}
                  className="w-full flex items-center gap-3 px-4 py-3 hover:bg-accent/50 transition-colors text-left"
                >
                  <div className={cn("size-8 rounded-lg flex items-center justify-center shrink-0",
                    p.tone === "rose" ? "bg-rose-50 text-rose-600"
                    : p.tone === "amber" ? "bg-amber-50 text-amber-600"
                    : p.tone === "teal" ? "bg-teal-50 text-teal-600"
                    : p.tone === "violet" ? "bg-violet-50 text-violet-600"
                    : "bg-muted text-muted-foreground")}>
                    <Icon className="size-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{p.label}</p>
                    <p className="text-xs text-muted-foreground capitalize">{p.tone} priority · goes to {p.href.replace(/-/g, " ")}</p>
                  </div>
                  <span className="text-lg font-bold tabular-nums">{p.count}</span>
                  <ChevronRight className="size-4 text-muted-foreground" />
                </button>
              );
            })}
          </div>
        )}
      </SectionCard>

      {/* Overdue tasks */}
      {overview.overdueTasks.length > 0 && (
        <SectionCard
          title="Overdue Tasks"
          description={`${overview.overdueTasks.length} task${overview.overdueTasks.length === 1 ? "" : "s"} past due`}
          className="mb-6"
          bodyClassName="p-0"
        >
          <div className="divide-y divide-border/60">
            {overview.overdueTasks.map((task) => (
              <TaskRow
                key={task.id}
                task={task}
                overdue
                completed={completedIds.has(task.id)}
                onToggle={() => toggleComplete(task)}
                onOpenClinic={() => task.clinicId && navigate("clinic-detail", task.clinicId)}
                onOpenFollowUps={() => navigate("follow-ups")}
              />
            ))}
          </div>
        </SectionCard>
      )}

      {/* Today's tasks checklist */}
      <SectionCard
        title="Today's Tasks"
        description={`${tasks.length} task${tasks.length === 1 ? "" : "s"} scheduled for today`}
        bodyClassName="p-0"
      >
        {sortedTasks.length === 0 ? (
          <EmptyState icon={CalendarCheck} title="Nothing due today" description="Schedule follow-ups to fill your day." />
        ) : (
          <div className="divide-y divide-border/60">
            {sortedTasks.map((task) => {
              const taskType = FOLLOWUP_TYPES.find((t) => t.id === task.taskType);
              return (
                <div
                  key={task.id}
                  className={cn(
                    "flex items-center gap-3 px-4 py-3 transition-opacity",
                    completedIds.has(task.id) && "opacity-50"
                  )}
                >
                  <Checkbox
                    checked={completedIds.has(task.id)}
                    onCheckedChange={() => toggleComplete(task)}
                  />
                  <div className="flex-1 min-w-0">
                    <p className={cn("text-sm font-medium truncate", completedIds.has(task.id) && "line-through")}>
                      {task.title}
                    </p>
                    <p className="text-xs text-muted-foreground truncate mt-0.5">
                      {task.clinicName ?? "—"}
                      {task.assignedAdminName && ` · ${task.assignedAdminName}`}
                      {taskType && ` · ${taskType.label}`}
                    </p>
                  </div>
                  <PriorityBadge priority={task.priority} />
                  {task.dueTime && (
                    <span className="text-xs text-muted-foreground tabular-nums hidden md:inline">{task.dueTime}</span>
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 text-xs"
                    onClick={() => task.clinicId ? navigate("clinic-detail", task.clinicId) : navigate("follow-ups")}
                  >
                    Open <ArrowRight className="size-3" />
                  </Button>
                </div>
              );
            })}
          </div>
        )}
      </SectionCard>
    </div>
  );
}

function TaskRow({
  task, overdue, completed, onToggle, onOpenClinic, onOpenFollowUps,
}: {
  task: FollowUpTask;
  overdue?: boolean;
  completed: boolean;
  onToggle: () => void;
  onOpenClinic: () => void;
  onOpenFollowUps: () => void;
}) {
  return (
    <div className={cn("flex items-center gap-3 px-4 py-3 transition-opacity", completed && "opacity-50")}>
      <Checkbox checked={completed} onCheckedChange={onToggle} />
      <div className="flex-1 min-w-0">
        <button onClick={onOpenFollowUps} className="text-left w-full">
          <p className={cn("text-sm font-medium truncate", completed && "line-through")}>{task.title}</p>
          <p className="text-xs text-muted-foreground truncate mt-0.5">
            {task.clinicName ?? "—"}
            {task.assignedAdminName && ` · ${task.assignedAdminName}`}
          </p>
        </button>
      </div>
      <PriorityBadge priority={task.priority} />
      {overdue && (
        <span className="inline-flex items-center gap-1 text-xs font-medium text-rose-600">
          <AlertTriangle className="size-3" /> Overdue
        </span>
      )}
      <span className="text-xs text-muted-foreground tabular-nums whitespace-nowrap">
        {task.dueDate ? relativeTime(task.dueDate) : "—"}
      </span>
      <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={onOpenClinic}>
        Open <ArrowRight className="size-3" />
      </Button>
    </div>
  );
}
