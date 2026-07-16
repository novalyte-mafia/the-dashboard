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
import { PhoneCall, PhoneOutgoing, Voicemail, UserCheck, TrendingUp, Headset } from "lucide-react";
import { callService } from "@/services";
import { formatDateTime, relativeTime } from "@/lib/format";
import { OUTCOME_MAP, CALL_OUTCOMES } from "@/lib/constants";
import type { CallSession } from "@/types";

const RANGES = [
  { value: "7d", label: "Last 7 days" },
  { value: "30d", label: "Last 30 days" },
  { value: "90d", label: "Last 90 days" },
];

export function OutreachAnalyticsView() {
  const { refreshKey } = useNav();
  const [range, setRange] = useState("30d");
  const [calls, setCalls] = useState<CallSession[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    callService.listAll().then((d) => setCalls(d.calls)).finally(() => setLoading(false));
  }, [refreshKey]);

  // Calls per day (mock — derived from calls' startedAt grouped by day)
  const callsPerDay = useMemo(() => {
    const days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
    const counts = [12, 18, 9, 22, 15, 4, 2];
    return days.map((d, i) => ({ label: d, value: counts[i], color: "var(--primary)" }));
  }, []);

  // Connect rate trend (mock)
  const connectRateTrend = useMemo(() => {
    const weeks = ["W1", "W2", "W3", "W4", "W5", "W6"];
    const rates = [38, 41, 45, 42, 48, 52];
    return weeks.map((w, i) => ({ label: w, value: rates[i], color: "var(--primary)" }));
  }, []);

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

  // Top performers
  const performers = useMemo(() => {
    const map = new Map<string, { name: string; calls: number; connects: number; bookings: number }>();
    for (const c of calls) {
      const name = c.adminName ?? "System";
      const ex = map.get(name) ?? { name, calls: 0, connects: 0, bookings: 0 };
      ex.calls += 1;
      if (c.answered) ex.connects += 1;
      if (c.outcome === "meeting_booked") ex.bookings += 1;
      map.set(name, ex);
    }
    return Array.from(map.values()).sort((a, b) => b.calls - a.calls);
  }, [calls]);

  const totalCalls = calls.length;
  const connected = calls.filter((c) => c.answered).length;
  const connectRate = totalCalls ? Math.round((connected / totalCalls) * 100) : 0;
  const booked = calls.filter((c) => c.outcome === "meeting_booked").length;
  const avgDuration = totalCalls
    ? Math.round(calls.reduce((s, c) => s + c.durationSec, 0) / totalCalls / 60)
    : 0;

  if (loading) {
    return (
      <div>
        <PageHeader
          title="Outreach Analytics"
          description="Call activity, connect rates, outcomes & top performers"
          action={<RangeSelect value={range} onChange={setRange} />}
        />
        <LoadingState label="Loading outreach analytics…" />
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="Outreach Analytics"
        description="Call activity, connect rates, outcomes & top performers"
        action={<RangeSelect value={range} onChange={setRange} />}
      />

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 mb-5">
        <MetricCard label="Total Calls" value={totalCalls} icon={PhoneOutgoing} tone="teal" hint="Logged" />
        <MetricCard label="Connect Rate" value={`${connectRate}%`} icon={PhoneCall} tone="green" trend={4} hint={`${connected} answered`} />
        <MetricCard label="Meetings Booked" value={booked} icon={UserCheck} tone="violet" hint="From calls" />
        <MetricCard label="Avg Call Duration" value={`${avgDuration}m`} icon={Headset} tone="default" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
        <ChartCard title="Calls per Day (this week)" data={callsPerDay} type="bar" />
        <ChartCard title="Connect Rate Trend (6 weeks %)" data={connectRateTrend} type="line" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
        <ChartCard title="Calls by Outcome" data={callsByOutcome} type="bar" />
        <Card className="p-4">
          <h3 className="text-sm font-semibold mb-3">Top Performers</h3>
          {performers.length === 0 ? (
            <EmptyState icon={Headset} title="No calls logged yet" />
          ) : (
            <div className="space-y-2">
              {performers.map((p, i) => {
                const rate = p.calls ? Math.round((p.connects / p.calls) * 100) : 0;
                return (
                  <div key={p.name} className="flex items-center gap-3 py-2 border-b last:border-0">
                    <div className="size-7 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-semibold">
                      {i + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{p.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {p.calls} calls · {p.connects} connects · {p.bookings} booked
                      </p>
                    </div>
                    <StatusBadge label={`${rate}%`} color={rate >= 50 ? "green" : rate >= 30 ? "amber" : "rose"} />
                  </div>
                );
              })}
            </div>
          )}
        </Card>
      </div>

      <Card className="p-0">
        <div className="px-4 py-3 border-b">
          <h3 className="text-sm font-semibold">Recent Calls</h3>
        </div>
        <DataTable
          data={calls}
          columns={[
            {
              key: "clinic",
              header: "Clinic",
              render: (c) => <span className="font-medium">{c.clinicName}</span>,
              sortValue: (c) => c.clinicName,
            },
            {
              key: "contact",
              header: "Contact",
              render: (c) => <span className="text-muted-foreground">{c.contactName ?? "—"}</span>,
              hideOnMobile: true,
            },
            {
              key: "outcome",
              header: "Outcome",
              render: (c) => {
                const o = OUTCOME_MAP[c.outcome];
                return <StatusBadge label={o?.label ?? c.outcome} color={o?.color ?? "slate"} />;
              },
            },
            {
              key: "duration",
              header: "Duration",
              render: (c) => <span className="tabular-nums">{Math.round(c.durationSec / 60)}m</span>,
              sortValue: (c) => c.durationSec,
              hideOnMobile: true,
            },
            {
              key: "startedAt",
              header: "When",
              render: (c) => <span className="text-xs text-muted-foreground">{relativeTime(c.startedAt)}</span>,
              sortValue: (c) => c.startedAt,
            },
          ]}
          pageSize={10}
        />
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
