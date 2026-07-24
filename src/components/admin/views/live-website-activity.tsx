"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Activity,
  ExternalLink,
  MapPin,
  RefreshCw,
  UserRound,
  Users,
  MousePointerClick,
  Eye,
  Shield,
  FlaskConical,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { PageHeader, LoadingState } from "@/components/admin/shared";
import { useNav } from "@/components/admin/admin-app";

type SessionEvent = {
  id: string;
  label: string;
  timestamp: string;
  page: string | null;
  event: string;
};

type VisitorSession = {
  sessionId: string;
  startedAt: string;
  endedAt: string;
  eventCount: number;
  pages: string[];
  events: SessionEvent[];
  replayUrl: string | null;
};

type Visitor = {
  visitorKey: string;
  visitorLabel: string;
  identityClassification: string;
  trafficClassification: string;
  isInternal: boolean;
  isTest: boolean;
  isBot: boolean;
  contactName: string | null;
  contactEmail: string | null;
  organization: string | null;
  firstSeen: string;
  lastSeen: string;
  sessionCount: number;
  eventCount: number;
  pageViewCount: number;
  lastPage: string | null;
  firstTouchSource: string | null;
  latestTouchSource: string | null;
  device: string | null;
  browser: string | null;
  os: string | null;
  city: string | null;
  region: string | null;
  country: string | null;
  converted: boolean;
  conversionCount: number;
  sessions: VisitorSession[];
};

type Metrics = {
  uniqueExternalVisitors: number;
  externalSessions: number;
  pageViews: number;
  realConversions: number;
  identifiedVisitors: number;
  returningVisitors: number;
  internalSessionsExcluded: number;
  testConversionsExcluded: number;
};

