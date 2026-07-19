"use client";

import { useEffect, useMemo, useState } from "react";
import { useNav } from "@/components/admin/admin-app";
import { contentService } from "@/services";
import type { Article } from "@/types";
import {
  PageHeader,
  MetricCard,
  DataTable,
  FilterBar,
  LoadingState,
  StatusBadge,
  SectionCard,
} from "@/components/admin/shared/index";
import { Button } from "@/components/ui/button";
import {
  Search,
  Target,
  FileText,
  ListChecks,
  Lightbulb,
  ExternalLink,
} from "lucide-react";
import {
  INITIAL_SEARCH_BRIEFS,
  type SearchContentBrief,
} from "@/lib/content/initial-search-briefs";

type BriefRow = SearchContentBrief & {
  id: string;
  status: "draft_structure" | "article_exists" | "published";
  articleId?: string;
};

const STATUS_COLOR: Record<BriefRow["status"], string> = {
  draft_structure: "slate",
  article_exists: "amber",
  published: "green",
};

const INTENT_COLOR: Record<string, string> = {
  informational: "teal",
  commercial_investigation: "amber",
};

export function SeoBriefsView() {
  const { navigate } = useNav();
  const [articles, setArticles] = useState<Article[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filters, setFilters] = useState<Record<string, string>>({});
  const [selected, setSelected] = useState<BriefRow | null>(null);

  useEffect(() => {
    contentService
      .listArticles()
      .then((d) => setArticles(d.articles))
      .finally(() => setLoading(false));
  }, []);

  const briefs = useMemo<BriefRow[]>(() => {
    return INITIAL_SEARCH_BRIEFS.map((brief) => {
      const article = articles.find((item) => item.slug === brief.slug);
      const status: BriefRow["status"] = !article
        ? "draft_structure"
        : article.status === "published"
          ? "published"
          : "article_exists";
      return {
        ...brief,
        id: brief.slug,
        status,
        articleId: article?.id,
      };
    });
  }, [articles]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    return briefs.filter((brief) => {
      if (
        q &&
        !`${brief.title} ${brief.primaryKeyword} ${brief.secondaryKeywords.join(" ")}`
          .toLowerCase()
          .includes(q)
      ) {
        return false;
      }
      if (filters.status && brief.status !== filters.status) return false;
      if (filters.intent && brief.searchIntent !== filters.intent) return false;
      return true;
    });
  }, [briefs, search, filters]);

  if (loading) return <LoadingState label="Loading SEO briefs…" />;

  const draftCount = briefs.filter((b) => b.status === "draft_structure").length;
  const inCms = briefs.filter((b) => b.status === "article_exists").length;
  const published = briefs.filter((b) => b.status === "published").length;

  return (
    <div>
      <PageHeader
        title="SEO Briefs"
        description="Editorial structures for the first search topics — no invented rankings or volume metrics"
        action={
          <Button
            variant="outline"
            onClick={() => navigate("content-studio")}
          >
            <FileText className="size-4" /> Open Content Studio
          </Button>
        }
      />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <MetricCard label="Launch briefs" value={briefs.length} icon={FileText} tone="default" />
        <MetricCard label="Structure only" value={draftCount} icon={Lightbulb} tone="amber" />
        <MetricCard label="In CMS" value={inCms} icon={Target} tone="teal" />
        <MetricCard label="Published" value={published} icon={ListChecks} tone="green" />
      </div>

      <FilterBar
        search={search}
        onSearchChange={setSearch}
        filters={[
          {
            key: "status",
            label: "Status",
            options: [
              { value: "draft_structure", label: "Structure only" },
              { value: "article_exists", label: "In CMS" },
              { value: "published", label: "Published" },
            ],
          },
          {
            key: "intent",
            label: "Intent",
            options: [
              { value: "informational", label: "Informational" },
              { value: "commercial_investigation", label: "Commercial investigation" },
            ],
          },
        ]}
        activeFilters={filters}
        onFilterChange={(k, v) => setFilters((f) => ({ ...f, [k]: v }))}
        onClear={() => {
          setSearch("");
          setFilters({});
        }}
        searchPlaceholder="Search by title or keyword…"
      />

      <DataTable
        data={filtered}
        onRowClick={(brief) => setSelected(brief)}
        emptyTitle="No briefs match"
        emptyDescription="Clear filters to see the launch content architecture."
        columns={[
          {
            key: "title",
            header: "Brief",
            sortValue: (b) => b.title,
            render: (b) => (
              <div>
                <div className="font-medium">{b.title}</div>
                <div className="mt-0.5 inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Search className="size-3.5" />
                  {b.primaryKeyword}
                </div>
              </div>
            ),
          },
          {
            key: "searchIntent",
            header: "Intent",
            sortValue: (b) => b.searchIntent,
            render: (b) => (
              <StatusBadge
                label={b.searchIntent.replaceAll("_", " ")}
                color={INTENT_COLOR[b.searchIntent]}
              />
            ),
          },
          {
            key: "sections",
            header: "Outline",
            hideOnMobile: true,
            sortValue: (b) => b.tableOfContents.length,
            render: (b) => (
              <span className="text-sm tabular-nums">
                {b.tableOfContents.length} sections
              </span>
            ),
          },
          {
            key: "sources",
            header: "Sources",
            hideOnMobile: true,
            sortValue: (b) => b.suggestedSources.length,
            render: (b) => (
              <span className="text-sm tabular-nums">
                {b.suggestedSources.length} suggested
              </span>
            ),
          },
          {
            key: "status",
            header: "Status",
            sortValue: (b) => b.status,
            render: (b) => (
              <StatusBadge
                label={
                  b.status === "draft_structure"
                    ? "Structure only"
                    : b.status === "article_exists"
                      ? "In CMS"
                      : "Published"
                }
                color={STATUS_COLOR[b.status]}
              />
            ),
          },
        ]}
      />

      {selected && (
        <SectionCard
          className="mt-6"
          title={selected.title}
          description={`${selected.primaryKeyword} · ${selected.searchIntent.replaceAll("_", " ")}`}
          action={
            selected.articleId ? (
              <Button
                size="sm"
                onClick={() =>
                  navigate("content-studio", null, { articleId: selected.articleId })
                }
              >
                Edit article
              </Button>
            ) : (
              <Button
                size="sm"
                variant="outline"
                onClick={() =>
                  navigate("content-studio", null, {
                    seedSlug: selected.slug,
                    seedTitle: selected.title,
                  })
                }
              >
                Create draft from brief
              </Button>
            )
          }
        >
          <div className="grid gap-6 lg:grid-cols-2">
            <div className="space-y-4 text-sm">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Meta description
                </p>
                <p className="mt-1">{selected.metaDescription}</p>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Supporting keywords
                </p>
                <ul className="mt-1 list-disc space-y-1 pl-5">
                  {selected.secondaryKeywords.map((keyword) => (
                    <li key={keyword}>{keyword}</li>
                  ))}
                </ul>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Required factual sections
                </p>
                <ul className="mt-1 list-disc space-y-1 pl-5">
                  {selected.requiredSections.map((section) => (
                    <li key={section}>{section}</li>
                  ))}
                </ul>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Internal links
                </p>
                <ul className="mt-1 space-y-1">
                  {selected.internalLinks.map((link) => (
                    <li key={link} className="font-mono text-xs">
                      {link}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
            <div className="space-y-4 text-sm">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Table of contents
                </p>
                <ol className="mt-1 list-decimal space-y-1 pl-5">
                  {selected.tableOfContents.map((heading) => (
                    <li key={heading}>{heading}</li>
                  ))}
                </ol>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Suggested sources
                </p>
                <ul className="mt-1 space-y-2">
                  {selected.suggestedSources.map((source) => (
                    <li key={source.url}>
                      <a
                        href={source.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 font-medium text-teal-700 hover:underline"
                      >
                        {source.organization}
                        <ExternalLink className="size-3.5" />
                      </a>
                      <p className="text-xs text-muted-foreground">{source.topic}</p>
                    </li>
                  ))}
                </ul>
              </div>
              <div className="rounded-md border bg-muted/30 p-3 text-xs text-muted-foreground">
                <p>
                  <span className="font-semibold text-foreground">Directory CTA:</span>{" "}
                  {selected.directoryCta}
                </p>
                <p className="mt-2">
                  <span className="font-semibold text-foreground">Assessment CTA:</span>{" "}
                  {selected.assessmentCta}
                </p>
                <p className="mt-2">{selected.medicalDisclaimer}</p>
              </div>
            </div>
          </div>
        </SectionCard>
      )}
    </div>
  );
}
