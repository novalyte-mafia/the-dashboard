"use client";

import { cn } from "@/lib/utils";
import { Card } from "@/components/ui/card";
import { LucideIcon } from "lucide-react";
import { stageBadgeClass, stageLabel, priorityBadgeClass, dealStageBadgeClass, dealStageLabel, directoryStageBadgeClass, directoryStageLabel } from "@/lib/constants";

export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={className} fill="none" aria-hidden="true">
      <path
        d="M16 3 C16.7 9.6 21.4 14.3 28 15 C21.4 15.7 16.7 20.4 16 27 C15.3 20.4 10.6 15.7 4 15 C10.6 14.3 15.3 9.6 16 3Z"
        fill="currentColor"
      />
    </svg>
  );
}

export function StatCard({
  label,
  value,
  icon: Icon,
  hint,
  tone = "default",
  onClick,
}: {
  label: string;
  value: string | number;
  icon: LucideIcon;
  hint?: string;
  tone?: "default" | "teal" | "amber" | "rose" | "green" | "violet";
  onClick?: () => void;
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
    <Card
      className={cn(
        "p-4 gap-0 hover:shadow-sm transition-shadow",
        onClick && "cursor-pointer hover:border-primary/40"
      )}
      onClick={onClick}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide truncate">{label}</p>
          <p className="text-2xl font-semibold tabular-nums mt-1 truncate">{value}</p>
          {hint && <p className="text-xs text-muted-foreground mt-1 truncate">{hint}</p>}
        </div>
        <div className={cn("size-9 rounded-lg flex items-center justify-center shrink-0", toneClasses[tone])}>
          <Icon className="size-4.5" />
        </div>
      </div>
    </Card>
  );
}

export function SectionCard({
  title,
  description,
  action,
  children,
  className,
  bodyClassName,
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

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
}: {
  icon: LucideIcon;
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

export function PriorityBadge({ priority }: { priority: string }) {
  return (
    <span className={cn("inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium capitalize", priorityBadgeClass(priority))}>
      {priority}
    </span>
  );
}

export function DealStageBadge({ stage }: { stage: string }) {
  return (
    <span className={cn("inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium", dealStageBadgeClass(stage))}>
      {dealStageLabel(stage)}
    </span>
  );
}

export function DirectoryStageBadge({ stage }: { stage: string }) {
  return (
    <span className={cn("inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium", directoryStageBadgeClass(stage))}>
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

export function LoadingState({ label = "Loading…" }: { label?: string }) {
  return (
    <div className="flex items-center justify-center gap-2 py-12 text-sm text-muted-foreground">
      <div className="size-4 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
      {label}
    </div>
  );
}

export function PageHeader({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3 mb-5">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">{title}</h1>
        {description && <p className="text-sm text-muted-foreground mt-1">{description}</p>}
      </div>
      {action && <div className="flex items-center gap-2">{action}</div>}
    </div>
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
