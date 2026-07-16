"use client";

import { useEffect, useState } from "react";
import { useNav } from "@/components/admin/admin-app";
import {
  PageHeader, MetricCard, SectionCard, EmptyState, LoadingState, ActivityTimeline, ChartCard,
} from "@/components/admin/shared";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  PhoneCall, CalendarCheck, CheckCircle2, AlertTriangle, UserCheck, CalendarPlus,
  Flame, Target, FileText, DollarSign, TrendingUp, ArrowRight, Clock, Activity as ActivityIcon,
  ListChecks, Building2, Users, Zap, MapPin, Gauge, Percent, Scale, Route,
} from "lucide-react";
import { dashboardService } from "@/services";
import type { CallSession, Clinic, FollowUpTask, ActivityEvent } from "@/types";
import { formatCurrency, formatCurrencyFull, relativeTime, formatDateTime, localTime, isWithinCallingHours } from "@/lib/format";
import { OUTCOME_MAP } from "@/lib/constants";
import { toast } from "sonner";

type OverviewData = Awaited<ReturnType<typeof dashboardService.getOverview>>;

const PRIORITY_TONE: Record<string, string> = {
  teal: "bg-teal-500",
  amber: "bg-amber-500",
  rose: "bg-rose-500",
  violet: "bg-violet-500",
  green: "bg-emerald-500",
};

