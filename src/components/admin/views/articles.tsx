"use client";

import { useEffect, useMemo, useState } from "react";
import { useNav } from "@/components/admin/admin-app";
import { contentService } from "@/services";
import type { Article } from "@/types";
import {
  PageHeader, MetricCard, DataTable, FilterBar, LoadingState,
  StatusBadge, ScoreBadge, SavedViewSelector, DataSourceBadge,
} from "@/components/admin/shared/index";
import { Button } from "@/components/ui/button";
import {
  FileText, CheckCircle2, Clock, Eye, CalendarDays, Plus,
  MoreHorizontal, Copy, Archive, Rocket, Undo2, ExternalLink,
} from "lucide-react";
import { formatDate } from "@/lib/format";
import { toast } from "sonner";

const STATUS_COLOR: Record<string, string> = {
  published: "green", scheduled: "teal", approved: "violet", review: "amber",
  draft: "slate", idea: "slate", brief: "slate", update_needed: "rose", archived: "slate",
};

const SAVED_VIEWS = ["All", "Published", "In Review", "Drafts", "Scheduled", "Archived"];

const VIEW_STATUS_MAP: Record<string, string[]> = {
  All: [],
  Published: ["published"],
  "In Review": ["review", "approved"],
  Drafts: ["draft", "idea", "brief"],
  Scheduled: ["scheduled"],
  Archived: ["archived"],
};

export function ArticlesView() {
  const { navigate, refreshKey } = useNav();
  const [data, setData] = useState<Article[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [activeView, setActiveView] = useState("All");
  const [filters, setFilters] = useState<Record<string, string>>({});
  const [busyId, setBusyId] = useState<string | null>(null);
  const [openMenu, setOpenMenu] = useState<string | null>(null);

  const reload = () => {
    setLoading(true);
    contentService.listArticles()
      .then((d) => setData(d.articles))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    reload();
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

  const runAction = async (
    article: Article,
    action: "publish" | "unpublish" | "archive" | "duplicate",
  ) => {
    setBusyId(article.id);
    setOpenMenu(null);
    try {
      if (action === "duplicate") {
        const { article: copy } = await contentService.articleAction(article.id, { action: "duplicate" });
        toast.success("Article duplicated.");
        navigate("content-studio", null, { articleId: copy.id });
        return;
      }
      await contentService.articleAction(article.id, {
        action,
        rowVersion: article.rowVersion,
      });
      toast.success(
        action === "publish"
          ? "Published."
          : action === "unpublish"
            ? "Unpublished."
            : "Archived.",
      );
      reload();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Action failed.");
    } finally {
      setBusyId(null);
    }
  };

  const openPreview = async (article: Article) => {
    setBusyId(article.id);
    setOpenMenu(null);
    try {
      const { previewUrl } = await contentService.createPreviewToken(article.id);
      window.open(previewUrl, "_blank", "noopener,noreferrer");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Preview unavailable.");
    } finally {
      setBusyId(null);
    }
  };

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
        description={`${data.length} articles in the editorial pipeline · ${drafts} drafts`}
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
                <div className="font-medium flex items-center gap-2">
                  {a.title} <DataSourceBadge source={a.dataSource} />
                  {!a.heroImageUrl && a.status !== "idea" && (
                    <span className="text-[10px] uppercase tracking-wide text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded">
                      Missing media
                    </span>
                  )}
                </div>
                <div className="text-xs text-muted-foreground">{a.slug}</div>
                <div className="text-[11px] text-muted-foreground mt-0.5">
                  {a.wordCount != null ? `${a.wordCount} words` : "—"}
                  {a.readingTime != null ? ` · ${a.readingTime} min` : ""}
                  {a.liveUrl ? ` · ${a.liveUrl}` : ""}
                </div>
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
          {
            key: "actions",
            header: "",
            render: (a) => (
              <div className="relative" onClick={(e) => e.stopPropagation()}>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-8 w-8 p-0"
                  disabled={busyId === a.id}
                  onClick={() => setOpenMenu((id) => (id === a.id ? null : a.id))}
                >
                  <MoreHorizontal className="size-4" />
                </Button>
                {openMenu === a.id && (
                  <div className="absolute right-0 z-20 mt-1 w-44 rounded-md border bg-popover p-1 shadow-md">
                    <MenuItem
                      icon={Rocket}
                      label="Publish"
                      onClick={() => void runAction(a, "publish")}
                    />
                    <MenuItem
                      icon={Undo2}
                      label="Unpublish"
                      onClick={() => void runAction(a, "unpublish")}
                    />
                    <MenuItem
                      icon={Archive}
                      label="Archive"
                      onClick={() => void runAction(a, "archive")}
                    />
                    <MenuItem
                      icon={Copy}
                      label="Duplicate"
                      onClick={() => void runAction(a, "duplicate")}
                    />
                    <MenuItem
                      icon={ExternalLink}
                      label="Exact preview"
                      onClick={() => void openPreview(a)}
                    />
                    <MenuItem
                      icon={Eye}
                      label="Open editor"
                      onClick={() => navigate("content-studio", null, { articleId: a.id })}
                    />
                  </div>
                )}
              </div>
            ),
          },
        ]}
      />
    </div>
  );
}

function MenuItem({
  icon: Icon,
  label,
  onClick,
}: {
  icon: React.ElementType;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left text-sm hover:bg-muted"
      onClick={onClick}
    >
      <Icon className="size-3.5" />
      {label}
    </button>
  );
}
