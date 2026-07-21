"use client";

import { useEffect, useMemo, useState } from "react";
import { useNav } from "@/components/admin/admin-app";
import {
  PageHeader, SectionCard, LoadingState, EmptyState,
  StatusBadge, DataTable, type Column,
} from "@/components/admin/shared";
import { BarChart3, Globe2 } from "lucide-react";
import { toast } from "sonner";

type Page = {
  id: string;
  public_title: string | null;
  path: string;
  status: string;
  host: string;
  campaign_id: string | null;
};

const STATUS_COLOR: Record<string, string> = {
  published: "green",
  draft: "slate",
  needs_review: "amber",
  approved: "violet",
  paused: "amber",
};

export function CampaignAnalyticsView() {
  const { navigate, refreshKey } = useNav();
  const [pages, setPages] = useState<Page[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetch("/api/campaigns/pages")
      .then((r) => r.json())
      .then((data) => setPages(data.pages ?? []))
      .catch(() => {
        toast.error("Unable to load campaign pages.");
        setPages([]);
      })
      .finally(() => setLoading(false));
  }, [refreshKey]);

  const summary = useMemo(() => {
    const published = pages.filter((p) => p.status === "published");
    return {
      totalPages: pages.length,
      publishedCount: published.length,
      organic: pages.filter((p) => p.host === "organic").length,
      ads: pages.filter((p) => p.host === "ads").length,
    };
  }, [pages]);

  const columns: Column<Page>[] = [
    {
      key: "title",
      header: "Page",
      render: (p) => (
        <div className="min-w-0">
          <p className="font-medium truncate">{p.public_title ?? p.path}</p>
          <p className="text-xs text-muted-foreground truncate">{p.path}</p>
        </div>
      ),
      sortValue: (p) => p.public_title ?? p.path,
    },
    {
      key: "host",
      header: "Host",
      render: (p) => <span className="text-sm text-muted-foreground">{p.host}</span>,
      sortValue: (p) => p.host,
      hideOnMobile: true,
    },
    {
      key: "status",
      header: "Status",
      render: (p) => (
        <StatusBadge label={p.status.replace(/_/g, " ")} color={STATUS_COLOR[p.status] ?? "slate"} />
      ),
      sortValue: (p) => p.status,
    },
    {
      key: "leads",
      header: "Leads",
      render: () => <span className="text-sm text-muted-foreground">—</span>,
      hideOnMobile: true,
    },
    {
      key: "views",
      header: "Views",
      render: () => <span className="text-sm text-muted-foreground">—</span>,
      hideOnMobile: true,
    },
  ];

  if (loading) return <LoadingState label="Loading analytics…" />;

  const hasAnalytics = false;

  return (
    <div>
      <PageHeader
        title="Campaign Analytics"
        description="Landing page performance and lead attribution"
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
        <div className="rounded-lg border bg-card p-4">
          <p className="text-xs text-muted-foreground uppercase">Pages</p>
          <p className="text-2xl font-semibold tabular-nums">{summary.totalPages}</p>
        </div>
        <div className="rounded-lg border bg-card p-4">
          <p className="text-xs text-muted-foreground uppercase">Published</p>
          <p className="text-2xl font-semibold tabular-nums">{summary.publishedCount}</p>
        </div>
        <div className="rounded-lg border bg-card p-4">
          <p className="text-xs text-muted-foreground uppercase">Organic</p>
          <p className="text-2xl font-semibold tabular-nums">{summary.organic}</p>
        </div>
        <div className="rounded-lg border bg-card p-4">
          <p className="text-xs text-muted-foreground uppercase">Ads</p>
          <p className="text-2xl font-semibold tabular-nums">{summary.ads}</p>
        </div>
      </div>

      {!hasAnalytics ? (
        <SectionCard>
          <EmptyState
            icon={BarChart3}
            title="No campaign analytics yet"
            description="Daily views and leads will appear here once cs_page_analytics_daily is populated and an analytics API is wired."
            action={
              summary.totalPages > 0 ? (
                <button
                  type="button"
                  className="text-sm text-primary hover:underline inline-flex items-center gap-1"
                  onClick={() => navigate("landing-pages")}
                >
                  <Globe2 className="size-4" /> View landing pages
                </button>
              ) : undefined
            }
          />
        </SectionCard>
      ) : (
        <SectionCard bodyClassName="p-0">
          <DataTable columns={columns} data={pages} pageSize={20} emptyTitle="No data" />
        </SectionCard>
      )}
    </div>
  );
}
