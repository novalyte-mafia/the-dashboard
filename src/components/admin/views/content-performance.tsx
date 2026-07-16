"use client";

import { useEffect, useMemo, useState } from "react";
import { useNav } from "@/components/admin/admin-app";
import { contentService } from "@/services";
import type { Article } from "@/types";
import {
  PageHeader, MetricCard, ChartCard, LoadingState, EmptyState, SectionCard,
  StatusBadge, DataTable,
} from "@/components/admin/shared/index";
import {
  Eye, Clock, MousePointerClick, ArrowDownToLine, TrendingUp, FileText,
} from "lucide-react";
import { formatDate, relativeTime } from "@/lib/format";

const STATUS_COLOR: Record<string, string> = {
  published: "green", scheduled: "teal", approved: "violet", review: "amber",
  draft: "slate", idea: "slate", brief: "slate", update_needed: "rose", archived: "slate",
};

// Mock performance metrics for published articles
interface PerformanceData {
  avgTimeSec: number;
  bounceRate: number; // 0-100
  conversions: number;
}

const MOCK_PERF: Record<string, PerformanceData> = {
  art_1: { avgTimeSec: 184, bounceRate: 38, conversions: 42 },
  art_7: { avgTimeSec: 156, bounceRate: 42, conversions: 28 },
};

const TRAFFIC_TREND = Array.from({ length: 14 }, (_, i) => {
  const d = new Date(Date.now() - (13 - i) * 86400000);
  return {
    label: `${d.getMonth() + 1}/${d.getDate()}`,
    value: 1200 + Math.round(Math.sin(i * 0.7) * 400) + i * 80,
    color: "#14b8a6",
  };
});

