"use client";

import { useEffect, useMemo, useState } from "react";
import { contentService } from "@/services";
import type { Article } from "@/types";
import {
  PageHeader, MetricCard, DataTable, FilterBar, LoadingState,
  StatusBadge, SectionCard,
} from "@/components/admin/shared/index";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Search, Target, TrendingUp, Sparkles, FileText, ListChecks, Plus, Lightbulb,
} from "lucide-react";
import { toast } from "sonner";

interface SeoBrief {
  id: string;
  targetKeyword: string;
  searchVolume: number;
  difficulty: number; // 0-100
  intent: "informational" | "commercial" | "transactional" | "navigational";
  cpc: number;
  currentRank?: number;
  serpFeatures: string[];
  suggestedOutline: { heading: string; notes: string }[];
  competitors: { domain: string; wordCount: number; dr: number }[];
  status: "draft" | "approved" | "in_progress" | "completed";
  assignedTo?: string;
  articleId?: string;
  createdAt: string;
}

const MOCK_BRIEFS: SeoBrief[] = [
  {
    id: "brf_1",
    targetKeyword: "trt therapy",
    searchVolume: 14800,
    difficulty: 62,
    intent: "informational",
    cpc: 4.20,
    currentRank: 12,
    serpFeatures: ["featured_snippet", "people_also_ask", "video_carousel"],
    suggestedOutline: [
      { heading: "What Is TRT Therapy?", notes: "Define TRT, when it's prescribed, and how it differs from steroid use" },
      { heading: "Signs You May Need TRT", notes: "Symptoms checklist — fatigue, low libido, muscle loss, brain fog" },
      { heading: "TRT Treatment Options", notes: "Injections, gels, pellets, oral — pros/cons of each" },
      { heading: "What to Expect: First 90 Days", notes: "Timeline of changes, monitoring protocol, dose adjustments" },
      { heading: "Side Effects & Risks", notes: "Honest coverage — hematocrit, fertility, cardiovascular" },
      { heading: "Finding a TRT Clinic Near You", notes: "CTA — what to look for, questions to ask" },
    ],
    competitors: [
      { domain: "healthline.com", wordCount: 3200, dr: 88 },
      { domain: "medicalnewstoday.com", wordCount: 2800, dr: 86 },
      { domain: "webmd.com", wordCount: 2400, dr: 90 },
    ],
    status: "in_progress",
    assignedTo: "Dr. Sarah Mitchell",
    articleId: "art_1",
    createdAt: new Date(Date.now() - 12 * 86400000).toISOString(),
  },
  {
    id: "brf_2",
    targetKeyword: "glp-1 weight loss",
    searchVolume: 22200,
    difficulty: 71,
    intent: "commercial",
    cpc: 6.80,
    currentRank: undefined,
    serpFeatures: ["featured_snippet", "people_also_ask", "shopping"],
    suggestedOutline: [
      { heading: "What Are GLP-1 Medications?", notes: "Semaglutide, tirzepatide — mechanism of action" },
      { heading: "GLP-1 for Weight Loss: Effectiveness", notes: "Clinical trial results, average % body weight loss" },
      { heading: "Cost & Insurance Coverage", notes: "Out-of-pocket vs insurance, generic availability" },
      { heading: "Side Effects to Know", notes: "Nausea, delayed gastric emptying, long-term considerations" },
      { heading: "Who Is a Good Candidate?", notes: "BMI criteria, contraindications, pre-screening" },
      { heading: "How to Get Started", notes: "CTA — telehealth vs in-person, what to expect at consultation" },
    ],
    competitors: [
      { domain: "forbes.com", wordCount: 2100, dr: 92 },
      { domain: "goodrx.com", wordCount: 2600, dr: 86 },
      { domain: "singlecare.com", wordCount: 1900, dr: 80 },
    ],
    status: "in_progress",
    assignedTo: "Lisa Chen, PA-C",
    articleId: "art_2",
    createdAt: new Date(Date.now() - 8 * 86400000).toISOString(),
  },
  {
    id: "brf_3",
    targetKeyword: "low testosterone symptoms",
    searchVolume: 18100,
    difficulty: 48,
    intent: "informational",
    cpc: 3.10,
    currentRank: 8,
    serpFeatures: ["featured_snippet", "people_also_ask"],
    suggestedOutline: [
      { heading: "What Is Low Testosterone?", notes: "Define clinical hypogonadism vs age-related decline" },
      { heading: "Physical Symptoms", notes: "Fatigue, weight gain, muscle loss, hair changes" },
      { heading: "Mental & Emotional Symptoms", notes: "Depression, irritability, brain fog, motivation loss" },
      { heading: "Sexual Symptoms", notes: "Low libido, ED, fertility changes" },
      { heading: "When to See a Doctor", notes: "Testing protocol, what numbers mean" },
    ],
    competitors: [
      { domain: "mayoclinic.org", wordCount: 1800, dr: 92 },
      { domain: "healthline.com", wordCount: 2200, dr: 88 },
    ],
    status: "completed",
    assignedTo: "Dr. Anthony Reed",
    articleId: "art_3",
    createdAt: new Date(Date.now() - 15 * 86400000).toISOString(),
  },
  {
    id: "brf_4",
    targetKeyword: "peptide therapy benefits",
    searchVolume: 8100,
    difficulty: 39,
    intent: "informational",
    cpc: 5.40,
    serpFeatures: ["featured_snippet", "video_carousel"],
    suggestedOutline: [
      { heading: "What Are Peptides?", notes: "Definition, types (BPC-157, CJC-1295, etc.)" },
      { heading: "Benefits by Use Case", notes: "Recovery, anti-aging, weight loss, sleep" },
      { heading: "How Peptides Are Administered", notes: "Injectable, oral, nasal — protocols" },
      { heading: "Safety & Regulation", notes: "FDA status, sourcing quality, red flags" },
    ],
    competitors: [
      { domain: "verywellhealth.com", wordCount: 1600, dr: 86 },
      { domain: "medicalnewstoday.com", wordCount: 1400, dr: 86 },
    ],
    status: "approved",
    assignedTo: "Jamil Yakasai",
    articleId: "art_4",
    createdAt: new Date(Date.now() - 4 * 86400000).toISOString(),
  },
  {
    id: "brf_5",
    targetKeyword: "does iv therapy work",
    searchVolume: 6600,
    difficulty: 34,
    intent: "informational",
    cpc: 4.90,
    serpFeatures: ["featured_snippet", "people_also_ask"],
    suggestedOutline: [
      { heading: "What Is IV Therapy?", notes: "Definition, common formulations (Myers, hydration, recovery)" },
      { heading: "Does IV Therapy Actually Work?", notes: "Evidence by claim — hydration yes, hangover mixed, anti-aging limited" },
      { heading: "Who Benefits Most?", notes: "Athletes, acute dehydration, malabsorption" },
      { heading: "Risks & Cost Considerations", notes: "Infection, cost per session, insurance" },
    ],
    competitors: [
      { domain: "clevelandclinic.org", wordCount: 1200, dr: 90 },
      { domain: "healthline.com", wordCount: 1500, dr: 88 },
    ],
    status: "draft",
    createdAt: new Date(Date.now() - 1 * 86400000).toISOString(),
  },
  {
    id: "brf_6",
    targetKeyword: "hormone optimization",
    searchVolume: 9900,
    difficulty: 56,
    intent: "commercial",
    cpc: 7.20,
    serpFeatures: ["featured_snippet", "shopping", "people_also_ask"],
    suggestedOutline: [
      { heading: "What Is Hormone Optimization?", notes: "Broader than TRT — thyroid, GH, cortisol" },
      { heading: "Signs of Hormone Imbalance", notes: "Symptoms across systems" },
      { heading: "Optimization Protocols", notes: "BHRT, lifestyle, peptides" },
      { heading: "Finding a Specialist", notes: "CTA — credentials to look for, intake process" },
    ],
    competitors: [
      { domain: "forbes.com", wordCount: 1900, dr: 92 },
      { domain: "verywellhealth.com", wordCount: 1700, dr: 86 },
    ],
    status: "completed",
    assignedTo: "Dr. Marcus Bell",
    articleId: "art_6",
    createdAt: new Date(Date.now() - 18 * 86400000).toISOString(),
  },
];

