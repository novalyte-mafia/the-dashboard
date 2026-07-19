"use client";

import { useEffect, useMemo, useState } from "react";
import { useNav } from "@/components/admin/admin-app";
import {
  PageHeader,
  LoadingState,
  EmptyState,
  StatusBadge,
  PriorityBadge,
  ScoreBadge,
} from "@/components/admin/shared";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  PhoneCall,
  Building2,
  Clock,
  AlertCircle,
  PhoneOutgoing,
  Ban,
  ExternalLink,
  MapPin,
  X,
} from "lucide-react";
import {
  formatPhone,
  localTime,
  isWithinCallingHours,
  relativeTime,
  fullName,
} from "@/lib/format";
import { US_STATES, US_TIMEZONES } from "@/lib/constants";
import { clinicService } from "@/services";
import { toast } from "sonner";
import type { Clinic } from "@/types";

export function CallQueueView() {
  const { openClinic, navigate, refresh, refreshKey } = useNav();
  const [queue, setQueue] = useState<Clinic[]>([]);
  const [loading, setLoading] = useState(true);
  const [state, setState] = useState("");
  const [timezone, setTimezone] = useState("");
  const [priority, setPriority] = useState("");
  const [withinHoursOnly, setWithinHoursOnly] = useState(false);

  useEffect(() => {
    setLoading(true);
    clinicService.queue().then(({ queue }) => setQueue(queue)).finally(() => setLoading(false));
  }, [refreshKey]);

  const filtered = useMemo(() => {
    let arr = queue;
    if (state) arr = arr.filter((c) => c.state === state);
    if (timezone) arr = arr.filter((c) => c.timezone === timezone);
    if (priority) arr = arr.filter((c) => c.priority === priority);
    if (withinHoursOnly) arr = arr.filter((c) => isWithinCallingHours(c.timezone));
    return arr;
  }, [queue, state, timezone, priority, withinHoursOnly]);

  const readyCount = queue.filter((c) => isWithinCallingHours(c.timezone)).length;

  async function quickAction(clinic: Clinic, action: "do_not_call" | "not_interested" | "invalid") {
    const labelMap = { do_not_call: "Do Not Call", not_interested: "Not Interested", invalid: "Invalid" };
    const response = await fetch(`/api/clinics/${clinic.id}/stage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ toStage: action, note: `Quick action: ${labelMap[action]}` }),
    });
    if (!response.ok) {
      toast.error(`Could not update ${clinic.name}`);
      return;
    }
    toast.success(`Saved ${clinic.name} → ${labelMap[action]}`);
    refresh();
  }

  return (
    <div>
      <PageHeader
        title="Call Queue"
        description={`${readyCount} of ${queue.length} clinics within calling hours right now`}
        action={
          <Button
            variant="outline"
            onClick={() => setWithinHoursOnly((v) => !v)}
            className={withinHoursOnly ? "border-primary text-primary" : ""}
          >
            <Clock className="size-4" />
            <span className="hidden sm:inline">{withinHoursOnly ? "Within hours only" : "Filter hours"}</span>
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
              <SelectContent>
                <SelectItem value="__all">Any</SelectItem>
                {US_STATES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">Timezone</label>
            <Select value={timezone} onValueChange={(v) => setTimezone(v === "__all" ? "" : v)}>
              <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Any" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__all">Any</SelectItem>
                {US_TIMEZONES.map((t) => <SelectItem key={t.id} value={t.id}>{t.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">Priority</label>
            <Select value={priority} onValueChange={(v) => setPriority(v === "__all" ? "" : v)}>
              <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Any" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__all">Any</SelectItem>
                <SelectItem value="critical">Critical</SelectItem>
                <SelectItem value="high">High</SelectItem>
                <SelectItem value="normal">Normal</SelectItem>
                <SelectItem value="low">Low</SelectItem>
              </SelectContent>
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
            // Live API returns a precomputed decisionMaker; mock data carries a contacts array.
            const dm =
              (q as { decisionMaker?: { firstName?: string; lastName?: string } | null }).decisionMaker ??
              (q.contacts ?? []).find((c) => c.isDecisionMaker) ??
              null;
            return (
              <Card key={q.id} className={`p-4 gap-0 ${!within ? "opacity-60" : ""}`}>
                <div className="flex items-start justify-between gap-3 mb-2">
                  <div className="min-w-0 flex-1">
                    <button onClick={() => openClinic(q.id)} className="flex items-center gap-2 hover:text-primary text-left min-w-0">
                      <div className="size-8 rounded-md bg-primary/10 flex items-center justify-center shrink-0">
                        <Building2 className="size-4 text-primary" />
                      </div>
                      <div className="min-w-0">
                        <p className="font-medium truncate">{q.name}</p>
                        <p className="text-xs text-muted-foreground flex items-center gap-1">
                          <MapPin className="size-3" />
                          {[q.city, q.state].filter(Boolean).join(", ")}
                        </p>
                      </div>
                    </button>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <PriorityBadge priority={q.priority} />
                    <ScoreBadge score={q.readinessScore} />
                  </div>
                </div>

                <div className="flex items-center gap-2 flex-wrap text-xs mb-2">
                  <StatusBadge label={q.pipelineStage.replace(/_/g, " ")} color="teal" />
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
                    <span className="font-medium">{dm ? fullName(dm.firstName, dm.lastName) : "Not identified"}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Last: </span>
                    <span className="font-medium">{relativeTime(q.lastContactedAt)}</span>
                  </div>
                </div>

                {q.nextAction && (
                  <div className="text-xs bg-amber-50 text-amber-800 border border-amber-200 rounded-md px-2 py-1.5 mb-3">
                    <span className="font-medium">Next: </span>{q.nextAction}
                    {q.nextActionAt && <span className="text-amber-600"> · {relativeTime(q.nextActionAt)}</span>}
                  </div>
                )}

                {(q.services ?? []).length > 0 && (
                  <div className="flex flex-wrap gap-1 mb-3">
                    {(q.services ?? []).slice(0, 4).map((s) => <Badge key={s} variant="outline" className="text-[10px]">{s}</Badge>)}
                  </div>
                )}

                <div className="flex items-center gap-1.5 flex-wrap pt-2 border-t">
                  <Button size="sm" onClick={() => navigate("calls", q.id)} disabled={!within || !q.primaryPhone}>
                    <PhoneOutgoing className="size-3.5" /> Call
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => openClinic(q.id)}>
                    <ExternalLink className="size-3.5" /> Open
                  </Button>
                  <div className="flex-1" />
                  <Button size="sm" variant="ghost" className="text-muted-foreground" onClick={() => quickAction(q, "not_interested")} title="Not interested">
                    <X className="size-3.5" />
                  </Button>
                  <Button size="sm" variant="ghost" className="text-rose-600" onClick={() => quickAction(q, "do_not_call")} title="Do not call">
                    <Ban className="size-3.5" />
                  </Button>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
