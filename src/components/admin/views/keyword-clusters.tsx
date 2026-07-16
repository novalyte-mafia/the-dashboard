"use client";

import { useEffect, useMemo, useState } from "react";
import { useNav } from "@/components/admin/admin-app";
import {
  PageHeader, MetricCard, LoadingState, EmptyState, SectionCard,
  ScoreBadge, FilterBar, DataTable, type Column,
} from "@/components/admin/shared";
import {
  Search, Hash, DollarSign, Gauge, Layers,
} from "lucide-react";
import { demandService } from "@/services";
import type { MarketData } from "@/types";
import { formatCurrency } from "@/lib/format";
import { SERVICE_CATALOG } from "@/lib/constants";

interface KeywordRow {
  id: string;
  keyword: string;
  volume: number;
  cpc: number;
  competition: number; // derived from market competitionScore
  market: string;
  state: string;
  treatment: string;
  treatmentSlug: string;
}

const TREATMENT_KEYWORD_MAP: Record<string, string[]> = {
  trt: ["trt", "testosterone"],
  "glp-1": ["glp-1", "semaglutide", "weight loss injection"],
  "medical-weight-loss": ["weight loss", "glp", "semaglutide"],
  "ed-care": ["ed", "erectile"],
  "peptide-therapy": ["peptide"],
  "hormone-optimization": ["hormone", "testosterone"],
  "iv-therapy": ["iv therapy"],
};

function classifyTreatment(keyword: string): string | null {
  const k = keyword.toLowerCase();
  for (const [slug, terms] of Object.entries(TREATMENT_KEYWORD_MAP)) {
    if (terms.some((t) => k.includes(t))) return slug;
  }
  return null;
}

const treatmentName = (slug: string) =>
  SERVICE_CATALOG.find((s) => s.slug === slug)?.name ?? slug;

