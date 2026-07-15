"use client";

import { useEffect, useState } from "react";
import { useNav } from "@/components/admin/admin-app";
import { PageHeader, LoadingState, EmptyState, PriorityBadge } from "@/components/admin/shared";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import { Calendar, CheckCircle2, AlertTriangle, Clock, Plus, CalendarCheck, RotateCcw } from "lucide-react";
import { relativeTime, formatDate, fullName } from "@/lib/format";
import { FOLLOWUP_TYPES, FOLLOWUP_STATUSES } from "@/lib/constants";
import { toast } from "sonner";
import { CreateFollowUpDialog } from "@/components/admin/create-followup-dialog";

interface Task {
  id: string;
  title: string;
  taskType: string;
  priority: string;
  dueDate: string | null;
  dueTime: string | null;
  status: string;
  notes: string | null;
  completedAt: string | null;
  clinic: { id: string; name: string; city: string | null; state: string | null } | null;
  contact: { id: string; firstName: string; lastName: string } | null;
  admin: { firstName: string; lastName: string } | null;
}

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
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/follow-ups?view=${view}`)
      .then((r) => r.json())
      .then((d) => setTasks(d.tasks ?? []))
      .catch(() => toast.error("Failed to load follow-ups"))
      .finally(() => setLoading(false));
  }, [view, refreshKey]);

  async function complete(id: string) {
    const res = await fetch(`/api/follow-ups/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "completed" }),
    });
    if (res.ok) { toast.success("Task completed"); refresh(); }
    else toast.error("Failed to complete task");
  }

  async function reschedule(id: string) {
    const res = await fetch(`/api/follow-ups/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "rescheduled", dueDate: new Date(Date.now() + 86400000).toISOString() }),
    });
    if (res.ok) { toast.success("Rescheduled to tomorrow"); refresh(); }
    else toast.error("Failed to reschedule");
  }

  return (
    <div>
      <PageHeader
        title="Follow-Ups"
        description="Everything that needs your next action"
        action={<Button onClick={() => setCreateOpen(true)}><Plus className="size-4" /> New Follow-Up</Button>}
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
          <EmptyState icon={CalendarCheck} title="Nothing here" description="No follow-ups in this view." action={<Button onClick={() => setCreateOpen(true)}><Plus className="size-4" /> New Follow-Up</Button>} />
        ) : (
          <div className="divide-y">
            {tasks.map((t) => (
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
                    <span className="text-xs text-muted-foreground capitalize">{t.taskType.replace(/_/g, " ")}</span>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1 flex-wrap">
                    {t.clinic && (
                      <button onClick={() => openClinic(t.clinic!.id)} className="hover:text-primary">{t.clinic.name}</button>
                    )}
                    {t.contact && <span>· {fullName(t.contact.firstName, t.contact.lastName)}</span>}
                    <span>· Due {t.dueDate ? formatDate(t.dueDate) : "—"}{t.dueTime ? ` ${t.dueTime}` : ""}</span>
                    {view === "overdue" && <span className="text-rose-600 font-medium">· Overdue {relativeTime(t.dueDate)}</span>}
                    {t.completedAt && <span>· Completed {relativeTime(t.completedAt)}</span>}
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
            ))}
          </div>
        )}
      </Card>

      <CreateFollowUpDialog open={createOpen} onOpenChange={setCreateOpen} onCreated={() => refresh()} />
    </div>
  );
}
