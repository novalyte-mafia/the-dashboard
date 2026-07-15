"use client";

import { useEffect, useState } from "react";
import { useNav } from "@/components/admin/admin-app";
import { PageHeader, LoadingState, EmptyState, StageBadge, PriorityBadge, ReadinessScore } from "@/components/admin/shared";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { PhoneCall, Building2, Phone, Clock, AlertCircle, PhoneOutgoing, Ban, CheckCircle2, X, ExternalLink, MapPin } from "lucide-react";
import { formatPhone, localTime, isWithinCallingHours, relativeTime, fullName } from "@/lib/format";
import { US_STATES, US_TIMEZONES, SERVICE_CATALOG } from "@/lib/constants";
import { toast } from "sonner";
import { LogCallDialog } from "@/components/admin/log-call-dialog";

interface QueueItem {
  id: string;
  name: string;
  city: string | null;
  state: string | null;
  timezone: string;
  primaryPhone: string | null;
  pipelineStage: string;
  priority: string;
  readinessScore: number;
  callAttempts: number;
  lastContactedAt: string | null;
  nextAction: string | null;
  nextActionAt: string | null;
  services: { name: string; slug: string }[];
  decisionMaker: { id: string; firstName: string; lastName: string; title: string | null; contactType: string } | null;
  followUp: { id: string; title: string } | null;
}

