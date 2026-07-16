"use client";

import { useEffect, useMemo, useState } from "react";
import { contentService } from "@/services";
import type { Article } from "@/types";
import {
  PageHeader, MetricCard, LoadingState, EmptyState, SectionCard, StatusBadge,
} from "@/components/admin/shared/index";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Image as ImageIcon, Upload, Search, FileImage, Film, Layers, Plus, Link2,
} from "lucide-react";
import { formatDate } from "@/lib/format";
import { toast } from "sonner";

interface MediaItem {
  id: string;
  name: string;
  type: "image" | "video" | "illustration";
  url: string;
  width: number;
  height: number;
  sizeKb: number;
  usedIn: string[];
  uploadedAt: string;
  alt: string;
}

// Mock media gallery — would be backed by storage service in production
const MOCK_MEDIA: MediaItem[] = [
  { id: "med_1", name: "trt-injection-guide.jpg", type: "image", url: "", width: 1200, height: 800, sizeKb: 240, usedIn: ["art_1"], uploadedAt: new Date(Date.now() - 10 * 86400000).toISOString(), alt: "TRT injection technique" },
  { id: "med_2", name: "glp-1-vial-hero.jpg", type: "image", url: "", width: 1600, height: 900, sizeKb: 380, usedIn: ["art_2"], uploadedAt: new Date(Date.now() - 8 * 86400000).toISOString(), alt: "GLP-1 medication vial" },
  { id: "med_3", name: "low-t-symptoms-infographic.png", type: "illustration", url: "", width: 1080, height: 1080, sizeKb: 510, usedIn: ["art_3"], uploadedAt: new Date(Date.now() - 5 * 86400000).toISOString(), alt: "Low testosterone symptoms infographic" },
  { id: "med_4", name: "peptide-therapy-process.mp4", type: "video", url: "", width: 1920, height: 1080, sizeKb: 8200, usedIn: [], uploadedAt: new Date(Date.now() - 4 * 86400000).toISOString(), alt: "Peptide therapy process video" },
  { id: "med_5", name: "iv-therapy-clinic.jpg", type: "image", url: "", width: 1400, height: 933, sizeKb: 295, usedIn: ["art_5"], uploadedAt: new Date(Date.now() - 2 * 86400000).toISOString(), alt: "IV therapy clinic setting" },
  { id: "med_6", name: "hormone-cycle-diagram.svg", type: "illustration", url: "", width: 800, height: 600, sizeKb: 42, usedIn: ["art_6"], uploadedAt: new Date(Date.now() - 12 * 86400000).toISOString(), alt: "Hormone cycle diagram" },
  { id: "med_7", name: "ed-treatment-options.jpg", type: "image", url: "", width: 1200, height: 800, sizeKb: 210, usedIn: ["art_7"], uploadedAt: new Date(Date.now() - 20 * 86400000).toISOString(), alt: "ED treatment options visual" },
  { id: "med_8", name: "weight-loss-journey.jpg", type: "image", url: "", width: 1600, height: 1067, sizeKb: 360, usedIn: [], uploadedAt: new Date(Date.now() - 1 * 86400000).toISOString(), alt: "Weight loss journey before/after" },
  { id: "med_9", name: "clinic-consultation-room.jpg", type: "image", url: "", width: 1800, height: 1200, sizeKb: 440, usedIn: [], uploadedAt: new Date(Date.now() - 3 * 86400000).toISOString(), alt: "Modern clinic consultation room" },
  { id: "med_10", name: "supplement-stack-flatlay.jpg", type: "image", url: "", width: 1200, height: 1200, sizeKb: 280, usedIn: [], uploadedAt: new Date(Date.now() - 6 * 86400000).toISOString(), alt: "Supplement stack flatlay" },
];

const TYPE_COLOR: Record<string, string> = {
  image: "teal", video: "violet", illustration: "amber",
};
const TYPE_ICON: Record<string, React.ElementType> = {
  image: FileImage, video: Film, illustration: Layers,
};

