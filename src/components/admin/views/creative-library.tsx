"use client";

import { useState, useMemo } from "react";
import { useNav } from "@/components/admin/admin-app";
import {
  PageHeader, MetricCard, SectionCard, EmptyState,
  StatusBadge, FilterBar, type Column, DataTable,
} from "@/components/admin/shared";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  ImageIcon, Video, FileText, MousePointerClick, Eye,
  TrendingUp, Layers, Plus, Sparkles,
} from "lucide-react";
import { toast } from "sonner";

type CreativeType = "image" | "video" | "text" | "carousel";

interface Creative {
  id: string;
  name: string;
  type: CreativeType;
  platform: string;
  campaignId: string;
  campaignName: string;
  impressions: number;
  clicks: number;
  ctr: number;
  conversions: number;
  status: "active" | "paused" | "archived";
  thumbnail?: string;
  headline: string;
  bodyText: string;
}

const CREATIVES: Creative[] = [
  { id: "cr_1", name: "TRT — Before/After Carousel", type: "carousel", platform: "meta", campaignId: "cmp_1", campaignName: "TRT Search — National", impressions: 124000, clicks: 2480, ctr: 2.0, conversions: 96, status: "active", headline: "Real TRT Results", bodyText: "See real patient transformations after 12 weeks of TRT therapy." },
  { id: "cr_2", name: "GLP-1 — Doctor Talking Head", type: "video", platform: "meta", campaignId: "cmp_2", campaignName: "GLP-1 Display — TX & FL", impressions: 86000, clicks: 1720, ctr: 2.0, conversions: 64, status: "active", headline: "Why GLP-1 Works", bodyText: "Dr. Mitchell explains how GLP-1 medications support sustainable weight loss." },
  { id: "cr_3", name: "TRT Static — Energy Boost", type: "image", platform: "google", campaignId: "cmp_1", campaignName: "TRT Search — National", impressions: 92000, clicks: 1840, ctr: 2.0, conversions: 72, status: "active", headline: "Reclaim Your Energy", bodyText: "Fatigue isn't aging. It might be low T. Get tested today." },
  { id: "cr_4", name: "TRT TikTok — Hook Opener", type: "video", platform: "tiktok", campaignId: "cmp_4", campaignName: "TRT TikTok — Men 35-55", impressions: 220000, clicks: 3300, ctr: 1.5, conversions: 48, status: "paused", headline: "POV: You started TRT", bodyText: "The first 30 days on TRT, explained." },
  { id: "cr_5", name: "ED Care — Confidential Static", type: "image", platform: "google", campaignId: "", campaignName: "—", impressions: 38000, clicks: 570, ctr: 1.5, conversions: 18, status: "active", headline: "Discreet ED Care", bodyText: "Talk to a specialist from the privacy of home." },
  { id: "cr_6", name: "Email — Nurture Hero Image", type: "image", platform: "email", campaignId: "cmp_5", campaignName: "Email — Nurture Sequence", impressions: 12000, clicks: 1800, ctr: 15.0, conversions: 96, status: "active", headline: "Your Next Step", bodyText: "Schedule your consultation in under 2 minutes." },
  { id: "cr_7", name: "Peptide Therapy — Longevity Story", type: "carousel", platform: "meta", campaignId: "", campaignName: "—", impressions: 18000, clicks: 216, ctr: 1.2, conversions: 8, status: "active", headline: "Peptides 101", bodyText: "Everything you've heard about peptide therapy — explained." },
  { id: "cr_8", name: "TRT — Ad Copy Variant A", type: "text", platform: "google", campaignId: "cmp_1", campaignName: "TRT Search — National", impressions: 88000, clicks: 1760, ctr: 2.0, conversions: 58, status: "active", headline: "TRT Clinic Near You", bodyText: "Board-certified men's health specialists. Same-week appointments available." },
  { id: "cr_9", name: "Hormone Optimization — Quiz Ad", type: "image", platform: "meta", campaignId: "", campaignName: "—", impressions: 64000, clicks: 1024, ctr: 1.6, conversions: 31, status: "archived", headline: "Take the Hormone Quiz", bodyText: "10 questions. 2 minutes. Find out if you're a candidate." },
];

