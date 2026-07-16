"use client";

import { useEffect, useMemo, useState } from "react";
import { useNav } from "@/components/admin/admin-app";
import { contentService } from "@/services";
import type { Article } from "@/types";
import {
  PageHeader, LoadingState, EmptyState, StatusBadge, ScoreBadge, SectionCard,
} from "@/components/admin/shared/index";
import { Button } from "@/components/ui/button";
import {
  ChevronLeft, ChevronRight, CalendarDays, Plus, Edit3,
} from "lucide-react";
import { toast } from "sonner";

const STATUS_COLOR: Record<string, string> = {
  published: "green", scheduled: "teal", approved: "violet", review: "amber",
  draft: "slate", idea: "slate", brief: "slate", update_needed: "rose", archived: "slate",
};

function startOfWeek(d: Date): Date {
  const date = new Date(d);
  date.setHours(0, 0, 0, 0);
  const day = date.getDay(); // 0 Sun, 1 Mon
  const diff = day === 0 ? -6 : 1 - day; // Monday-start
  date.setDate(date.getDate() + diff);
  return date;
}

function addDays(d: Date, n: number): Date {
  const date = new Date(d);
  date.setDate(date.getDate() + n);
  return date;
}

function fmtKey(d: Date): string {
  return d.toISOString().slice(0, 10);
}

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export function EditorialCalendarView() {
  const { navigate, refreshKey } = useNav();
  const [data, setData] = useState<Article[]>([]);
  const [loading, setLoading] = useState(true);
  const [weekStart, setWeekStart] = useState<Date>(() => startOfWeek(new Date()));

  useEffect(() => {
    setLoading(true);
    contentService.listArticles()
      .then((d) => setData(d.articles))
      .finally(() => setLoading(false));
  }, [refreshKey]);

  const articlesByDate = useMemo(() => {
    const map = new Map<string, Article[]>();
    data.forEach((a) => {
      if (!a.publishDate) return;
      const key = fmtKey(new Date(a.publishDate));
      const arr = map.get(key) ?? [];
      arr.push(a);
      map.set(key, arr);
    });
    return map;
  }, [data]);

  if (loading) return <LoadingState label="Loading editorial calendar…" />;

  const weekDays = WEEKDAYS.map((_, i) => addDays(weekStart, i));
  const weekEnd = weekDays[6];
  const monthLabel = weekStart.getMonth() === weekEnd.getMonth()
    ? weekStart.toLocaleDateString("en-US", { month: "long", year: "numeric" })
    : `${weekStart.toLocaleDateString("en-US", { month: "short" })} – ${weekEnd.toLocaleDateString("en-US", { month: "short", year: "numeric" })}`;

  const todayKey = fmtKey(new Date());

  // For mini month grid (current month)
  const monthStart = new Date(weekStart.getFullYear(), weekStart.getMonth(), 1);
  const monthEnd = new Date(weekStart.getFullYear(), weekStart.getMonth() + 1, 0);
  const firstWeekdayOfMonth = (monthStart.getDay() + 6) % 7; // Monday-start
  const daysInMonth = monthEnd.getDate();

  return (
    <div>
      <PageHeader
        title="Editorial Calendar"
        description="Scheduled and published articles by week"
        action={
          <Button onClick={() => navigate("content-studio")}>
            <Plus className="size-4" /> Schedule Article
          </Button>
        }
      />

      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" className="size-8" onClick={() => setWeekStart((d) => addDays(d, -7))}>
            <ChevronLeft className="size-4" />
          </Button>
          <Button variant="outline" size="sm" onClick={() => setWeekStart(startOfWeek(new Date()))}>
            This week
          </Button>
          <Button variant="outline" size="icon" className="size-8" onClick={() => setWeekStart((d) => addDays(d, 7))}>
            <ChevronRight className="size-4" />
          </Button>
        </div>
        <div className="text-sm font-medium">{monthLabel}</div>
        <div className="text-xs text-muted-foreground tabular-nums">
          {weekStart.toLocaleDateString("en-US", { month: "short", day: "numeric" })} – {weekEnd.toLocaleDateString("en-US", { month: "short", day: "numeric" })}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-7 gap-2 mb-6">
        {weekDays.map((day, i) => {
          const key = fmtKey(day);
          const articles = articlesByDate.get(key) ?? [];
          const isToday = key === todayKey;
          return (
            <div
              key={key}
              className={`rounded-lg border ${isToday ? "border-teal-400 bg-teal-50/40" : "border-border/70 bg-card"} min-h-[180px] flex flex-col`}
            >
              <div className={`px-2.5 py-1.5 border-b ${isToday ? "border-teal-200" : "border-border/60"} flex items-center justify-between`}>
                <div>
                  <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{WEEKDAYS[i]}</div>
                  <div className={`text-sm font-semibold tabular-nums ${isToday ? "text-teal-700" : ""}`}>
                    {day.getDate()}
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-5 opacity-50 hover:opacity-100"
                  onClick={() => toast.info(`Schedule article for ${day.toLocaleDateString()}.`)}
                >
                  <Plus className="size-3" />
                </Button>
              </div>
              <div className="flex-1 p-1.5 space-y-1.5 overflow-y-auto nv-scroll">
                {articles.map((a) => (
                  <button
                    key={a.id}
                    onClick={() => navigate("content-studio", null, { articleId: a.id })}
                    className="w-full text-left p-1.5 rounded-md border border-border/60 bg-background hover:bg-accent/40 transition-colors"
                  >
                    <div className="flex items-start justify-between gap-1">
                      <div className="text-xs font-medium leading-snug line-clamp-2">{a.title}</div>
                      <StatusBadge label={a.status} color={STATUS_COLOR[a.status]} className="shrink-0 !text-[9px] !px-1 !py-0" />
                    </div>
                    {a.primaryKeyword && (
                      <div className="text-[10px] text-muted-foreground mt-0.5 truncate">{a.primaryKeyword}</div>
                    )}
                  </button>
                ))}
                {articles.length === 0 && (
                  <div className="h-full flex items-center justify-center text-[10px] text-muted-foreground/60 py-2">
                    —
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <SectionCard
          title="Month Overview"
          description={weekStart.toLocaleDateString("en-US", { month: "long", year: "numeric" })}
        >
          <div className="grid grid-cols-7 gap-1 text-center">
            {WEEKDAYS.map((d) => (
              <div key={d} className="text-[10px] text-muted-foreground uppercase">{d.charAt(0)}</div>
            ))}
            {Array.from({ length: firstWeekdayOfMonth }).map((_, i) => (
              <div key={`pad-${i}`} />
            ))}
            {Array.from({ length: daysInMonth }).map((_, i) => {
              const day = i + 1;
              const date = new Date(monthStart.getFullYear(), monthStart.getMonth(), day);
              const key = fmtKey(date);
              const hasArticles = (articlesByDate.get(key)?.length ?? 0) > 0;
              const isToday = key === todayKey;
              return (
                <button
                  key={day}
                  onClick={() => setWeekStart(startOfWeek(date))}
                  className={`aspect-square rounded-md text-xs tabular-nums flex flex-col items-center justify-center transition-colors ${
                    isToday ? "bg-teal-100 text-teal-800 font-semibold"
                    : hasArticles ? "bg-primary/10 text-primary hover:bg-primary/20"
                    : "hover:bg-accent"
                  }`}
                >
                  {day}
                  {hasArticles && <div className="size-1 rounded-full bg-teal-500 mt-0.5" />}
                </button>
              );
            })}
          </div>
        </SectionCard>

        <SectionCard
          title="Upcoming This Month"
          description="Scheduled and approved"
          className="lg:col-span-2"
          bodyClassName="p-0"
        >
          {(() => {
            const monthArticles = data
              .filter((a) => a.publishDate && new Date(a.publishDate).getMonth() === weekStart.getMonth() && new Date(a.publishDate).getFullYear() === weekStart.getFullYear())
              .sort((a, b) => new Date(a.publishDate!).getTime() - new Date(b.publishDate!).getTime());
            if (monthArticles.length === 0) {
              return <EmptyState icon={CalendarDays} title="No articles scheduled this month" description="Plan ahead by scheduling articles." />;
            }
            return (
              <div className="divide-y divide-border/60">
                {monthArticles.map((a) => (
                  <button
                    key={a.id}
                    onClick={() => navigate("content-studio", null, { articleId: a.id })}
                    className="w-full px-4 py-2.5 hover:bg-accent/40 transition-colors text-left flex items-center justify-between gap-3"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="size-9 rounded-md bg-muted text-center shrink-0">
                        <div className="text-[9px] uppercase text-muted-foreground pt-0.5">
                          {new Date(a.publishDate!).toLocaleDateString("en-US", { month: "short" })}
                        </div>
                        <div className="text-sm font-semibold tabular-nums leading-none">
                          {new Date(a.publishDate!).getDate()}
                        </div>
                      </div>
                      <div className="min-w-0">
                        <div className="text-sm font-medium truncate">{a.title}</div>
                        <div className="text-xs text-muted-foreground truncate">
                          {a.authorName} · {a.primaryKeyword ?? "No keyword"}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {a.seoScore != null && <ScoreBadge score={a.seoScore} />}
                      <StatusBadge label={a.status} color={STATUS_COLOR[a.status]} />
                    </div>
                  </button>
                ))}
              </div>
            );
          })()}
        </SectionCard>
      </div>
    </div>
  );
}