export function MediaLibraryView() {
  const [articles, setArticles] = useState<Article[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("");

  useEffect(() => {
    contentService.listArticles()
      .then((d) => setArticles(d.articles))
      .finally(() => setLoading(false));
  }, []);

  const articleTitleById = useMemo(() => {
    const map = new Map<string, string>();
    articles.forEach((a) => map.set(a.id, a.title));
    return map;
  }, [articles]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    return MOCK_MEDIA.filter((m) => {
      if (q && !`${m.name} ${m.alt}`.toLowerCase().includes(q)) return false;
      if (typeFilter && m.type !== typeFilter) return false;
      return true;
    });
  }, [search, typeFilter]);

  if (loading) return <LoadingState label="Loading media library…" />;

  const totalSize = MOCK_MEDIA.reduce((s, m) => s + m.sizeKb, 0);
  const unused = MOCK_MEDIA.filter((m) => m.usedIn.length === 0).length;
  const inUse = MOCK_MEDIA.length - unused;

  return (
    <div>
      <PageHeader
        title="Media Library"
        description={`${MOCK_MEDIA.length} assets · ${(totalSize / 1024).toFixed(1)} MB total`}
        action={
          <Button onClick={() => toast.info("Upload flow — drag and drop your file.")}>
            <Upload className="size-4" /> Upload
          </Button>
        }
      />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <MetricCard label="Total Assets" value={MOCK_MEDIA.length} icon={ImageIcon} tone="default" />
        <MetricCard label="In Use" value={inUse} icon={Link2} tone="green" hint="Linked to articles" />
        <MetricCard label="Unused" value={unused} icon={ImageIcon} tone="amber" hint="Available to delete" />
        <MetricCard label="Storage Used" value={`${(totalSize / 1024).toFixed(1)} MB`} icon={Layers} tone="teal" />
      </div>

      <div className="flex flex-col sm:flex-row gap-2 mb-4">
        <div className="relative flex-1 max-w-md">
          <Search className="size-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name or alt text…"
            className="pl-9 h-9"
          />
        </div>
        <div className="flex items-center gap-2">
          {["", "image", "video", "illustration"].map((t) => (
            <button
              key={t || "all"}
              onClick={() => setTypeFilter(t)}
              className={`text-xs font-medium px-2.5 py-1.5 rounded-md border transition-colors ${
                typeFilter === t ? "bg-primary text-primary-foreground border-primary" : "bg-card hover:bg-accent"
              }`}
            >
              {t ? t.charAt(0).toUpperCase() + t.slice(1) + "s" : "All"}
            </button>
          ))}
        </div>
      </div>

      {/* Upload area */}
      <div
        className="mb-4 border-2 border-dashed border-border/70 rounded-lg p-6 text-center hover:border-primary/40 hover:bg-accent/20 transition-colors cursor-pointer"
        onClick={() => toast.info("File picker would open here.")}
      >
        <Upload className="size-6 text-muted-foreground mx-auto mb-2" />
        <p className="text-sm font-medium">Drop files here or click to upload</p>
        <p className="text-xs text-muted-foreground mt-1">Supports JPG, PNG, SVG, WebP, MP4 · Max 25 MB</p>
      </div>

      {filtered.length === 0 ? (
        <EmptyState icon={ImageIcon} title="No media found" description="Try adjusting your search or filter." />
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
          {filtered.map((m) => {
            const Icon = TYPE_ICON[m.type] ?? FileImage;
            return (
              <div
                key={m.id}
                className="rounded-lg border border-border/70 bg-card overflow-hidden hover:shadow-sm hover:border-primary/40 transition-all group"
              >
                <div
                  className="aspect-[4/3] bg-gradient-to-br from-muted to-muted/60 flex items-center justify-center relative"
                  onClick={() => toast.info(`Previewing ${m.name}`)}
                >
                  <Icon className="size-8 text-muted-foreground/60" />
                  <div className="absolute top-2 right-2">
                    <StatusBadge label={m.type} color={TYPE_COLOR[m.type]} className="!text-[9px]" />
                  </div>
                  {m.usedIn.length > 0 && (
                    <div className="absolute bottom-2 left-2 inline-flex items-center gap-1 bg-background/90 backdrop-blur px-1.5 py-0.5 rounded text-[10px] font-medium">
                      <Link2 className="size-2.5" />
                      {m.usedIn.length} {m.usedIn.length === 1 ? "article" : "articles"}
                    </div>
                  )}
                </div>
                <div className="p-2.5">
                  <div className="text-xs font-medium truncate" title={m.name}>{m.name}</div>
                  <div className="text-[10px] text-muted-foreground mt-0.5 tabular-nums">
                    {m.width}×{m.height} · {(m.sizeKb / 1024).toFixed(2)} MB
                  </div>
                  {m.usedIn.length > 0 ? (
                    <div className="text-[10px] text-teal-700 mt-1.5 truncate">
                      Used in: {m.usedIn.map((id) => articleTitleById.get(id)).filter(Boolean)[0] ?? "—"}
                      {m.usedIn.length > 1 && ` +${m.usedIn.length - 1} more`}
                    </div>
                  ) : (
                    <div className="text-[10px] text-amber-700 mt-1.5">Unused</div>
                  )}
                  <div className="text-[10px] text-muted-foreground mt-1">{formatDate(m.uploadedAt)}</div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <SectionCard
        title="Bulk Actions"
        description="Manage multiple assets at once"
        className="mt-4"
      >
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={() => toast.info("Select unused assets to delete.")}>
            Select Unused ({unused})
          </Button>
          <Button variant="outline" size="sm" onClick={() => toast.info("Bulk alt text generation queued.")}>
            <Plus className="size-3.5" /> Generate Alt Text (AI)
          </Button>
          <Button variant="outline" size="sm" onClick={() => toast.info("Export manifest generated.")}>
            Export Manifest
          </Button>
        </div>
      </SectionCard>
    </div>
  );
}
