"use client";

import { useState, useMemo } from "react";
import { useNav } from "@/components/admin/admin-app";
import {
  PageHeader, MetricCard, SectionCard, EmptyState,
  StatusBadge, FilterBar, DataTable, type Column,
} from "@/components/admin/shared";
import { Button } from "@/components/ui/button";
import {
  FileText, MousePointerClick, TrendingUp, Globe, Plus, ExternalLink,
} from "lucide-react";
import { toast } from "sonner";

interface LandingPage {
  id: string;
  name: string;
  url: string;
  campaignId: string;
  campaignName: string;
  visits: number;
  conversions: number;
  conversionRate: number;
  bounceRate: number;
  avgTimeOnPage: number;
  status: "published" | "draft" | "paused" | "archived";
  treatment: string;
}

const LANDING_PAGES: LandingPage[] = [
  { id: "lp_1", name: "TRT Consultation — Home", url: "novalyte.io/trt", campaignId: "cmp_1", campaignName: "TRT Search — National", visits: 8400, conversions: 312, conversionRate: 3.7, bounceRate: 42, avgTimeOnPage: 84, status: "published", treatment: "trt" },
  { id: "lp_2", name: "GLP-1 Weight Loss — TX", url: "novalyte.io/glp-1-tx", campaignId: "cmp_2", campaignName: "GLP-1 Display — TX & FL", visits: 6200, conversions: 248, conversionRate: 4.0, bounceRate: 38, avgTimeOnPage: 102, status: "published", treatment: "glp-1" },
  { id: "lp_3", name: "Directory Retarget — TRT", url: "novalyte.io/trt-retarget", campaignId: "cmp_3", campaignName: "Directory Retargeting", visits: 2700, conversions: 89, conversionRate: 3.3, bounceRate: 45, avgTimeOnPage: 67, status: "published", treatment: "trt" },
  { id: "lp_4", name: "TikTok TRT — Men 35-55", url: "novalyte.io/trt-tiktok", campaignId: "cmp_4", campaignName: "TRT TikTok — Men 35-55", visits: 7800, conversions: 156, conversionRate: 2.0, bounceRate: 52, avgTimeOnPage: 48, status: "paused", treatment: "trt" },
  { id: "lp_5", name: "Email Nurture — Booking", url: "novalyte.io/book-consult", campaignId: "cmp_5", campaignName: "Email — Nurture Sequence", visits: 1800, conversions: 96, conversionRate: 5.3, bounceRate: 28, avgTimeOnPage: 145, status: "published", treatment: "general" },
  { id: "lp_6", name: "ED Care — Confidential", url: "novalyte.io/ed-care", campaignId: "", campaignName: "—", visits: 0, conversions: 0, conversionRate: 0, bounceRate: 0, avgTimeOnPage: 0, status: "draft", treatment: "ed-care" },
  { id: "lp_7", name: "Peptide Therapy — Longevity", url: "novalyte.io/peptide-therapy", campaignId: "", campaignName: "—", visits: 0, conversions: 0, conversionRate: 0, bounceRate: 0, avgTimeOnPage: 0, status: "draft", treatment: "peptide-therapy" },
  { id: "lp_8", name: "Hormone Optimization — Men", url: "novalyte.io/hormone-optimization", campaignId: "", campaignName: "—", visits: 1240, conversions: 38, conversionRate: 3.1, bounceRate: 49, avgTimeOnPage: 72, status: "archived", treatment: "hormone-optimization" },
];

const STATUS_COLOR: Record<string, string> = {
  published: "green",
  draft: "slate",
  paused: "amber",
  archived: "slate",
};

const FILTERS = [
  {
    key: "status",
    label: "Status",
    options: [
      { value: "published", label: "Published" },
      { value: "draft", label: "Draft" },
      { value: "paused", label: "Paused" },
      { value: "archived", label: "Archived" },
    ],
  },
  {
    key: "treatment",
    label: "Treatment",
    options: [
      { value: "trt", label: "TRT" },
      { value: "glp-1", label: "GLP-1" },
      { value: "ed-care", label: "ED Care" },
      { value: "peptide-therapy", label: "Peptide Therapy" },
      { value: "hormone-optimization", label: "Hormone Optimization" },
      { value: "general", label: "General" },
    ],
  },
];

