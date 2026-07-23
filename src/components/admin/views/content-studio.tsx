"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNav } from "@/components/admin/admin-app";
import { contentGenerationService, contentService } from "@/services";
import type { Article } from "@/types";
import type { JournalArticleV1 } from "@/lib/journal-article-v1";
import { normalizeJournalSlug } from "@/lib/journal-article-v1";
import {
  PageHeader, SectionCard, LoadingState, StatusBadge, FormSection,
} from "@/components/admin/shared/index";
import { ArticleMdxEditor } from "@/components/admin/content/article-mdx-editor";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Sparkles, Eye, Save, Send, BookOpen, Search, Gauge, CheckCircle2, AlertCircle,
  ExternalLink, History, Upload, Rocket,
} from "lucide-react";
import { toast } from "sonner";

const STATUS_COLOR: Record<string, string> = {
  published: "green", scheduled: "teal", approved: "violet", review: "amber",
  draft: "slate", idea: "slate", brief: "slate", update_needed: "rose", archived: "slate",
};

const CATEGORIES = ["Treatment Guides", "Symptoms", "Wellness", "Performance", "Weight Loss", "Patient Stories", "Industry News"];
const TREATMENTS = ["trt", "glp-1", "peptide-therapy", "iv-therapy", "hormone-optimization", "ed-care", "longevity", "general"];
const AUDIENCES = ["men_25_plus", "men_35_plus", "men_40_plus", "weight_loss_seekers", "athletes", "general_audience"];
const INTENTS = ["informational", "commercial", "transactional", "navigational"];

type SeoChecks = { score: number; checks: { id: string; label: string; ok: boolean }[] };
type PendingAi =
  | { kind: "markdown"; label: string; markdown: string }
  | { kind: "seo"; label: string; metaTitle: string; metaDescription: string; slug?: string; primaryKeyword?: string; secondaryKeywords?: string[] }
  | { kind: "outline"; label: string; markdown: string; title?: string; excerpt?: string; slug?: string };

