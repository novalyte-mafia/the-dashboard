"use client";

import { useEffect, useMemo, useState } from "react";
import { useNav } from "@/components/admin/admin-app";
import {
  PageHeader, SectionCard, DataTable, LoadingState, EmptyState,
  StatusBadge, type Column,
} from "@/components/admin/shared";
import { Button } from "@/components/ui/button";
import { Megaphone, Globe2, FileText, PenTool, Rocket, Loader2, type LucideIcon } from "lucide-react";
import { relativeTime } from "@/lib/format";
import { toast } from "sonner";

type Campaign = {
  id: string;
  name: string;
  traffic_type: string | null;
  status: string;
  objective: string | null;
  updated_at: string;
};

type Target = {
  id: string;
  geo_id: string | null;
  vertical_id: string | null;
  intent: string | null;
  warnings: unknown[];
};

type Page = {
  id: string;
  path: string;
  public_title: string | null;
  status: string;
  host: string;
  updated_at: string;
};

const STATUS_COLOR: Record<string, string> = {
  draft: "slate",
  generating: "amber",
  generation_failed: "rose",
  needs_review: "amber",
  changes_requested: "amber",
  approved: "violet",
  published: "green",
  paused: "amber",
  archived: "slate",
};

export function CampaignDetailView({ params }: { params?: Record<string, unknown> | null }) {
  const { navigate, refreshKey, refresh } = useNav();
  const campaignId = (params as { campaignId?: string } | undefined)?.campaignId;

  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [targets, setTargets] = useState<Target[]>([]);
  const [pages, setPages] = useState<Page[]>([]);
  const [loading, setLoading] = useState(true);
  const [publishing, setPublishing] = useState(false);
  const [selectedPageIds, setSelectedPageIds] = useState<Set<string>>(new Set());
  const [articleLoading, setArticleLoading] = useState(false);

  useEffect(() => {
    if (!campaignId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    Promise.all([
      fetch(`/api/campaigns/${campaignId}`).then((r) => r.json()),
      fetch(`/api/campaigns/pages?campaignId=${campaignId}`).then((r) => r.json()),
    ])
      .then(([cData, pData]) => {
        if (cData.error) throw new Error(cData.error);
        setCampaign(cData.campaign ?? null);
        setTargets(cData.targets ?? []);
        setPages(pData.pages ?? []);
      })
      .catch((err) => {
        toast.error(err instanceof Error ? err.message : "Unable to load campaign.");
        setCampaign(null);
        setPages([]);
      })
      .finally(() => setLoading(false));
  }, [campaignId, refreshKey]);

  const pageColumns: Column<Page>[] = [
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
      key: "updated",
      header: "Updated",
      render: (p) => (
        <span className="text-sm text-muted-foreground tabular-nums">{relativeTime(p.updated_at)}</span>
      ),
      sortValue: (p) => p.updated_at,
      hideOnMobile: true,
    },
  ];

  const togglePage = (id: string) => {
    setSelectedPageIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const publishSelected = async () => {
    const approved = pages.filter(
      (p) => selectedPageIds.has(p.id) && p.status === "approved",
    );
    if (approved.length === 0) {
      toast.error("Select approved pages to publish.");
      return;
    }
    setPublishing(true);
    let ok = 0;
    for (const p of approved) {
      try {
        const res = await fetch(`/api/campaigns/pages/${p.id}/actions`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "publish", index: true }),
        });
        if (res.ok) ok += 1;
      } catch {
        /* continue */
      }
    }
    setPublishing(false);
    toast.success(`Published ${ok} of ${approved.length} pages`);
    refresh();
  };

  const createArticle = async (pageId?: string) => {
    if (!campaignId) return;
    setArticleLoading(true);
    try {
      const res = await fetch(`/api/campaigns/${campaignId}/article`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pageId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Article creation failed");
      toast.success("Supporting article draft created");
      navigate("content-studio", null, { articleId: data.articleId });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Unable to create article.");
    } finally {
      setArticleLoading(false);
    }
  };

  const summary = useMemo(() => {
    const published = pages.filter((p) => p.status === "published").length;
    const inReview = pages.filter((p) =>
      ["needs_review", "changes_requested", "approved"].includes(p.status),
    ).length;
    return { total: pages.length, published, inReview, targets: targets.length };
  }, [pages, targets]);

  if (!campaignId) {
    return (
      <SectionCard>
        <EmptyState
          icon={Megaphone}
          title="No campaign selected"
          description="Open a campaign from Campaign Overview."
          action={<Button onClick={() => navigate("campaign-overview")}>Go to Overview</Button>}
        />
      </SectionCard>
    );
  }

  if (loading) return <LoadingState label="Loading campaign…" />;

  if (!campaign) {
    return (
      <SectionCard>
        <EmptyState
          icon={Megaphone}
          title="Campaign not found"
          action={<Button onClick={() => navigate("campaign-overview")}>Back to Overview</Button>}
        />
      </SectionCard>
    );
  }

  return (
    <div>
      <PageHeader
        title={campaign.name}
        description={campaign.objective ?? campaign.traffic_type?.replace(/_/g, " ") ?? "Campaign detail"}
        breadcrumbs={[
          { label: "Campaign Overview", onClick: () => navigate("campaign-overview") },
          { label: campaign.name },
        ]}
        action={
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => createArticle()} disabled={articleLoading}>
              {articleLoading ? <Loader2 className="size-4 animate-spin" /> : <PenTool className="size-4" />}
              Supporting article
            </Button>
            <Button
              onClick={publishSelected}
              disabled={publishing || selectedPageIds.size === 0}
            >
              {publishing ? <Loader2 className="size-4 animate-spin" /> : <Rocket className="size-4" />}
              Publish selected
            </Button>
          </div>
        }
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
        <MetricCardSimple label="Pages" value={summary.total} icon={Globe2} />
        <MetricCardSimple label="Published" value={summary.published} icon={FileText} />
        <MetricCardSimple label="In workflow" value={summary.inReview} icon={FileText} />
        <MetricCardSimple label="Targets" value={summary.targets} icon={Megaphone} />
      </div>

      <SectionCard title="Landing pages" bodyClassName="p-0">
        {pages.length === 0 ? (
          <EmptyState
            icon={Globe2}
            title="No pages yet"
            description="Run generation from the wizard or regenerate targets."
          />
        ) : (
          <DataTable
            columns={[
              {
                key: "select",
                header: "",
                render: (p) => (
                  <input
                    type="checkbox"
                    checked={selectedPageIds.has(p.id)}
                    onChange={() => togglePage(p.id)}
                    onClick={(e) => e.stopPropagation()}
                    className="rounded border-input"
                  />
                ),
              },
              ...pageColumns,
            ]}
            data={pages}
            onRowClick={(p) => navigate("page-editor", null, { pageId: p.id })}
            pageSize={15}
            emptyTitle="No pages"
          />
        )}
      </SectionCard>

      {targets.length > 0 && (
        <SectionCard title="Targets" className="mt-5">
          <ul className="text-sm space-y-1 text-muted-foreground">
            {targets.map((t) => (
              <li key={t.id}>
                Target {t.id.slice(0, 8)}… · intent: {t.intent ?? "—"}
                {Array.isArray(t.warnings) && t.warnings.length > 0 && (
                  <span className="text-amber-600 ml-2">({t.warnings.length} warnings)</span>
                )}
              </li>
            ))}
          </ul>
        </SectionCard>
      )}
    </div>
  );
}

function MetricCardSimple({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: number;
  icon: LucideIcon;
}) {
  return (
    <div className="rounded-lg border bg-card p-4">
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium text-muted-foreground uppercase">{label}</p>
        <Icon className="size-4 text-muted-foreground" />
      </div>
      <p className="text-2xl font-semibold tabular-nums mt-1">{value}</p>
    </div>
  );
}