export function LandingPagesView() {
  const { navigate } = useNav();
  const [search, setSearch] = useState("");
  const [activeFilters, setActiveFilters] = useState<Record<string, string>>({});

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return LANDING_PAGES.filter((p) => {
      if (q && !`${p.name} ${p.url} ${p.campaignName}`.toLowerCase().includes(q)) return false;
      if (activeFilters.status && p.status !== activeFilters.status) return false;
      if (activeFilters.treatment && p.treatment !== activeFilters.treatment) return false;
      return true;
    });
  }, [search, activeFilters]);

  const totals = useMemo(() => {
    const published = LANDING_PAGES.filter((p) => p.status === "published");
    const totalVisits = published.reduce((s, p) => s + p.visits, 0);
    const totalConversions = published.reduce((s, p) => s + p.conversions, 0);
    const avgConvRate = totalVisits > 0 ? Math.round((totalConversions / totalVisits) * 1000) / 10 : 0;
    return {
      publishedCount: published.length,
      draftCount: LANDING_PAGES.filter((p) => p.status === "draft").length,
      totalVisits,
      totalConversions,
      avgConvRate,
    };
  }, []);

  const columns: Column<LandingPage>[] = [
    {
      key: "name",
      header: "Page Name",
      render: (p) => (
        <div className="min-w-0">
          <div className="font-medium truncate inline-flex items-center gap-1.5">
            <FileText className="size-3.5 text-muted-foreground" />
            {p.name}
          </div>
          <a
            href={`https://${p.url}`}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="text-xs text-primary truncate hover:underline inline-flex items-center gap-0.5"
          >
            {p.url} <ExternalLink className="size-2.5" />
          </a>
        </div>
      ),
      sortValue: (p) => p.name,
    },
    {
      key: "campaign",
      header: "Campaign",
      render: (p) => (
        <span className="text-sm text-muted-foreground truncate">{p.campaignName}</span>
      ),
      sortValue: (p) => p.campaignName,
      hideOnMobile: true,
    },
    {
      key: "visits",
      header: "Visits",
      render: (p) => <span className="tabular-nums text-sm">{p.visits.toLocaleString()}</span>,
      sortValue: (p) => p.visits,
    },
    {
      key: "conversions",
      header: "Conversions",
      render: (p) => <span className="tabular-nums text-sm">{p.conversions.toLocaleString()}</span>,
      sortValue: (p) => p.conversions,
      hideOnMobile: true,
    },
    {
      key: "convRate",
      header: "Conv Rate",
      render: (p) => (
        <span className={"tabular-nums text-sm font-medium " + (p.conversionRate >= 4 ? "text-emerald-600" : p.conversionRate >= 2 ? "text-amber-600" : p.conversionRate > 0 ? "text-rose-600" : "text-muted-foreground")}>
          {p.conversionRate > 0 ? `${p.conversionRate}%` : "—"}
        </span>
      ),
      sortValue: (p) => p.conversionRate,
    },
    {
      key: "bounceRate",
      header: "Bounce",
      render: (p) => <span className="tabular-nums text-sm text-muted-foreground">{p.bounceRate > 0 ? `${p.bounceRate}%` : "—"}</span>,
      sortValue: (p) => p.bounceRate,
      hideOnMobile: true,
    },
    {
      key: "status",
      header: "Status",
      render: (p) => <StatusBadge label={p.status} color={STATUS_COLOR[p.status] ?? "slate"} />,
      sortValue: (p) => p.status,
    },
    {
      key: "actions",
      header: "",
      render: (p) => (
        <Button
          size="sm"
          variant="ghost"
          onClick={(e) => {
            e.stopPropagation();
            toast.info(`Opening page editor · ${p.name}`);
          }}
        >
          Edit
        </Button>
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        title="Landing Pages"
        description="Conversion-optimized landing pages tied to ad campaigns"
        action={
          <Button onClick={() => toast.info("Landing page builder — coming soon")}>
            <Plus className="size-4" /> New Page
          </Button>
        }
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
        <MetricCard label="Published Pages" value={totals.publishedCount} icon={Globe} tone="teal" hint="Live & serving traffic" />
        <MetricCard label="Total Visits" value={totals.totalVisits.toLocaleString()} icon={MousePointerClick} tone="violet" hint="Across published pages" />
        <MetricCard label="Total Conversions" value={totals.totalConversions.toLocaleString()} icon={TrendingUp} tone="green" hint="Form fills & calls" />
        <MetricCard label="Avg Conv Rate" value={`${totals.avgConvRate}%`} icon={TrendingUp} tone="amber" hint="Across published pages" />
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
        searchPlaceholder="Search by page name, URL, campaign…"
      />

      {filtered.length === 0 ? (
        <SectionCard>
          <EmptyState
            icon={FileText}
            title="No landing pages"
            description="Create a landing page to start capturing conversions."
          />
        </SectionCard>
      ) : (
        <SectionCard bodyClassName="p-0">
          <DataTable
            columns={columns}
            data={filtered}
            pageSize={15}
            emptyTitle="No landing pages"
          />
        </SectionCard>
      )}

      <div className="flex justify-end mt-4">
        <Button variant="ghost" onClick={() => navigate("campaign-dashboard")}>
          Back to Campaigns
        </Button>
      </div>
    </div>
  );
}
