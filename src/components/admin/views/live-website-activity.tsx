"use client";

import { useCallback, useEffect, useState } from "react";
import { Activity, Globe2, RefreshCw, UserRound } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { PageHeader, LoadingState } from "@/components/admin/shared";

type ActivityEvent = {
  id: string; event: string; timestamp: string; distinctId: string;
  page: string | null; referrer: string | null; device: string | null;
  browser: string | null; os: string | null; city: string | null;
  region: string | null; country: string | null;
};

export function LiveWebsiteActivityView() {
  const [events, setEvents] = useState<ActivityEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [configured, setConfigured] = useState(false);
  const [environment, setEnvironment] = useState<"production" | "development" | "all">("production");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/analytics/live?environment=${environment}`, { cache: "no-store" });
      const payload = await response.json();
      setConfigured(Boolean(payload.configured));
      setEvents(payload.events ?? []);
      setError(response.ok ? null : payload.error ?? "Live activity unavailable.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Live activity unavailable.");
    } finally { setLoading(false); }
  }, [environment]);

  useEffect(() => {
    void load();
    const timer = window.setInterval(() => void load(), 15000);
    return () => window.clearInterval(timer);
  }, [load]);

  if (loading && events.length === 0) return <LoadingState label="Loading live website activity…" />;

  return <div>
    <PageHeader title="Live Website Activity" description="Privacy-safe PostHog events refreshed every 15 seconds" action={<div className="flex items-center gap-2"><select aria-label="Activity environment" value={environment} onChange={(event) => setEnvironment(event.target.value as typeof environment)} className="h-9 rounded-md border bg-background px-2 text-sm"><option value="production">Production</option><option value="development">Development</option><option value="all">All environments</option></select><Button variant="outline" size="sm" onClick={() => void load()}><RefreshCw className="size-4" /> Refresh</Button></div>} />
    {!configured && <Card className="mb-4 border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">Live activity is not configured. Add the server-only PostHog project credentials to the dashboard deployment.</Card>}
    {error && <Card className="mb-4 border-rose-200 bg-rose-50 p-4 text-sm text-rose-900">{error}</Card>}
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
      <Metric label="Events loaded" value={events.length} icon={Activity} />
      <Metric label="Active feed" value={configured ? "Live" : "Off"} icon={Globe2} />
      <Metric label="Identities" value={new Set(events.map((e) => e.distinctId)).size} icon={UserRound} />
      <Metric label="Refresh" value="15s" icon={RefreshCw} />
    </div>
    <Card className="overflow-hidden">
      <div className="border-b px-4 py-3 flex items-center justify-between"><div><h3 className="font-semibold">Recent website events</h3><p className="text-xs text-muted-foreground">Approximate provider metadata only; no form contents or health answers are displayed.</p></div><Badge variant="outline">{configured ? "PostHog" : "Not configured"}</Badge></div>
      {events.length === 0 ? <div className="p-8 text-center text-sm text-muted-foreground">No events available yet.</div> : <div className="divide-y">{events.map((event) => <div key={event.id} className="p-4 grid gap-2 md:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)_auto] md:items-center"><div className="min-w-0"><p className="font-medium truncate">{event.event}</p><p className="text-xs text-muted-foreground truncate">{event.page ?? "Page not reported"}</p></div><div className="text-xs text-muted-foreground">{[event.city, event.region, event.country].filter(Boolean).join(", ") || "Approximate location unavailable"}<br />{[event.device, event.browser, event.os].filter(Boolean).join(" · ") || "Device unavailable"}</div><div className="text-xs text-muted-foreground md:text-right">{event.distinctId}<br />{new Date(event.timestamp).toLocaleString()}</div></div>)}</div>}
    </Card>
  </div>;
}

function Metric({ label, value, icon: Icon }: { label: string; value: string | number; icon: typeof Activity }) { return <Card className="p-3"><div className="flex items-center gap-2 text-muted-foreground"><Icon className="size-4" /><span className="text-xs">{label}</span></div><p className="mt-2 text-xl font-semibold">{value}</p></Card>; }
