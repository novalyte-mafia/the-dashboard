"use client";

import { useEffect, useMemo, useState } from "react";
import { useNav } from "@/components/admin/admin-app";
import {
  PageHeader, MetricCard, SectionCard, DataTable, LoadingState, EmptyState,
  StatusBadge, type Column,
} from "@/components/admin/shared";
import { Button } from "@/components/ui/button";
import { Megaphone, Globe2, FileText, Plus } from "lucide-react";
import { relativeTime } from "@/lib/format";
import { toast } from "sonner";

type Campaign = {
  id: string;
  name: string;
  traffic_type: string | null;
  status: string;
  vertical_id: string | null;
  updated_at: string;
};

type Vertical = { id: string; name: string; slug: string };

type Page = { id: string; status: string; host: string };

const STATUS_COLOR: Record<string, string> = {
  draft: "slate",
  active: "green",
  paused: "amber",
  archived: "slate",
};

export function CampaignOverviewView() {
  const { navigate, refreshKey } = useNav();
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [pages, setPages] = useState<Page[]>([]);
  const [verticals, setVerticals] = useState<Vertical[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      fetch("/api/campaigns").then((r) => r.json()),
      fetch("/api/campaigns/pages").then((r) => r.json()),
      fetch("/api/campaigns/verticals").then((r) => r.json()),
    ])
      .then(([cData, pData, vData]) => {
        setCampaigns(cData.campaigns ?? []);
        setPages(pData.pages ?? []);
        setVerticals(vData.verticals ?? []);
      })
      .catch((err) => {
        toast.error(err instanceof Error ? err.message : "Unable to load campaigns.");
        setCampaigns([]);
        setPages([]);
      })
      .finally(() => setLoading(false));
  }, [refreshKey]);

  const verticalMap = useMemo(
    () => new Map(verticals.map((v) => [v.id, v.name])),
    [verticals],
  );

  const kpis = useMemo(() => {
    const published = pages.filter((p) => p.status === "published").length;
    const inReview = pages.filter((p) =>
      ["needs_review", "changes_requested", "approved"].includes(p.status),
    ).length;
    return {
      campaignCount: campaigns.length,
      pageCount: pages.length,
      published,
      inReview,
    };
  }, [campaigns, pages]);

  const columns: Column<Campaign>[] = [
    {
      key: "name",
      header: "Name",
      render: (c) => <span className="font-medium">{c.name}</span>,
      sortValue: (c) => c.name,
    },
    {
      key: "traffic",
      header: "Traffic",
      render: (c) => (
        <span className="text-sm text-muted-foreground">
          {c.traffic_type?.replace(/_/g, " ") ?? "—"}
        </span>
      ),
      sortValue: (c) => c.traffic_type ?? "",
      hideOnMobile: true,
    },
    {
      key: "status",
      header: "Status",
      render: (c) => (
        <StatusBadge label={c.status} color={STATUS_COLOR[c.status] ?? "slate"} />
      ),
      sortValue: (c) => c.status,
    },
    {
      key: "vertical",
      header: "Vertical",
      render: (c) => (
        <span className="text-sm text-muted-foreground">
          {c.vertical_id ? verticalMap.get(c.vertical_id) ?? "—" : "—"}
        </span>
      ),
      sortValue: (c) => (c.vertical_id ? verticalMap.get(c.vertical_id) ?? "" : ""),
      hideOnMobile: true,
    },
    {
      key: "updated",
      header: "Updated",
      render: (c) => (
        <span className="text-sm text-muted-foreground tabular-nums">
          {relativeTime(c.updated_at)}
        </span>
      ),
      sortValue: (c) => c.updated_at,
    },
  ];

  if (loading) return <LoadingState label="Loading campaigns…" />;

  return (
    <div>
      <PageHeader
        title="Campaigns"
        description="Organic and paid landing page campaigns"
        action={
          <Button onClick={() => navigate("campaign-wizard")}>
            <Plus className="size-4" /> Create Campaign
          </Button>
        }
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
        <MetricCard label="Campaigns" value={kpis.campaignCount} icon={Megaphone} tone="teal" />
        <MetricCard label="Landing Pages" value={kpis.pageCount} icon={Globe2} tone="violet" />
        <MetricCard label="Published" value={kpis.published} icon={FileText} tone="green" />
        <MetricCard label="In Review" value={kpis.inReview} icon={FileText} tone="amber" />
      </div>

      {campaigns.length === 0 ? (
        <SectionCard>
          <EmptyState
            icon={Megaphone}
            title="No campaigns yet"
            description="Create your first campaign to generate landing pages."
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
            data={campaigns}
            onRowClick={(c) => navigate("campaign-detail", null, { campaignId: c.id })}
            pageSize={15}
            emptyTitle="No campaigns"
          />
        </SectionCard>
      )}
    </div>
  );
}
