"use client";

import { useEffect, useMemo, useState, useRef, useCallback } from "react";
import { useNav } from "@/components/admin/admin-app";
import {
  PageHeader,
  LoadingState,
  EmptyState,
  StatusBadge,
  PriorityBadge,
} from "@/components/admin/shared";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  PhoneCall,
  PhoneOutgoing,
  PhoneOff,
  Phone,
  Mic,
  MicOff,
  Pause,
  Play,
  Grid3x3,
  Clock,
  Building2,
  MapPin,
  Globe,
  Mail,
  User,
  Calendar,
  Send,
  CheckCircle2,
  Ban,
  AlertTriangle,
  ListChecks,
  BookOpen,
  PhoneIncoming,
} from "lucide-react";
import { clinicService } from "@/services";
import { CALL_OUTCOMES, OUTCOME_MAP } from "@/lib/constants";
import { formatPhone, localTime, isWithinCallingHours, relativeTime, fullName } from "@/lib/format";
import { toast } from "sonner";
import type { Clinic, CallState, CallOutcome } from "@/types";

const OBJECTION_LIBRARY = [
  { id: "obj_1", text: "Send me info via email", response: "Happy to. I'll send a 1-page overview and our directory link. Can I book a 10-min follow-up Thursday?" },
  { id: "obj_2", text: "We already have a marketing agency", response: "Got it — most clinics we work with keep their agency for general marketing. We're a focused men's-health demand engine, not a replacement." },
  { id: "obj_3", text: "Cost is a concern right now", response: "Understandable. We offer a pilot at break-even — if we deliver qualified patient leads in 30 days, we scale. If not, you walk away free." },
  { id: "obj_4", text: "Need to think about it", response: "Of course. What specifically would you want to think through? I can address it now or send supporting data." },
  { id: "obj_5", text: "Send me patient demand data", response: "Perfect — I'll send a ZIP-level demand report for your market. Best email?" },
  { id: "obj_6", text: "Speak with my partner first", response: "Great idea. Would a 15-min joint call Thursday or Friday work? I'll keep it tight." },
];

const QUALIFICATION_CHECKLIST = [
  { id: "q1", label: "Decision-maker reached" },
  { id: "q2", label: "Confirmed service offering matches" },
  { id: "q3", label: "Confirmed patient acquisition is a priority" },
  { id: "q4", label: "Budget authority confirmed" },
  { id: "q5", label: "Timeline / urgency discussed" },
  { id: "q6", label: "Next step agreed" },
];

