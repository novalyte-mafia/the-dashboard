"use client";

import { useEffect, useMemo, useState } from "react";
import { useNav } from "@/components/admin/admin-app";
import { contentService } from "@/services";
import type { Article } from "@/types";
import {
  PageHeader, SectionCard, LoadingState, ScoreBadge, StatusBadge, FormSection,
} from "@/components/admin/shared/index";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Sparkles, Eye, Save, Send, BookOpen, Search, Gauge, CheckCircle2, AlertCircle,
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

export function ContentStudioView({ params }: { params?: Record<string, unknown> | null }) {
  const { refreshKey } = useNav();
  const articleId = (params as { articleId?: string } | undefined)?.articleId;

  const [all, setAll] = useState<Article[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"edit" | "preview">("edit");
  const [generating, setGenerating] = useState(false);

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
  const [author, setAuthor] = useState("Jamil Yakasai");
  const [reviewer, setReviewer] = useState("");
  const [status, setStatus] = useState<Article["status"]>("draft");

  useEffect(() => {
    contentService.listArticles()
      .then((d) => setAll(d.articles))
      .finally(() => setLoading(false));
  }, [refreshKey]);

  const editing = useMemo(
    () => (articleId ? all.find((a) => a.id === articleId) : undefined),
    [articleId, all]
  );

  useEffect(() => {
    if (editing) {
      setTitle(editing.title);
      setSlug(editing.slug);
      setExcerpt(editing.excerpt ?? "");
      setBody(`# ${editing.title}\n\n${editing.excerpt ?? ""}\n\n[Article body — ${editing.wordCount ?? 0} words]`);
      setCategory(editing.category);
      setTreatment(editing.treatmentCategory ?? TREATMENTS[0]);
      setAudience(editing.audience ?? AUDIENCES[0]);
      setSearchIntent(editing.searchIntent ?? INTENTS[0]);
      setPrimaryKeyword(editing.primaryKeyword ?? "");
      setSecondaryKeywords(editing.secondaryKeywords.join(", "));
      setAuthor(editing.authorName);
      setReviewer(editing.reviewerName ?? "");
      setStatus(editing.status);
    } else {
      // Reset for new article
      setTitle("");
      setSlug("");
      setExcerpt("");
      setBody("");
      setCategory(CATEGORIES[0]);
      setTreatment(TREATMENTS[0]);
      setAudience(AUDIENCES[0]);
      setSearchIntent(INTENTS[0]);
      setPrimaryKeyword("");
      setSecondaryKeywords("");
      setMetaTitle("");
      setMetaDescription("");
      setAuthor("Jamil Yakasai");
      setReviewer("");
      setStatus("draft");
    }
  }, [editing]);

  // Compute live SEO score (mock heuristic)
  const seoScore = useMemo(() => {
    let score = 30;
    if (title.length > 10 && title.length < 70) score += 15;
    if (primaryKeyword && title.toLowerCase().includes(primaryKeyword.toLowerCase())) score += 15;
    if (metaTitle.length > 10 && metaTitle.length < 60) score += 10;
    if (metaDescription.length > 50 && metaDescription.length < 160) score += 10;
    if (body.length > 800) score += 10;
    if (secondaryKeywords.trim().length > 0) score += 5;
    if (slug && slug.length > 3) score += 5;
    return Math.min(100, score);
  }, [title, primaryKeyword, metaTitle, metaDescription, body, secondaryKeywords, slug]);

  const readabilityScore = useMemo(() => {
    if (body.length < 100) return 0;
    const sentences = body.split(/[.!?]+/).filter((s) => s.trim().length > 0).length || 1;
    const words = body.split(/\s+/).filter(Boolean).length || 1;
    const avgWordsPerSentence = words / sentences;
    // Lower avg = higher score (simpler)
    return Math.max(0, Math.min(100, Math.round(100 - (avgWordsPerSentence - 12) * 4)));
  }, [body]);

  if (loading) return <LoadingState label="Loading content studio…" />;

  return (
    <div>
      <PageHeader
        title={editing ? "Edit Article" : "Content Studio"}
        description={editing ? editing.title : "Create a new SEO-optimized article"}
        action={
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => toast.success("Draft saved.")}>
              <Save className="size-4" /> Save Draft
            </Button>
            <Button size="sm" onClick={() => toast.success("Sent to review.")}>
              <Send className="size-4" /> Send to Review
            </Button>
          </div>
        }
      />

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
        <div className="ml-auto">
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
                      onChange={(e) => setTitle(e.target.value)}
                      placeholder="e.g. TRT Therapy: Complete Guide for Men Over 40"
                      className="mt-1"
                    />
                    <div className="flex items-center justify-between text-xs text-muted-foreground mt-1">
                      <span>Slug: /articles/{slug || "auto-generated-slug"}</span>
                      <span className="tabular-nums">{title.length}/70</span>
                    </div>
                  </div>
                  <div>
                    <Label className="text-xs">Slug</Label>
                    <Input
                      value={slug}
                      onChange={(e) => setSlug(e.target.value)}
                      placeholder="trt-therapy-guide-men-over-40"
                      className="mt-1 font-mono text-sm"
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Excerpt</Label>
                    <Textarea
                      value={excerpt}
                      onChange={(e) => setExcerpt(e.target.value)}
                      placeholder="Short summary shown in cards and search results…"
                      className="mt-1"
                      rows={2}
                    />
                  </div>
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <Label className="text-xs">Body (Markdown)</Label>
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 text-xs"
                        disabled={generating}
                        onClick={() => {
                          setGenerating(true);
                          toast.info("Generating draft with AI…");
                          setTimeout(() => {
                            setGenerating(false);
                            const generated = `# ${title || "New Article"}\n\n## Introduction\n\n${excerpt || "An engaging intro that hooks the reader and sets up the topic."}\n\n## Key Benefits\n\n1. First benefit with supporting evidence\n2. Second benefit with clinical context\n3. Third benefit addressing common concerns\n\n## What to Expect\n\nDetailed walkthrough of the patient journey, including consultation, treatment protocol, and follow-up care.\n\n## Clinical Considerations\n\nDiscussion of contraindications, side effects, and monitoring protocols.\n\n## Conclusion\n\nSummary and clear next steps for the reader.\n\n---\n*Disclaimer: This article is for informational purposes only and does not constitute medical advice.*`;
                            setBody(generated);
                            toast.success("AI draft generated — review and refine.");
                          }, 1400);
                        }}
                      >
                        <Sparkles className="size-3" /> {generating ? "Generating…" : "Generate with AI"}
                      </Button>
                    </div>
                    <Textarea
                      value={body}
                      onChange={(e) => setBody(e.target.value)}
                      placeholder="Write your article in markdown…"
                      className="mt-0 font-mono text-sm"
                      rows={14}
                    />
                    <div className="text-xs text-muted-foreground mt-1 tabular-nums">
                      {body.split(/\s+/).filter(Boolean).length} words · {body.length} chars
                    </div>
                  </div>
                </div>
              </SectionCard>

              <SectionCard title="SEO Configuration">
                <FormSection title="" description="">
                  <div>
                    <Label className="text-xs">Primary Keyword</Label>
                    <Input
                      value={primaryKeyword}
                      onChange={(e) => setPrimaryKeyword(e.target.value)}
                      placeholder="trt therapy"
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
                        <option key={i} value={i}>{i.charAt(0).toUpperCase() + i.slice(1)}</option>
                      ))}
                    </select>
                  </div>
                  <div className="md:col-span-2">
                    <Label className="text-xs">Secondary Keywords (comma-separated)</Label>
                    <Input
                      value={secondaryKeywords}
                      onChange={(e) => setSecondaryKeywords(e.target.value)}
                      placeholder="testosterone replacement, trt benefits, trt side effects"
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Meta Title</Label>
                    <Input
                      value={metaTitle}
                      onChange={(e) => setMetaTitle(e.target.value)}
                      placeholder="TRT Therapy: Complete 2024 Guide"
                      className="mt-1"
                    />
                    <div className="text-xs text-muted-foreground mt-1 tabular-nums">{metaTitle.length}/60</div>
                  </div>
                  <div>
                    <Label className="text-xs">Meta Description</Label>
                    <Textarea
                      value={metaDescription}
                      onChange={(e) => setMetaDescription(e.target.value)}
                      placeholder="Everything you need to know about testosterone replacement therapy."
                      className="mt-1"
                      rows={2}
                    />
                    <div className="text-xs text-muted-foreground mt-1 tabular-nums">{metaDescription.length}/160</div>
                  </div>
                </FormSection>
              </SectionCard>

              <SectionCard title="Categorization & Workflow">
                <FormSection title="" description="">
                  <div>
                    <Label className="text-xs">Category</Label>
                    <select
                      value={category}
                      onChange={(e) => setCategory(e.target.value)}
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
                      onChange={(e) => setTreatment(e.target.value)}
                      className="mt-1 h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                    >
                      {TREATMENTS.map((t) => (
                        <option key={t} value={t}>{t.replace(/_/g, " ")}</option>
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
                        <option key={a} value={a}>{a.replace(/_/g, " ")}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <Label className="text-xs">Status</Label>
                    <select
                      value={status}
                      onChange={(e) => setStatus(e.target.value as Article["status"])}
                      className="mt-1 h-9 w-full rounded-md border border-input bg-background px-3 text-sm capitalize"
                    >
                      {["idea", "brief", "draft", "review", "approved", "scheduled", "published"].map((s) => (
                        <option key={s} value={s}>{s.replace(/_/g, " ")}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <Label className="text-xs">Author</Label>
                    <Input value={author} onChange={(e) => setAuthor(e.target.value)} className="mt-1" />
                  </div>
                  <div>
                    <Label className="text-xs">Reviewer</Label>
                    <Input
                      value={reviewer}
                      onChange={(e) => setReviewer(e.target.value)}
                      placeholder="Assign reviewer…"
                      className="mt-1"
                    />
                  </div>
                </FormSection>
              </SectionCard>
            </>
          ) : (
            <SectionCard title="Preview" description="How this article will appear to readers">
              <article className="prose prose-sm max-w-none">
                <div className="text-xs text-muted-foreground uppercase tracking-wide mb-2">{category}</div>
                <h1 className="text-2xl font-bold tracking-tight mb-2">{title || "Untitled article"}</h1>
                <div className="text-sm text-muted-foreground mb-4">By {author} · {new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}</div>
                {excerpt && <p className="text-base text-muted-foreground italic mb-4">{excerpt}</p>}
                <div className="whitespace-pre-wrap text-sm leading-relaxed">{body}</div>
              </article>
            </SectionCard>
          )}
        </div>

        <div className="space-y-4">
          <SectionCard title="SEO Score" description="Live optimization score">
            <div className="flex items-center gap-4">
              <div className={`size-16 rounded-full flex items-center justify-center text-xl font-bold tabular-nums ${
                seoScore >= 75 ? "bg-emerald-50 text-emerald-700"
                : seoScore >= 50 ? "bg-amber-50 text-amber-700"
                : "bg-rose-50 text-rose-700"
              }`}>
                {seoScore}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium">{seoScore >= 75 ? "Well optimized" : seoScore >= 50 ? "Needs work" : "Poor"}</div>
                <div className="text-xs text-muted-foreground mt-0.5">Out of 100</div>
              </div>
            </div>
            <div className="mt-4 space-y-2 text-xs">
              <ScoreRow label="Title length" ok={title.length > 10 && title.length < 70} />
              <ScoreRow label="Primary keyword in title" ok={!!primaryKeyword && title.toLowerCase().includes(primaryKeyword.toLowerCase())} />
              <ScoreRow label="Meta title (10–60 chars)" ok={metaTitle.length > 10 && metaTitle.length < 60} />
              <ScoreRow label="Meta description (50–160)" ok={metaDescription.length > 50 && metaDescription.length < 160} />
              <ScoreRow label="Body length > 800 chars" ok={body.length > 800} />
              <ScoreRow label="Slug set" ok={slug.length > 3} />
            </div>
          </SectionCard>

          <SectionCard title="Readability" description="Flesch reading ease">
            <div className="flex items-center gap-4">
              <div className={`size-16 rounded-full flex items-center justify-center text-xl font-bold tabular-nums ${
                readabilityScore >= 70 ? "bg-emerald-50 text-emerald-700"
                : readabilityScore >= 50 ? "bg-amber-50 text-amber-700"
                : "bg-slate-50 text-slate-700"
              }`}>
                {readabilityScore || "—"}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium">
                  {readabilityScore >= 70 ? "Easy to read" : readabilityScore >= 50 ? "Moderate" : "Complex"}
                </div>
                <div className="text-xs text-muted-foreground mt-0.5">Target ≥ 60 for general audience</div>
              </div>
            </div>
          </SectionCard>

          <SectionCard title="Quick Checks">
            <div className="space-y-2 text-xs">
              <CheckRow icon={Search} label="Keyword research" done={!!primaryKeyword} />
              <CheckRow icon={Gauge} label="SEO optimized" done={seoScore >= 75} />
              <CheckRow icon={BookOpen} label="Content depth" done={body.split(/\s+/).filter(Boolean).length >= 800} />
              <CheckRow icon={Eye} label="Preview checked" done={tab === "preview"} />
              <CheckRow icon={CheckCircle2} label="Reviewed" done={!!reviewer} />
            </div>
          </SectionCard>

          <SectionCard title="AI Assistants">
            <div className="space-y-2">
              <Button variant="outline" size="sm" className="w-full justify-start" onClick={() => toast.info("Generating title ideas…")}>
                <Sparkles className="size-3.5" /> Suggest Titles
              </Button>
              <Button variant="outline" size="sm" className="w-full justify-start" onClick={() => toast.info("Extracting keywords…")}>
                <Search className="size-3.5" /> Extract Keywords
              </Button>
              <Button variant="outline" size="sm" className="w-full justify-start" onClick={() => toast.info("Generating meta description…")}>
                <Sparkles className="size-3.5" /> Write Meta Description
              </Button>
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
