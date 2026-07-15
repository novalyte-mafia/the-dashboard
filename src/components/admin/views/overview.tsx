"use client";

import { useEffect, useState } from "react";
import { useNav } from "@/components/admin/admin-app";
import { StatCard, SectionCard, EmptyState, LoadingState, StageBadge, PageHeader } from "@/components/admin/shared";
import { formatCurrency, formatCurrencyFull, relativeTime, formatDateTime } from "@/lib/format";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PhoneCall, CalendarCheck, CheckCircle2, AlertTriangle, UserCheck, CalendarPlus, Flame, Target, FileText, DollarSign, TrendingUp, ArrowRight, Clock, Activity as ActivityIcon, ListChecks, Building2 } from "lucide-react";

interface DashboardData {
  metrics: {
    readyToCall: number;
    callsCompletedToday: number;
    followUpsDueToday: number;
    overdueFollowUps: number;
    decisionMakersReached: number;
    meetingsBooked: number;
    interestedClinics: number;
    activeOpportunities: number;
    proposalsOutstanding: number;
    estimatedPipelineValue: number;
    revenueWonThisMonth: number;
    revenueWon: number;
    clinicCount: number;
  };
  priorities: { label: string; count: number; href: string; tone: string }[];
  pipelineSnapshot: { stage: string; label: string; count: number }[];
  todayFollowUps: { id: string; title: string; dueDate: string; priority: string; clinic: { name: string } | null }[];
  overdueTasks: { id: string; title: string; dueDate: string; priority: string; clinic: { name: string } | null }[];
  recentActivity: { id: string; action: string; summary: string; timestamp: string; admin: { firstName: string; lastName: string } | null }[];
  callSessionsToday: { id: string; clinic: { name: string; city: string | null; state: string | null } | null; outcome: string; startedAt: string }[];
}