const TYPE_ICON: Record<CreativeType, typeof ImageIcon> = {
  image: ImageIcon,
  video: Video,
  text: FileText,
  carousel: Layers,
};

const PLATFORM_LABEL: Record<string, string> = {
  google: "Google",
  meta: "Meta",
  tiktok: "TikTok",
  linkedin: "LinkedIn",
  email: "Email",
};

const STATUS_COLOR: Record<string, string> = {
  active: "green",
  paused: "amber",
  archived: "slate",
};

const FILTERS = [
  {
    key: "platform",
    label: "Platform",
    options: Object.entries(PLATFORM_LABEL).map(([value, label]) => ({ value, label })),
  },
  {
    key: "type",
    label: "Type",
    options: [
      { value: "image", label: "Image" },
      { value: "video", label: "Video" },
      { value: "text", label: "Text" },
      { value: "carousel", label: "Carousel" },
    ],
  },
  {
    key: "status",
    label: "Status",
    options: [
      { value: "active", label: "Active" },
      { value: "paused", label: "Paused" },
      { value: "archived", label: "Archived" },
    ],
  },
];

export function CreativeLibraryView() {
  const [search, setSearch] = useState("");
  const [activeFilters, setActiveFilters] = useState<Record<string, string>>({});
  const [layout, setLayout] = useState<"grid" | "table">("grid");

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return CREATIVES.filter((c) => {
      if (q && !`${c.name} ${c.headline} ${c.campaignName}`.toLowerCase().includes(q)) return false;
      if (activeFilters.platform && c.platform !== activeFilters.platform) return false;
      if (activeFilters.type && c.type !== activeFilters.type) return false;
      if (activeFilters.status && c.status !== activeFilters.status) return false;
      return true;
    });
  }, [search, activeFilters]);

  const totals = useMemo(() => {
    const active = CREATIVES.filter((c) => c.status === "active");
    const totalImpressions = active.reduce((s, c) => s + c.impressions, 0);
    const totalClicks = active.reduce((s, c) => s + c.clicks, 0);
    const totalConversions = active.reduce((s, c) => s + c.conversions, 0);
    const avgCtr = totalImpressions > 0 ? Math.round((totalClicks / totalImpressions) * 1000) / 10 : 0;
    return { activeCount: active.length, totalImpressions, totalClicks, totalConversions, avgCtr };
  }, []);

  const columns: Column<Creative>[] = [
    {
      key: "name",
      header: "Creative",
      render: (c) => {
        const Icon = TYPE_ICON[c.type];
        return (
          <div className="min-w-0 flex items-center gap-2">
            <div className="size-8 rounded-md bg-primary/10 text-primary inline-flex items-center justify-center shrink-0">
              <Icon className="size-4" />
            </div>
            <div className="min-w-0">
              <div className="font-medium truncate">{c.name}</div>
              <div className="text-xs text-muted-foreground truncate">{c.headline}</div>
            </div>
          </div>
        );
      },
      sortValue: (c) => c.name,
    },
    {
      key: "platform",
      header: "Platform",
      render: (c) => <span className="text-sm">{PLATFORM_LABEL[c.platform] ?? c.platform}</span>,
      sortValue: (c) => c.platform,
      hideOnMobile: true,
    },
    {
      key: "type",
      header: "Type",
      render: (c) => <span className="text-xs text-muted-foreground uppercase">{c.type}</span>,
      sortValue: (c) => c.type,
      hideOnMobile: true,
    },
    {
      key: "impressions",
      header: "Impr",
      render: (c) => <span className="tabular-nums text-sm">{c.impressions.toLocaleString()}</span>,
      sortValue: (c) => c.impressions,
    },
    {
      key: "ctr",
      header: "CTR",
      render: (c) => <span className="tabular-nums text-sm">{c.ctr}%</span>,
      sortValue: (c) => c.ctr,
      hideOnMobile: true,
    },
    {
      key: "conversions",
      header: "Conv",
      render: (c) => <span className="tabular-nums text-sm font-medium">{c.conversions}</span>,
      sortValue: (c) => c.conversions,
    },
    {
      key: "status",
      header: "Status",
      render: (c) => <StatusBadge label={c.status} color={STATUS_COLOR[c.status] ?? "slate"} />,
      sortValue: (c) => c.status,
    },
  ];

  return (
    <div>
      <PageHeader
        title="Creative Library"
        description="Ad creative gallery — images, videos, carousels & text variants across campaigns"
        action={
          <div className="flex items-center gap-2">
            <div className="flex rounded-md border overflow-hidden">
              <Button
                variant={layout === "grid" ? "default" : "ghost"}
                size="sm"
                onClick={() => setLayout("grid")}
                className="rounded-none"
              >
                <Layers className="size-4" />
              </Button>
              <Button
                variant={layout === "table" ? "default" : "ghost"}
                size="sm"
                onClick={() => setLayout("table")}
                className="rounded-none"
              >
                <FileText className="size-4" />
              </Button>
            </div>
            <Button onClick={() => toast.info("Creative uploader — coming soon")}>
              <Plus className="size-4" /> Upload
            </Button>
          </div>
        }
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
        <MetricCard label="Active Creatives" value={totals.activeCount} icon={Sparkles} tone="teal" hint="Currently serving" />
        <MetricCard
          label="Total Impressions"
          value={`${(totals.totalImpressions / 1000).toFixed(0)}k`}
          icon={Eye}
          tone="violet"
          hint="Active creatives"
        />
        <MetricCard
          label="Total Clicks"
          value={totals.totalClicks.toLocaleString()}
          icon={MousePointerClick}
          tone="amber"
          hint={`CTR ${totals.avgCtr}%`}
        />
        <MetricCard
          label="Conversions"
          value={totals.totalConversions.toLocaleString()}
          icon={TrendingUp}
          tone="green"
          hint="Form fills & calls"
        />
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
        searchPlaceholder="Search creatives by name, headline, campaign…"
      />

      {filtered.length === 0 ? (
        <SectionCard>
          <EmptyState
            icon={ImageIcon}
            title="No creatives found"
            description="Upload creative assets or adjust filters to see results."
          />
        </SectionCard>
      ) : layout === "grid" ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {filtered.map((c) => {
            const Icon = TYPE_ICON[c.type];
            return (
              <Card key={c.id} className="p-4 gap-0 hover:shadow-sm transition-shadow">
                {/* Thumbnail */}
                <div className="aspect-video rounded-md bg-gradient-to-br from-primary/15 to-primary/5 flex items-center justify-center mb-3 relative">
                  <Icon className="size-8 text-primary/60" />
                  <div className="absolute top-2 right-2">
                    <StatusBadge label={c.status} color={STATUS_COLOR[c.status] ?? "slate"} />
                  </div>
                  <div className="absolute top-2 left-2">
                    <StatusBadge label={PLATFORM_LABEL[c.platform] ?? c.platform} color="slate" />
                  </div>
                </div>

                <div className="min-w-0">
                  <h3 className="text-sm font-semibold truncate">{c.name}</h3>
                  <p className="text-xs font-medium text-foreground mt-1 line-clamp-1">{c.headline}</p>
                  <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{c.bodyText}</p>
                </div>

                <div className="grid grid-cols-3 gap-2 mt-3 text-xs">
                  <Metric label="Impr" value={c.impressions >= 1000 ? `${(c.impressions / 1000).toFixed(0)}k` : c.impressions.toString()} />
                  <Metric label="CTR" value={`${c.ctr}%`} />
                  <Metric label="Conv" value={c.conversions.toString()} />
                </div>

                {c.campaignName !== "—" && (
                  <p className="text-[10px] text-muted-foreground mt-2 truncate">
                    Campaign: {c.campaignName}
                  </p>
                )}
              </Card>
            );
          })}
        </div>
      ) : (
        <SectionCard bodyClassName="p-0">
          <DataTable
            columns={columns}
            data={filtered}
            pageSize={15}
            emptyTitle="No creatives"
          />
        </SectionCard>
      )}
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-border/70 px-2 py-1.5 text-center">
      <p className="text-[10px] uppercase text-muted-foreground tracking-wide">{label}</p>
      <p className="text-sm font-medium tabular-nums">{value}</p>
    </div>
  );
}
