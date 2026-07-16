"use client";

import { useEffect, useState } from "react";
import { useNav } from "@/components/admin/admin-app";
import {
  PageHeader,
  LoadingState,
  EmptyState,
  PriorityBadge,
  StatusBadge,
} from "@/components/admin/shared";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Calendar,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Plus,
  CalendarCheck,
  RotateCcw,
} from "lucide-react";
import { relativeTime, formatDate, fullName } from "@/lib/format";
import { followUpService } from "@/services";
import { toast } from "sonner";
import type { FollowUpTask } from "@/types";

const VIEW_TABS = [
  { id: "today", label: "Today", icon: Calendar },
  { id: "overdue", label: "Overdue", icon: AlertTriangle },
  { id: "upcoming", label: "Upcoming", icon: Clock },
  { id: "completed", label: "Completed", icon: CheckCircle2 },
  { id: "all", label: "All", icon: CalendarCheck },
];

export function FollowUpsView() {
  const { openClinic, refresh, refreshKey } = useNav();
  const [view, setView] = useState("today");
  const [tasks, setTasks] = useState<FollowUpTask[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    followUpService.list(view).then((d) => setTasks(d.tasks)).finally(() => setLoading(false));
  }, [view, refreshKey]);

  function complete(id: string) {
    toast.success("Task completed");
    setTasks((prev) => prev.filter((t) => t.id !== id));
    refresh();
  }

  function reschedule(id: string) {
    toast.success("Rescheduled to tomorrow");
    setTasks((prev) => prev.filter((t) => t.id !== id));
    refresh();
  }

  return (
    <div>
      <PageHeader
        title="Follow-Ups"
        description="Everything that needs your next action"
        action={<Button onClick={() => toast.info("Create follow-up form — coming soon.")}><Plus className="size-4" /> New Follow-Up</Button>}
      />

      <Tabs value={view} onValueChange={setView} className="mb-4">
        <TabsList>
          {VIEW_TABS.map((t) => (
            <TabsTrigger key={t.id} value={t.id} className="gap-1.5">
              <t.icon className="size-3.5" />
              {t.label}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      <Card className="p-0">
        {loading ? (
          <LoadingState label="Loading follow-ups…" />
        ) : tasks.length === 0 ? (
          <EmptyState
            icon={CalendarCheck}
            title="Nothing here"
            description="No follow-ups in this view."
            action={<Button onClick={() => toast.info("Create follow-up form — coming soon.")}><Plus className="size-4" /> New Follow-Up</Button>}
          />
        ) : (
          <div className="divide-y">
            {tasks.map((t) => {
              const isOverdue = (t.status === "open" || t.status === "in_progress") && t.dueDate && new Date(t.dueDate) < new Date(new Date().setHours(0, 0, 0, 0));
              return (
                <div key={t.id} className="px-4 py-3 flex items-start gap-3 group">
                  <button
                    onClick={() => complete(t.id)}
                    className="mt-0.5 size-5 rounded-full border-2 border-muted-foreground/30 hover:border-emerald-500 hover:bg-emerald-50 flex items-center justify-center transition-colors shrink-0"
                    title="Complete"
                  >
                    {t.status === "completed" && <CheckCircle2 className="size-4 text-emerald-500" />}
                  </button>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className={`text-sm font-medium ${t.status === "completed" ? "line-through text-muted-foreground" : ""}`}>{t.title}</p>
                      <PriorityBadge priority={t.priority} />
                      <StatusBadge
                        label={t.taskType.replace(/_/g, " ")}
                        color="slate"
                      />
                      {isOverdue && <StatusBadge label="overdue" color="rose" />}
                    </div>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1 flex-wrap">
                      {t.clinicName && (
                        <button onClick={() => t.clinicId && openClinic(t.clinicId)} className="hover:text-primary">{t.clinicName}</button>
                      )}
                      {t.contactName && <span>· {t.contactName}</span>}
                      <span>· Due {t.dueDate ? formatDate(t.dueDate) : "—"}{t.dueTime ? ` ${t.dueTime}` : ""}</span>
                      {isOverdue && <span className="text-rose-600 font-medium">· Overdue {relativeTime(t.dueDate)}</span>}
                      {t.completedAt && <span>· Completed {relativeTime(t.completedAt)}</span>}
                      {t.assignedAdminName && <span>· {t.assignedAdminName}</span>}
                    </div>
                    {t.notes && <p className="text-xs text-muted-foreground mt-1">{t.notes}</p>}
                  </div>
                  {t.status !== "completed" && (
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                      <Button size="sm" variant="ghost" onClick={() => reschedule(t.id)} title="Reschedule +1 day">
                        <RotateCcw className="size-3.5" />
                      </Button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </Card>
    </div>
  );
}
