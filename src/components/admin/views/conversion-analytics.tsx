"use client";

import { useEffect, useMemo, useState } from "react";
import { useNav } from "@/components/admin/admin-app";
import {
  PageHeader, LoadingState, EmptyState, MetricCard, SectionCard, ChartCard,
} from "@/components/admin/shared";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  PhoneCall, Users, CalendarPlus, FileText, CheckCircle2, TrendingUp, Percent,
  Scale, Clock, Route, Filter, ArrowRight, ChevronRight,
} from "lucide-react";
import { dashboardService } from "@/services";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { formatCurrency } from "@/lib/format";

type ConversionStage = {
  key: string;
  label: string;
  count: number;
  icon: any;
  rate?: number;
  tone: "teal" | "amber" | "rose" | "violet" | "green";
};

export function ConversionAnalyticsView() {
  const { navigate, refreshKey } = useNav();
  const [data, setData] = useState<Awaited<ReturnType<typeof dashboardService.getOverview>> | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    dashboardService
      .getOverview()
      .then(setData)
      .catch(() => toast.error("Failed to load conversion analytics"))
      .finally(() => setLoading(false));
  }, [refreshKey]);

  const funnel = useMemo<ConversionStage[]>(() => {
    if (!data) return [];
    const m = data.metrics;
    const c = data.conversionMetrics;
    const calls = Math.max(m.callsCompletedToday * 12, 100); // approximate monthly dials
    return [
      { key: "dials", label: "Dials Made", count: calls, icon: PhoneCall, tone: "teal" },
      { key: "connects", label: "Connections", count: Math.round(calls * c.dialToConnect / 100), icon: Users, tone: "teal", rate: c.dialToConnect },
      { key: "interest", label: "Interested", count: Math.round(calls * c.dialToConnect / 100 * c.conversationToInterest / 100), icon: TrendingUp, tone: "amber", rate: c.conversationToInterest },
      { key: "meetings", label: "Meetings Booked", count: m.meetingsBooked, icon: CalendarPlus, tone: "teal", rate: c.interestToMeeting },
      { key: "proposals", label: "Proposals Sent", count: m.proposalsOutstanding, icon: FileText, tone: "amber", rate: c.meetingToProposal },
      { key: "won", label: "Deals Won", count: Math.round(m.proposalsOutstanding * c.proposalToClose / 100), icon: CheckCircle2, tone: "green", rate: c.proposalToClose },
    ];
  }, [data]);

  if (loading || !data) return <LoadingState label="Loading conversion analytics…" />;

  const c = data.conversionMetrics;
  const maxFunnel = Math.max(1, ...funnel.map((f) => f.count));

  const stageBars = funnel.map((f) => ({
    label: f.label,
    value: f.count,
    color: f.tone === "green" ? "#10b981" : f.tone === "amber" ? "#f59e0b" : "#14b8a6",
  }));

  return (
    <div>
      <PageHeader
        title="Conversion Analytics"
        description="Sales funnel & stage-by-stage conversion rates"
        action={
          <Button variant="outline" onClick={() => navigate("activity")}>
            <Filter className="size-4" /> View activity
          </Button>
        }
      />

      {/* Conversion rate cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 mb-6">
        <ConvCard icon={PhoneCall} label="Dial → Connect" value={c.dialToConnect} />
        <ConvCard icon={Users} label="Connect → Interest" value={c.conversationToInterest} />
        <ConvCard icon={CalendarPlus} label="Interest → Meeting" value={c.interestToMeeting} />
        <ConvCard icon={FileText} label="Meeting → Proposal" value={c.meetingToProposal} />
        <ConvCard icon={CheckCircle2} label="Proposal → Close" value={c.proposalToClose} />
        <ConvCard icon={Route} label="Lead → Booking" value={c.leadToBooking} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
        {/* Funnel visualization */}
        <SectionCard
          title="Sales Funnel"
          description="Stage-by-stage drop-off"
          className="lg:col-span-2"
          bodyClassName="p-4"
        >
          <div className="space-y-2">
            {funnel.map((f, i) => {
              const width = (f.count / maxFunnel) * 100;
              const dropoff = i > 0 ? Math.round((1 - f.count / funnel[i - 1].count) * 100) : 0;
              return (
                <div key={f.key} className="space-y-1">
                  <div className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2">
                      <f.icon className="size-3.5 text-muted-foreground" />
                      <span className="font-medium">{f.label}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      {f.rate != null && (
                        <span className="text-xs text-muted-foreground tabular-nums">{f.rate}% conv</span>
                      )}
                      <span className="font-semibold tabular-nums">{f.count.toLocaleString()}</span>
                    </div>
                  </div>
                  <div className="h-7 bg-muted rounded-md overflow-hidden">
                    <div
                      className={cn(
                        "h-full rounded-md flex items-center px-3 text-xs font-medium text-white",
                        f.tone === "green" ? "bg-emerald-500"
                        : f.tone === "amber" ? "bg-amber-500"
                        : f.tone === "rose" ? "bg-rose-500"
                        : f.tone === "violet" ? "bg-violet-500"
                        : "bg-teal-500"
                      )}
                      style={{ width: `${Math.max(width, 8)}%` }}
                    >
                      {f.count.toLocaleString()}
                    </div>
                  </div>
                  {i > 0 && dropoff > 0 && (
                    <p className="text-[10px] text-muted-foreground/70">↓ {dropoff}% drop-off from {funnel[i - 1].label}</p>
                  )}
                </div>
              );
            })}
          </div>
        </SectionCard>

        {/* Key metrics */}
        <div className="space-y-4">
          <ChartCard title="Funnel by Volume" type="bar" data={stageBars} />
          <Card className="p-4 gap-0">
            <h3 className="text-sm font-semibold mb-3">Cycle Metrics</h3>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground flex items-center gap-2">
                  <Scale className="size-3.5" /> Avg Deal Value
                </span>
                <span className="font-semibold tabular-nums">{formatCurrency(c.avgDealValue)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground flex items-center gap-2">
                  <Clock className="size-3.5" /> Avg Sales Cycle
                </span>
                <span className="font-semibold tabular-nums">{c.avgSalesCycle} days</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground flex items-center gap-2">
                  <Percent className="size-3.5" /> Follow-Up Completion
                </span>
                <span className="font-semibold tabular-nums">{c.followUpCompletion}%</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground flex items-center gap-2">
                  <Users className="size-3.5" /> Connect → Conversation
                </span>
                <span className="font-semibold tabular-nums">{c.connectToConversation}%</span>
              </div>
            </div>
          </Card>
        </div>
      </div>

      {/* Stage-by-stage breakdown */}
      <SectionCard
        title="Stage-by-Stage Breakdown"
        description="Conversion rates between funnel stages"
        bodyClassName="p-0"
      >
        <div className="overflow-x-auto nv-scroll">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/40 text-left">
                <th className="font-medium text-muted-foreground px-3 py-2.5">Stage Transition</th>
                <th className="font-medium text-muted-foreground px-3 py-2.5 text-right">Conversion</th>
                <th className="font-medium text-muted-foreground px-3 py-2.5 text-right">From Volume</th>
                <th className="font-medium text-muted-foreground px-3 py-2.5 text-right">To Volume</th>
                <th className="font-medium text-muted-foreground px-3 py-2.5 text-right">Drop-off</th>
                <th className="font-medium text-muted-foreground px-3 py-2.5">Health</th>
              </tr>
            </thead>
            <tbody>
              {funnel.slice(1).map((f, i) => {
                const prev = funnel[i];
                const dropoff = Math.round((1 - f.count / prev.count) * 100);
                const health = (f.rate ?? 0) >= 50 ? "Strong" : (f.rate ?? 0) >= 30 ? "Average" : "Needs work";
                const healthColor = (f.rate ?? 0) >= 50 ? "green" : (f.rate ?? 0) >= 30 ? "amber" : "rose";
                return (
                  <tr key={f.key} className="border-b last:border-0 hover:bg-accent/40">
                    <td className="px-3 py-2.5">
                      <span className="text-sm">{prev.label} → {f.label}</span>
                    </td>
                    <td className="px-3 py-2.5 text-right font-medium tabular-nums">{f.rate}%</td>
                    <td className="px-3 py-2.5 text-right tabular-nums text-muted-foreground">{prev.count.toLocaleString()}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums text-muted-foreground">{f.count.toLocaleString()}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums text-rose-600">−{dropoff}%</td>
                    <td className="px-3 py-2.5">
                      <span className={cn(
                        "inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium",
                        healthColor === "green" ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                        : healthColor === "amber" ? "bg-amber-50 text-amber-700 border-amber-200"
                        : "bg-rose-50 text-rose-700 border-rose-200"
                      )}>{health}</span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </SectionCard>
    </div>
  );
}

function ConvCard({ icon: Icon, label, value }: { icon: any; label: string; value: number }) {
  return (
    <Card className="p-4 gap-0">
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1">
        <Icon className="size-3" />
        <span className="truncate">{label}</span>
      </div>
      <p className="text-2xl font-semibold tabular-nums">{value}%</p>
    </Card>
  );
}
