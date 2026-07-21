"use client";

import { useEffect, useMemo, useState } from "react";
import { useNav } from "@/components/admin/admin-app";
import {
  PageHeader, SectionCard, EmptyState, LoadingState,
  StatusBadge, FilterBar, DataTable, type Column,
} from "@/components/admin/shared";
import { Button } from "@/components/ui/button";
import { FileText, Globe2, Plus } from "lucide-react";
import { relativeTime } from "@/lib/format";
import { toast } from "sonner";

type Page = {
  id: string;
  public_title: string | null;
  path: string;
  status: string;
  host: string;
  campaign_id: string | null;
  updated_at: string;
};

const STATUS_COLOR: Record<string, string> = {
  draft: "slate",
  generating: "amber",
  generation_failed: "rose",
  needs_review: "amber",
  changes_requested: "amber",
  approved: "violet",
  scheduled: "teal",
  published: "green",
  paused: "amber",
  archived: "slate",
  redirected: "slate",
};

const FILTERS = [
  {
    key: "status",
    label: "Status",
    options: [
      { value: "draft", label: "Draft" },
      { value: "needs_review", label: "Needs review" },
      { value: "approved", label: "Approved" },
      { value: "published", label: "Published" },
      { value: "paused", label: "Paused" },
    ],
  },
  {
    key: "host",
    label: "Host",
    options: [
      { value: "organic", label: "Organic (novalyte.io)" },
      { value: "ads", label: "Ads (ads.novalyte.io)" },
    ],
  },
];

export function LandingPagesView() {
  const { navigate, refreshKey } = useNav();
  const [pages, setPages] = useState<Page[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [activeFilters, setActiveFilters] = useState<Record<string, string>>({});

  useEffect(() => {
    setLoading(true);
    fetch("/api/campaigns/pages")
      .then((r) => r.json())
      .then((data) => setPages(data.pages ?? []))
      .catch((err) => {
        toast.error(err instanceof Error ? err.message : "Unable to load pages.");
        setPages([]);
      })
      .finally(() => setLoading(false));
  }, [refreshKey]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return pages.filter((p) => {
      if (q && !`${p.public_title ?? ""} ${p.path}`.toLowerCase().includes(q)) return false;
      if (activeFilters.status && p.status !== activeFilters.status) return false;
      if (activeFilters.host && p.host !== activeFilters.host) return false;
      return true;
    });
  }, [pages, search, activeFilters]);

  const counts = useMemo(() => ({
    total: pages.length,
    published: pages.filter((p) => p.status === "published").length,
    organic: pages.filter((p) => p.host === "organic").length,
    ads: pages.filter((p) => p.host === "ads").length,
  }), [pages]);

  const columns: Column<Page>[] = [
    {
      key: "title",
      header: "Page",
      render: (p) => (
        <div className="min-w-0">
          <p className="font-medium truncate">{p.public_title ?? "Untitled"}</p>
          <p className="text-xs text-muted-foreground truncate">{p.path}</p>
        </div>
      ),
      sortValue: (p) => p.public_title ?? p.path,
    },
    {
      key: "host",
      header: "Host",
      render: (p) => (
        <span className="text-sm text-muted-foreground">{p.host === "ads" ? "ads" : "organic"}</span>
      ),
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
      key: "updated",
      header: "Updated",
      render: (p) => (
        <span className="text-sm text-muted-foreground tabular-nums">{relativeTime(p.updated_at)}</span>
      ),
      sortValue: (p) => p.updated_at,
      hideOnMobile: true,
    },
  ];

  if (loading) return <LoadingState label="Loading landing pages…" />;

  return (
    <div>
      <PageHeader
        title="Landing Pages"
        description="Campaign Studio pages on organic and ads hosts"
        action={
          <Button onClick={() => navigate("campaign-wizard")}>
            <Plus className="size-4" /> New via Wizard
          </Button>
        }
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
        <div className="rounded-lg border bg-card p-4">
          <p className="text-xs text-muted-foreground uppercase">Total pages</p>
          <p className="text-2xl font-semibold tabular-nums">{counts.total}</p>
        </div>
        <div className="rounded-lg border bg-card p-4">
          <p className="text-xs text-muted-foreground uppercase">Published</p>
          <p className="text-2xl font-semibold tabular-nums">{counts.published}</p>
        </div>
        <div className="rounded-lg border bg-card p-4">
          <p className="text-xs text-muted-foreground uppercase">Organic host</p>
          <p className="text-2xl font-semibold tabular-nums">{counts.organic}</p>
        </div>
        <div className="rounded-lg border bg-card p-4">
          <p className="text-xs text-muted-foreground uppercase">Ads host</p>
          <p className="text-2xl font-semibold tabular-nums">{counts.ads}</p>
        </div>
      </div>

      <FilterBar
        search={search}
        onSearchChange={setSearch}
        filters={FILTERS}
        activeFilters={activeFilters}
        onFilterChange={(k, v) => setActiveFilters((prev) => {
          const next = { ...prev };
          if (v) next[k] = v; else delete next[k];
          return next;
        })}
        onClear={() => setActiveFilters({})}
        searchPlaceholder="Search by title or path…"
      />

      {filtered.length === 0 ? (
        <SectionCard>
          <EmptyState
            icon={FileText}
            title="No landing pages"
            description="Create a campaign to generate landing pages."
            action={
              <Button onClick={() => navigate("campaign-wizard")}>
                <Plus className="size-4" /> Create Campaign
              </Button>
            }
          />
        </SectionCard>
      ) : (
        <SectionCard bodyClassName="p-0">
          <DataTable
            columns={columns}
            data={filtered}
            onRowClick={(p) => navigate("page-editor", null, { pageId: p.id })}
            pageSize={20}
            emptyTitle="No landing pages"
          />
        </SectionCard>
      )}

      <div className="flex justify-end mt-4">
        <Button variant="ghost" onClick={() => navigate("campaign-overview")}>
          <Globe2 className="size-4" /> Campaign Overview
        </Button>
      </div>
    </div>
  );
}
