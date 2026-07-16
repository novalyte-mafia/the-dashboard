"use client";

import { useEffect, useMemo, useState } from "react";
import { useNav } from "@/components/admin/admin-app";
import { contentService } from "@/services";
import type { Article } from "@/types";
import {
  PageHeader, MetricCard, DataTable, FilterBar, LoadingState,
  StatusBadge, ScoreBadge, SavedViewSelector,
} from "@/components/admin/shared/index";
import { Button } from "@/components/ui/button";
import {
  FileText, CheckCircle2, Clock, Edit3, Eye, CalendarDays, Plus,
} from "lucide-react";
import { relativeTime, formatDate } from "@/lib/format";
import { toast } from "sonner";

const STATUS_COLOR: Record<string, string> = {
  published: "green", scheduled: "teal", approved: "violet", review: "amber",
  draft: "slate", idea: "slate", brief: "slate", update_needed: "rose", archived: "slate",
};

const SAVED_VIEWS = ["All", "Published", "In Review", "Drafts", "Scheduled"];

const VIEW_STATUS_MAP: Record<string, string[]> = {
  All: [],
  Published: ["published"],
  "In Review": ["review", "approved"],
  Drafts: ["draft", "idea", "brief"],
  Scheduled: ["scheduled"],
};

export function ArticlesView() {
  const { navigate, refreshKey } = useNav();
  const [data, setData] = useState<Article[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [activeView, setActiveView] = useState("All");
  const [filters, setFilters] = useState<Record<string, string>>({});

  useEffect(() => {
    setLoading(true);
    contentService.listArticles()
      .then((d) => setData(d.articles))
      .finally(() => setLoading(false));
  }, [refreshKey]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    const viewStatuses = VIEW_STATUS_MAP[activeView] ?? [];
    return data.filter((a) => {
      if (q && !`${a.title} ${a.authorName} ${a.category} ${a.primaryKeyword ?? ""}`.toLowerCase().includes(q)) return false;
      if (viewStatuses.length > 0 && !viewStatuses.includes(a.status)) return false;
      if (filters.category && a.category !== filters.category) return false;
      if (filters.author && a.authorName !== filters.author) return false;
      return true;
    });
  }, [data, search, activeView, filters]);

  if (loading) return <LoadingState label="Loading articles…" />;

  const published = data.filter((a) => a.status === "published").length;
  const inReview = data.filter((a) => a.status === "review" || a.status === "approved").length;
  const drafts = data.filter((a) => a.status === "draft" || a.status === "idea" || a.status === "brief").length;
  const totalViews = data.filter((a) => a.status === "published").reduce((s, a) => s + (a.views ?? 0), 0);

  const categories = Array.from(new Set(data.map((a) => a.category))).sort();
  const authors = Array.from(new Set(data.map((a) => a.authorName))).sort();

  return (
    <div>
      <PageHeader
        title="Articles"
        description={`${data.length} articles in the editorial pipeline`}
        action={
          <Button onClick={() => navigate("content-studio")}>
            <Plus className="size-4" /> New Article
          </Button>
        }
      />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <MetricCard label="Total Articles" value={data.length} icon={FileText} tone="default" />
        <MetricCard label="Published" value={published} icon={CheckCircle2} tone="green" />
        <MetricCard label="In Review" value={inReview} icon={Clock} tone="amber" />
        <MetricCard label="Total Views" value={totalViews.toLocaleString()} icon={Eye} tone="violet" hint="Published only" />
      </div>

      <SavedViewSelector
        views={SAVED_VIEWS}
        active={activeView}
        onSelect={setActiveView}
      />

      <FilterBar
        search={search}
        onSearchChange={setSearch}
        filters={[
          { key: "category", label: "Category", options: categories.map((c) => ({ value: c, label: c })) },
          { key: "author", label: "Author", options: authors.map((a) => ({ value: a, label: a })) },
        ]}
        activeFilters={filters}
        onFilterChange={(k, v) => setFilters((f) => ({ ...f, [k]: v }))}
        onClear={() => { setSearch(""); setFilters({}); }}
        searchPlaceholder="Search by title, author, keyword…"
      />

      <DataTable
        data={filtered}
        onRowClick={(a) => navigate("content-studio", null, { articleId: a.id })}
        emptyTitle="No articles match"
        emptyDescription="Try a different saved view or filter."
        columns={[
          {
            key: "title",
            header: "Title",
            sortValue: (a) => a.title,
            render: (a) => (
              <div>
                <div className="font-medium">{a.title}</div>
                <div className="text-xs text-muted-foreground">{a.slug}</div>
              </div>
            ),
          },
          {
            key: "category",
            header: "Category",
            hideOnMobile: true,
            sortValue: (a) => a.category,
            render: (a) => <span className="text-sm">{a.category}</span>,
          },
          {
            key: "author",
            header: "Author",
            hideOnMobile: true,
            sortValue: (a) => a.authorName,
            render: (a) => <span className="text-sm">{a.authorName}</span>,
          },
          {
            key: "status",
            header: "Status",
            sortValue: (a) => a.status,
            render: (a) => <StatusBadge label={a.status.replace(/_/g, " ")} color={STATUS_COLOR[a.status] ?? "slate"} />,
          },
          {
            key: "seoScore",
            header: "SEO",
            sortValue: (a) => a.seoScore ?? 0,
            render: (a) => a.seoScore != null ? <ScoreBadge score={a.seoScore} /> : <span className="text-xs text-muted-foreground">—</span>,
          },
          {
            key: "views",
            header: "Views",
            hideOnMobile: true,
            sortValue: (a) => a.views ?? 0,
            render: (a) => (
              <span className="text-sm tabular-nums">{a.views != null ? a.views.toLocaleString() : "—"}</span>
            ),
          },
          {
            key: "publishDate",
            header: "Publish Date",
            hideOnMobile: true,
            sortValue: (a) => a.publishDate ? new Date(a.publishDate).getTime() : 0,
            render: (a) => (
              <span className="text-xs text-muted-foreground inline-flex items-center gap-1">
                <CalendarDays className="size-3" />
                {a.publishDate ? formatDate(a.publishDate) : "—"}
              </span>
            ),
          },
        ]}
      />
    </div>
  );
}