export function CallConsoleView() {
  const { openClinic, openLogCall, refreshKey } = useNav();
  const [clinics, setClinics] = useState<Clinic[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeClinicId, setActiveClinicId] = useState<string | null>(null);

  const [callState, setCallState] = useState<CallState>("idle");
  const [callDuration, setCallDuration] = useState(0);
  const [muted, setMuted] = useState(false);
  const [onHold, setOnHold] = useState(false);
  const [notes, setNotes] = useState("");
  const [outcome, setOutcome] = useState<CallOutcome | "">("");
  const [nextAction, setNextAction] = useState("");
  const [followUpDate, setFollowUpDate] = useState("");
  const [qualification, setQualification] = useState<Record<string, boolean>>({});
  const [expandedObjection, setExpandedObjection] = useState<string | null>(null);
  const [dialPadOpen, setDialPadOpen] = useState(false);

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Fetch ready-to-call clinics + others in outreach stages
  useEffect(() => {
    setLoading(true);
    Promise.all([
      clinicService.list({ stage: "ready_to_call" }),
      clinicService.list({ stage: "attempted" }),
      clinicService.list({ stage: "connected" }),
    ]).then(([ready, attempted, connected]) => {
      const combined = [...ready.clinics, ...attempted.clinics, ...connected.clinics];
      setClinics(combined);
      if (combined.length > 0 && !activeClinicId) setActiveClinicId(combined[0].id);
    }).finally(() => setLoading(false));
  }, [refreshKey]);

  // Call timer
  useEffect(() => {
    if (callState === "connected" || callState === "on_hold") {
      timerRef.current = setInterval(() => setCallDuration((d) => d + 1), 1000);
    } else if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [callState]);

  const activeClinic = useMemo(() => clinics.find((c) => c.id === activeClinicId) ?? null, [clinics, activeClinicId]);

  // Reset call state when switching clinics
  function selectClinic(id: string) {
    if (callState !== "idle" && callState !== "ended") {
      toast.error("End the current call before switching clinics.");
      return;
    }
    setActiveClinicId(id);
    setCallState("idle");
    setCallDuration(0);
    setNotes("");
    setOutcome("");
    setNextAction("");
    setFollowUpDate("");
    setQualification({});
    setMuted(false);
    setOnHold(false);
  }

  function startCall() {
    if (!activeClinic) return;
    setCallState("dialing");
    setTimeout(() => setCallState("ringing"), 1200);
    setTimeout(() => {
      setCallState("connected");
      setCallDuration(0);
      toast.success(`Connected — ${activeClinic.name}`);
    }, 2800);
  }

  function endCall() {
    setCallState("ended");
    if (timerRef.current) clearInterval(timerRef.current);
    toast.info(`Call ended · ${formatDuration(callDuration)}`);
  }

  function resetCall() {
    setCallState("idle");
    setCallDuration(0);
    setNotes("");
    setOutcome("");
    setNextAction("");
    setFollowUpDate("");
    setQualification({});
    setMuted(false);
    setOnHold(false);
  }

  function saveCall() {
    if (!outcome) {
      toast.error("Select an outcome before saving.");
      return;
    }
    toast.success(`Call logged · ${OUTCOME_MAP[outcome]?.label ?? outcome}`);
    resetCall();
  }

  function toggleMute() {
    setMuted((m) => !m);
    toast.info(muted ? "Unmuted" : "Muted");
  }

  function toggleHold() {
    setOnHold((h) => !h);
    setCallState((s) => (s === "on_hold" ? "connected" : s === "connected" ? "on_hold" : s));
    toast.info(onHold ? "Resumed call" : "Call on hold");
  }

  if (loading) {
    return (
      <div>
        <PageHeader title="Call Console" description="Live calling workspace with coaching panel" />
        <LoadingState label="Loading call console…" />
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="Call Console"
        description="Live calling workspace — queue, call workspace & coaching panel"
        action={
          <Badge variant="outline" className="gap-1.5 text-xs">
            <span className={`size-2 rounded-full ${callState === "idle" ? "bg-slate-400" : callState === "connected" ? "bg-emerald-500 animate-pulse" : callState === "ended" ? "bg-rose-500" : "bg-amber-500"}`} />
            <span className="capitalize">{callState.replace(/_/g, " ")}</span>
          </Badge>
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-3">
        {/* LEFT: Queue */}
        <Card className="p-0 lg:col-span-3 lg:max-h-[calc(100vh-220px)] lg:overflow-hidden flex flex-col">
          <div className="px-3 py-2.5 border-b">
            <h3 className="text-sm font-semibold flex items-center gap-2">
              <ListChecks className="size-4" /> Queue
              <Badge variant="secondary" className="ml-auto">{clinics.length}</Badge>
            </h3>
          </div>
          <div className="flex-1 overflow-y-auto nv-scroll">
            {clinics.length === 0 ? (
              <EmptyState icon={PhoneCall} title="Queue empty" description="No clinics ready to call." />
            ) : (
              <div className="divide-y">
                {clinics.map((c) => {
                  const within = isWithinCallingHours(c.timezone);
                  const isActive = c.id === activeClinicId;
                  return (
                    <button
                      key={c.id}
                      onClick={() => selectClinic(c.id)}
                      className={`w-full text-left px-3 py-2.5 hover:bg-accent/50 transition-colors ${
                        isActive ? "bg-primary/5 border-l-2 border-primary" : ""
                      }`}
                    >
                      <div className="flex items-start gap-2">
                        <div className={`size-2 rounded-full mt-1.5 shrink-0 ${within ? "bg-emerald-500" : "bg-rose-400"}`} />
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium truncate">{c.name}</p>
                          <p className="text-xs text-muted-foreground truncate">
                            {[c.city, c.state].filter(Boolean).join(", ")}
                          </p>
                          <div className="flex items-center gap-1.5 mt-1">
                            <PriorityBadge priority={c.priority} />
                            <span className="text-[10px] text-muted-foreground tabular-nums">{localTime(c.timezone)}</span>
                          </div>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </Card>

        {/* CENTER: Call workspace */}
        <Card className="p-0 lg:col-span-6 flex flex-col">
          {activeClinic ? (
            <>
              {/* Clinic summary header */}
              <div className="px-4 py-3 border-b">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <button
                      onClick={() => openClinic(activeClinic.id)}
                      className="flex items-center gap-2 hover:text-primary text-left min-w-0"
                    >
                      <div className="size-9 rounded-md bg-primary/10 flex items-center justify-center shrink-0">
                        <Building2 className="size-4 text-primary" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold truncate">{activeClinic.name}</p>
                        <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                          <MapPin className="size-3" />
                          {[activeClinic.city, activeClinic.state].filter(Boolean).join(", ")}
                        </p>
                      </div>
                    </button>
                  </div>
                  <div className="flex items-center gap-2">
                    <PriorityBadge priority={activeClinic.priority} />
                    <StatusBadge label={`Readiness ${activeClinic.readinessScore}`} color={activeClinic.readinessScore >= 75 ? "green" : activeClinic.readinessScore >= 50 ? "amber" : "slate"} />
                  </div>
                </div>
              </div>

              {/* Contact info */}
              <div className="px-4 py-3 border-b grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
                <ContactItem icon={Phone} label="Primary" value={formatPhone(activeClinic.primaryPhone)} />
                <ContactItem icon={Mail} label="Email" value={activeClinic.generalEmail ?? "—"} />
                <ContactItem icon={Globe} label="Website" value={activeClinic.website?.replace(/^https?:\/\//, "") ?? "—"} />
                <ContactItem
                  icon={Clock}
                  label="Local time"
                  value={localTime(activeClinic.timezone)}
                  tone={isWithinCallingHours(activeClinic.timezone) ? "ok" : "warn"}
                />
              </div>

              {/* Decision-maker */}
              {activeClinic.contacts.find((c) => c.isDecisionMaker) && (
                <div className="px-4 py-2 border-b bg-teal-50/40">
                  <p className="text-xs flex items-center gap-1.5">
                    <User className="size-3 text-teal-700" />
                    <span className="font-medium text-teal-700">Decision-Maker:</span>
                    <span className="text-foreground">
                      {fullName(
                        activeClinic.contacts.find((c) => c.isDecisionMaker)?.firstName,
                        activeClinic.contacts.find((c) => c.isDecisionMaker)?.lastName
                      )}
                    </span>
                    <span className="text-muted-foreground">
                      · {activeClinic.contacts.find((c) => c.isDecisionMaker)?.title ?? "—"}
                    </span>
                    <span className="text-muted-foreground">
                      · {formatPhone(activeClinic.contacts.find((c) => c.isDecisionMaker)?.directPhone)}
                    </span>
                  </p>
                </div>
              )}

              {/* Call state + dial pad */}
              <div className="px-4 py-5 flex-1 flex flex-col items-center justify-center bg-muted/20">
                <CallStateIndicator state={callState} duration={callDuration} />

                {/* Dial pad */}
                {dialPadOpen && callState === "idle" && (
                  <div className="grid grid-cols-3 gap-2 mt-4 max-w-[200px]">
                    {["1","2","3","4","5","6","7","8","9","*","0","#"].map((d) => (
                      <Button
                        key={d}
                        variant="outline"
                        className="h-12 text-lg font-medium"
                        onClick={() => toast.info(`DTMF: ${d}`)}
                      >
                        {d}
                      </Button>
                    ))}
                  </div>
                )}

                {/* Controls */}
                <div className="flex items-center gap-2 mt-5 flex-wrap justify-center">
                  {callState === "idle" && (
                    <>
                      <Button onClick={startCall} disabled={!isWithinCallingHours(activeClinic.timezone)} size="lg" className="bg-emerald-600 hover:bg-emerald-700">
                        <PhoneOutgoing className="size-4" /> Dial
                      </Button>
                      <Button variant="outline" size="lg" onClick={() => setDialPadOpen((o) => !o)}>
                        <Grid3x3 className="size-4" /> Dial Pad
                      </Button>
                      {!isWithinCallingHours(activeClinic.timezone) && (
                        <span className="text-xs text-rose-600 flex items-center gap-1">
                          <AlertTriangle className="size-3" /> Outside calling hours (8a–8p local)
                        </span>
                      )}
                    </>
                  )}
                  {(callState === "dialing" || callState === "ringing") && (
                    <Button disabled size="lg">
                      <PhoneCall className="size-4 animate-pulse" /> {callState === "dialing" ? "Dialing…" : "Ringing…"}
                    </Button>
                  )}
                  {(callState === "connected" || callState === "on_hold") && (
                    <>
                      <Button variant={muted ? "default" : "outline"} size="lg" onClick={toggleMute}>
                        {muted ? <MicOff className="size-4" /> : <Mic className="size-4" />}
                        {muted ? "Unmute" : "Mute"}
                      </Button>
                      <Button variant={onHold ? "default" : "outline"} size="lg" onClick={toggleHold}>
                        {onHold ? <Play className="size-4" /> : <Pause className="size-4" />}
                        {onHold ? "Resume" : "Hold"}
                      </Button>
                      <Button variant="destructive" size="lg" onClick={endCall}>
                        <PhoneOff className="size-4" /> End Call
                      </Button>
                    </>
                  )}
                  {callState === "ended" && (
                    <>
                      <Button size="lg" onClick={saveCall}>
                        <CheckCircle2 className="size-4" /> Save Call Log
                      </Button>
                      <Button variant="outline" size="lg" onClick={resetCall}>
                        Dismiss
                      </Button>
                    </>
                  )}
                </div>
              </div>

              {/* Live notes */}
              <div className="px-4 py-3 border-t">
                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide flex items-center gap-1.5 mb-1.5">
                  <BookOpen className="size-3" /> Live Notes
                </label>
                <Textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={3}
                  placeholder="Capture key points, objections, next steps…"
                  className="text-sm"
                />
              </div>
            </>
          ) : (
            <EmptyState icon={PhoneCall} title="No clinic selected" description="Pick a clinic from the queue to begin." />
          )}
        </Card>

        {/* RIGHT: Coaching panel */}
        <Card className="p-0 lg:col-span-3 lg:max-h-[calc(100vh-220px)] lg:overflow-hidden flex flex-col">
          <div className="px-3 py-2.5 border-b">
            <h3 className="text-sm font-semibold flex items-center gap-2">
              <BookOpen className="size-4" /> Coaching Panel
            </h3>
          </div>
          <div className="flex-1 overflow-y-auto nv-scroll p-3 space-y-4">
            {/* Outcome selector */}
            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1.5">Call Outcome</p>
              <select
                value={outcome}
                onChange={(e) => setOutcome(e.target.value as CallOutcome)}
                className="w-full h-8 rounded-md border border-input bg-background px-2 text-xs"
              >
                <option value="">Select outcome…</option>
                {CALL_OUTCOMES.map((o) => (
                  <option key={o.id} value={o.id}>{o.label}</option>
                ))}
              </select>
            </div>

            {/* Qualification checklist */}
            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1.5">Qualification</p>
              <div className="space-y-1">
                {QUALIFICATION_CHECKLIST.map((q) => (
                  <label key={q.id} className="flex items-center gap-2 text-xs cursor-pointer py-1">
                    <input
                      type="checkbox"
                      checked={!!qualification[q.id]}
                      onChange={(e) => setQualification((prev) => ({ ...prev, [q.id]: e.target.checked }))}
                      className="accent-primary size-3.5"
                    />
                    <span className={qualification[q.id] ? "text-foreground line-through" : "text-muted-foreground"}>
                      {q.label}
                    </span>
                  </label>
                ))}
              </div>
            </div>

            {/* Next action + follow-up */}
            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1.5">Next Action</p>
              <input
                type="text"
                value={nextAction}
                onChange={(e) => setNextAction(e.target.value)}
                placeholder="e.g. Send proposal Friday"
                className="w-full h-8 rounded-md border border-input bg-background px-2 text-xs mb-1.5"
              />
              <label className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1">
                <Calendar className="size-3" /> Follow-up date
              </label>
              <input
                type="date"
                value={followUpDate}
                onChange={(e) => setFollowUpDate(e.target.value)}
                className="w-full h-8 rounded-md border border-input bg-background px-2 text-xs"
              />
            </div>

            {/* Objection library */}
            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1.5 flex items-center gap-1">
                <BookOpen className="size-3" /> Objection Library
              </p>
              <div className="space-y-1">
                {OBJECTION_LIBRARY.map((o) => (
                  <div key={o.id} className="border rounded-md overflow-hidden">
                    <button
                      onClick={() => setExpandedObjection(expandedObjection === o.id ? null : o.id)}
                      className="w-full text-left px-2 py-1.5 text-xs hover:bg-accent/40 transition-colors"
                    >
                      <span className="font-medium">"{o.text}"</span>
                    </button>
                    {expandedObjection === o.id && (
                      <div className="px-2 py-1.5 bg-muted/40 text-xs text-muted-foreground border-t">
                        <span className="text-[10px] uppercase font-medium text-emerald-700">Response:</span> {o.response}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Quick actions */}
            <div className="pt-2 border-t">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1.5">Quick Actions</p>
              <div className="grid grid-cols-2 gap-1.5">
                <Button size="sm" variant="outline" onClick={() => activeClinic && openLogCall(activeClinic.id)}>
                  <PhoneCall className="size-3" /> Log Call
                </Button>
                <Button size="sm" variant="outline" onClick={() => toast.info("Opening full clinic detail…")}>
                  <Building2 className="size-3" /> Details
                </Button>
                <Button size="sm" variant="outline" className="text-amber-600" onClick={() => toast.success("Marked 'Not Interested'")}>
                  <Send className="size-3" /> Not Interested
                </Button>
                <Button size="sm" variant="outline" className="text-rose-600" onClick={() => toast.success("Added to DNC list")}>
                  <Ban className="size-3" /> DNC
                </Button>
              </div>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}

function ContactItem({ icon: Icon, label, value, tone }: { icon: typeof Phone; label: string; value: string; tone?: "ok" | "warn" }) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-wide text-muted-foreground flex items-center gap-1">
        <Icon className="size-3" /> {label}
      </p>
      <p className={`text-xs font-medium truncate ${tone === "warn" ? "text-rose-600" : tone === "ok" ? "text-emerald-700" : ""}`}>
        {value}
      </p>
    </div>
  );
}

function CallStateIndicator({ state, duration }: { state: CallState; duration: number }) {
  const config = {
    idle: { icon: PhoneCall, label: "Ready to dial", color: "text-slate-400 bg-slate-50" },
    dialing: { icon: PhoneOutgoing, label: "Dialing…", color: "text-amber-700 bg-amber-50" },
    ringing: { icon: PhoneIncoming, label: "Ringing…", color: "text-amber-700 bg-amber-50" },
    connected: { icon: PhoneCall, label: "Connected", color: "text-emerald-700 bg-emerald-50" },
    on_hold: { icon: Pause, label: "On Hold", color: "text-amber-700 bg-amber-50" },
    ended: { icon: PhoneOff, label: "Call Ended", color: "text-rose-700 bg-rose-50" },
    failed: { icon: AlertTriangle, label: "Call Failed", color: "text-rose-700 bg-rose-50" },
  }[state];
  const Icon = config.icon;

  return (
    <div className="flex flex-col items-center gap-3">
      <div className={`size-20 rounded-full flex items-center justify-center ${config.color} ${state === "dialing" || state === "ringing" || state === "connected" ? "animate-pulse" : ""}`}>
        <Icon className="size-8" />
      </div>
      <div className="text-center">
        <p className="text-sm font-semibold">{config.label}</p>
        {(state === "connected" || state === "on_hold" || state === "ended") && (
          <p className="text-2xl font-bold tabular-nums mt-1">{formatDuration(duration)}</p>
        )}
      </div>
    </div>
  );
}

function formatDuration(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}