export function ContentPerformanceView() {
  const { navigate, refreshKey } = useNav();
  const [data, setData] = useState<Article[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    contentService.listArticles()
      .then((d) => setData(d.articles))
      .finally(() => setLoading(false));
  }, [refreshKey]);

  const published = useMemo(() => data.filter((a) => a.status === "published"), [data]);

  const ranked = useMemo(() => {
    return [...published]
      .map((a) => ({
        article: a,
        views: a.views ?? 0,
        perf: MOCK_PERF[a.id] ?? { avgTimeSec: 120 + Math.floor(Math.random() * 90), bounceRate: 35 + Math.floor(Math.random() * 25), conversions: Math.floor(((a.views ?? 0) / 1000) * (3 + Math.random() * 5)) },
      }))
      .sort((a, b) => b.views - a.views);
  }, [published]);

  const viewsByArticle = useMemo(() => {
    return ranked.slice(0, 8).map((r) => ({
      label: r.article.title.length > 30 ? r.article.title.slice(0, 30) + "…" : r.article.title,
      value: r.views,
      color: "#14b8a6",
    }));
  }, [ranked]);

  if (loading) return <LoadingState label="Loading content performance…" />;

  const totalViews = published.reduce((s, a) => s + (a.views ?? 0), 0);
  const avgTime = ranked.length > 0 ? Math.round(ranked.reduce((s, r) => s + r.perf.avgTimeSec, 0) / ranked.length) : 0;
  const avgBounce = ranked.length > 0 ? Math.round(ranked.reduce((s, r) => s + r.perf.bounceRate, 0) / ranked.length) : 0;
  const totalConversions = ranked.reduce((s, r) => s + r.perf.conversions, 0);

  const formatDuration = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

  return (
    <div>
      <PageHeader
        title="Content Performance"
        description="How published articles are performing in search and on-site"
      />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <MetricCard label="Total Views" value={totalViews.toLocaleString()} icon={Eye} tone="teal" hint="Published articles" trend={18} />
        <MetricCard label="Avg Time on Page" value={formatDuration(avgTime)} icon={Clock} tone="violet" hint="Across all published" />
        <MetricCard label="Avg Bounce Rate" value={`${avgBounce}%`} icon={MousePointerClick} tone={avgBounce > 50 ? "amber" : "green"} />
        <MetricCard label="Conversions" value={totalConversions} icon={ArrowDownToLine} tone="green" hint="CTA clicks / consults" />
      </div>

      <ChartCard
        title="Traffic Trend (Last 14 Days)"
        data={TRAFFIC_TREND}
        type="line"
        className="mb-4"
      />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
        <ChartCard
          title="Views by Article (Top 8)"
          data={viewsByArticle}
          type="bar"
        />
        <SectionCard
          title="Performance Summary"
          description="Key content metrics"
        >
          <div className="space-y-3">
            <PerfRow label="Published articles" value={`${published.length} of ${data.length}`} />
            <PerfRow label="Total views (all-time)" value={totalViews.toLocaleString()} />
            <PerfRow label="Avg views per article" value={published.length > 0 ? Math.round(totalViews / published.length).toLocaleString() : "0"} />
            <PerfRow label="Avg time on page" value={formatDuration(avgTime)} />
            <PerfRow label="Avg bounce rate" value={`${avgBounce}%`} />
            <PerfRow label="Total conversions" value={totalConversions.toLocaleString()} />
            <PerfRow label="Conversion rate" value={`${totalViews > 0 ? ((totalConversions / totalViews) * 100).toFixed(2) : 0}%`} />
          </div>
        </SectionCard>
      </div>

      <SectionCard
        title="Article Performance Detail"
        description="Ranked by total views"
        bodyClassName="p-0"
      >
        {ranked.length === 0 ? (
          <EmptyState icon={FileText} title="No published articles yet" description="Publish articles to see performance data." />
        ) : (
          <DataTable
            data={ranked.map((r) => ({ id: r.article.id, ...r }))}
            onRowClick={(r) => navigate("content-studio", null, { articleId: r.article.id })}
            columns={[
              {
                key: "title",
                header: "Article",
                sortValue: (r) => r.article.title,
                render: (r) => (
                  <div>
                    <div className="font-medium">{r.article.title}</div>
                    <div className="text-xs text-muted-foreground">
                      {r.article.category} · published {relativeTime(r.article.publishDate ?? r.article.createdAt)}
                    </div>
                  </div>
                ),
              },
              {
                key: "views",
                header: "Views",
                sortValue: (r) => r.views,
                render: (r) => <span className="text-sm font-semibold tabular-nums">{r.views.toLocaleString()}</span>,
              },
              {
                key: "avgTime",
                header: "Avg Time",
                hideOnMobile: true,
                sortValue: (r) => r.perf.avgTimeSec,
                render: (r) => (
                  <span className={`text-sm tabular-nums ${r.perf.avgTimeSec > 180 ? "text-emerald-700 font-medium" : ""}`}>
                    {formatDuration(r.perf.avgTimeSec)}
                  </span>
                ),
              },
              {
                key: "bounceRate",
                header: "Bounce",
                hideOnMobile: true,
                sortValue: (r) => r.perf.bounceRate,
                render: (r) => (
                  <span className={`text-sm tabular-nums ${r.perf.bounceRate < 40 ? "text-emerald-700" : r.perf.bounceRate > 55 ? "text-rose-600" : ""}`}>
                    {r.perf.bounceRate}%
                  </span>
                ),
              },
              {
                key: "conversions",
                header: "Conversions",
                hideOnMobile: true,
                sortValue: (r) => r.perf.conversions,
                render: (r) => <span className="text-sm tabular-nums">{r.perf.conversions}</span>,
              },
              {
                key: "convRate",
                header: "Conv Rate",
                hideOnMobile: true,
                sortValue: (r) => r.views > 0 ? r.perf.conversions / r.views : 0,
                render: (r) => (
                  <span className="text-sm tabular-nums">
                    {r.views > 0 ? ((r.perf.conversions / r.views) * 100).toFixed(1) : "0"}%
                  </span>
                ),
              },
              {
                key: "status",
                header: "Status",
                render: (r) => <StatusBadge label={r.article.status} color={STATUS_COLOR[r.article.status]} />,
              },
            ]}
          />
        )}
      </SectionCard>
    </div>
  );
}

function PerfRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between py-2 border-b border-border/60 last:border-0">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="text-sm font-semibold tabular-nums">{value}</span>
    </div>
  );
}