export function LiveWebsiteActivityView() {
  const { navigate } = useNav();
  const [visitors, setVisitors] = useState<Visitor[]>([]);
  const [activeVisitors, setActiveVisitors] = useState<Visitor[]>([]);
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [configured, setConfigured] = useState(false);
  const [filterSummary, setFilterSummary] = useState("");
  const [locationDisclaimer, setLocationDisclaimer] = useState("");
  const [environment, setEnvironment] = useState<"production" | "development" | "all">("production");
  const [traffic, setTraffic] = useState<"external" | "internal" | "test" | "all">("external");
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch(
        `/api/analytics/live?environment=${environment}&traffic=${traffic}`,
        { cache: "no-store" },
      );
      const payload = await response.json();
      setConfigured(Boolean(payload.configured));
      setVisitors(payload.visitors ?? []);
      setActiveVisitors(payload.activeVisitors ?? []);
      setMetrics(payload.metrics ?? null);
      setFilterSummary(payload.filterSummary ?? "");
      setLocationDisclaimer(payload.locationDisclaimer ?? "");
      setError(response.ok ? payload.error ?? null : payload.error ?? "Live activity unavailable.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Live activity unavailable.");
    } finally {
      setLoading(false);
    }
  }, [environment, traffic]);

  useEffect(() => {
    void load();
    const timer = window.setInterval(() => void load(), 15000);
    return () => window.clearInterval(timer);
  }, [load]);

  const selected = useMemo(
    () => visitors.find((v) => v.visitorKey === selectedKey) ?? null,
    [visitors, selectedKey],
  );

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return visitors;
    return visitors.filter((v) =>
      [v.visitorLabel, v.contactName, v.contactEmail, v.lastPage, v.firstTouchSource]
        .filter(Boolean)
        .some((x) => String(x).toLowerCase().includes(q)),
    );
  }, [visitors, search]);

  if (loading && visitors.length === 0) {
    return <LoadingState label="Loading live website activity…" />;
  }

  return (
    <div>
      <PageHeader
        title="Live Website Activity"
        description="Visitors and sessions — not raw event spam. External production by default."
        action={
          <div className="flex flex-wrap items-center gap-2">
            <select
              aria-label="Environment"
              value={environment}
              onChange={(e) => setEnvironment(e.target.value as typeof environment)}
              className="h-9 rounded-md border bg-background px-2 text-sm"
            >
              <option value="production">Production</option>
              <option value="development">Development</option>
              <option value="all">All environments</option>
            </select>
            <select
              aria-label="Traffic classification"
              value={traffic}
              onChange={(e) => setTraffic(e.target.value as typeof traffic)}
              className="h-9 rounded-md border bg-background px-2 text-sm"
            >
              <option value="external">External only</option>
              <option value="internal">Internal only</option>
              <option value="test">Test / QA only</option>
              <option value="all">All traffic</option>
            </select>
            <Button variant="outline" size="sm" onClick={() => navigate("internal-qa-activity")}>
              Internal & QA
            </Button>
            <Button variant="outline" size="sm" onClick={() => navigate("traffic-analytics")}>
              Traffic + GA4
            </Button>
            <Button variant="outline" size="sm" onClick={() => void load()}>
              <RefreshCw className="size-4" /> Refresh
            </Button>
          </div>
        }
      />

      {filterSummary && (
        <Card className="mb-4 border-sky-200 bg-sky-50 p-3 text-sm text-sky-950">{filterSummary}</Card>
      )}
      {!configured && (
        <Card className="mb-4 border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          Live activity is not fully configured. Add PostHog credentials or use Forms inbox.
        </Card>
      )}
      {error && (
        <Card className="mb-4 border-rose-200 bg-rose-50 p-4 text-sm text-rose-900">{error}</Card>
      )}

      <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-8">
        <Metric label="Unique External Visitors" value={metrics?.uniqueExternalVisitors ?? 0} icon={Users} tip="Distinct external visitor identities in this feed window" />
        <Metric label="External Sessions" value={metrics?.externalSessions ?? 0} icon={Activity} tip="Sessions under external visitors" />
        <Metric label="Page Views" value={metrics?.pageViews ?? 0} icon={Eye} tip="PostHog $pageview count (duplicates suppressed)" />
        <Metric label="Real Conversions" value={metrics?.realConversions ?? 0} icon={MousePointerClick} tip="Unique Supabase form submissions classified real" />
        <Metric label="Identified Visitors" value={metrics?.identifiedVisitors ?? 0} icon={UserRound} tip="External visitors with name/email from forms" />
        <Metric label="Returning Visitors" value={metrics?.returningVisitors ?? 0} icon={Users} tip="External visitors with more than one session" />
        <Metric label="Internal Excluded" value={metrics?.internalSessionsExcluded ?? 0} icon={Shield} tip="Internal-classified events kept out of external totals" />
        <Metric label="Test Excluded" value={metrics?.testConversionsExcluded ?? 0} icon={FlaskConical} tip="Test conversions excluded from real totals" />
      </div>

      <div className="mb-4 flex flex-wrap gap-2">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search visitors, emails, pages, sources…"
          className="h-9 min-w-[240px] flex-1 rounded-md border bg-background px-3 text-sm"
        />
        <Badge variant="outline">{configured ? "Live · 15s" : "Limited"}</Badge>
      </div>

      {activeVisitors.length > 0 && (
        <Card className="mb-4 overflow-hidden">
          <div className="border-b px-4 py-3">
            <h3 className="font-semibold">Active in last 15 minutes</h3>
            <p className="text-xs text-muted-foreground">
              Refresh interval is 15s — not continuous realtime.
            </p>
          </div>
          <div className="divide-y">
            {activeVisitors.slice(0, 8).map((v) => (
              <button
                key={v.visitorKey}
                type="button"
                className="flex w-full items-start justify-between gap-3 p-3 text-left hover:bg-muted/40"
                onClick={() => setSelectedKey(v.visitorKey)}
              >
                <div>
                  <p className="font-medium text-sm">{v.visitorLabel}</p>
                  <p className="text-xs text-muted-foreground truncate">{v.lastPage ?? "—"}</p>
                </div>
                <p className="text-xs text-muted-foreground shrink-0">
                  {new Date(v.lastSeen).toLocaleTimeString()}
                </p>
              </button>
            ))}
          </div>
        </Card>
      )}

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)]">
        <Card className="overflow-hidden">
          <div className="border-b px-4 py-3">
            <h3 className="font-semibold">Visitors</h3>
            <p className="text-xs text-muted-foreground">
              One row per visitor. Click to open session timeline.
            </p>
          </div>
          {visible.length === 0 ? (
            <div className="p-8 text-center text-sm text-muted-foreground">No visitors for these filters.</div>
          ) : (
            <div className="divide-y">
              {visible.map((v) => {
                const location = [v.city, v.region, v.country].filter(Boolean).join(", ") || null;
                return (
                  <button
                    key={v.visitorKey}
                    type="button"
                    onClick={() => setSelectedKey(v.visitorKey)}
                    className={`grid w-full gap-2 p-4 text-left hover:bg-muted/40 md:grid-cols-[1.2fr_1fr_auto] ${
                      selectedKey === v.visitorKey ? "bg-muted/50" : ""
                    }`}
                  >
                    <div className="min-w-0 space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-medium truncate">{v.visitorLabel}</p>
                        <Badge variant="outline">{v.identityClassification.replace(/_/g, " ")}</Badge>
                        {v.converted && <Badge>Converted</Badge>}
                        {v.isInternal && <Badge variant="secondary">Internal</Badge>}
                        {v.isTest && <Badge variant="secondary">Test</Badge>}
                      </div>
                      <p className="truncate text-sm text-muted-foreground">{v.lastPage ?? "No page yet"}</p>
                      {(v.contactEmail || v.organization) && (
                        <p className="text-xs text-muted-foreground">
                          {[v.contactEmail, v.organization].filter(Boolean).join(" · ")}
                        </p>
                      )}
                    </div>
                    <div className="space-y-1 text-xs text-muted-foreground">
                      <p className="flex items-start gap-1.5">
                        <MapPin className="mt-0.5 size-3.5 shrink-0" />
                        <span>{location ?? "Approximate location unavailable"}</span>
                      </p>
                      <p>First touch · {v.firstTouchSource ?? "direct / unknown"}</p>
                      <p>Latest · {v.latestTouchSource ?? "direct / unknown"}</p>
                      <p>{[v.device, v.browser, v.os].filter(Boolean).join(" · ") || "Device unavailable"}</p>
                    </div>
                    <div className="text-xs text-muted-foreground md:text-right space-y-1">
                      <p>{v.sessionCount} session{v.sessionCount === 1 ? "" : "s"}</p>
                      <p>{v.pageViewCount} page view{v.pageViewCount === 1 ? "" : "s"}</p>
                      <p>{new Date(v.lastSeen).toLocaleString()}</p>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </Card>

        <Card className="overflow-hidden h-fit">
          <div className="border-b px-4 py-3">
            <h3 className="font-semibold">Visitor detail</h3>
            <p className="text-xs text-muted-foreground">{locationDisclaimer}</p>
          </div>
          {!selected ? (
            <div className="p-8 text-center text-sm text-muted-foreground">Select a visitor.</div>
          ) : (
            <div className="p-4 space-y-4">
              <div>
                <p className="font-semibold">{selected.visitorLabel}</p>
                <p className="text-xs text-muted-foreground">
                  {selected.identityClassification.replace(/_/g, " ")} ·{" "}
                  {selected.trafficClassification}
                </p>
                {(selected.contactName || selected.contactEmail) && (
                  <p className="text-sm mt-1">
                    {[selected.contactName, selected.contactEmail, selected.organization]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                )}
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                <p>First seen · {new Date(selected.firstSeen).toLocaleString()}</p>
                <p>Last seen · {new Date(selected.lastSeen).toLocaleString()}</p>
                <p>Sessions · {selected.sessionCount}</p>
                <p>Conversions · {selected.conversionCount}</p>
              </div>
              <div className="space-y-3">
                {selected.sessions.map((session) => (
                  <div key={session.sessionId} className="rounded-md border p-3">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="text-sm font-medium">
                          Session · {new Date(session.startedAt).toLocaleTimeString()}–
                          {new Date(session.endedAt).toLocaleTimeString()}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {session.eventCount} events · {session.pages.length} pages
                        </p>
                      </div>
                      {session.replayUrl && (
                        <a
                          href={session.replayUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 text-xs text-sky-700 hover:underline"
                        >
                          <ExternalLink className="size-3" /> Replay
                        </a>
                      )}
                    </div>
                    <ol className="mt-2 space-y-1 text-xs text-muted-foreground">
                      {session.events.map((ev) => (
                        <li key={ev.id}>
                          {new Date(ev.timestamp).toLocaleTimeString()} — {ev.label}
                          {ev.page ? ` · ${ev.page.replace(/^https?:\/\/[^/]+/, "")}` : ""}
                        </li>
                      ))}
                    </ol>
                  </div>
                ))}
              </div>
              <details className="text-xs text-muted-foreground">
                <summary className="cursor-pointer">Technical identifiers</summary>
                <p className="mt-2 break-all">Visitor key · {selected.visitorKey}</p>
              </details>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}

function Metric({
  label,
  value,
  icon: Icon,
  tip,
}: {
  label: string;
  value: number;
  icon: typeof Activity;
  tip: string;
}) {
  return (
    <Card className="p-3" title={tip}>
      <div className="flex items-center gap-2 text-muted-foreground">
        <Icon className="size-3.5" />
        <p className="text-[11px] leading-tight">{label}</p>
      </div>
      <p className="mt-1 text-xl font-semibold tabular-nums">{value}</p>
    </Card>
  );
}