export function OverviewView() {
  const { navigate, refreshKey } = useNav();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    setLoading(true);
    fetch("/api/dashboard")
      .then((r) => r.json())
      .then((d) => active && setData(d))
      .finally(() => active && setLoading(false));
    return () => { active = false; };
  }, [refreshKey]);

  if (loading || !data) return <LoadingState label="Loading command center…" />;

  const m = data.metrics;
  const maxSnapshot = Math.max(1, ...data.pipelineSnapshot.map((s) => s.count));

  return (
    <div>
      <PageHeader
        title="Overview"
        description="What needs your attention today"
        action={
          <Button onClick={() => navigate("call-queue")}>
            <PhoneCall className="size-4" />
            Start calling
          </Button>
        }
      />

      {/* Primary metrics */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 mb-6">
        <StatCard label="Ready to Call" value={m.readyToCall} icon={PhoneCall} tone="teal" hint="In your queue" onClick={() => navigate("call-queue")} />
        <StatCard label="Calls Today" value={m.callsCompletedToday} icon={CheckCircle2} tone="green" hint="Answered calls logged" />
        <StatCard label="Follow-Ups Due" value={m.followUpsDueToday} icon={CalendarCheck} tone="amber" onClick={() => navigate("follow-ups", null)} />
        <StatCard label="Overdue Follow-Ups" value={m.overdueFollowUps} icon={AlertTriangle} tone="rose" onClick={() => navigate("follow-ups", null)} />
        <StatCard label="Decision-Makers" value={m.decisionMakersReached} icon={UserCheck} tone="teal" hint="Identified across clinics" />
        <StatCard label="Meetings Booked" value={m.meetingsBooked} icon={CalendarPlus} tone="teal" />
        <StatCard label="Interested Clinics" value={m.interestedClinics} icon={Flame} tone="amber" onClick={() => navigate("clinics", null)} />
        <StatCard label="Active Opportunities" value={m.activeOpportunities} icon={Target} tone="violet" onClick={() => navigate("deals", null)} />
        <StatCard label="Proposals Outstanding" value={m.proposalsOutstanding} icon={FileText} tone="amber" onClick={() => navigate("deals", null)} />
        <StatCard label="Pipeline Value" value={formatCurrency(m.estimatedPipelineValue)} icon={TrendingUp} tone="teal" hint="Estimated, open deals" onClick={() => navigate("deals", null)} />
        <StatCard label="Revenue Won (Month)" value={formatCurrency(m.revenueWonThisMonth)} icon={DollarSign} tone="green" />
        <StatCard label="Total Clinics" value={m.clinicCount} icon={Building2} tone="default" onClick={() => navigate("clinics", null)} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
        {/* Today's priorities */}
        <SectionCard
          title="Today's Priorities"
          description="Generated from live records"
          className="lg:col-span-2"
          bodyClassName="p-0"
        >
          {data.priorities.length === 0 ? (
            <EmptyState icon={ListChecks} title="All clear" description="No outstanding priorities right now." />
          ) : (
            <div className="divide-y divide-border/60">
              {data.priorities.map((p, i) => (
                <button
                  key={i}
                  onClick={() => navigate(p.href as never, null)}
                  className="w-full flex items-center gap-3 px-4 py-3 hover:bg-accent/50 transition-colors text-left"
                >
                  <PriorityDot tone={p.tone} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{p.label}</p>
                  </div>
                  <span className="text-sm font-semibold tabular-nums text-muted-foreground">{p.count}</span>
                  <ArrowRight className="size-4 text-muted-foreground" />
                </button>
              ))}
            </div>
          )}
        </SectionCard>

        {/* Pipeline snapshot */}
        <SectionCard title="Pipeline Snapshot" description="Clinics by stage" bodyClassName="p-4">
          <div className="space-y-2.5">
            {data.pipelineSnapshot.map((s) => (
              <button
                key={s.stage}
                onClick={() => navigate("clinics", null)}
                className="w-full flex items-center gap-3 group"
              >
                <div className="w-32 shrink-0 text-left">
                  <StageBadge stage={s.stage} />
                </div>
                <div className="flex-1 h-6 bg-muted rounded-md overflow-hidden relative">
                  <div
                    className="h-full bg-primary/70 group-hover:bg-primary transition-colors rounded-md"
                    style={{ width: `${(s.count / maxSnapshot) * 100}%` }}
                  />
                </div>
                <span className="w-6 text-right text-sm font-semibold tabular-nums">{s.count}</span>
              </button>
            ))}
          </div>
        </SectionCard>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Follow-ups today + overdue */}
        <SectionCard title="Follow-Ups — Today" description={`${data.todayFollowUps.length} due today`} bodyClassName="p-0" className="lg:col-span-2">
          {data.todayFollowUps.length === 0 && data.overdueTasks.length === 0 ? (
            <EmptyState icon={CalendarCheck} title="Nothing due today" />
          ) : (
            <div className="divide-y divide-border/60">
              {data.overdueTasks.map((t) => (
                <TaskRow key={`o-${t.id}`} task={t} overdue onClick={() => navigate("follow-ups", null)} />
              ))}
              {data.todayFollowUps.map((t) => (
                <TaskRow key={`t-${t.id}`} task={t} onClick={() => navigate("follow-ups", null)} />
              ))}
            </div>
          )}
        </SectionCard>

        {/* Recent activity */}
        <SectionCard title="Recent Activity" description="Immutable history" bodyClassName="p-0">
          <div className="max-h-96 overflow-y-auto nv-scroll divide-y divide-border/60">
            {data.recentActivity.length === 0 ? (
              <EmptyState icon={ActivityIcon} title="No activity yet" />
            ) : (
              data.recentActivity.map((a) => (
                <div key={a.id} className="px-4 py-2.5">
                  <p className="text-sm leading-snug">{a.summary}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {a.admin ? `${a.admin.firstName} ${a.admin.lastName} · ` : ""}{relativeTime(a.timestamp)}
                  </p>
                </div>
              ))
            )}
          </div>
          <div className="border-t border-border/60 p-2">
            <Button variant="ghost" size="sm" className="w-full" onClick={() => navigate("activity", null)}>
              View all activity
            </Button>
          </div>
        </SectionCard>
      </div>

      {/* Calls today */}
      {data.callSessionsToday.length > 0 && (
        <Card className="mt-4 p-0">
          <div className="px-4 py-3 border-b border-border/70 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <PhoneCall className="size-4 text-primary" />
              <h3 className="text-sm font-semibold">Calls Logged Today</h3>
            </div>
            <span className="text-xs text-muted-foreground">{data.callSessionsToday.length} total</span>
          </div>
          <div className="divide-y divide-border/60">
            {data.callSessionsToday.map((c) => (
              <div key={c.id} className="px-4 py-2.5 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{c.clinic?.name ?? "Unknown clinic"}</p>
                  <p className="text-xs text-muted-foreground truncate">{[c.clinic?.city, c.clinic?.state].filter(Boolean).join(", ")}</p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-xs text-muted-foreground">{formatDateTime(c.startedAt)}</span>
                  <StageBadge stage={c.outcome} className="capitalize" />
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}

function PriorityDot({ tone }: { tone: string }) {
  const colors: Record<string, string> = {
    teal: "bg-teal-500",
    amber: "bg-amber-500",
    rose: "bg-rose-500",
    violet: "bg-violet-500",
    green: "bg-emerald-500",
  };
  return <span className={`size-2 rounded-full ${colors[tone] ?? "bg-slate-400"} shrink-0`} />;
}

function TaskRow({ task, overdue, onClick }: { task: { id: string; title: string; dueDate: string; priority: string; clinic: { name: string } | null }; overdue?: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick} className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-accent/50 transition-colors text-left">
      {overdue ? <AlertTriangle className="size-4 text-rose-500 shrink-0" /> : <Clock className="size-4 text-muted-foreground shrink-0" />}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{task.title}</p>
        <p className="text-xs text-muted-foreground truncate">{task.clinic?.name ?? "—"}</p>
      </div>
      {overdue && <span className="text-xs font-medium text-rose-600">Overdue</span>}
      <span className="text-xs text-muted-foreground tabular-nums">{relativeTime(task.dueDate)}</span>
    </button>
  );
}