function countWords(text: string): number {
  return text.replace(/[#>*_`|-]/g, " ").split(/\s+/).filter(Boolean).length;
}

function readingTime(text: string): number {
  return Math.max(1, Math.round(countWords(text) / 225));
}

export function ContentStudioView({ params }: { params?: Record<string, unknown> | null }) {
  const { navigate, refreshKey } = useNav();
  const articleIdParam = (params as { articleId?: string } | undefined)?.articleId;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveState, setSaveState] = useState<"idle" | "dirty" | "saving" | "saved" | "conflict">("idle");
  const [tab, setTab] = useState<"edit" | "preview">("edit");
  const [generating, setGenerating] = useState(false);
  const [glmModel, setGlmModel] = useState("glm-5.2");
  const [articleId, setArticleId] = useState<string | null>(articleIdParam ?? null);
  const [rowVersion, setRowVersion] = useState(1);
  const [status, setStatus] = useState<Article["status"]>("draft");
  const [editorKey, setEditorKey] = useState("new");
  const [seo, setSeo] = useState<SeoChecks | null>(null);
  const [revisions, setRevisions] = useState<Array<{
    id: string;
    revision_number: number;
    change_summary: string | null;
    created_at: string;
  }>>([]);
  const [pendingAi, setPendingAi] = useState<PendingAi | null>(null);

  const [title, setTitle] = useState("");
  const [slug, setSlug] = useState("");
  const [excerpt, setExcerpt] = useState("");
  const [body, setBody] = useState("");
  const [category, setCategory] = useState(CATEGORIES[0]);
  const [treatment, setTreatment] = useState(TREATMENTS[0]);
  const [audience, setAudience] = useState(AUDIENCES[0]);
  const [searchIntent, setSearchIntent] = useState(INTENTS[0]);
  const [primaryKeyword, setPrimaryKeyword] = useState("");
  const [secondaryKeywords, setSecondaryKeywords] = useState("");
  const [metaTitle, setMetaTitle] = useState("");
  const [metaDescription, setMetaDescription] = useState("");
  const [canonicalUrl, setCanonicalUrl] = useState("");
  const [noIndex, setNoIndex] = useState(false);
  const [tags, setTags] = useState("");
  const [author, setAuthor] = useState("Jamil Yakasai");
  const [reviewer, setReviewer] = useState("");
  const [heroSrc, setHeroSrc] = useState("");
  const [heroAlt, setHeroAlt] = useState("");
  const [heroCaption, setHeroCaption] = useState("");
  const [references, setReferences] = useState<JournalArticleV1["references"]>([]);
  const [faqs, setFaqs] = useState<JournalArticleV1["faqs"]>([]);

  const dirtyRef = useRef(false);
  const autosaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hydrateRef = useRef(false);

  const markDirty = useCallback(() => {
    if (!hydrateRef.current) return;
    dirtyRef.current = true;
    setSaveState("dirty");
  }, []);

  const applyArticle = useCallback((article: JournalArticleV1, nextSeo?: SeoChecks) => {
    hydrateRef.current = false;
    setArticleId(article.id);
    setRowVersion(article.rowVersion);
    setTitle(article.title);
    setSlug(article.slug);
    setExcerpt(article.excerpt);
    setBody(article.contentMarkdown ?? "");
    setCategory(article.category || CATEGORIES[0]);
    setTreatment(article.relatedTreatment ?? TREATMENTS[0]);
    setPrimaryKeyword(article.keywords.primary ?? "");
    setSecondaryKeywords((article.keywords.secondary ?? []).join(", "));
    setMetaTitle(article.seo.title ?? "");
    setMetaDescription(article.seo.description ?? "");
    setCanonicalUrl(article.seo.canonicalUrl ?? "");
    setNoIndex(article.seo.noIndex);
    setTags(article.tags.join(", "));
    setAuthor(article.author.name);
    setReviewer(article.medicalReviewer?.name ?? "");
    setStatus(article.status);
    setHeroSrc(article.hero.src ?? "");
    setHeroAlt(article.hero.alt ?? "");
    setHeroCaption(article.hero.caption ?? "");
    setReferences(article.references);
    setFaqs(article.faqs);
    setEditorKey(`${article.id}:${article.rowVersion}`);
    if (nextSeo) setSeo(nextSeo);
    dirtyRef.current = false;
    setSaveState("saved");
    queueMicrotask(() => {
      hydrateRef.current = true;
    });
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    (async () => {
      try {
        if (articleIdParam) {
          const { article, seo: nextSeo } = await contentService.getArticle(articleIdParam);
          if (cancelled) return;
          applyArticle(article, nextSeo);
          const rev = await contentService.listRevisions(articleIdParam).catch(() => ({ revisions: [] }));
          if (!cancelled) setRevisions(rev.revisions);
        } else {
          hydrateRef.current = true;
          setArticleId(null);
          setRowVersion(1);
          setSaveState("idle");
        }
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Unable to load article.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [articleIdParam, refreshKey, applyArticle]);

  const buildPayload = useCallback(
    (overrides?: Record<string, unknown>) => ({
      title: title.trim() || "Untitled",
      slug: slug.trim() || normalizeJournalSlug(title) || undefined,
      excerpt,
      category,
      contentMarkdown: body,
      relatedTreatment: treatment,
      author: { name: author.trim() || "Novalyte Editorial", role: "Author", bio: "" },
      medicalReviewer: reviewer.trim()
        ? { name: reviewer.trim(), role: "Medical Reviewer" }
        : null,
      seo: {
        title: metaTitle || null,
        description: metaDescription || null,
        canonicalUrl: canonicalUrl || null,
        noIndex,
      },
      keywords: {
        primary: primaryKeyword || null,
        secondary: secondaryKeywords
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean),
      },
      hero: {
        src: heroSrc,
        alt: heroAlt,
        caption: heroCaption || null,
      },
      tags: tags
        .split(",")
        .map((value) => value.trim())
        .filter(Boolean),
      references,
      faqs,
      rowVersion,
      ...overrides,
    }),
    [
      title, slug, excerpt, category, body, treatment, author, reviewer,
      metaTitle, metaDescription, canonicalUrl, noIndex, tags,
      primaryKeyword, secondaryKeywords,
      heroSrc, heroAlt, heroCaption, references, faqs, rowVersion,
    ],
  );

  const persist = useCallback(
    async (opts?: { status?: Article["status"]; silent?: boolean; changeSummary?: string }) => {
      if (!title.trim() && !body.trim()) {
        if (!opts?.silent) toast.error("Add a title or body before saving.");
        return null;
      }
      if (
        references.some((reference) => !reference.label.trim() || !reference.source.trim()) ||
        faqs.some((faq) => !faq.question.trim() || !faq.answer.trim())
      ) {
        if (!opts?.silent) {
          toast.error("Complete or remove unfinished sources and FAQs before saving.");
        }
        return null;
      }
      setSaving(true);
      setSaveState("saving");
      try {
        if (!articleId) {
          const created = await contentService.createArticle({
            ...buildPayload(),
            status: opts?.status ?? "draft",
          });
          applyArticle(created.article);
          navigate("content-studio", null, { articleId: created.article.id });
          if (!opts?.silent) toast.success("Draft created.");
          return created.article;
        }

        const payload = buildPayload({
          status: opts?.status ?? status,
          changeSummary: opts?.changeSummary ?? "Autosave",
        });
        const updated = opts?.silent
          ? await contentService.autosaveArticle(articleId, payload)
          : await contentService.updateArticle(articleId, payload);
        applyArticle(updated.article, updated.seo);
        if (!opts?.silent) {
          setRevisions((await contentService.listRevisions(articleId)).revisions);
          toast.success("Saved.");
        }
        return updated.article;
      } catch (error: any) {
        if (error?.conflict && error.article) {
          setSaveState("conflict");
          toast.error("Conflict: another session updated this article. Reload to continue.");
          return null;
        }
        toast.error(error instanceof Error ? error.message : "Save failed.");
        setSaveState("dirty");
        return null;
      } finally {
        setSaving(false);
      }
    },
    [
      articleId,
      buildPayload,
      applyArticle,
      navigate,
      status,
      title,
      body,
      references,
      faqs,
    ],
  );

  useEffect(() => {
    if (saveState !== "dirty" || !articleId) return;
    if (
      references.some((reference) => !reference.label.trim() || !reference.source.trim()) ||
      faqs.some((faq) => !faq.question.trim() || !faq.answer.trim())
    ) {
      return;
    }
    if (autosaveTimer.current) clearTimeout(autosaveTimer.current);
    autosaveTimer.current = setTimeout(() => {
      void persist({ silent: true, changeSummary: "Autosave" });
    }, 1800);
    return () => {
      if (autosaveTimer.current) clearTimeout(autosaveTimer.current);
    };
  }, [
    saveState,
    articleId,
    body,
    title,
    excerpt,
    slug,
    metaTitle,
    metaDescription,
    canonicalUrl,
    noIndex,
    tags,
    primaryKeyword,
    secondaryKeywords,
    heroCaption,
    references,
    faqs,
    persist,
  ]);

  const words = countWords(body);
  const readMins = readingTime(body || "word");

  const readabilityScore = useMemo(() => {
    if (body.length < 100) return 0;
    const sentences = body.split(/[.!?]+/).filter((s) => s.trim().length > 0).length || 1;
    const avg = words / sentences;
    return Math.max(0, Math.min(100, Math.round(100 - (avg - 12) * 4)));
  }, [body, words]);

  const advisoryScore = seo?.score ?? 0;

  const acceptPendingAi = () => {
    if (!pendingAi) return;
    if (pendingAi.kind === "markdown" || pendingAi.kind === "outline") {
      setBody(pendingAi.markdown);
      if (pendingAi.kind === "outline") {
        if (pendingAi.title) setTitle(pendingAi.title);
        if (pendingAi.excerpt) setExcerpt(pendingAi.excerpt);
        if (pendingAi.slug) setSlug(pendingAi.slug);
      }
      setEditorKey(`ai-${Date.now()}`);
    } else {
      setMetaTitle(pendingAi.metaTitle);
      setMetaDescription(pendingAi.metaDescription);
      if (pendingAi.slug) setSlug(pendingAi.slug);
      if (pendingAi.primaryKeyword) setPrimaryKeyword(pendingAi.primaryKeyword);
      if (pendingAi.secondaryKeywords) {
        setSecondaryKeywords(pendingAi.secondaryKeywords.join(", "));
      }
    }
    markDirty();
    setPendingAi(null);
    toast.success("AI suggestion applied.");
  };

  const runOutlineGenerate = async () => {
    setGenerating(true);
    try {
      const { outline } = await contentGenerationService.generateOutline({
        topic: title || primaryKeyword || "Men's health article",
        category,
        audience,
        searchIntent,
        primaryKeyword: primaryKeyword || undefined,
        secondaryKeywords: secondaryKeywords
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean),
        targetWordCount: 4200,
        articleId: articleId ?? undefined,
        model: glmModel,
      });
      const markdown = [
        `# ${outline.title}`,
        "",
        outline.excerpt,
        "",
        ...outline.sections.flatMap((section) => [
          `## ${section.heading}`,
          "",
          ...(section.keyPoints ?? []).map((p) => `- ${p}`),
          "",
        ]),
      ].join("\n");
      setPendingAi({
        kind: "outline",
        label: "Generated outline",
        markdown,
        title: outline.title,
        excerpt: outline.excerpt,
        slug: outline.slug,
      });
      toast.message("Outline ready — accept to apply (won't overwrite until you accept).");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Outline generation failed.");
    } finally {
      setGenerating(false);
    }
  };

  const runFullGenerate = async () => {
    setGenerating(true);
    try {
      const { outline } = await contentGenerationService.generateOutline({
        topic: title || primaryKeyword || "Men's health article",
        category,
        audience,
        searchIntent,
        primaryKeyword: primaryKeyword || undefined,
        secondaryKeywords: secondaryKeywords
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean),
        targetWordCount: 4200,
        articleId: articleId ?? undefined,
        model: glmModel,
      });
      const { article } = await contentGenerationService.generateArticle({
        outline,
        secondaryKeywords: secondaryKeywords
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean),
        articleId: articleId ?? undefined,
        model: glmModel,
      });
      setPendingAi({
        kind: "markdown",
        label: article.complete ? "Generated article" : "Partial article (some sections failed)",
        markdown: article.contentMarkdown,
      });
      toast.message("Draft ready — accept to apply.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Generation failed.");
    } finally {
      setGenerating(false);
    }
  };

  const runSeoSuggest = async () => {
    setGenerating(true);
    try {
      const { seo: suggestion } = await contentGenerationService.suggestSeo({
        title,
        excerpt,
        category,
        primaryKeyword: primaryKeyword || undefined,
        contentMarkdown: body.slice(0, 6000),
        articleId: articleId ?? undefined,
      });
      setPendingAi({
        kind: "seo",
        label: "SEO suggestions",
        metaTitle: suggestion.seoTitle,
        metaDescription: suggestion.seoDescription,
        slug: suggestion.slug,
        primaryKeyword: suggestion.suggestedPrimaryKeyword ?? undefined,
        secondaryKeywords: suggestion.suggestedSecondaryKeywords,
      });
      toast.message("SEO suggestions ready — accept to apply.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "SEO suggestion failed.");
    } finally {
      setGenerating(false);
    }
  };

  const runKeywordResearch = async () => {
    const seed = primaryKeyword || title;
    if (!seed.trim()) {
      toast.error("Add a primary keyword or title first.");
      return;
    }
    setGenerating(true);
    try {
      const result = await contentService.researchKeywords({
        seedKeyword: seed,
        topic: title || undefined,
        additionalKeywords: secondaryKeywords
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean),
      });
      setPendingAi({
        kind: "seo",
        label:
          result.provider === "dataforseo"
            ? "DataForSEO keywords"
            : "AI keyword recommendations (no invented metrics)",
        metaTitle,
        metaDescription,
        primaryKeyword: result.keywords.primary ?? primaryKeyword,
        secondaryKeywords: result.keywords.secondary,
      });
      toast.message(
        result.provider === "dataforseo"
          ? "Keyword metrics ready — accept to apply."
          : "Labeled AI keyword ideas ready — accept to apply.",
      );
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Keyword research failed.");
    } finally {
      setGenerating(false);
    }
  };

  const openExactPreview = async () => {
    const saved = await persist({ silent: true, changeSummary: "Preview snapshot" });
    const id = saved?.id ?? articleId;
    if (!id) return;
    try {
      const { previewUrl } = await contentService.createPreviewToken(id);
      window.open(previewUrl, "_blank", "noopener,noreferrer");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Preview unavailable.");
    }
  };

  const onUploadHero = async (file: File | null) => {
    if (!file) return;
    const form = new FormData();
    form.set("file", file);
    form.set("alt", heroAlt || title || file.name);
    form.set("visibility", "draft");
    if (articleId) {
      form.set("articleId", articleId);
      form.set("role", "hero");
    }
    try {
      const { media } = await contentService.uploadMedia(form);
      if (typeof media.url === "string" && media.url) setHeroSrc(media.url);
      if (typeof media.alt === "string") setHeroAlt(media.alt);
      markDirty();
      toast.success("Hero image uploaded.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Upload failed.");
    }
  };

  if (loading) return <LoadingState label="Loading content studio…" />;

  return (
    <div>
      <PageHeader
        title={articleId ? "Edit Article" : "Content Studio"}
        description={
          saveState === "saving"
            ? "Saving…"
            : saveState === "dirty"
              ? "Unsaved changes"
              : saveState === "conflict"
                ? "Version conflict — reload before saving"
                : articleId
                  ? title || "Untitled"
                  : "Create a new SEO-optimized article"
        }
        action={
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={saving}
              onClick={() => void persist({ changeSummary: "Manual save" })}
            >
              <Save className="size-4" /> Save Draft
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={saving || !articleId}
              onClick={() => void openExactPreview()}
            >
              <ExternalLink className="size-4" /> Exact Preview
            </Button>
            <Button
              size="sm"
              disabled={saving}
              onClick={async () => {
                const saved = await persist({ status: "review", changeSummary: "Sent to review" });
                if (saved && articleId) {
                  await contentService.articleAction(saved.id, {
                    action: "review",
                    rowVersion: saved.rowVersion,
                  }).catch(() => null);
                }
                toast.success("Sent to review.");
              }}
            >
              <Send className="size-4" /> Send to Review
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={saving || !articleId || status !== "review"}
              onClick={async () => {
                if (!articleId) return;
                const saved = await persist({ silent: true });
                if (!saved) return;
                try {
                  const { article } = await contentService.articleAction(articleId, {
                    action: "approve",
                    rowVersion: saved.rowVersion,
                  });
                  applyArticle(article);
                  toast.success("Editorial review approved.");
                } catch (error) {
                  toast.error(error instanceof Error ? error.message : "Approval failed.");
                }
              }}
            >
              <CheckCircle2 className="size-4" /> Approve
            </Button>
            <Button
              size="sm"
              variant="secondary"
              disabled={saving || !articleId || status !== "approved"}
              onClick={async () => {
                if (!articleId) return;
                const saved = await persist({ silent: true });
                if (!saved) return;
                try {
                  const { article } = await contentService.articleAction(articleId, {
                    action: "publish",
                    rowVersion: saved.rowVersion,
                  });
                  applyArticle(article);
                  toast.success("Published to Journal.");
                } catch (error) {
                  toast.error(error instanceof Error ? error.message : "Publish failed.");
                }
              }}
            >
              <Rocket className="size-4" /> Publish
            </Button>
          </div>
        }
      />

      {pendingAi && (
        <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm">
          <div className="font-medium text-amber-900">{pendingAi.label}</div>
          <div className="mt-1 text-amber-800">
            AI output is staged. Accept to apply, or dismiss to keep your current edits.
          </div>
          <div className="mt-3 flex gap-2">
            <Button size="sm" onClick={acceptPendingAi}>Accept</Button>
            <Button size="sm" variant="outline" onClick={() => setPendingAi(null)}>Dismiss</Button>
          </div>
        </div>
      )}

      <div className="flex items-center gap-1 mb-4 border-b">
        <button
          onClick={() => setTab("edit")}
          className={`px-3 py-2 text-sm font-medium border-b-2 transition-colors ${tab === "edit" ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`}
        >
          <BookOpen className="size-3.5 inline mr-1.5" />
          Editor
        </button>
        <button
          onClick={() => setTab("preview")}
          className={`px-3 py-2 text-sm font-medium border-b-2 transition-colors ${tab === "preview" ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`}
        >
          <Eye className="size-3.5 inline mr-1.5" />
          Preview
        </button>
        <div className="ml-auto flex items-center gap-2">
          <span className="text-xs text-muted-foreground tabular-nums">
            {words} words · {readMins} min read · v{rowVersion}
          </span>
          <StatusBadge label={status.replace(/_/g, " ")} color={STATUS_COLOR[status]} />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 space-y-4">
          {tab === "edit" ? (
            <>
              <SectionCard title="Article Details">
                <div className="space-y-3">
                  <div>
                    <Label className="text-xs">Title</Label>
                    <Input
                      value={title}
                      onChange={(e) => {
                        setTitle(e.target.value);
                        if (!slug || slug === normalizeJournalSlug(title)) {
                          setSlug(normalizeJournalSlug(e.target.value));
                        }
                        markDirty();
                      }}
                      placeholder="e.g. TRT Therapy: Complete Guide for Men Over 40"
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Slug</Label>
                    <Input
                      value={slug}
                      onChange={(e) => {
                        setSlug(e.target.value);
                        markDirty();
                      }}
                      className="mt-1 font-mono text-sm"
                    />
                    <div className="text-xs text-muted-foreground mt-1">
                      Public URL: /journal/{slug || "auto-generated-slug"}
                    </div>
                  </div>
                  <div>
                    <Label className="text-xs">Excerpt</Label>
                    <Textarea
                      value={excerpt}
                      onChange={(e) => {
                        setExcerpt(e.target.value);
                        markDirty();
                      }}
                      className="mt-1"
                      rows={2}
                    />
                  </div>
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <Label className="text-xs">Body</Label>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 text-xs"
                          disabled={generating}
                          onClick={() => void runOutlineGenerate()}
                        >
                          <Sparkles className="size-3" /> Outline
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 text-xs"
                          disabled={generating}
                          onClick={() => void runFullGenerate()}
                        >
                          <Sparkles className="size-3" /> {generating ? "Generating…" : "Generate article"}
                        </Button>
                      </div>
                    </div>
                    <ArticleMdxEditor
                      editorKey={editorKey}
                      markdown={body}
                      onChange={(value) => {
                        setBody(value);
                        markDirty();
                      }}
                    />
                    <p className="mt-2 text-xs text-muted-foreground">
                      Use Source mode for video embeds:
                      {" "}
                      <code>[Video: Descriptive title](https://youtube.com/watch?v=... &quot;Optional caption&quot;)</code>.
                      Start a quote with <code>Tip:</code>, <code>Warning:</code>, or <code>Note:</code> to render a callout.
                    </p>
                  </div>
                </div>
              </SectionCard>

              <SectionCard title="SEO Configuration">
                <FormSection title="" description="">
                  <div>
                    <Label className="text-xs">Primary Keyword</Label>
                    <Input
                      value={primaryKeyword}
                      onChange={(e) => {
                        setPrimaryKeyword(e.target.value);
                        markDirty();
                      }}
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Search Intent</Label>
                    <select
                      value={searchIntent}
                      onChange={(e) => setSearchIntent(e.target.value)}
                      className="mt-1 h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                    >
                      {INTENTS.map((i) => (
                        <option key={i} value={i}>{i}</option>
                      ))}
                    </select>
                  </div>
                  <div className="md:col-span-2">
                    <Label className="text-xs">Secondary Keywords (comma-separated)</Label>
                    <Input
                      value={secondaryKeywords}
                      onChange={(e) => {
                        setSecondaryKeywords(e.target.value);
                        markDirty();
                      }}
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Meta Title</Label>
                    <Input
                      value={metaTitle}
                      onChange={(e) => {
                        setMetaTitle(e.target.value);
                        markDirty();
                      }}
                      className="mt-1"
                    />
                    <div className="text-xs text-muted-foreground mt-1 tabular-nums">{metaTitle.length}/60</div>
                  </div>
                  <div>
                    <Label className="text-xs">Meta Description</Label>
                    <Textarea
                      value={metaDescription}
                      onChange={(e) => {
                        setMetaDescription(e.target.value);
                        markDirty();
                      }}
                      className="mt-1"
                      rows={2}
                    />
                    <div className="text-xs text-muted-foreground mt-1 tabular-nums">{metaDescription.length}/160</div>
                  </div>
                  <div className="md:col-span-2">
                    <Label className="text-xs">Canonical URL (optional)</Label>
                    <Input
                      value={canonicalUrl}
                      onChange={(e) => {
                        setCanonicalUrl(e.target.value);
                        markDirty();
                      }}
                      placeholder={`https://novalyte.io/journal/${slug || "article-slug"}`}
                      className="mt-1 font-mono text-sm"
                    />
                  </div>
                  <div className="md:col-span-2">
                    <Label className="text-xs">Tags (comma-separated)</Label>
                    <Input
                      value={tags}
                      onChange={(e) => {
                        setTags(e.target.value);
                        markDirty();
                      }}
                      className="mt-1"
                    />
                  </div>
                  <label className="md:col-span-2 flex items-start gap-2 rounded-md border border-input p-3 text-sm">
                    <input
                      type="checkbox"
                      checked={noIndex}
                      onChange={(e) => {
                        setNoIndex(e.target.checked);
                        markDirty();
                      }}
                      className="mt-0.5"
                    />
                    <span>
                      <span className="block font-medium">Exclude from search indexing</span>
                      <span className="block text-xs text-muted-foreground">
                        Adds noindex and excludes the article from the sitemap.
                      </span>
                    </span>
                  </label>
                </FormSection>
              </SectionCard>

              <SectionCard title="Hero media">
                <div className="space-y-3">
                  <div>
                    <Label className="text-xs">Hero image URL</Label>
                    <Input
                      value={heroSrc}
                      onChange={(e) => {
                        setHeroSrc(e.target.value);
                        markDirty();
                      }}
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Alt text</Label>
                    <Input
                      value={heroAlt}
                      onChange={(e) => {
                        setHeroAlt(e.target.value);
                        markDirty();
                      }}
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Image caption</Label>
                    <Textarea
                      value={heroCaption}
                      onChange={(e) => {
                        setHeroCaption(e.target.value);
                        markDirty();
                      }}
                      className="mt-1"
                      rows={2}
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Upload</Label>
                    <Input
                      type="file"
                      accept="image/*"
                      className="mt-1"
                      onChange={(e) => void onUploadHero(e.target.files?.[0] ?? null)}
                    />
                  </div>
                </div>
              </SectionCard>

              <SectionCard
                title="Sources & FAQs"
                description="Use direct, credible source URLs. FAQs remain draft content until the article is approved."
              >
                <div className="space-y-5">
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <Label className="text-xs">References</Label>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setReferences((current) => [
                            ...current,
                            { label: "", source: "", url: null },
                          ]);
                          markDirty();
                        }}
                      >
                        Add source
                      </Button>
                    </div>
                    {references.length === 0 && (
                      <p className="text-xs text-muted-foreground">
                        Add at least two sources before editorial approval.
                      </p>
                    )}
                    {references.map((reference, index) => (
                      <div key={index} className="grid gap-2 rounded-md border p-3 md:grid-cols-2">
                        <Input
                          aria-label={`Reference ${index + 1} title`}
                          placeholder="Source title"
                          value={reference.label}
                          onChange={(event) => {
                            setReferences((current) =>
                              current.map((item, itemIndex) =>
                                itemIndex === index
                                  ? { ...item, label: event.target.value }
                                  : item,
                              ),
                            );
                            markDirty();
                          }}
                        />
                        <Input
                          aria-label={`Reference ${index + 1} publisher`}
                          placeholder="Publisher or organization"
                          value={reference.source}
                          onChange={(event) => {
                            setReferences((current) =>
                              current.map((item, itemIndex) =>
                                itemIndex === index
                                  ? { ...item, source: event.target.value }
                                  : item,
                              ),
                            );
                            markDirty();
                          }}
                        />
                        <Input
                          aria-label={`Reference ${index + 1} URL`}
                          placeholder="https://..."
                          value={reference.url ?? ""}
                          onChange={(event) => {
                            setReferences((current) =>
                              current.map((item, itemIndex) =>
                                itemIndex === index
                                  ? { ...item, url: event.target.value || null }
                                  : item,
                              ),
                            );
                            markDirty();
                          }}
                          className="md:col-span-2"
                        />
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          className="w-fit text-destructive"
                          onClick={() => {
                            setReferences((current) =>
                              current.filter((_, itemIndex) => itemIndex !== index),
                            );
                            markDirty();
                          }}
                        >
                          Remove source
                        </Button>
                      </div>
                    ))}
                  </div>

                  <div className="space-y-3 border-t pt-4">
                    <div className="flex items-center justify-between">
                      <Label className="text-xs">FAQs</Label>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setFaqs((current) => [
                            ...current,
                            { question: "", answer: "" },
                          ]);
                          markDirty();
                        }}
                      >
                        Add FAQ
                      </Button>
                    </div>
                    {faqs.map((faq, index) => (
                      <div key={index} className="space-y-2 rounded-md border p-3">
                        <Input
                          aria-label={`FAQ ${index + 1} question`}
                          placeholder="Question"
                          value={faq.question}
                          onChange={(event) => {
                            setFaqs((current) =>
                              current.map((item, itemIndex) =>
                                itemIndex === index
                                  ? { ...item, question: event.target.value }
                                  : item,
                              ),
                            );
                            markDirty();
                          }}
                        />
                        <Textarea
                          aria-label={`FAQ ${index + 1} answer`}
                          placeholder="Answer"
                          value={faq.answer}
                          onChange={(event) => {
                            setFaqs((current) =>
                              current.map((item, itemIndex) =>
                                itemIndex === index
                                  ? { ...item, answer: event.target.value }
                                  : item,
                              ),
                            );
                            markDirty();
                          }}
                          rows={3}
                        />
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          className="text-destructive"
                          onClick={() => {
                            setFaqs((current) =>
                              current.filter((_, itemIndex) => itemIndex !== index),
                            );
                            markDirty();
                          }}
                        >
                          Remove FAQ
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              </SectionCard>

              <SectionCard title="Categorization & Workflow">
                <FormSection title="" description="">
                  <div>
                    <Label className="text-xs">Category</Label>
                    <select
                      value={category}
                      onChange={(e) => {
                        setCategory(e.target.value);
                        markDirty();
                      }}
                      className="mt-1 h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                    >
                      {CATEGORIES.map((c) => (
                        <option key={c} value={c}>{c}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <Label className="text-xs">Treatment</Label>
                    <select
                      value={treatment}
                      onChange={(e) => {
                        setTreatment(e.target.value);
                        markDirty();
                      }}
                      className="mt-1 h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                    >
                      {TREATMENTS.map((t) => (
                        <option key={t} value={t}>{t}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <Label className="text-xs">Audience</Label>
                    <select
                      value={audience}
                      onChange={(e) => setAudience(e.target.value)}
                      className="mt-1 h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                    >
                      {AUDIENCES.map((a) => (
                        <option key={a} value={a}>{a}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <Label className="text-xs">Author</Label>
                    <Input
                      value={author}
                      onChange={(e) => {
                        setAuthor(e.target.value);
                        markDirty();
                      }}
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Reviewer</Label>
                    <Input
                      value={reviewer}
                      onChange={(e) => {
                        setReviewer(e.target.value);
                        markDirty();
                      }}
                      className="mt-1"
                    />
                  </div>
                </FormSection>
              </SectionCard>
            </>
          ) : (
            <SectionCard title="Studio preview" description="Exact Journal preview opens in a new tab via signed token.">
              <article className="prose prose-sm max-w-none">
                <div className="text-xs text-muted-foreground uppercase tracking-wide mb-2">{category}</div>
                <h1 className="text-2xl font-bold tracking-tight mb-2">{title || "Untitled article"}</h1>
                <div className="text-sm text-muted-foreground mb-4">
                  By {author} · {readMins} min read
                </div>
                {excerpt && <p className="text-base text-muted-foreground italic mb-4">{excerpt}</p>}
                <pre className="whitespace-pre-wrap text-sm leading-relaxed font-sans">{body}</pre>
              </article>
            </SectionCard>
          )}
        </div>

        <div className="space-y-4">
          <SectionCard title="SEO checklist" description="Advisory only — gaps do not block publish">
            <div className="flex items-center gap-4">
              <div className={`size-16 rounded-full flex items-center justify-center text-xl font-bold tabular-nums ${
                advisoryScore >= 75 ? "bg-emerald-50 text-emerald-700"
                  : advisoryScore >= 50 ? "bg-amber-50 text-amber-700"
                    : "bg-rose-50 text-rose-700"
              }`}>
                {advisoryScore || "—"}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium">
                  {advisoryScore >= 75 ? "Well optimized" : advisoryScore >= 50 ? "Needs work" : "Incomplete"}
                </div>
                <div className="text-xs text-muted-foreground mt-0.5">Out of 100</div>
              </div>
            </div>
            <div className="mt-4 space-y-2 text-xs">
              {(seo?.checks ?? [
                { id: "title", label: "Title length 10–70", ok: title.length > 10 && title.length < 70 },
                { id: "kw", label: "Primary keyword in title", ok: !!primaryKeyword && title.toLowerCase().includes(primaryKeyword.toLowerCase()) },
                { id: "meta-t", label: "Meta title 10–60", ok: metaTitle.length > 10 && metaTitle.length < 60 },
                { id: "meta-d", label: "Meta description 50–160", ok: metaDescription.length > 50 && metaDescription.length < 160 },
                { id: "body", label: "Body target 2,500–4,500 words", ok: words >= 2500 && words <= 4500 },
                { id: "hero", label: "Hero image + alt", ok: !!heroSrc && !!heroAlt },
              ]).map((check) => (
                <ScoreRow key={check.id} label={check.label} ok={check.ok} />
              ))}
            </div>
          </SectionCard>

          <SectionCard title="Readability">
            <div className="flex items-center gap-4">
              <div className={`size-16 rounded-full flex items-center justify-center text-xl font-bold tabular-nums ${
                readabilityScore >= 70 ? "bg-emerald-50 text-emerald-700"
                  : readabilityScore >= 50 ? "bg-amber-50 text-amber-700"
                    : "bg-slate-50 text-slate-700"
              }`}>
                {readabilityScore || "—"}
              </div>
              <div className="text-xs text-muted-foreground">Target ≥ 60 for general audience</div>
            </div>
          </SectionCard>

          <SectionCard title="Workflow">
            <div className="space-y-2">
              <Button
                variant="outline"
                size="sm"
                className="w-full justify-start"
                disabled={saving || !articleId || status !== "approved"}
                onClick={async () => {
                  if (!articleId) return;
                  const when = window.prompt(
                    "Schedule publish time (ISO, e.g. 2026-07-20T15:00:00.000Z)",
                    new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
                  );
                  if (!when) return;
                  const saved = await persist({ silent: true });
                  if (!saved) return;
                  try {
                    const { article } = await contentService.articleAction(articleId, {
                      action: "schedule",
                      scheduledFor: when,
                      rowVersion: saved.rowVersion,
                    });
                    applyArticle(article);
                    toast.success("Scheduled.");
                  } catch (error) {
                    toast.error(error instanceof Error ? error.message : "Schedule failed.");
                  }
                }}
              >
                Schedule
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="w-full justify-start"
                disabled={saving || !articleId}
                onClick={async () => {
                  if (!articleId) return;
                  const saved = await persist({ silent: true });
                  if (!saved) return;
                  try {
                    const { article } = await contentService.articleAction(articleId, {
                      action: "unpublish",
                      rowVersion: saved.rowVersion,
                    });
                    applyArticle(article);
                    toast.success("Unpublished (now a draft).");
                  } catch (error) {
                    toast.error(error instanceof Error ? error.message : "Unpublish failed.");
                  }
                }}
              >
                Unpublish
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="w-full justify-start"
                disabled={saving || !articleId}
                onClick={async () => {
                  if (!articleId) return;
                  const saved = await persist({ silent: true });
                  if (!saved) return;
                  try {
                    const { article } = await contentService.articleAction(articleId, {
                      action: "archive",
                      rowVersion: saved.rowVersion,
                    });
                    applyArticle(article);
                    toast.success("Archived.");
                  } catch (error) {
                    toast.error(error instanceof Error ? error.message : "Archive failed.");
                  }
                }}
              >
                Archive
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="w-full justify-start"
                disabled={saving || !articleId}
                onClick={async () => {
                  if (!articleId) return;
                  try {
                    const { article } = await contentService.articleAction(articleId, {
                      action: "duplicate",
                    });
                    toast.success("Duplicate created.");
                    navigate("content-studio", null, { articleId: article.id });
                  } catch (error) {
                    toast.error(error instanceof Error ? error.message : "Duplicate failed.");
                  }
                }}
              >
                Duplicate
              </Button>
            </div>
          </SectionCard>

          <SectionCard title="AI Assistants">
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="glm-model" className="text-xs">Long-form model</Label>
                <select
                  id="glm-model"
                  className="flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                  value={glmModel}
                  onChange={(e) => setGlmModel(e.target.value)}
                >
                  <option value="glm-5.2">GLM 5.2</option>
                  <option value="glm-5">GLM 5</option>
                  <option value="glm-4.5">GLM 4.5</option>
                </select>
                <p className="text-[11px] text-muted-foreground">
                  Uses server-side <code>GLM_API_KEY</code>. Default long-form model is GLM 5.2.
                </p>
              </div>
              <Button variant="outline" size="sm" className="w-full justify-start" disabled={generating} onClick={() => void runSeoSuggest()}>
                <Sparkles className="size-3.5" /> Suggest SEO
              </Button>
              <Button variant="outline" size="sm" className="w-full justify-start" disabled={generating} onClick={() => void runKeywordResearch()}>
                <Search className="size-3.5" /> Research Keywords
              </Button>
              <Button variant="outline" size="sm" className="w-full justify-start" disabled={!articleId} onClick={() => void openExactPreview()}>
                <Eye className="size-3.5" /> Exact Journal Preview
              </Button>
            </div>
          </SectionCard>

          <SectionCard title="Revisions" description="Latest snapshots">
            <div className="space-y-2 max-h-56 overflow-auto">
              {revisions.length === 0 && (
                <div className="text-xs text-muted-foreground">No revisions yet.</div>
              )}
              {revisions.map((rev) => (
                <div key={rev.id} className="flex items-start justify-between gap-2 text-xs border-b pb-2">
                  <div>
                    <div className="font-medium inline-flex items-center gap-1">
                      <History className="size-3" /> #{rev.revision_number}
                    </div>
                    <div className="text-muted-foreground">
                      {rev.change_summary || "Update"} · {new Date(rev.created_at).toLocaleString()}
                    </div>
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7"
                    disabled={!articleId}
                    onClick={async () => {
                      if (!articleId) return;
                      try {
                        const { article } = await contentService.restoreRevision(articleId, rev.id);
                        applyArticle(article);
                        toast.success(`Restored revision #${rev.revision_number}`);
                      } catch (error) {
                        toast.error(error instanceof Error ? error.message : "Restore failed.");
                      }
                    }}
                  >
                    Restore
                  </Button>
                </div>
              ))}
            </div>
          </SectionCard>

          <SectionCard title="Quick Checks">
            <div className="space-y-2 text-xs">
              <CheckRow icon={Search} label="Keyword research" done={!!primaryKeyword} />
              <CheckRow icon={Gauge} label="SEO optimized" done={advisoryScore >= 75} />
              <CheckRow icon={BookOpen} label="Content depth" done={words >= 2500 && words <= 4500} />
              <CheckRow icon={Upload} label="Hero media" done={!!heroSrc && !!heroAlt} />
              <CheckRow icon={CheckCircle2} label="Reviewed" done={!!reviewer} />
            </div>
          </SectionCard>
        </div>
      </div>
    </div>
  );
}

function ScoreRow({ label, ok }: { label: string; ok: boolean }) {
  return (
    <div className="flex items-center gap-2">
      {ok ? (
        <CheckCircle2 className="size-3.5 text-emerald-600 shrink-0" />
      ) : (
        <AlertCircle className="size-3.5 text-muted-foreground shrink-0" />
      )}
      <span className={ok ? "text-foreground" : "text-muted-foreground"}>{label}</span>
    </div>
  );
}

function CheckRow({ icon: Icon, label, done }: { icon: React.ElementType; label: string; done: boolean }) {
  return (
    <div className="flex items-center gap-2">
      <Icon className={`size-3.5 ${done ? "text-teal-600" : "text-muted-foreground"}`} />
      <span className={done ? "text-foreground" : "text-muted-foreground"}>{label}</span>
      {done && <CheckCircle2 className="size-3 text-emerald-600 ml-auto" />}
    </div>
  );
}
