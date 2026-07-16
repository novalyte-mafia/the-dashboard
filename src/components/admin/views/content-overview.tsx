"use client";

import { useEffect, useState } from "react";
import { useNav } from "@/components/admin/admin-app";
import { contentService } from "@/services";
import type { Article } from "@/types";
import {
  PageHeader, MetricCard, SectionCard, LoadingState, EmptyState,
  StatusBadge, ScoreBadge,
} from "@/components/admin/shared/index";
import { Button } from "@/components/ui/button";
import {
  FileText, Eye, CheckCircle2, Clock, Edit3, ArrowRight, Calendar, TrendingUp,
} from "lucide-react";
import { relativeTime, formatDate } from "@/lib/format";
import { toast } from "sonner";

const STATUS_COLOR: Record<string, string> = {
  published: "green", scheduled: "teal", approved: "violet", review: "amber",
  draft: "slate", idea: "slate", brief: "slate", update_needed: "rose", archived: "slate",
};

export function ContentOverviewView() {
  const { navigate, refreshKey } = useNav();
  const [data, setData] = useState<Article[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    contentService.listArticles()
      .then((d) => setData(d.articles))
      .finally(() => setLoading(false));
  }, [refreshKey]);

  if (loading) return <LoadingState label="Loading content overview…" />;

  const published = data.filter((a) => a.status === "published");
  const inReview = data.filter((a) => a.status === "review");
  const drafts = data.filter((a) => a.status === "draft" || a.status === "idea" || a.status === "brief");
  const scheduled = data.filter((a) => a.status === "scheduled");
  const totalViews = published.reduce((s, a) => s + (a.views ?? 0), 0);

  const recent = [...data]
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 6);

  const reviewQueue = inReview.slice(0, 4);

  return (
    <div>
      <PageHeader
        title="Content & Journal"
        description="Editorial pipeline, publishing queue, and SEO performance"
        action={
          <Button onClick={() => navigate("content-studio")}>
            <Edit3 className="size-4" /> New Article
          </Button>
        }
      />

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3 mb-6">
        <MetricCard label="Total Articles" value={data.length} icon={FileText} tone="default" onClick={() => navigate("articles")} />
        <MetricCard label="Published" value={published.length} icon={CheckCircle2} tone="green" onClick={() => navigate("articles")} />
        <MetricCard label="In Review" value={inReview.length} icon={Clock} tone="amber" onClick={() => navigate("articles")} />
        <MetricCard label="Drafts" value={drafts.length} icon={Edit3} tone="teal" onClick={() => navigate("articles")} />
        <MetricCard label="Total Views" value={totalViews.toLocaleString()} icon={Eye} tone="violet" hint="Across published" onClick={() => navigate("content-performance")} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <SectionCard
          title="Recent Articles"
          description="Latest activity across pipeline"
          className="lg:col-span-2"
          bodyClassName="p-0"
          action={
            <Button variant="ghost" size="sm" onClick={() => navigate("articles")}>
              View all <ArrowRight className="size-3.5" />
            </Button>
          }
        >
          {recent.length === 0 ? (
            <EmptyState title="No articles yet" description="Create your first piece in Content Studio." />
          ) : (
            <div className="divide-y divide-border/60">
              {recent.map((a) => (
                <button
                  key={a.id}
                  onClick={() => navigate("content-studio", null, { articleId: a.id })}
                  className="w-full px-4 py-3 hover:bg-accent/40 transition-colors text-left flex items-center justify-between gap-3"
                >
                  <div className="min-w-0">
                    <div className="text-sm font-medium truncate">{a.title}</div>
                    <div className="text-xs text-muted-foreground truncate">
                      {a.category} · by {a.authorName}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {a.seoScore != null && <ScoreBadge score={a.seoScore} />}
                    <StatusBadge label={a.status} color={STATUS_COLOR[a.status] ?? "slate"} />
                  </div>
                </button>
              ))}
            </div>
          )}
        </SectionCard>

        <div className="space-y-4">
          <SectionCard
            title="Needs Review"
            description="Awaiting editorial sign-off"
            bodyClassName="p-0"
            action={
              reviewQueue.length > 0 && (
                <Button variant="ghost" size="sm" onClick={() => navigate("articles")}>
                  All <ArrowRight className="size-3.5" />
                </Button>
              )
            }
          >
            {reviewQueue.length === 0 ? (
              <EmptyState icon={CheckCircle2} title="Nothing in review" description="All caught up." />
            ) : (
              <div className="divide-y divide-border/60">
                {reviewQueue.map((a) => (
                  <button
                    key={a.id}
                    onClick={() => navigate("content-studio", null, { articleId: a.id })}
                    className="w-full px-4 py-2.5 hover:bg-accent/40 transition-colors text-left"
                  >
                    <div className="text-sm font-medium truncate">{a.title}</div>
                    <div className="text-xs text-muted-foreground">
                      by {a.authorName} · {a.wordCount ?? 0} words
                    </div>
                  </button>
                ))}
              </div>
            )}
          </SectionCard>

          <SectionCard
            title="Publishing Queue"
            description="Scheduled & approved"
            bodyClassName="p-0"
            action={
              scheduled.length > 0 && (
                <Button variant="ghost" size="sm" onClick={() => navigate("editorial-calendar")}>
                  Calendar <ArrowRight className="size-3.5" />
                </Button>
              )
            }
          >
            {scheduled.length === 0 ? (
              <EmptyState icon={Calendar} title="No scheduled posts" description="Plan ahead in Editorial Calendar." />
            ) : (
              <div className="divide-y divide-border/60">
                {scheduled.map((a) => (
                  <div key={a.id} className="px-4 py-2.5">
                    <div className="text-sm font-medium truncate">{a.title}</div>
                    <div className="text-xs text-muted-foreground inline-flex items-center gap-1">
                      <Calendar className="size-3" />
                      {a.publishDate ? formatDate(a.publishDate) : "—"}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </SectionCard>
        </div>
      </div>

      <SectionCard
        title="Performance Snapshot"
        description="Top published articles by views"
        className="mt-4"
        bodyClassName="p-0"
        action={
          <Button variant="ghost" size="sm" onClick={() => navigate("content-performance")}>
            Full report <ArrowRight className="size-3.5" />
          </Button>
        }
      >
        {published.length === 0 ? (
          <EmptyState icon={TrendingUp} title="No published articles yet" description="Publish articles to see performance." />
        ) : (
          <div className="divide-y divide-border/60">
            {[...published]
              .sort((a, b) => (b.views ?? 0) - (a.views ?? 0))
              .slice(0, 5)
              .map((a, i) => (
                <div key={a.id} className="px-4 py-3 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="size-6 rounded-md bg-muted text-xs font-semibold text-muted-foreground flex items-center justify-center shrink-0 tabular-nums">
                      {i + 1}
                    </div>
                    <div className="min-w-0">
                      <div className="text-sm font-medium truncate">{a.title}</div>
                      <div className="text-xs text-muted-foreground">
                        {a.category} · published {relativeTime(a.publishDate ?? a.createdAt)}
                      </div>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="text-sm font-semibold tabular-nums">{(a.views ?? 0).toLocaleString()}</div>
                    <div className="text-xs text-muted-foreground">views</div>
                  </div>
                </div>
              ))}
          </div>
        )}
      </SectionCard>
    </div>
  );
}
