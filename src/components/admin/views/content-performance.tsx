"use client";

import { useCallback, useEffect, useState } from "react";
import { BookOpen, ExternalLink, Eye } from "lucide-react";
import { ChartCard, LoadingState, MetricCard, PageHeader, SectionCard } from "@/components/admin/shared";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";

type Datum = { label: string; value: number };
type ContentAnalytics = {
  configured: boolean;
  source: string;
  days: number;
  refreshedAt?: string;
  message?: string;
  error?: string;
  metrics?: { pageViews: number; bookingClicks: number };
  articles?: Datum[];
  trend?: Datum[];
};

export function ContentPerformanceView() {
  const [days, setDays] = useState(30);
  const [data, setData] = useState<ContentAnalytics | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/analytics/traffic?days=${days}`, { cache: "no-store" });
      setData((await response.json()) as ContentAnalytics);
    } finally {
      setLoading(false);
    }
  }, [days]);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading && !data) return <LoadingState label="Loading content performance…" />;

  const articleViews = (data?.articles ?? []).reduce((sum, article) => sum + article.value, 0);

  return (
    <div>
      <PageHeader
        title="Content Performance"
        description="Verified production Journal activity; no modeled or placeholder metrics"
        action={
          <div className="flex items-center gap-2">
            <Badge variant="outline">{data?.source ?? "PostHog"}</Badge>
            <select
              aria-label="Content analytics date range"
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
          {data?.message ?? "PostHog reporting is not configured."} Performance remains blank
          until the server-only credentials are available.
        </Card>
      )}
      {data?.error && (
        <Card className="mb-5 border-rose-200 bg-rose-50 p-4 text-sm text-rose-900">
          {data.error}
        </Card>
      )}

      <div className="mb-5 grid grid-cols-2 gap-3 md:grid-cols-3">
        <MetricCard label="Journal views" value={data?.configured ? articleViews : "—"} icon={Eye} tone="teal" hint="article_viewed events" />
        <MetricCard label="All page views" value={data?.metrics?.pageViews ?? "—"} icon={BookOpen} tone="violet" hint="PostHog $pageview" />
        <MetricCard label="Booking clicks" value={data?.metrics?.bookingClicks ?? "—"} icon={ExternalLink} tone="green" hint="PostHog event" />
      </div>

      <ChartCard
        title={`Production page-view trend — ${days} days`}
        data={data?.trend ?? []}
        type="line"
        className="mb-5"
      />

      <SectionCard title="Most-viewed Journal articles" description="Source: PostHog article_viewed events" bodyClassName="p-0">
        {(data?.articles ?? []).length === 0 ? (
          <p className="p-6 text-sm text-muted-foreground">No production article views for this period.</p>
        ) : (
          <ol className="divide-y">
            {data?.articles?.map((article, index) => (
              <li key={`${article.label}-${index}`} className="flex items-center justify-between gap-3 px-4 py-3">
                <span className="min-w-0 truncate text-sm">{article.label}</span>
                <span className="font-semibold tabular-nums">{article.value.toLocaleString()}</span>
              </li>
            ))}
          </ol>
        )}
      </SectionCard>
    </div>
  );
}
