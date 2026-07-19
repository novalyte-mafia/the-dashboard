"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Activity,
  BookOpen,
  ExternalLink,
  MousePointerClick,
  Search,
  Users,
} from "lucide-react";
import { ChartCard, LoadingState, MetricCard, PageHeader, SectionCard } from "@/components/admin/shared";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";

type Datum = { label: string; value: number };
type TrafficResponse = {
  configured: boolean;
  source: string;
  environment?: string;
  days: number;
  refreshedAt?: string;
  message?: string;
  error?: string;
  metrics?: {
    uniqueVisitors: number;
    sessions: number;
    pageViews: number;
    directorySearches: number;
    bookingClicks: number;
    assessmentsStarted: number;
    assessmentsCompleted: number;
    clinicApplications: number;
    workforceRegistrations: number;
  };
  sources?: Datum[];
  campaigns?: Datum[];
  landingPages?: Datum[];
  articles?: Datum[];
  clinics?: Datum[];
  devices?: Datum[];
  countries?: Datum[];
  trend?: Datum[];
};

export function TrafficAnalyticsView() {
  const [days, setDays] = useState(30);
  const [data, setData] = useState<TrafficResponse | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/analytics/traffic?days=${days}`, { cache: "no-store" });
      const payload = (await response.json()) as TrafficResponse;
      setData(payload);
    } finally {
      setLoading(false);
    }
  }, [days]);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading && !data) {
    return <LoadingState label="Loading production traffic analytics..." />;
  }

  const metrics = data?.metrics;
  const assessmentRate =
    metrics && metrics.assessmentsStarted > 0
      ? (metrics.assessmentsCompleted / metrics.assessmentsStarted) * 100
      : 0;
  const bookingRate =
    metrics && metrics.sessions > 0 ? (metrics.bookingClicks / metrics.sessions) * 100 : 0;
  const empty = "-";

  return (
    <div>
      <PageHeader
        title="Traffic Analytics"
        description="Search, content, directory, and conversion performance"
        action={
          <div className="flex items-center gap-2">
            <Badge variant="outline">{data?.source ?? "PostHog"}</Badge>
            <select
              aria-label="Analytics date range"
              value={days}
              onChange={(event) => setDays(Number(event.target.value))}
              className="h-9 rounded-md border bg-background px-2 text-sm"
            >
              <option value={7}>Last 7 days</option>
              <option value={14}>Last 14 days</option>
              <option value={30}>Last 30 days</option>
              <option value={90}>Last 90 days</option>
            </select>
          </div>
        }
      />

      {!data?.configured && (
        <Card className="mb-5 border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          {data?.message ?? "PostHog reporting credentials are not configured."} No placeholder
          traffic numbers are shown.
        </Card>
      )}
      {data?.error && (
        <Card className="mb-5 border-rose-200 bg-rose-50 p-4 text-sm text-rose-900">
          {data.error}
        </Card>
      )}

      <div className="mb-5 grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
        <MetricCard label="Unique visitors" value={metrics?.uniqueVisitors ?? empty} icon={Users} tone="teal" hint="PostHog" />
        <MetricCard label="Sessions" value={metrics?.sessions ?? empty} icon={Activity} tone="violet" hint="PostHog" />
        <MetricCard label="Page views" value={metrics?.pageViews ?? empty} icon={BookOpen} tone="teal" hint="PostHog" />
        <MetricCard label="Directory searches" value={metrics?.directorySearches ?? empty} icon={Search} tone="amber" hint="PostHog event" />
        <MetricCard label="Booking clicks" value={metrics?.bookingClicks ?? empty} icon={ExternalLink} tone="green" hint="PostHog event" />
        <MetricCard
          label="Assessment completion"
          value={metrics ? `${assessmentRate.toFixed(1)}%` : empty}
          icon={MousePointerClick}
          tone="green"
          hint="Started to completed"
        />
      </div>

      <ChartCard
        title={`Production page views - ${days} days`}
        data={data?.trend ?? []}
        type="line"
        className="mb-5"
      />

      <div className="mb-5 grid gap-4 lg:grid-cols-3">
        <RankedList title="Traffic sources" data={data?.sources ?? []} />
        <RankedList title="UTM campaigns" data={data?.campaigns ?? []} />
        <RankedList title="Top landing pages" data={data?.landingPages ?? []} />
      </div>

      <div className="mb-5 grid gap-4 lg:grid-cols-2">
        <RankedList title="Most-viewed articles" data={data?.articles ?? []} />
        <RankedList title="Most-viewed clinic profiles" data={data?.clinics ?? []} />
      </div>

      <div className="mb-5 grid gap-4 lg:grid-cols-2">
        <ChartCard title="Device breakdown" data={data?.devices ?? []} type="bar" />
        <ChartCard title="Country breakdown (approximate)" data={data?.countries ?? []} type="bar" />
      </div>

      <SectionCard title="Conversion snapshot" description="Production PostHog events for the selected period">
        <div className="grid gap-4 text-sm md:grid-cols-3">
          <Snapshot
            label="Assessments"
            value={`${metrics?.assessmentsCompleted ?? 0} / ${metrics?.assessmentsStarted ?? 0} completed`}
          />
          <Snapshot
            label="Booking click rate"
            value={metrics ? `${bookingRate.toFixed(2)}% of sessions` : empty}
          />
          <Snapshot label="Clinic applications" value={String(metrics?.clinicApplications ?? 0)} />
          <Snapshot
            label="Workforce registrations started"
            value={String(metrics?.workforceRegistrations ?? 0)}
          />
          <Snapshot label="Environment" value={data?.environment ?? "Production only"} />
          <Snapshot
            label="Last refreshed"
            value={data?.refreshedAt ? new Date(data.refreshedAt).toLocaleString() : "Not connected"}
          />
        </div>
      </SectionCard>
    </div>
  );
}

function RankedList({ title, data }: { title: string; data: Datum[] }) {
  return (
    <SectionCard title={title} description="Source: PostHog" bodyClassName="p-0">
      {data.length === 0 ? (
        <p className="p-5 text-sm text-muted-foreground">No production data for this period.</p>
      ) : (
        <ol className="divide-y">
          {data.map((item, index) => (
            <li
              key={`${item.label}-${index}`}
              className="flex items-center justify-between gap-3 px-4 py-3 text-sm"
            >
              <span className="min-w-0 truncate text-muted-foreground">{item.label}</span>
              <span className="font-semibold tabular-nums">{item.value.toLocaleString()}</span>
            </li>
          ))}
        </ol>
      )}
    </SectionCard>
  );
}

function Snapshot({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 font-semibold">{value}</p>
    </div>
  );
}