export function OverviewView() {
  const { navigate, refreshKey } = useNav();
  const [data, setData] = useState<OverviewData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    setLoading(true);
    dashboardService
      .getOverview()
      .then((d) => active && setData(d))
      .catch(() => active && toast.error("Failed to load overview"))
      .finally(() => active && setLoading(false));
    return () => { active = false; };
  }, [refreshKey]);

  if (loading || !data) return <LoadingState label="Loading command center…" />;

  const m = data.metrics;
  const c = data.conversionMetrics;
  const nbc = data.nextBestCall;

  return (
    <div>
      <PageHeader
        title="Command Center"
        description="Real-time view of revenue operations — what needs your attention today"
        action={
          <Button onClick={() => navigate("call-queue")}>
            <PhoneCall className="size-4" />
            Start calling
          </Button>
        }
      />

      {/* Primary KPIs (12 cards) */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 mb-6">
        <MetricCard label="Ready to Call" value={m.readyToCall} icon={PhoneCall} tone="teal" hint="In call queue" onClick={() => navigate("call-queue")} />
        <MetricCard label="Calls Today" value={m.callsCompletedToday} icon={CheckCircle2} tone="green" hint="Answered calls" onClick={() => navigate("call-queue")} />
        <MetricCard label="Follow-Ups Due" value={m.followUpsDue} icon={CalendarCheck} tone="amber" hint="Today" onClick={() => navigate("follow-ups")} />
        <MetricCard label="Overdue" value={m.overdueFollowUps} icon={AlertTriangle} tone="rose" hint="Past due" onClick={() => navigate("follow-ups")} />
        <MetricCard label="Interested" value={m.interestedClinics} icon={Flame} tone="amber" hint="Active intent" onClick={() => navigate("clinics")} />
        <MetricCard label="Meetings Booked" value={m.meetingsBooked} icon={CalendarPlus} tone="teal" hint="Scheduled" onClick={() => navigate("meetings")} />
        <MetricCard label="Proposals Out" value={m.proposalsOutstanding} icon={FileText} tone="amber" hint="Awaiting reply" onClick={() => navigate("proposals")} />
        <MetricCard label="Active Deals" value={m.activeOpportunities} icon={Target} tone="violet" hint="Open pipeline" onClick={() => navigate("deals")} />
        <MetricCard label="Pipeline Value" value={formatCurrency(m.estimatedPipelineValue)} icon={TrendingUp} tone="teal" hint="Open deals" onClick={() => navigate("pipeline")} />
        <MetricCard label="Revenue Won" value={formatCurrency(m.revenueWon)} icon={DollarSign} tone="green" hint="All-time" onClick={() => navigate("revenue")} />
        <MetricCard label="Patient Leads" value={m.patientLeads} icon={Users} tone="violet" hint="Inbound" onClick={() => navigate("patient-leads")} />
        <MetricCard label="Qualified Leads" value={m.qualifiedPatientLeads} icon={UserCheck} tone="teal" hint="Ready to route" onClick={() => navigate("patient-leads")} />
      </div>

      {/* Conversion metrics row */}
      <SectionCard
        title="Conversion Metrics"
        description="Funnel benchmarks across the sales process"
        className="mb-6"
        bodyClassName="p-0"
      >
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 divide-y md:divide-y-0 md:divide-x divide-border/60">
          <ConversionStat icon={Percent} label="Dial → Connect" value={c.dialToConnect} />
          <ConversionStat icon={Percent} label="Connect → Interest" value={c.conversationToInterest} />
          <ConversionStat icon={Percent} label="Interest → Meeting" value={c.interestToMeeting} />
          <ConversionStat icon={Percent} label="Meeting → Proposal" value={c.meetingToProposal} />
          <ConversionStat icon={Percent} label="Proposal → Close" value={c.proposalToClose} />
          <ConversionStat icon={Route} label="Lead → Booking" value={c.leadToBooking} />
          <ConversionStat icon={Scale} label="Avg Deal Value" value={formatCurrency(c.avgDealValue)} raw />
          <ConversionStat icon={Clock} label="Avg Sales Cycle" value={`${c.avgSalesCycle}d`} raw />
        </div>
      </SectionCard>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
        {/* Today's Priorities */}
        <SectionCard
          title="Today's Priorities"
          description="Generated from live records"
          className="lg:col-span-2"
          bodyClassName="p-0"
          action={<Button variant="ghost" size="sm" onClick={() => navigate("priorities")}>View all <ArrowRight className="size-3.5" /></Button>}
        >
          {data.priorities.length === 0 ? (
            <EmptyState icon={ListChecks} title="All clear" description="No outstanding priorities right now." />
          ) : (
            <div className="divide-y divide-border/60">
              {data.priorities.slice(0, 6).map((p, i) => (
                <button
                  key={i}
                  onClick={() => navigate(p.href)}
                  className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-accent/50 transition-colors text-left"
                >
                  <span className={`size-2 rounded-full ${PRIORITY_TONE[p.tone] ?? "bg-slate-400"} shrink-0`} />
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

        {/* Next Best Call */}
        <SectionCard
          title="Next Best Call"
          description="Highest-priority ready-to-call clinic"
          bodyClassName="p-4"
        >
          {nbc ? (
            <NextBestCallCard clinic={nbc} onCall={() => navigate("call-console", nbc.id)} onOpen={() => navigate("clinic-detail", nbc.id)} />
          ) : (
            <EmptyState icon={PhoneCall} title="No clinics ready to call" description="The call queue is empty." />
          )}
        </SectionCard>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
        {/* Pipeline Snapshot */}
        <SectionCard title="Pipeline Snapshot" description="Clinics by stage" className="lg:col-span-2" bodyClassName="p-4">
          <ChartCard
            title="Clinics per Pipeline Stage"
            type="bar"
            data={data.pipelineSnapshot.map((s) => ({
              label: s.label,
              value: s.count,
              color: "var(--primary)",
            }))}
          />
        </SectionCard>

        {/* Deal Risk Alerts */}
        <SectionCard title="Deal Risk Alerts" description="Deals needing attention" bodyClassName="p-0">
          {data.dealAlerts.length === 0 ? (
            <EmptyState icon={AlertTriangle} title="No risks flagged" />
          ) : (
            <div className="divide-y divide-border/60">
              {data.dealAlerts.map((a) => (
                <button
                  key={a.id}
                  onClick={() => navigate("deals")}
                  className="w-full px-4 py-3 text-left hover:bg-accent/50 transition-colors"
                >
                  <div className="flex items-start gap-2">
                    <AlertTriangle className="size-4 text-amber-500 shrink-0 mt-0.5" />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium truncate">{a.name}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{a.risk}</p>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </SectionCard>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
        {/* Patient Demand Alerts */}
        <SectionCard title="Patient Demand Alerts" description="Supply-demand gaps & rising markets" bodyClassName="p-0" className="lg:col-span-1">
          {data.patientDemandAlerts.length === 0 ? (
            <EmptyState icon={MapPin} title="No demand alerts" />
          ) : (
            <div className="divide-y divide-border/60">
              {data.patientDemandAlerts.map((a) => (
                <button
                  key={a.id}
                  onClick={() => navigate("demand-overview")}
                  className="w-full px-4 py-2.5 text-left hover:bg-accent/50 transition-colors"
                >
                  <div className="flex items-start gap-2">
                    <Zap className="size-4 text-violet-500 shrink-0 mt-0.5" />
                    <p className="text-sm">{a.text}</p>
                  </div>
                </button>
              ))}
            </div>
          )}
        </SectionCard>

        {/* Recent Calls */}
        <SectionCard
          title="Recent Calls"
          description={`${data.recentCalls.length} most recent`}
          bodyClassName="p-0"
          className="lg:col-span-2"
          action={<Button variant="ghost" size="sm" onClick={() => navigate("call-queue")}>All calls <ArrowRight className="size-3.5" /></Button>}
        >
          {data.recentCalls.length === 0 ? (
            <EmptyState icon={PhoneCall} title="No calls logged" />
          ) : (
            <div className="divide-y divide-border/60">
              {data.recentCalls.slice(0, 5).map((call) => (
                <RecentCallRow key={call.id} call={call} onOpen={() => call.clinicId && navigate("clinic-detail", call.clinicId)} />
              ))}
            </div>
          )}
        </SectionCard>
      </div>

      {/* Recent Activity */}
      <SectionCard
        title="Recent Activity"
        description="Immutable history"
        bodyClassName="p-0"
        action={<Button variant="ghost" size="sm" onClick={() => navigate("activity")}>View all <ArrowRight className="size-3.5" /></Button>}
      >
        <ActivityTimeline items={data.recentActivity.map((a: ActivityEvent) => ({
          id: a.id,
          summary: a.summary,
          timestamp: a.timestamp,
          adminName: a.adminName,
          action: a.action,
        }))} maxHeight="320px" />
      </SectionCard>
    </div>
  );
}

function ConversionStat({ icon: Icon, label, value, raw }: { icon: any; label: string; value: number | string; raw?: boolean }) {
  return (
    <div className="px-4 py-3">
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1">
        <Icon className="size-3" />
        <span className="truncate">{label}</span>
      </div>
      <p className="text-lg font-semibold tabular-nums">
        {raw ? value : `${value}%`}
      </p>
    </div>
  );
}

function NextBestCallCard({ clinic, onCall, onOpen }: { clinic: Clinic; onCall: () => void; onOpen: () => void }) {
  const withinHours = isWithinCallingHours(clinic.timezone);
  const dm = clinic.contacts.find((c) => c.isDecisionMaker);
  return (
    <div>
      <button onClick={onOpen} className="text-left w-full">
        <p className="text-sm font-semibold truncate">{clinic.name}</p>
        <p className="text-xs text-muted-foreground mt-0.5 truncate">
          {[clinic.city, clinic.state].filter(Boolean).join(", ")} · {clinic.timezone.replace("America/", "")}
        </p>
      </button>
      <div className="grid grid-cols-2 gap-2 mt-3 text-xs">
        <div className="rounded-md border border-border/70 px-2.5 py-1.5">
          <p className="text-[10px] uppercase text-muted-foreground tracking-wide">Local Time</p>
          <p className="text-sm font-medium">{localTime(clinic.timezone)}</p>
        </div>
        <div className="rounded-md border border-border/70 px-2.5 py-1.5">
          <p className="text-[10px] uppercase text-muted-foreground tracking-wide">Readiness</p>
          <p className="text-sm font-medium tabular-nums">{clinic.readinessScore}/100</p>
        </div>
        <div className="rounded-md border border-border/70 px-2.5 py-1.5">
          <p className="text-[10px] uppercase text-muted-foreground tracking-wide">Priority</p>
          <p className="text-sm font-medium capitalize">{clinic.priority}</p>
        </div>
        <div className="rounded-md border border-border/70 px-2.5 py-1.5">
          <p className="text-[10px] uppercase text-muted-foreground tracking-wide">Attempts</p>
          <p className="text-sm font-medium tabular-nums">{clinic.callAttempts}</p>
        </div>
      </div>
      {dm && (
        <div className="mt-3 rounded-md bg-teal-50 border border-teal-200 px-3 py-2">
          <p className="text-xs text-teal-700 font-medium">Decision-Maker</p>
          <p className="text-sm">{dm.firstName} {dm.lastName}{dm.title ? ` · ${dm.title}` : ""}</p>
        </div>
      )}
      <div className="flex items-center gap-2 mt-3">
        <Button size="sm" className="flex-1" onClick={onCall} disabled={!withinHours}>
          <PhoneCall className="size-3.5" /> Call now
        </Button>
        <Button size="sm" variant="outline" onClick={onOpen}>
          <Building2 className="size-3.5" /> Open
        </Button>
      </div>
      <p className="text-[10px] text-muted-foreground mt-2 flex items-center gap-1">
        <Clock className="size-3" />
        {withinHours ? "Within calling hours" : "Outside calling hours"}
      </p>
    </div>
  );
}

function RecentCallRow({ call, onOpen }: { call: CallSession; onOpen: () => void }) {
  const outcome = OUTCOME_MAP[call.outcome];
  const colorClass: Record<string, string> = {
    slate: "bg-slate-50 text-slate-700 border-slate-200",
    teal: "bg-teal-50 text-teal-700 border-teal-200",
    amber: "bg-amber-50 text-amber-700 border-amber-200",
    rose: "bg-rose-50 text-rose-700 border-rose-200",
  };
  return (
    <button onClick={onOpen} className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-accent/50 transition-colors text-left">
      <div className={`size-2 rounded-full shrink-0 ${call.answered ? "bg-teal-500" : "bg-slate-300"}`} />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{call.clinicName}</p>
        <p className="text-xs text-muted-foreground truncate">
          {call.contactName ?? "Unknown contact"} · {call.adminName ?? "System"}
        </p>
      </div>
      <Badge variant="outline" className={colorClass[outcome?.color ?? "slate"]}>
        {outcome?.label ?? call.outcome}
      </Badge>
      <span className="text-xs text-muted-foreground whitespace-nowrap shrink-0">{formatDateTime(call.startedAt)}</span>
    </button>
  );
}
