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
import { Button } from "@/components/ui/button";
import { useNav } from "@/components/admin/admin-app";

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
  const { navigate } = useNav();
  const [days, setDays] = useState(30);
  const [data, setData] = useState<TrafficResponse | null>(null);
  const [sourceView, setSourceView] = useState<"overview" | "ga4" | "posthog">("overview");
  const [ga4, setGa4] = useState<{
    collectionConfigured: boolean;
    apiConfigured: boolean;
    propertyUrl: string | null;
    measurementId?: string | null;
    message: string | null;
    error?: string;
    days?: number;
    refreshedAt?: string;
    metrics?: {
      activeUsers: number;
      sessions: number;
      screenPageViews: number;
      engagedSessions: number;
      averageSessionDuration: number;
      bounceRate: number;
    } | null;
    channels?: Datum[];
    countries?: Datum[];
    devices?: Datum[];
    landingPages?: Datum[];
    sources?: Datum[];
  } | null>(null);
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

  useEffect(() => {
    fetch(`/api/analytics/ga4?days=${days}`, { cache: "no-store" })
      .then((response) => response.json())
      .then(setGa4)
      .catch(() => setGa4(null));
  }, [days]);

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

      <div className="mb-5 flex flex-wrap gap-2" aria-label="Analytics source">
        {(["overview", "ga4", "posthog"] as const).map((source) => (
          <Button
            key={source}
            size="sm"
            variant={sourceView === source ? "default" : "outline"}
            onClick={() => setSourceView(source)}
          >
            {source === "ga4" ? "Google Analytics" : source === "posthog" ? "PostHog" : "Overview"}
          </Button>
        ))}
        <Button size="sm" variant="outline" onClick={() => navigate("live-website-activity")}>
          Live activity
        </Button>
        <Button size="sm" variant="outline" onClick={() => navigate("form-submissions")}>
          Forms & conversions
        </Button>
      </div>

      {sourceView === "ga4" && (
        <div className="mb-5 space-y-5">
          <Card className="p-5">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <h2 className="font-semibold">Google Analytics 4</h2>
                <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
                  {ga4?.message ??
                    (ga4?.metrics
                      ? "Live GA4 Data API metrics for the selected range."
                      : "Checking GA4 reporting configuration…")}
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Badge variant="outline">
                    Collection {ga4?.collectionConfigured ? "configured" : "not confirmed"}
                  </Badge>
                  <Badge variant="outline">
                    Data API {ga4?.apiConfigured ? "configured" : "not configured"}
                  </Badge>
                  {ga4?.measurementId && <Badge variant="outline">{ga4.measurementId}</Badge>}
                </div>
              </div>
              {ga4?.propertyUrl && (
                <Button asChild variant="outline">
                  <a href={ga4.propertyUrl} target="_blank" rel="noreferrer">
                    Open GA4 property <ExternalLink className="size-4" />
                  </a>
                </Button>
              )}
            </div>
            {ga4?.error && (
              <p className="mt-4 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-900">
                {ga4.error}
              </p>
            )}
          </Card>

          {ga4?.metrics ? (
            <>
              <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
                <MetricCard label="Active users" value={ga4.metrics.activeUsers} icon={Users} tone="teal" hint="GA4" />
                <MetricCard label="Sessions" value={ga4.metrics.sessions} icon={Activity} tone="violet" hint="GA4" />
                <MetricCard
                  label="Page views"
                  value={ga4.metrics.screenPageViews}
                  icon={BookOpen}
                  tone="teal"
                  hint="GA4"
                />
                <MetricCard
                  label="Engaged sessions"
                  value={ga4.metrics.engagedSessions}
                  icon={MousePointerClick}
                  tone="green"
                  hint="GA4"
                />
                <MetricCard
                  label="Avg session (s)"
                  value={Math.round(ga4.metrics.averageSessionDuration)}
                  icon={Activity}
                  tone="amber"
                  hint="GA4"
                />
                <MetricCard
                  label="Bounce rate"
                  value={`${(ga4.metrics.bounceRate * 100).toFixed(1)}%`}
                  icon={ExternalLink}
                  tone="amber"
                  hint="GA4"
                />
              </div>
              <div className="grid gap-4 lg:grid-cols-3">
                <RankedList title="GA4 channels" data={ga4.channels ?? []} sourceLabel="GA4" />
                <RankedList title="GA4 sources" data={ga4.sources ?? []} sourceLabel="GA4" />
                <RankedList title="GA4 landing pages" data={ga4.landingPages ?? []} sourceLabel="GA4" />
              </div>
              <div className="grid gap-4 lg:grid-cols-2">
                <RankedList title="GA4 countries" data={ga4.countries ?? []} sourceLabel="GA4" />
                <RankedList title="GA4 devices" data={ga4.devices ?? []} sourceLabel="GA4" />
              </div>
            </>
          ) : (
            <Card className="border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
              GA4 numbers are not shown as PostHog numbers. To see Google Analytics inside this
              dashboard, add <code>GA4_PROPERTY_ID</code> and a read-only{" "}
              <code>GOOGLE_SERVICE_ACCOUNT_JSON</code> to the admin Vercel project, then grant that
              service account Viewer on the GA4 property. Until then use{" "}
              <strong>Open GA4 property</strong> or the PostHog / Live activity tabs.
            </Card>
          )}
        </div>
      )}

      {sourceView !== "ga4" && (
      <>
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
        <RankedList title="Traffic sources" data={data?.sources ?? []} sourceLabel="PostHog" />
        <RankedList title="UTM campaigns" data={data?.campaigns ?? []} sourceLabel="PostHog" />
        <RankedList title="Top landing pages" data={data?.landingPages ?? []} sourceLabel="PostHog" />
      </div>

      <div className="mb-5 grid gap-4 lg:grid-cols-2">
        <RankedList title="Most-viewed articles" data={data?.articles ?? []} sourceLabel="PostHog" />
        <RankedList title="Most-viewed clinic profiles" data={data?.clinics ?? []} sourceLabel="PostHog" />
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
      </>
      )}
    </div>
  );
}

function RankedList({
  title,
  data,
  sourceLabel = "PostHog",
}: {
  title: string;
  data: Datum[];
  sourceLabel?: string;
}) {
  return (
    <SectionCard title={title} description={`Source: ${sourceLabel}`} bodyClassName="p-0">
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
