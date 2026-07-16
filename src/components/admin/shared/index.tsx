"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { LucideIcon, Search, SlidersHorizontal, Inbox, ChevronLeft, ChevronRight, ArrowUpDown } from "lucide-react";
import {
  stageBadgeClass, stageLabel, priorityBadgeClass,
  dealStageBadgeClass, dealStageLabel,
  directoryStageBadgeClass, directoryStageLabel,
} from "@/lib/constants";

// ---------------------------------------------------------------------------
// PageHeader
// ---------------------------------------------------------------------------
export function PageHeader({
  title, description, action, breadcrumbs,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
  breadcrumbs?: { label: string; onClick?: () => void }[];
}) {
  return (
    <div className="mb-5">
      {breadcrumbs && (
        <nav className="flex items-center gap-1 text-xs text-muted-foreground mb-2">
          {breadcrumbs.map((b, i) => (
            <React.Fragment key={i}>
              {i > 0 && <span className="opacity-50">/</span>}
              <button onClick={b.onClick} className="hover:text-foreground transition-colors">{b.label}</button>
            </React.Fragment>
          ))}
        </nav>
      )}
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-xl font-semibold tracking-tight">{title}</h1>
          {description && <p className="text-sm text-muted-foreground mt-1">{description}</p>}
        </div>
        {action && <div className="flex items-center gap-2 shrink-0">{action}</div>}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// MetricCard
// ---------------------------------------------------------------------------
export function MetricCard({
  label, value, icon: Icon, hint, tone = "default", onClick, trend,
}: {
  label: string;
  value: string | number;
  icon: LucideIcon;
  hint?: string;
  tone?: "default" | "teal" | "amber" | "rose" | "green" | "violet";
  onClick?: () => void;
  trend?: number;
}) {
  const toneClasses: Record<string, string> = {
    default: "text-foreground bg-muted/60",
    teal: "text-teal-700 bg-teal-50",
    amber: "text-amber-700 bg-amber-50",
    rose: "text-rose-700 bg-rose-50",
    green: "text-emerald-700 bg-emerald-50",
    violet: "text-violet-700 bg-violet-50",
  };
  return (
    <Card className={cn("p-4 gap-0 hover:shadow-sm transition-shadow", onClick && "cursor-pointer hover:border-primary/40")} onClick={onClick}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide truncate">{label}</p>
          <p className="text-2xl font-semibold tabular-nums mt-1 truncate">{value}</p>
          <div className="flex items-center gap-2 mt-1">
            {hint && <p className="text-xs text-muted-foreground truncate">{hint}</p>}
            {trend != null && (
              <span className={cn("text-xs font-medium tabular-nums", trend >= 0 ? "text-emerald-600" : "text-rose-500")}>
                {trend >= 0 ? "↑" : "↓"} {Math.abs(trend)}%
              </span>
            )}
          </div>
        </div>
        <div className={cn("size-9 rounded-lg flex items-center justify-center shrink-0", toneClasses[tone])}>
          <Icon className="size-4" />
        </div>
      </div>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// SectionCard
// ---------------------------------------------------------------------------
export function SectionCard({
  title, description, action, children, className, bodyClassName,
}: {
  title?: string;
  description?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  bodyClassName?: string;
}) {
  return (
    <Card className={cn("gap-0", className)}>
      {(title || action) && (
        <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-border/70">
          <div className="min-w-0">
            {title && <h3 className="text-sm font-semibold truncate">{title}</h3>}
            {description && <p className="text-xs text-muted-foreground mt-0.5 truncate">{description}</p>}
          </div>
          {action}
        </div>
      )}
      <div className={cn("p-4", bodyClassName)}>{children}</div>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// EmptyState
// ---------------------------------------------------------------------------
export function EmptyState({
  icon: Icon = Inbox, title, description, action,
}: {
  icon?: LucideIcon;
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center text-center py-12 px-4">
      <div className="size-12 rounded-xl bg-muted flex items-center justify-center mb-3">
        <Icon className="size-5 text-muted-foreground" />
      </div>
      <p className="text-sm font-medium">{title}</p>
      {description && <p className="text-xs text-muted-foreground mt-1 max-w-sm">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

// ---------------------------------------------------------------------------
// LoadingState
// ---------------------------------------------------------------------------
export function LoadingState({ label = "Loading…" }: { label?: string }) {
  return (
    <div className="flex items-center justify-center gap-2 py-12 text-sm text-muted-foreground">
      <div className="size-4 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
      {label}
    </div>
  );
}

export function TableSkeleton({ rows = 6, cols = 5 }: { rows?: number; cols?: number }) {
  return (
    <div className="p-4 space-y-3">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex gap-3">
          {Array.from({ length: cols }).map((_, j) => (
            <Skeleton key={j} className="h-8 flex-1" />
          ))}
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// FilterBar
// ---------------------------------------------------------------------------
export function FilterBar({
  search, onSearchChange, filters, activeFilters, onFilterChange, onClear,
  searchPlaceholder = "Search…",
}: {
  search: string;
  onSearchChange: (v: string) => void;
  filters?: { key: string; label: string; options: { value: string; label: string }[] }[];
  activeFilters: Record<string, string>;
  onFilterChange: (key: string, value: string) => void;
  onClear: () => void;
  searchPlaceholder?: string;
}) {
  const activeCount = Object.values(activeFilters).filter(Boolean).length;
  return (
    <div className="flex flex-col gap-2 mb-3">
      <div className="flex items-center gap-2 flex-wrap">
        <div className="relative flex-1 min-w-[200px] max-w-md">
          <Search className="size-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
          <Input value={search} onChange={(e) => onSearchChange(e.target.value)} placeholder={searchPlaceholder} className="pl-9 h-9" />
        </div>
        {activeCount > 0 && (
          <Button variant="ghost" size="sm" onClick={onClear} className="h-9 text-muted-foreground">
            Clear ({activeCount})
          </Button>
        )}
      </div>
      {filters && filters.length > 0 && (
        <div className="flex items-center gap-2 flex-wrap">
          <SlidersHorizontal className="size-3.5 text-muted-foreground" />
          {filters.map((f) => (
            <select
              key={f.key}
              value={activeFilters[f.key] ?? ""}
              onChange={(e) => onFilterChange(f.key, e.target.value)}
              className="h-8 rounded-md border border-input bg-background px-2 text-xs"
            >
              <option value="">{f.label}: Any</option>
              {f.options.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          ))}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// DataTable — generic, sortable, paginated
// ---------------------------------------------------------------------------
export interface Column<T> {
  key: string;
  header: string;
  render: (row: T) => React.ReactNode;
  sortValue?: (row: T) => string | number;
  className?: string;
  hideOnMobile?: boolean;
}

export function DataTable<T extends { id: string }>({
  columns, data, onRowClick, pageSize = 25, emptyTitle = "No records found",
  emptyDescription, emptyAction,
}: {
  columns: Column<T>[];
  data: T[];
  onRowClick?: (row: T) => void;
  pageSize?: number;
  emptyTitle?: string;
  emptyDescription?: string;
  emptyAction?: React.ReactNode;
}) {
  const [page, setPage] = React.useState(1);
  const [sortKey, setSortKey] = React.useState<string | null>(null);
  const [sortDir, setSortDir] = React.useState<"asc" | "desc">("desc");

  const sorted = React.useMemo(() => {
    if (!sortKey) return data;
    const col = columns.find((c) => c.key === sortKey);
    if (!col?.sortValue) return data;
    return [...data].sort((a, b) => {
      const av = col.sortValue!(a);
      const bv = col.sortValue!(b);
      const cmp = typeof av === "number" && typeof bv === "number" ? av - bv : String(av).localeCompare(String(bv));
      return sortDir === "asc" ? cmp : -cmp;
    });
  }, [data, sortKey, sortDir, columns]);

  const totalPages = Math.max(1, Math.ceil(sorted.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const paged = sorted.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  function toggleSort(key: string) {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  }

  if (data.length === 0) {
    return <EmptyState title={emptyTitle} description={emptyDescription} action={emptyAction} />;
  }

  return (
    <div>
      <div className="overflow-x-auto nv-scroll">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/40 text-left">
              {columns.map((col) => (
                <th
                  key={col.key}
                  className={cn(
                    "font-medium text-muted-foreground px-3 py-2.5 whitespace-nowrap",
                    col.className,
                    col.hideOnMobile && "hidden md:table-cell",
                    col.sortValue && "cursor-pointer hover:text-foreground"
                  )}
                  onClick={() => col.sortValue && toggleSort(col.key)}
                >
                  <span className="inline-flex items-center gap-1">
                    {col.header}
                    {col.sortValue && <ArrowUpDown className="size-3 opacity-50" />}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {paged.map((row) => (
              <tr
                key={row.id}
                onClick={() => onRowClick?.(row)}
                className={cn(
                  "border-b last:border-0 hover:bg-accent/40 transition-colors",
                  onRowClick && "cursor-pointer"
                )}
              >
                {columns.map((col) => (
                  <td
                    key={col.key}
                    className={cn("px-3 py-2.5", col.className, col.hideOnMobile && "hidden md:table-cell")}
                  >
                    {col.render(row)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {totalPages > 1 && (
        <div className="flex items-center justify-between px-3 py-2.5 border-t text-xs text-muted-foreground">
          <span>Showing {(currentPage - 1) * pageSize + 1}–{Math.min(currentPage * pageSize, sorted.length)} of {sorted.length}</span>
          <div className="flex items-center gap-1">
            <Button variant="outline" size="icon" className="size-7" disabled={currentPage <= 1} onClick={() => setPage((p) => p - 1)}>
              <ChevronLeft className="size-3.5" />
            </Button>
            <span className="px-2 tabular-nums">{currentPage} / {totalPages}</span>
            <Button variant="outline" size="icon" className="size-7" disabled={currentPage >= totalPages} onClick={() => setPage((p) => p + 1)}>
              <ChevronRight className="size-3.5" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// StatusBadge — generic by color token
// ---------------------------------------------------------------------------
const COLOR_CLASSES: Record<string, string> = {
  slate: "bg-slate-100 text-slate-700 border-slate-200",
  teal: "bg-teal-50 text-teal-700 border-teal-200",
  amber: "bg-amber-50 text-amber-700 border-amber-200",
  violet: "bg-violet-50 text-violet-700 border-violet-200",
  green: "bg-emerald-50 text-emerald-700 border-emerald-200",
  rose: "bg-rose-50 text-rose-700 border-rose-200",
};

export function StatusBadge({ label, color = "slate", className }: { label: string; color?: string; className?: string }) {
  return (
    <span className={cn("inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium", COLOR_CLASSES[color] ?? COLOR_CLASSES.slate, className)}>
      {label}
    </span>
  );
}

export function DataSourceBadge({ source }: { source?: "live" | "demo" }) {
  const live = source === "live";
  return (
    <Badge variant="outline" className={cn("text-[10px] px-1.5 py-0", live ? "border-emerald-200 text-emerald-700" : "border-slate-300 text-slate-500")}>
      {live ? "Live" : "Demo"}
    </Badge>
  );
}

export function PriorityBadge({ priority }: { priority: string }) {
  const colors: Record<string, string> = { low: "slate", normal: "teal", high: "amber", critical: "rose" };
  return <StatusBadge label={priority.charAt(0).toUpperCase() + priority.slice(1)} color={colors[priority] ?? "slate"} />;
}

export function ScoreBadge({ score, className }: { score: number; className?: string }) {
  const tone = score >= 75 ? "green" : score >= 50 ? "amber" : "slate";
  return <StatusBadge label={String(score)} color={tone} className={cn("tabular-nums", className)} />;
}

// ---------------------------------------------------------------------------
// SavedViewSelector
// ---------------------------------------------------------------------------
export function SavedViewSelector({
  views, active, onSelect,
}: {
  views: string[];
  active: string;
  onSelect: (v: string) => void;
}) {
  return (
    <div className="flex items-center gap-2 mb-3 overflow-x-auto nv-scroll pb-1">
      {views.map((v) => (
        <button
          key={v}
          onClick={() => onSelect(v)}
          className={cn(
            "shrink-0 text-xs font-medium px-2.5 py-1.5 rounded-md border transition-colors",
            active === v ? "bg-primary text-primary-foreground border-primary" : "bg-card hover:bg-accent"
          )}
        >
          {v}
        </button>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// ActivityTimeline
// ---------------------------------------------------------------------------
export function ActivityTimeline({
  items, maxHeight = "400px",
}: {
  items: { id: string; summary: string; timestamp: string; adminName?: string; action?: string }[];
  maxHeight?: string;
}) {
  return (
    <div className="overflow-y-auto nv-scroll" style={{ maxHeight }}>
      <div className="divide-y divide-border/60">
        {items.map((a) => (
          <div key={a.id} className="px-4 py-2.5">
            <p className="text-sm leading-snug">{a.summary}</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {a.adminName && `${a.adminName} · `}
              {new Date(a.timestamp).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// DetailDrawer (using shadcn Sheet)
// ---------------------------------------------------------------------------
export function DetailDrawer({
  open, onOpenChange, title, children,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <React.Fragment>
      {open && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div className="absolute inset-0 bg-black/40" onClick={() => onOpenChange(false)} />
          <div className="relative w-full max-w-md bg-background border-l shadow-xl overflow-y-auto nv-scroll">
            <div className="flex items-center justify-between px-4 py-3 border-b sticky top-0 bg-background z-10">
              <h3 className="text-sm font-semibold">{title}</h3>
              <Button variant="ghost" size="icon" className="size-7" onClick={() => onOpenChange(false)}>
                <ChevronLeft className="size-4 rotate-180" />
              </Button>
            </div>
            <div className="p-4">{children}</div>
          </div>
        </div>
      )}
    </React.Fragment>
  );
}

// ---------------------------------------------------------------------------
// ConfirmationDialog
// ---------------------------------------------------------------------------
export function ConfirmationDialog({
  open, onOpenChange, title, description, confirmLabel = "Confirm", onConfirm, destructive,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  title: string;
  description: string;
  confirmLabel?: string;
  onConfirm: () => void;
  destructive?: boolean;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={() => onOpenChange(false)} />
      <Card className="relative w-full max-w-sm p-5 shadow-xl">
        <h3 className="text-base font-semibold">{title}</h3>
        <p className="text-sm text-muted-foreground mt-2">{description}</p>
        <div className="flex justify-end gap-2 mt-4">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button
            variant={destructive ? "destructive" : "default"}
            onClick={() => { onConfirm(); onOpenChange(false); }}
          >
            {confirmLabel}
          </Button>
        </div>
      </Card>
    </div>
  );
}

// ---------------------------------------------------------------------------
// FormSection
// ---------------------------------------------------------------------------
export function FormSection({ title, children, description }: { title: string; description?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-3">
      <div>
        <h3 className="text-sm font-semibold">{title}</h3>
        {description && <p className="text-xs text-muted-foreground mt-0.5">{description}</p>}
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">{children}</div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// ChartCard — simple bar/line chart wrapper using divs (no external chart lib needed for mock)
// ---------------------------------------------------------------------------
export function ChartCard({
  title, data, type = "bar", className,
}: {
  title: string;
  data: { label: string; value: number; color?: string }[];
  type?: "bar" | "line";
  className?: string;
}) {
  const max = Math.max(1, ...data.map((d) => d.value));
  return (
    <Card className={cn("p-4 gap-0", className)}>
      <h3 className="text-sm font-semibold mb-3">{title}</h3>
      {type === "bar" ? (
        <div className="space-y-2">
          {data.map((d, i) => (
            <div key={i} className="flex items-center gap-3">
              <div className="w-24 text-xs text-muted-foreground truncate shrink-0">{d.label}</div>
              <div className="flex-1 h-5 bg-muted rounded-md overflow-hidden">
                <div
                  className="h-full rounded-md transition-all"
                  style={{ width: `${(d.value / max) * 100}%`, backgroundColor: d.color ?? "var(--primary)" }}
                />
              </div>
              <div className="w-12 text-right text-xs font-medium tabular-nums">{d.value.toLocaleString()}</div>
            </div>
          ))}
        </div>
      ) : (
        <div className="h-32 flex items-end gap-1">
          {data.map((d, i) => (
            <div key={i} className="flex-1 flex flex-col items-center gap-1">
              <div className="w-full bg-muted rounded-t-md overflow-hidden flex items-end" style={{ height: "100px" }}>
                <div className="w-full rounded-t-md transition-all" style={{ height: `${(d.value / max) * 100}%`, backgroundColor: d.color ?? "var(--primary)" }} />
              </div>
              <span className="text-[10px] text-muted-foreground truncate w-full text-center">{d.label}</span>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

// ---------------------------------------------------------------------------
// TabsList wrapper for convenience
// ---------------------------------------------------------------------------
export { Badge, Button };

// ---------------------------------------------------------------------------
// Legacy components (kept for back-compat with existing views)
// ---------------------------------------------------------------------------

export function LogoMark({ className }: { className?: string }) {
  return <img src="/logo.svg" className={cn("object-contain", className)} alt="Novalyte AI" />;
}

/** Alias of MetricCard kept for back-compat. */
export const StatCard = MetricCard;

export function StageBadge({ stage, className }: { stage: string; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium",
        stageBadgeClass(stage),
        className
      )}
    >
      {stageLabel(stage)}
    </span>
  );
}

export function DealStageBadge({ stage, className }: { stage: string; className?: string }) {
  return (
    <span className={cn("inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium", dealStageBadgeClass(stage), className)}>
      {dealStageLabel(stage)}
    </span>
  );
}

export function DirectoryStageBadge({ stage, className }: { stage: string; className?: string }) {
  return (
    <span className={cn("inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium", directoryStageBadgeClass(stage), className)}>
      {directoryStageLabel(stage)}
    </span>
  );
}

export function ReadinessScore({ score, className }: { score: number; className?: string }) {
  const tone =
    score >= 75 ? "text-emerald-700 bg-emerald-50 border-emerald-200"
    : score >= 50 ? "text-amber-700 bg-amber-50 border-amber-200"
    : "text-slate-600 bg-slate-50 border-slate-200";
  return (
    <span className={cn("inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium tabular-nums", tone, className)}>
      {score}
    </span>
  );
}

// Small pill
export function Pill({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <span className={cn("inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium", className)}>
      {children}
    </span>
  );
}

export async function fetchJson<T = unknown>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error || `Request failed (${res.status})`);
  }
  return res.json() as Promise<T>;
}