const STATUS_COLOR: Record<string, string> = {
  draft: "slate", approved: "violet", in_progress: "teal", completed: "green",
};
const INTENT_COLOR: Record<string, string> = {
  informational: "teal", commercial: "amber", transactional: "green", navigational: "slate",
};

export function SeoBriefsView() {
  const [articles, setArticles] = useState<Article[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filters, setFilters] = useState<Record<string, string>>({});
  const [selected, setSelected] = useState<SeoBrief | null>(null);

  useEffect(() => {
    contentService.listArticles()
      .then((d) => setArticles(d.articles))
      .finally(() => setLoading(false));
  }, []);

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    return MOCK_BRIEFS.filter((b) => {
      if (q && !`${b.targetKeyword} ${b.assignedTo ?? ""}`.toLowerCase().includes(q)) return false;
      if (filters.status && b.status !== filters.status) return false;
      if (filters.intent && b.intent !== filters.intent) return false;
      return true;
    });
  }, [search, filters]);

  if (loading) return <LoadingState label="Loading SEO briefs…" />;

  const totalVolume = MOCK_BRIEFS.reduce((s, b) => s + b.searchVolume, 0);
  const inProgress = MOCK_BRIEFS.filter((b) => b.status === "in_progress").length;
  const completed = MOCK_BRIEFS.filter((b) => b.status === "completed").length;
  const avgDifficulty = Math.round(MOCK_BRIEFS.reduce((s, b) => s + b.difficulty, 0) / MOCK_BRIEFS.length);

  return (
    <div>
      <PageHeader
        title="SEO Briefs"
        description={`${MOCK_BRIEFS.length} keyword briefs · ${totalVolume.toLocaleString()} monthly searches targeted`}
        action={
          <Button onClick={() => toast.info("Brief generator — enter a keyword to begin.")}>
            <Sparkles className="size-4" /> Generate Brief
          </Button>
        }
      />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <MetricCard label="Total Briefs" value={MOCK_BRIEFS.length} icon={FileText} tone="default" />
        <MetricCard label="In Progress" value={inProgress} icon={Target} tone="teal" />
        <MetricCard label="Completed" value={completed} icon={ListChecks} tone="green" />
        <MetricCard label="Avg Difficulty" value={avgDifficulty} icon={TrendingUp} tone="amber" hint="0–100 scale" />
      </div>

      <FilterBar
        search={search}
        onSearchChange={setSearch}
        filters={[
          { key: "status", label: "Status", options: [
            { value: "draft", label: "Draft" },
            { value: "approved", label: "Approved" },
            { value: "in_progress", label: "In Progress" },
            { value: "completed", label: "Completed" },
          ] },
          { key: "intent", label: "Intent", options: [
            { value: "informational", label: "Informational" },
            { value: "commercial", label: "Commercial" },
            { value: "transactional", label: "Transactional" },
            { value: "navigational", label: "Navigational" },
          ] },
        ]}
        activeFilters={filters}
        onFilterChange={(k, v) => setFilters((f) => ({ ...f, [k]: v }))}
        onClear={() => { setSearch(""); setFilters({}); }}
        searchPlaceholder="Search by keyword or assignee…"
      />

      <DataTable
        data={filtered}
        onRowClick={(b) => setSelected(b)}
        emptyTitle="No briefs match"
        emptyDescription="Generate a new brief to get started."
        columns={[
          {
            key: "targetKeyword",
            header: "Keyword",
            sortValue: (b) => b.targetKeyword,
            render: (b) => (
              <div>
                <div className="font-medium inline-flex items-center gap-1.5">
                  <Search className="size-3.5 text-muted-foreground" />
                  {b.targetKeyword}
                </div>
                {b.currentRank != null && (
                  <div className="text-xs text-teal-700 mt-0.5">Currently ranking #{b.currentRank}</div>
                )}
              </div>
            ),
          },
          {
            key: "searchVolume",
            header: "Volume",
            sortValue: (b) => b.searchVolume,
            render: (b) => <span className="text-sm tabular-nums">{b.searchVolume.toLocaleString()}</span>,
          },
          {
            key: "difficulty",
            header: "Difficulty",
            sortValue: (b) => b.difficulty,
            render: (b) => {
              const tone = b.difficulty < 40 ? "green" : b.difficulty < 65 ? "amber" : "rose";
              return <StatusBadge label={`${b.difficulty}/100`} color={tone} />;
            },
          },
          {
            key: "intent",
            header: "Intent",
            hideOnMobile: true,
            sortValue: (b) => b.intent,
            render: (b) => <StatusBadge label={b.intent} color={INTENT_COLOR[b.intent]} />,
          },
          {
            key: "cpc",
            header: "CPC",
            hideOnMobile: true,
            sortValue: (b) => b.cpc,
            render: (b) => <span className="text-sm tabular-nums">${b.cpc.toFixed(2)}</span>,
          },
          {
            key: "assignedTo",
            header: "Assigned",
            hideOnMobile: true,
            render: (b) => <span className="text-sm">{b.assignedTo ?? "—"}</span>,
          },
          {
            key: "status",
            header: "Status",
            sortValue: (b) => b.status,
            render: (b) => <StatusBadge label={b.status.replace(/_/g, " ")} color={STATUS_COLOR[b.status]} />,
          },
        ]}
      />

      {selected && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div className="absolute inset-0 bg-black/40" onClick={() => setSelected(null)} />
          <div className="relative w-full max-w-md bg-background border-l shadow-xl overflow-y-auto nv-scroll">
            <div className="flex items-center justify-between px-4 py-3 border-b sticky top-0 bg-background z-10">
              <div>
                <h3 className="text-sm font-semibold">{selected.targetKeyword}</h3>
                <div className="text-xs text-muted-foreground mt-0.5">
                  {selected.searchVolume.toLocaleString()} searches/mo · difficulty {selected.difficulty}/100
                </div>
              </div>
              <Button variant="ghost" size="icon" className="size-7" onClick={() => setSelected(null)}>×</Button>
            </div>
            <div className="p-4 space-y-5">
              <div className="grid grid-cols-3 gap-2">
                <div className="p-2.5 rounded-md bg-muted/60">
                  <div className="text-[10px] text-muted-foreground uppercase">Volume</div>
                  <div className="text-sm font-semibold tabular-nums">{selected.searchVolume.toLocaleString()}</div>
                </div>
                <div className="p-2.5 rounded-md bg-muted/60">
                  <div className="text-[10px] text-muted-foreground uppercase">Difficulty</div>
                  <div className="text-sm font-semibold tabular-nums">{selected.difficulty}</div>
                </div>
                <div className="p-2.5 rounded-md bg-muted/60">
                  <div className="text-[10px] text-muted-foreground uppercase">CPC</div>
                  <div className="text-sm font-semibold tabular-nums">${selected.cpc.toFixed(2)}</div>
                </div>
              </div>

              <div>
                <div className="text-xs text-muted-foreground uppercase tracking-wide mb-2">Suggested Outline</div>
                <div className="space-y-2.5">
                  {selected.suggestedOutline.map((o, i) => (
                    <div key={i} className="p-2.5 rounded-md border border-border/60">
                      <div className="text-sm font-medium">
                        <span className="text-muted-foreground tabular-nums mr-1.5">{i + 1}.</span>
                        {o.heading}
                      </div>
                      <div className="text-xs text-muted-foreground mt-0.5 pl-5">{o.notes}</div>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <div className="text-xs text-muted-foreground uppercase tracking-wide mb-2">SERP Features</div>
                <div className="flex flex-wrap gap-1.5">
                  {selected.serpFeatures.map((f) => (
                    <StatusBadge key={f} label={f.replace(/_/g, " ")} color="teal" />
                  ))}
                </div>
              </div>

              <div>
                <div className="text-xs text-muted-foreground uppercase tracking-wide mb-2">Top Competitors</div>
                <div className="space-y-1.5">
                  {selected.competitors.map((c) => (
                    <div key={c.domain} className="flex items-center justify-between p-2 rounded-md border border-border/60 text-xs">
                      <span className="font-medium">{c.domain}</span>
                      <div className="flex items-center gap-3 text-muted-foreground tabular-nums">
                        <span>{c.wordCount.toLocaleString()} words</span>
                        <span>DR {c.dr}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex gap-2 pt-2 border-t">
                <Button
                  size="sm"
                  variant="outline"
                  className="flex-1"
                  onClick={() => toast.info("Opening in Content Studio…")}
                >
                  <Plus className="size-3.5" /> Create Article
                </Button>
                <Button
                  size="sm"
                  className="flex-1"
                  onClick={() => toast.success("Brief regenerated with latest SERP data.")}
                >
                  <Sparkles className="size-3.5" /> Regenerate
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      <SectionCard
        title="Brief Generator"
        description="AI-powered brief creation from a single keyword"
        className="mt-4"
      >
        <div className="flex flex-col sm:flex-row gap-2">
          <Input placeholder="Enter a target keyword (e.g. 'testosterone replacement therapy cost')…" className="h-9" />
          <Button onClick={() => toast.info("Generating brief — analyzing SERP, competitors, and intent…")}>
            <Sparkles className="size-4" /> Generate Brief
          </Button>
        </div>
        <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
          <Lightbulb className="size-3.5" />
          Briefs include search volume, difficulty, intent, SERP features, suggested outline, and competitor analysis.
        </div>
      </SectionCard>
    </div>
  );
}