export function KeywordClustersView() {
  const { refreshKey } = useNav();
  const [markets, setMarkets] = useState<MarketData[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [activeFilters, setActiveFilters] = useState<Record<string, string>>({});

  useEffect(() => {
    setLoading(true);
    demandService
      .listMarkets()
      .then((d) => setMarkets(d.markets))
      .finally(() => setLoading(false));
  }, [refreshKey]);

  const keywordRows = useMemo<KeywordRow[]>(() => {
    const seen = new Map<string, KeywordRow>();
    for (const m of markets) {
      for (const kw of m.topKeywords) {
        const treatmentSlug = classifyTreatment(kw.keyword) ?? "other";
        const key = `${kw.keyword}`;
        if (!seen.has(key)) {
          seen.set(key, {
            id: `${m.id}-${kw.keyword}`,
            keyword: kw.keyword,
            volume: kw.volume,
            cpc: kw.cpc,
            competition: m.competitionScore,
            market: m.geography,
            state: m.state,
            treatment: treatmentName(treatmentSlug),
            treatmentSlug,
          });
        } else {
          // aggregate — take max volume & avg cpc
          const existing = seen.get(key)!;
          existing.volume = Math.max(existing.volume, kw.volume);
          existing.cpc = Math.round(((existing.cpc + kw.cpc) / 2) * 100) / 100;
        }
      }
    }
    return Array.from(seen.values());
  }, [markets]);

  const treatments = useMemo(() => {
    const set = new Set(keywordRows.map((k) => k.treatmentSlug));
    return Array.from(set);
  }, [keywordRows]);

  const filters = [
    {
      key: "treatment",
      label: "Treatment",
      options: treatments
        .filter((t) => t !== "other")
        .map((t) => ({ value: t, label: treatmentName(t) }))
        .concat([{ value: "other", label: "Other" }]),
    },
    {
      key: "state",
      label: "State",
      options: Array.from(new Set(markets.map((m) => m.state))).map((s) => ({ value: s, label: s })),
    },
  ];

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return keywordRows.filter((k) => {
      if (q && !`${k.keyword} ${k.market} ${k.treatment}`.toLowerCase().includes(q)) return false;
      if (activeFilters.treatment && k.treatmentSlug !== activeFilters.treatment) return false;
      if (activeFilters.state && k.state !== activeFilters.state) return false;
      return true;
    });
  }, [keywordRows, search, activeFilters]);

  const grouped = useMemo(() => {
    const map = new Map<string, KeywordRow[]>();
    for (const k of filtered) {
      if (!map.has(k.treatment)) map.set(k.treatment, []);
      map.get(k.treatment)!.push(k);
    }
    return Array.from(map.entries()).map(([treatment, rows]) => ({
      treatment,
      rows: rows.sort((a, b) => b.volume - a.volume),
      totalVolume: rows.reduce((s, r) => s + r.volume, 0),
      avgCpc: Math.round((rows.reduce((s, r) => s + r.cpc, 0) / rows.length) * 100) / 100,
    }));
  }, [filtered]);

  const totalVolume = keywordRows.reduce((s, k) => s + k.volume, 0);
  const avgCpc = keywordRows.length
    ? Math.round((keywordRows.reduce((s, k) => s + k.cpc, 0) / keywordRows.length) * 100) / 100
    : 0;
  const avgCompetition = keywordRows.length
    ? Math.round(keywordRows.reduce((s, k) => s + k.competition, 0) / keywordRows.length)
    : 0;

  const columns: Column<KeywordRow>[] = [
    {
      key: "keyword",
      header: "Keyword",
      render: (k) => (
        <div className="min-w-0">
          <div className="font-medium truncate inline-flex items-center gap-1.5">
            <Hash className="size-3 text-muted-foreground" />
            {k.keyword}
          </div>
          <div className="text-xs text-muted-foreground truncate">{k.treatment}</div>
        </div>
      ),
      sortValue: (k) => k.keyword,
    },
    {
      key: "market",
      header: "Source Market",
      render: (k) => <span className="text-sm text-muted-foreground">{k.market}</span>,
      sortValue: (k) => k.market,
      hideOnMobile: true,
    },
    {
      key: "volume",
      header: "Volume",
      render: (k) => <span className="tabular-nums text-sm">{k.volume.toLocaleString()}</span>,
      sortValue: (k) => k.volume,
    },
    {
      key: "cpc",
      header: "CPC",
      render: (k) => <span className="tabular-nums text-sm">{formatCurrency(k.cpc)}</span>,
      sortValue: (k) => k.cpc,
    },
    {
      key: "competition",
      header: "Competition",
      render: (k) => <ScoreBadge score={k.competition} />,
      sortValue: (k) => k.competition,
      hideOnMobile: true,
    },
  ];

  return (
    <div>
      <PageHeader
        title="Keyword Clusters"
        description="Top performing keywords across markets — grouped by treatment category"
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
        <MetricCard label="Tracked Keywords" value={keywordRows.length} icon={Hash} tone="teal" hint="Unique across markets" />
        <MetricCard
          label="Total Volume"
          value={`${(totalVolume / 1000).toFixed(0)}k`}
          icon={Search}
          tone="violet"
          hint="Monthly searches"
        />
        <MetricCard label="Avg CPC" value={formatCurrency(avgCpc)} icon={DollarSign} tone="amber" hint="Across all keywords" />
        <MetricCard label="Avg Competition" value={avgCompetition} icon={Gauge} tone="rose" hint="0–100 index" />
      </div>

      <FilterBar
        search={search}
        onSearchChange={setSearch}
        filters={filters}
        activeFilters={activeFilters}
        onFilterChange={(k, v) => setActiveFilters((prev) => {
          const next = { ...prev };
          if (v) next[k] = v; else delete next[k];
          return next;
        })}
        onClear={() => setActiveFilters({})}
        searchPlaceholder="Search keywords, markets, treatments…"
      />

      {loading ? (
        <SectionCard>
          <LoadingState label="Loading keywords…" />
        </SectionCard>
      ) : grouped.length === 0 ? (
        <SectionCard>
          <EmptyState
            icon={Search}
            title="No keywords match"
            description="Adjust filters to surface keyword clusters."
          />
        </SectionCard>
      ) : (
        <div className="space-y-4">
          {grouped.map((group) => (
            <SectionCard
              key={group.treatment}
              title={group.treatment}
              description={`${group.rows.length} keywords · Vol ${(group.totalVolume / 1000).toFixed(0)}k · Avg CPC ${formatCurrency(group.avgCpc)}`}
              action={<Layers className="size-4 text-muted-foreground" />}
              bodyClassName="p-0"
            >
              <DataTable
                columns={columns}
                data={group.rows}
                pageSize={10}
                emptyTitle="No keywords"
              />
            </SectionCard>
          ))}
        </div>
      )}
    </div>
  );
}
