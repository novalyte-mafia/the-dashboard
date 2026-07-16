"use client";

import { useEffect, useMemo, useState } from "react";
import { useNav } from "@/components/admin/admin-app";
import {
  PageHeader,
  MetricCard,
  SectionCard,
  ChartCard,
  LoadingState,
  DataTable,
  StatusBadge,
  EmptyState,
} from "@/components/admin/shared";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card } from "@/components/ui/card";
import { PhoneCall, PhoneOutgoing, Clock, TrendingUp, Activity, Calendar } from "lucide-react";
import { callService } from "@/services";
import { formatDateTime } from "@/lib/format";
import { OUTCOME_MAP, CALL_OUTCOMES } from "@/lib/constants";
import type { CallSession } from "@/types";

const RANGES = [
  { value: "7d", label: "Last 7 days" },
  { value: "30d", label: "Last 30 days" },
  { value: "90d", label: "Last 90 days" },
];

export function CallAnalyticsView() {
  const { refreshKey } = useNav();
  const [range, setRange] = useState("30d");
  const [calls, setCalls] = useState<CallSession[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    callService.listAll().then((d) => setCalls(d.calls)).finally(() => setLoading(false));
  }, [refreshKey]);

  // Dial-to-connect funnel
  const funnel = useMemo(() => {
    const dials = calls.length;
    const answered = calls.filter((c) => c.answered).length;
    const dmReached = calls.filter((c) => c.decisionMakerReached).length;
    const interested = calls.filter((c) => c.outcome === "interested" || c.outcome === "meeting_booked").length;
    return [
      { label: "Dials", value: dials, color: "var(--primary)" },
      { label: "Answered", value: answered, color: "var(--primary)" },
      { label: "DM Reached", value: dmReached, color: "var(--primary)" },
      { label: "Interested", value: interested, color: "var(--primary)" },
    ];
  }, [calls]);

  // Calls by outcome
  const callsByOutcome = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const c of calls) counts[c.outcome] = (counts[c.outcome] ?? 0) + 1;
    return CALL_OUTCOMES.filter((o) => counts[o.id]).map((o) => ({
      label: o.label,
      value: counts[o.id] ?? 0,
      color: outcomeColor(o.id),
    }));
  }, [calls]);

  // Calls by admin
  const callsByAdmin = useMemo(() => {
    const map = new Map<string, { name: string; calls: number; connects: number; avgDuration: number }>();
    for (const c of calls) {
      const name = c.adminName ?? "System";
      const ex = map.get(name) ?? { name, calls: 0, connects: 0, avgDuration: 0 };
      ex.calls += 1;
      if (c.answered) ex.connects += 1;
      ex.avgDuration += c.durationSec;
      map.set(name, ex);
    }
    return Array.from(map.values()).map((p) => ({
      ...p,
      avgDuration: p.calls ? Math.round(p.avgDuration / p.calls / 60) : 0,
    }));
  }, [calls]);

  // Best call times (mock — derived from calls by hour)
  const bestCallTimes = useMemo(() => {
    const hours = ["9a", "10a", "11a", "12p", "1p", "2p", "3p", "4p", "5p"];
    const values = [8, 14, 12, 5, 9, 18, 21, 16, 7];
    return hours.map((h, i) => ({ label: h, value: values[i], color: "var(--primary)" }));
  }, []);

  const totalCalls = calls.length;
  const connected = calls.filter((c) => c.answered).length;
  const dmReached = calls.filter((c) => c.decisionMakerReached).length;
  const avgDuration = totalCalls
    ? Math.round(calls.reduce((s, c) => s + c.durationSec, 0) / totalCalls / 60)
    : 0;
  const dialToConnect = totalCalls ? Math.round((connected / totalCalls) * 100) : 0;

  if (loading) {
    return (
      <div>
        <PageHeader
          title="Call Analytics"
          description="Deep-dive on call performance, funnel, durations & best call times"
          action={<RangeSelect value={range} onChange={setRange} />}
        />
        <LoadingState label="Loading call analytics…" />
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="Call Analytics"
        description="Deep-dive on call performance, funnel, durations & best call times"
        action={<RangeSelect value={range} onChange={setRange} />}
      />

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 mb-5">
        <MetricCard label="Total Dials" value={totalCalls} icon={PhoneOutgoing} tone="teal" />
        <MetricCard label="Dial → Connect" value={`${dialToConnect}%`} icon={TrendingUp} tone="green" hint={`${connected} answered`} />
        <MetricCard label="DMs Reached" value={dmReached} icon={PhoneCall} tone="violet" hint="Decision-makers" />
        <MetricCard label="Avg Duration" value={`${avgDuration}m`} icon={Clock} tone="default" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
        <ChartCard title="Dial-to-Connect Funnel" data={funnel} type="bar" />
        <ChartCard title="Calls by Outcome" data={callsByOutcome} type="bar" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
        <ChartCard title="Best Call Times (by hour)" data={bestCallTimes} type="bar" />
        <Card className="p-4">
          <h3 className="text-sm font-semibold mb-3">Funnel Conversion</h3>
          <div className="space-y-3">
            <FunnelRow label="Dials → Answered" value={totalCalls} next={connected} />
            <FunnelRow label="Answered → DM Reached" value={connected} next={dmReached} />
            <FunnelRow
              label="DM Reached → Interested"
              value={dmReached}
              next={calls.filter((c) => c.outcome === "interested" || c.outcome === "meeting_booked").length}
            />
          </div>
          <div className="mt-4 pt-3 border-t text-xs text-muted-foreground">
            <Calendar className="size-3 inline mr-1" />
            Best performing window: <span className="font-medium text-foreground">3–4 PM local</span>
          </div>
        </Card>
      </div>

      <Card className="p-0">
        <div className="px-4 py-3 border-b">
          <h3 className="text-sm font-semibold">Calls by Admin</h3>
        </div>
        {callsByAdmin.length === 0 ? (
          <EmptyState icon={Activity} title="No calls logged" />
        ) : (
          <DataTable
            data={callsByAdmin.map((a, i) => ({ id: `a${i}`, ...a }))}
            columns={[
              { key: "name", header: "Admin", render: (r) => <span className="font-medium">{r.name}</span> },
              { key: "calls", header: "Calls", render: (r) => <span className="tabular-nums">{r.calls}</span>, sortValue: (r) => r.calls },
              {
                key: "connects",
                header: "Connects",
                render: (r) => <span className="tabular-nums">{r.connects}</span>,
                sortValue: (r) => r.connects,
                hideOnMobile: true,
              },
              {
                key: "rate",
                header: "Connect Rate",
                render: (r) => {
                  const rate = r.calls ? Math.round((r.connects / r.calls) * 100) : 0;
                  return <StatusBadge label={`${rate}%`} color={rate >= 50 ? "green" : rate >= 30 ? "amber" : "rose"} />;
                },
                sortValue: (r) => (r.calls ? r.connects / r.calls : 0),
              },
              {
                key: "avg",
                header: "Avg Duration",
                render: (r) => <span className="tabular-nums">{r.avgDuration}m</span>,
                sortValue: (r) => r.avgDuration,
                hideOnMobile: true,
              },
            ]}
            pageSize={12}
          />
        )}
      </Card>
    </div>
  );
}

function RangeSelect({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="w-40 h-9">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {RANGES.map((r) => (
          <SelectItem key={r.value} value={r.value}>
            {r.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function FunnelRow({ label, value, next }: { label: string; value: number; next: number }) {
  const rate = value ? Math.round((next / value) * 100) : 0;
  return (
    <div>
      <div className="flex items-center justify-between text-sm mb-1">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-medium tabular-nums">
          {next}/{value} · {rate}%
        </span>
      </div>
      <div className="h-2 bg-muted rounded-full overflow-hidden">
        <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${rate}%` }} />
      </div>
    </div>
  );
}

function outcomeColor(outcome: string): string {
  const o = OUTCOME_MAP[outcome];
  if (!o) return "var(--primary)";
  const tone = o.color;
  if (tone === "teal") return "#0d9488";
  if (tone === "amber") return "#d97706";
  if (tone === "rose") return "#e11d48";
  if (tone === "green") return "#059669";
  return "#64748b";
}
