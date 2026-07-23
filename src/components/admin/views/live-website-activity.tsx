"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Activity,
  ExternalLink,
  Globe2,
  MapPin,
  MousePointerClick,
  RefreshCw,
  UserRound,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { PageHeader, LoadingState } from "@/components/admin/shared";
import { useNav } from "@/components/admin/admin-app";

type ActivityEvent = {
  id: string;
  kind: "activity" | "conversion";
  event: string;
  label: string;
  timestamp: string;
  distinctId: string;
  page: string | null;
  referrer: string | null;
  referringDomain: string | null;
  utmSource: string | null;
  utmMedium: string | null;
  utmCampaign: string | null;
  device: string | null;
  browser: string | null;
  os: string | null;
  city: string | null;
  region: string | null;
  country: string | null;
  sessionId?: string | null;
  replayUrl?: string | null;
  formType?: string | null;
  contactName?: string | null;
  organization?: string | null;
};

export function LiveWebsiteActivityView() {
  const { navigate } = useNav();
  const [events, setEvents] = useState<ActivityEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [configured, setConfigured] = useState(false);
  const [conversionsCount, setConversionsCount] = useState(0);
  const [activityCount, setActivityCount] = useState(0);
  const [filter, setFilter] = useState<"all" | "conversions" | "activity">("all");
  const [environment, setEnvironment] = useState<"production" | "development" | "all">("production");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/analytics/live?environment=${environment}`, {
        cache: "no-store",
      });
      const payload = await response.json();
      setConfigured(Boolean(payload.configured));
      setEvents(payload.events ?? []);
      setConversionsCount(Number(payload.conversionsCount ?? 0));
      setActivityCount(Number(payload.activityCount ?? 0));
      setError(response.ok ? payload.error ?? null : payload.error ?? "Live activity unavailable.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Live activity unavailable.");
    } finally {
      setLoading(false);
    }
  }, [environment]);

  useEffect(() => {
    void load();
    const timer = window.setInterval(() => void load(), 15000);
    return () => window.clearInterval(timer);
  }, [load]);

  const visible = useMemo(() => {
    if (filter === "conversions") return events.filter((e) => e.kind === "conversion");
    if (filter === "activity") return events.filter((e) => e.kind === "activity");
    return events;
  }, [events, filter]);

  if (loading && events.length === 0) {
    return <LoadingState label="Loading live website activity…" />;
  }

  return (
    <div>
      <PageHeader
        title="Live Website Activity"
        description="What people did — pages, referrers, location, UTMs, and form conversions. No health answers or form message contents."
        action={
          <div className="flex flex-wrap items-center gap-2">
            <select
              aria-label="Activity environment"
              value={environment}
              onChange={(event) => setEnvironment(event.target.value as typeof environment)}
              className="h-9 rounded-md border bg-background px-2 text-sm"
            >
              <option value="production">Production</option>
              <option value="development">Development</option>
              <option value="all">All environments</option>
            </select>
            <Button variant="outline" size="sm" onClick={() => navigate("traffic-analytics")}>
              Traffic + GA4
            </Button>
            <Button variant="outline" size="sm" onClick={() => navigate("form-submissions")}>
              Forms inbox
            </Button>
            <Button variant="outline" size="sm" onClick={() => void load()}>
              <RefreshCw className="size-4" /> Refresh
            </Button>
          </div>
        }
      />

      {!configured && (
        <Card className="mb-4 border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          Live activity is not fully configured. Add PostHog project credentials to the dashboard
          deployment, or use Forms & Notifications for conversions.
        </Card>
      )}
      {error && (
        <Card className="mb-4 border-rose-200 bg-rose-50 p-4 text-sm text-rose-900">{error}</Card>
      )}

      <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-4">
        <Metric label="Actions shown" value={visible.length} icon={Activity} />
        <Metric label="Conversions" value={conversionsCount} icon={MousePointerClick} />
        <Metric label="Browse events" value={activityCount} icon={Globe2} />
        <Metric label="Identities" value={new Set(visible.map((e) => e.distinctId)).size} icon={UserRound} />
      </div>

      <div className="mb-4 flex flex-wrap gap-2">
        {(
          [
            ["all", "Everything"],
            ["conversions", "Conversions only"],
            ["activity", "Browse / clicks"],
          ] as const
        ).map(([value, label]) => (
          <Button
            key={value}
            size="sm"
            variant={filter === value ? "default" : "outline"}
            onClick={() => setFilter(value)}
          >
            {label}
          </Button>
        ))}
      </div>

      <Card className="overflow-hidden">
        <div className="flex items-center justify-between border-b px-4 py-3">
          <div>
            <h3 className="font-semibold">Recent activity</h3>
            <p className="text-xs text-muted-foreground">
              Geography, referrer, and campaign attribution when PostHog/form envelopes provide them.
            </p>
          </div>
          <Badge variant="outline">{configured ? "Live · 15s" : "Limited"}</Badge>
        </div>

        {visible.length === 0 ? (
          <div className="p-8 text-center text-sm text-muted-foreground">No events available yet.</div>
        ) : (
          <div className="divide-y">
            {visible.map((event) => {
              const location =
                [event.city, event.region, event.country].filter(Boolean).join(", ") || null;
              const attribution = [
                event.utmSource && `src:${event.utmSource}`,
                event.utmMedium && `med:${event.utmMedium}`,
                event.utmCampaign && `camp:${event.utmCampaign}`,
              ]
                .filter(Boolean)
                .join(" · ");
              const referrer = event.referringDomain || event.referrer;

              return (
                <div
                  key={event.id}
                  className="grid gap-3 p-4 md:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_auto] md:items-start"
                >
                  <div className="min-w-0 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-medium">{event.label}</p>
                      <Badge variant={event.kind === "conversion" ? "default" : "outline"}>
                        {event.kind === "conversion" ? "Conversion" : "Activity"}
                      </Badge>
                    </div>
                    <p className="truncate text-sm text-muted-foreground">
                      {event.page ?? "Page not reported"}
                    </p>
                    {(event.contactName || event.organization) && (
                      <p className="text-xs text-muted-foreground">
                        {[event.contactName, event.organization].filter(Boolean).join(" · ")}
                      </p>
                    )}
                  </div>

                  <div className="space-y-1 text-xs text-muted-foreground">
                    <p className="flex items-start gap-1.5">
                      <MapPin className="mt-0.5 size-3.5 shrink-0" />
                      <span>{location ?? "Location unavailable"}</span>
                    </p>
                    <p className="flex items-start gap-1.5">
                      <ExternalLink className="mt-0.5 size-3.5 shrink-0" />
                      <span className="break-all">
                        {referrer ? `Referrer: ${referrer}` : "Direct / referrer not reported"}
                      </span>
                    </p>
                    {attribution && <p>UTM · {attribution}</p>}
                    <p>
                      {[event.device, event.browser, event.os].filter(Boolean).join(" · ") ||
                        (event.kind === "conversion" ? "Device n/a for form envelope" : "Device unavailable")}
                    </p>
                  </div>

                  <div className="text-xs text-muted-foreground md:text-right space-y-1">
                    <p>{event.distinctId}</p>
                    <p>{new Date(event.timestamp).toLocaleString()}</p>
                    {event.replayUrl && (
                      <a
                        href={event.replayUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 text-sky-700 hover:underline"
                      >
                        <ExternalLink className="size-3" /> Session replay
                      </a>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>
    </div>
  );
}

function Metric({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: string | number;
  icon: typeof Activity;
}) {
  return (
    <Card className="p-3">
      <div className="flex items-center gap-2 text-muted-foreground">
        <Icon className="size-4" />
        <span className="text-xs">{label}</span>
      </div>
      <p className="mt-2 text-xl font-semibold">{value}</p>
    </Card>
  );
}