export function CallQueueView() {
  const { openClinic, refresh, refreshKey } = useNav();
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [state, setState] = useState("");
  const [timezone, setTimezone] = useState("");
  const [priority, setPriority] = useState("");
  const [withinHoursOnly, setWithinHoursOnly] = useState(false);
  const [logCallFor, setLogCallFor] = useState<{ clinicId: string; contactId?: string } | null>(null);

  useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams();
    if (state) params.set("state", state);
    if (timezone) params.set("timezone", timezone);
    if (priority) params.set("priority", priority);
    fetch(`/api/call-queue?${params.toString()}`)
      .then((r) => r.json())
      .then((d) => setQueue(d.queue ?? []))
      .catch(() => toast.error("Failed to load call queue"))
      .finally(() => setLoading(false));
  }, [state, timezone, priority, refreshKey]);

  const filtered = withinHoursOnly ? queue.filter((q) => isWithinCallingHours(q.timezone)) : queue;
  const readyCount = queue.filter((q) => isWithinCallingHours(q.timezone)).length;

  async function quickAction(clinicId: string, action: "do_not_call" | "not_interested" | "invalid") {
    const labelMap = { do_not_call: "Do Not Call", not_interested: "Not Interested", invalid: "Invalid" };
    const res = await fetch(`/api/clinics/${clinicId}/stage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ toStage: action, reason: `Queue quick action: ${labelMap[action]}` }),
    });
    if (res.ok) {
      toast.success(`Marked ${labelMap[action]}`);
      refresh();
    } else toast.error("Action failed");
  }

  return (
    <div>
      <PageHeader
        title="Call Queue"
        description={`${readyCount} of ${queue.length} clinics within calling hours right now`}
        action={
          <Button variant="outline" onClick={() => setWithinHoursOnly((v) => !v)} className={withinHoursOnly ? "border-primary text-primary" : ""}>
            <Clock className="size-4" />
            {withinHoursOnly ? "Showing within hours" : "Within hours only"}
          </Button>
        }
      />

      {/* Filters */}
      <Card className="p-3 mb-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          <div className="space-y-1">
            <label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">State</label>
            <Select value={state} onValueChange={(v) => setState(v === "__all" ? "" : v)}>
              <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Any" /></SelectTrigger>
              <SelectContent><SelectItem value="__all">Any</SelectItem>{US_STATES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">Timezone</label>
            <Select value={timezone} onValueChange={(v) => setTimezone(v === "__all" ? "" : v)}>
              <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Any" /></SelectTrigger>
              <SelectContent><SelectItem value="__all">Any</SelectItem>{US_TIMEZONES.map((t) => <SelectItem key={t.id} value={t.id}>{t.label}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">Priority</label>
            <Select value={priority} onValueChange={(v) => setPriority(v === "__all" ? "" : v)}>
              <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Any" /></SelectTrigger>
              <SelectContent><SelectItem value="__all">Any</SelectItem><SelectItem value="critical">Critical</SelectItem><SelectItem value="high">High</SelectItem><SelectItem value="normal">Normal</SelectItem><SelectItem value="low">Low</SelectItem></SelectContent>
            </Select>
          </div>
          <div className="space-y-1 flex items-end">
            <div className="text-xs text-muted-foreground flex items-center gap-1.5">
              <AlertCircle className="size-3.5 text-amber-500" />
              Local calling hours: 8am–8pm
            </div>
          </div>
        </div>
      </Card>

      {loading ? (
        <LoadingState label="Loading call queue…" />
      ) : filtered.length === 0 ? (
        <EmptyState icon={PhoneCall} title="Queue is empty" description="No clinics match these filters, or all are outside calling hours." />
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          {filtered.map((q) => {
            const within = isWithinCallingHours(q.timezone);
            return (
              <Card key={q.id} className={`p-4 gap-0 ${!within ? "opacity-60" : ""}`}>
                <div className="flex items-start justify-between gap-3 mb-2">
                  <div className="min-w-0 flex-1">
                    <button onClick={() => openClinic(q.id)} className="flex items-center gap-2 hover:text-primary text-left">
                      <div className="size-8 rounded-md bg-primary/10 flex items-center justify-center shrink-0"><Building2 className="size-4 text-primary" /></div>
                      <div className="min-w-0">
                        <p className="font-medium truncate">{q.name}</p>
                        <p className="text-xs text-muted-foreground flex items-center gap-1"><MapPin className="size-3" />{[q.city, q.state].filter(Boolean).join(", ")}</p>
                      </div>
                    </button>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <PriorityBadge priority={q.priority} />
                    <ReadinessScore score={q.readinessScore} />
                  </div>
                </div>

                <div className="flex items-center gap-2 flex-wrap text-xs mb-2">
                  <StageBadge stage={q.pipelineStage} />
                  <Badge variant="secondary" className="capitalize">{q.timezone.replace("America/", "")}</Badge>
                  <span className={`flex items-center gap-1 ${within ? "text-emerald-600" : "text-rose-500"}`}>
                    <Clock className="size-3" />{localTime(q.timezone)}{!within && " · outside hours"}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-xs mb-3">
                  <div>
                    <span className="text-muted-foreground">Phone: </span>
                    <span className="font-medium">{formatPhone(q.primaryPhone)}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Attempts: </span>
                    <span className="font-medium tabular-nums">{q.callAttempts}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Decision-Maker: </span>
                    <span className="font-medium">{q.decisionMaker ? fullName(q.decisionMaker.firstName, q.decisionMaker.lastName) : "Not identified"}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Last: </span>
                    <span className="font-medium">{relativeTime(q.lastContactedAt)}</span>
                  </div>
                </div>

                {q.nextAction && (
                  <div className="text-xs bg-amber-50 text-amber-800 border border-amber-200 rounded-md px-2 py-1.5 mb-3">
                    <span className="font-medium">Next: </span>{q.nextAction}{q.nextActionAt && <span className="text-amber-600"> · {relativeTime(q.nextActionAt)}</span>}
                  </div>
                )}

                {q.services.length > 0 && (
                  <div className="flex flex-wrap gap-1 mb-3">
                    {q.services.slice(0, 4).map((s) => <Badge key={s.slug} variant="outline" className="text-[10px]">{s.name}</Badge>)}
                  </div>
                )}

                {/* Actions */}
                <div className="flex items-center gap-1.5 flex-wrap pt-2 border-t">
                  <Button size="sm" onClick={() => setLogCallFor({ clinicId: q.id, contactId: q.decisionMaker?.id })} disabled={!within}>
                    <PhoneOutgoing className="size-3.5" /> Log Call
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => openClinic(q.id)}><ExternalLink className="size-3.5" /> Open</Button>
                  <div className="flex-1" />
                  <Button size="sm" variant="ghost" className="text-muted-foreground" onClick={() => quickAction(q.id, "not_interested")} title="Not interested"><X className="size-3.5" /></Button>
                  <Button size="sm" variant="ghost" className="text-rose-600" onClick={() => quickAction(q.id, "do_not_call")} title="Do not call"><Ban className="size-3.5" /></Button>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {logCallFor && (
        <LogCallDialog
          open={!!logCallFor}
          onOpenChange={(o) => !o && setLogCallFor(null)}
          presetClinicId={logCallFor.clinicId}
          presetContactId={logCallFor.contactId}
          onLogged={() => refresh()}
        />
      )}
    </div>
  );
}
