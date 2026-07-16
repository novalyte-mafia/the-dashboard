"use client";

import { useEffect, useState } from "react";
import { useNav } from "@/components/admin/admin-app";
import {
  PageHeader,
  MetricCard,
  SectionCard,
  ChartCard,
  LoadingState,
  StatusBadge,
  ActivityTimeline,
} from "@/components/admin/shared";
import { Card } from "@/components/ui/card";
import {
  Server,
  Database,
  HardDrive,
  Activity,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Zap,
} from "lucide-react";
import { activityService } from "@/services";
import { relativeTime, formatDateTime } from "@/lib/format";

interface SystemMetric {
  label: string;
  value: string;
  status: "healthy" | "warning" | "critical";
  detail: string;
}

const MOCK_ERRORS = [
  { id: "err_1", message: "Automation 'Article Published → Social Post' failed: OpenAI rate limit", level: "warning", timestamp: new Date(Date.now() - 2 * 3600000).toISOString() },
  { id: "err_2", message: "Stripe webhook signature verification failed (3 retries)", level: "critical", timestamp: new Date(Date.now() - 6 * 3600000).toISOString() },
  { id: "err_3", message: "Slack notification delivery failed: webhook URL not configured", level: "warning", timestamp: new Date(Date.now() - 12 * 3600000).toISOString() },
  { id: "err_4", message: "Slow query detected on patient_leads (1.8s) — index recommended", level: "warning", timestamp: new Date(Date.now() - 18 * 3600000).toISOString() },
];

export function AppHealthView() {
  const { refreshKey } = useNav();
  const [activities, setActivities] = useState<{ id: string; summary: string; timestamp: string; adminName?: string; action?: string }[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    activityService.list().then((d) => setActivities(d.activities.slice(0, 10))).finally(() => setLoading(false));
  }, [refreshKey]);

  // Mock system metrics
  const apiResponseTime = [
    { label: "9a", value: 142, color: "var(--primary)" },
    { label: "11a", value: 168, color: "var(--primary)" },
    { label: "1p", value: 184, color: "var(--primary)" },
    { label: "3p", value: 156, color: "var(--primary)" },
    { label: "5p", value: 128, color: "var(--primary)" },
    { label: "7p", value: 94, color: "var(--primary)" },
    { label: "9p", value: 76, color: "var(--primary)" },
  ];

  const errorRate = [
    { label: "Mon", value: 0.8, color: "var(--primary)" },
    { label: "Tue", value: 0.4, color: "var(--primary)" },
    { label: "Wed", value: 1.2, color: "#d97706" },
    { label: "Thu", value: 0.6, color: "var(--primary)" },
    { label: "Fri", value: 0.3, color: "var(--primary)" },
    { label: "Sat", value: 0.2, color: "var(--primary)" },
    { label: "Sun", value: 0.1, color: "var(--primary)" },
  ];

  const services: SystemMetric[] = [
    { label: "API (Next.js)", value: "128ms", status: "healthy", detail: "p95 latency" },
    { label: "Database (Supabase)", value: "24ms", status: "healthy", detail: "Query latency" },
    { label: "Queue (Workers)", value: "4 jobs", status: "healthy", detail: "Pending" },
    { label: "Active Connections", value: "42", status: "healthy", detail: "Current sessions" },
    { label: "Error Rate", value: "0.6%", status: "warning", detail: "Last 24h" },
    { label: "Storage", value: "1.2 GB", status: "healthy", detail: "12% of quota" },
    { label: "Background Jobs", value: "1 failing", status: "warning", detail: "Article → Social" },
    { label: "Uptime", value: "99.94%", status: "healthy", detail: "30-day rolling" },
  ];

  const overallStatus: "healthy" | "warning" | "critical" = services.some((s) => s.status === "critical")
    ? "critical"
    : services.some((s) => s.status === "warning")
    ? "warning"
    : "healthy";

  if (loading) {
    return (
      <div>
        <PageHeader title="Application Health" description="Real-time system status, performance & errors" />
        <LoadingState label="Loading system health…" />
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="Application Health"
        description="Real-time system status, performance & errors"
        action={
          <div className="flex items-center gap-2">
            <span className={`size-2.5 rounded-full ${
              overallStatus === "healthy" ? "bg-emerald-500" :
              overallStatus === "warning" ? "bg-amber-500" : "bg-rose-500"
            } animate-pulse`} />
            <span className="text-sm font-medium capitalize">{overallStatus === "healthy" ? "All systems operational" : overallStatus === "warning" ? "Degraded performance" : "Critical issues"}</span>
          </div>
        }
      />

      {/* Service status cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 mb-5">
        {services.map((s) => {
          const tone =
            s.status === "healthy" ? "green" :
            s.status === "warning" ? "amber" : "rose";
          const Icon =
            s.label.includes("API") ? Server :
            s.label.includes("Database") ? Database :
            s.label.includes("Queue") || s.label.includes("Jobs") ? HardDrive :
            s.label.includes("Connections") ? Activity :
            s.label.includes("Uptime") ? Clock :
            s.label.includes("Storage") ? HardDrive :
            AlertTriangle;
          return (
            <MetricCard
              key={s.label}
              label={s.label}
              value={s.value}
              icon={Icon}
              tone={tone === "green" ? "green" : tone === "amber" ? "amber" : "rose"}
              hint={s.detail}
            />
          );
        })}
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
        <ChartCard title="API Response Time (ms)" data={apiResponseTime} type="line" />
        <ChartCard title="Error Rate (% by day)" data={errorRate} type="bar" />
      </div>

      {/* Status + errors */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <SectionCard title="Service Status" description="Live component health" bodyClassName="p-0">
          <div className="divide-y">
            {services.map((s) => (
              <div key={s.label} className="px-4 py-2.5 flex items-center justify-between">
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{s.label}</p>
                  <p className="text-xs text-muted-foreground truncate">{s.detail}</p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-sm font-semibold tabular-nums">{s.value}</span>
                  {s.status === "healthy" ? (
                    <CheckCircle2 className="size-4 text-emerald-600" />
                  ) : (
                    <AlertTriangle className={`size-4 ${s.status === "critical" ? "text-rose-600" : "text-amber-600"}`} />
                  )}
                </div>
              </div>
            ))}
          </div>
        </SectionCard>

        <SectionCard title="Recent Errors" description="Last 24 hours" bodyClassName="p-0" className="lg:col-span-2">
          <div className="divide-y">
            {MOCK_ERRORS.map((e) => (
              <div key={e.id} className="px-4 py-3 flex items-start gap-3">
                <AlertTriangle className={`size-4 mt-0.5 shrink-0 ${e.level === "critical" ? "text-rose-600" : "text-amber-600"}`} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm">{e.message}</p>
                  <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1.5">
                    <StatusBadge label={e.level} color={e.level === "critical" ? "rose" : "amber"} />
                    {formatDateTime(e.timestamp)} · {relativeTime(e.timestamp)}
                  </p>
                </div>
              </div>
            ))}
          </div>
          <div className="px-4 py-2 border-t text-xs text-muted-foreground flex items-center gap-1.5">
            <Zap className="size-3" />
            Errors are also streamed to Slack #alerts (when configured).
          </div>
        </SectionCard>
      </div>

      <Card className="p-0 mt-4">
        <div className="px-4 py-3 border-b">
          <h3 className="text-sm font-semibold flex items-center gap-2">
            <Activity className="size-4" /> Recent System Activity
          </h3>
        </div>
        <ActivityTimeline items={activities} maxHeight="320px" />
      </Card>
    </div>
  );
}
