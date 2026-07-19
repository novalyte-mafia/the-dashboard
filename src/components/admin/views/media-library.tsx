"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { contentService } from "@/services";
import type { Article } from "@/types";
import {
  PageHeader, MetricCard, LoadingState, EmptyState, SectionCard, StatusBadge,
} from "@/components/admin/shared/index";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Image as ImageIcon, Upload, Search, FileImage, Layers, Link2,
} from "lucide-react";
import { formatDate } from "@/lib/format";
import { toast } from "sonner";

interface MediaItem {
  id: string;
  name: string;
  type: "image";
  url: string | null;
  width: number | null;
  height: number | null;
  sizeKb: number;
  usedIn: string[];
  uploadedAt: string;
  alt: string;
  visibility: string;
}

export function MediaLibraryView() {
  const [articles, setArticles] = useState<Article[]>([]);
  const [media, setMedia] = useState<MediaItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [search, setSearch] = useState("");
  const [attachArticleId, setAttachArticleId] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const reload = async () => {
    setLoading(true);
    try {
      const [articleRes, mediaRes] = await Promise.all([
        contentService.listArticles(),
        contentService.listMedia(),
      ]);
      setArticles(articleRes.articles);
      setMedia(
        (mediaRes.media ?? []).map((row) => ({
          id: String(row.id),
          name: String(row.objectPath ?? row.id).split("/").pop() ?? String(row.id),
          type: "image" as const,
          url: typeof row.url === "string" ? row.url : null,
          width: typeof row.width === "number" ? row.width : null,
          height: typeof row.height === "number" ? row.height : null,
          sizeKb: Math.round(Number(row.byteSize ?? 0) / 1024),
          usedIn: [],
          uploadedAt: String(row.createdAt ?? new Date().toISOString()),
          alt: String(row.alt ?? ""),
          visibility: String(row.visibility ?? "draft"),
        })),
      );
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to load media.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void reload();
  }, []);

  const articleTitleById = useMemo(() => {
    const map = new Map<string, string>();
    articles.forEach((a) => map.set(a.id, a.title));
    return map;
  }, [articles]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    return media.filter((m) => {
      if (q && !`${m.name} ${m.alt}`.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [search, media]);

  const onUpload = async (file: File | null) => {
    if (!file) return;
    setUploading(true);
    try {
      const form = new FormData();
      form.set("file", file);
      form.set("alt", file.name.replace(/\.[^.]+$/, ""));
      form.set("visibility", "draft");
      if (attachArticleId) {
        form.set("articleId", attachArticleId);
        form.set("role", "inline");
      }
      await contentService.uploadMedia(form);
      toast.success("Uploaded to journal drafts bucket.");
      await reload();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Upload failed.");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  if (loading) return <LoadingState label="Loading media library…" />;

  const totalSize = media.reduce((s, m) => s + m.sizeKb, 0);
  const unused = media.filter((m) => m.usedIn.length === 0).length;
  const inUse = media.length - unused;

  return (
    <div>
      <PageHeader
        title="Media Library"
        description={`${media.length} assets · ${(totalSize / 1024).toFixed(1)} MB total`}
        action={
          <div className="flex items-center gap-2">
            <select
              value={attachArticleId}
              onChange={(e) => setAttachArticleId(e.target.value)}
              className="h-9 rounded-md border border-input bg-background px-2 text-sm"
            >
              <option value="">Upload unattached</option>
              {articles.map((a) => (
                <option key={a.id} value={a.id}>{a.title}</option>
              ))}
            </select>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => void onUpload(e.target.files?.[0] ?? null)}
            />
            <Button disabled={uploading} onClick={() => fileRef.current?.click()}>
              <Upload className="size-4" /> {uploading ? "Uploading…" : "Upload"}
            </Button>
          </div>
        }
      />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <MetricCard label="Total Assets" value={media.length} icon={ImageIcon} tone="default" />
        <MetricCard label="In Use" value={inUse} icon={Link2} tone="green" hint="Linked to articles" />
        <MetricCard label="Unused" value={unused} icon={ImageIcon} tone="amber" hint="Available to attach" />
        <MetricCard label="Storage Used" value={`${(totalSize / 1024).toFixed(1)} MB`} icon={Layers} tone="teal" />
      </div>

      <div className="mb-4 flex items-center gap-2">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name or alt…"
            className="pl-9"
          />
        </div>
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          title="No media yet"
          description="Upload images to the private journal-drafts bucket. Promote to journal-media on publish."
        />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((item) => (
            <SectionCard key={item.id} title={item.name}>
              <div className="space-y-3">
                <div className="aspect-video rounded-md border bg-muted/40 flex items-center justify-center overflow-hidden">
                  {item.url ? (
                    <img src={item.url} alt={item.alt} className="h-full w-full object-cover" />
                  ) : (
                    <div className="text-xs text-muted-foreground flex flex-col items-center gap-1">
                      <FileImage className="size-6" />
                      Draft asset (signed URL not exposed)
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <StatusBadge label={item.visibility} color={item.visibility === "published" ? "green" : "slate"} />
                  <span className="text-xs text-muted-foreground">{item.sizeKb} KB</span>
                </div>
                <div className="text-xs text-muted-foreground">
                  Alt: {item.alt || "—"}
                </div>
                <div className="text-xs text-muted-foreground">
                  Uploaded {formatDate(item.uploadedAt)}
                </div>
                <div className="flex gap-2">
                  <select
                    className="h-8 flex-1 rounded-md border border-input bg-background px-2 text-xs"
                    defaultValue=""
                    onChange={async (e) => {
                      const articleId = e.target.value;
                      if (!articleId) return;
                      try {
                        await contentService.attachMedia({
                          articleId,
                          mediaId: item.id,
                          role: "inline",
                        });
                        toast.success(`Attached to ${articleTitleById.get(articleId) ?? "article"}.`);
                      } catch (error) {
                        toast.error(error instanceof Error ? error.message : "Attach failed.");
                      }
                    }}
                  >
                    <option value="">Attach to article…</option>
                    {articles.map((a) => (
                      <option key={a.id} value={a.id}>{a.title}</option>
                    ))}
                  </select>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={async () => {
                      if (!attachArticleId && !articles[0]) {
                        toast.error("Select an article first.");
                        return;
                      }
                      const articleId = attachArticleId || articles[0]?.id;
                      if (!articleId) return;
                      try {
                        await contentService.attachMedia({
                          articleId,
                          mediaId: item.id,
                          role: "hero",
                        });
                        toast.success("Set as hero media.");
                      } catch (error) {
                        toast.error(error instanceof Error ? error.message : "Hero attach failed.");
                      }
                    }}
                  >
                    Set hero
                  </Button>
                </div>
              </div>
            </SectionCard>
          ))}
        </div>
      )}
    </div>
  );
}
