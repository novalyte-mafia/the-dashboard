"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  PhoneCall,
  PhoneOff,
  Building2,
  MapPin,
  Clock,
  Ban,
  AlertTriangle,
  CheckCircle2,
  Search,
  FileText,
  Mic,
  RefreshCw,
  ShieldCheck,
  History,
  Target,
  Globe,
  User,
} from "lucide-react";
import { toast } from "sonner";
import { formatPhone, localTime, relativeTime } from "@/lib/format";
import { CALL_OUTCOMES } from "@/lib/constants";
import {
  FOUNDER_CALL_OBJECTIVE,
  FOUNDER_GAPS_TO_VERIFY,
  FOUNDER_OBJECTIVE_CHECKLIST,
  FOUNDER_QUICK_RESPONSES,
} from "@/lib/calls/founder-led-script";
import { DialpadCti } from "./dialpad-cti";
import { CallHud, CopilotPanel, DialKeypad, useCallAssist } from "./founder-call-hud";

/**
 * Founder-Led Call Mode (Dialpad).
 *
 * You speak in Dialpad with your real voice. Novalyte shows briefing, talk
 * tracks, recovery, checklist, notes, outcomes, and artifact status.
 */

interface IntegrationStatus {
  enabled: boolean;
  mode: string;
  configured: boolean;
  configErrors: string[];
  apiConnection: string;
  apiConnectionError?: string;
  dialpadUserConfigured: boolean;
  dialpadUserDisplayName?: string;
  outboundCallerId?: string;
  webhookSecretConfigured: boolean;
  ctiEnabled: boolean;
  ctiProvisioned: boolean;
  lastWebhookAt: string | null;
  lastProviderError: string | null;
  pendingEnrichmentJobs: number;
}

interface QueueClinic {
  id: string;
  name: string;
  city: string | null;
  state: string | null;
  timezone: string | null;
  primaryPhone: string | null;
  website?: string | null;
  pipelineStage: string;
  callAttempts: number;
  lastContactedAt: string | null;
  nextAction: string | null;
  nextActionAt: string | null;
  services?: string[];
  telehealth?: boolean | null;
  notes?: string | null;
  decisionMaker?: { firstName?: string; lastName?: string; title?: string; email?: string } | null;
  followUp: { id: string; dueDate?: string } | null;
}

interface DialpadCall {
  id: string;
  clinicId: string;
  status: string;
  startedAt: string | null;
  ringingAt: string | null;
  connectedAt: string | null;
  endedAt: string | null;
  durationMs: number | null;
  durationSec: number | null;
  externalNumber: string | null;
  transcriptStatus: string | null;
  recordingAvailable: boolean;
  failureCode: string | null;
  failureMessage: string | null;
  outcome: string | null;
  notes: string | null;
  recapSummary: string | null;
  mode: string | null;
  trainingReviewStatus?: string | null;
  attemptNumber?: number | null;
}

interface TranscriptSegment {
  sequenceNum: number;
  speaker: string;
  speakerRole: string | null;
  text: string;
  segmentType: string;
  startedAt: string | null;
}

const ACTIVE_STATUSES = ["queued", "initiating", "ringing", "connected", "active", "held"];
const TERMINAL_LABELS: Record<string, string> = {
  completed: "Completed",
  canceled: "No answer / canceled",
  failed: "Failed",
  missed: "Missed",
  voicemail: "Voicemail",
};

const TRAINING_REVIEW_OPTIONS = [
  { id: "requires_review", label: "Requires review" },
  { id: "unreviewed", label: "Unreviewed" },
  { id: "approved_analytics", label: "Approved for analytics" },
  { id: "approved_evaluation", label: "Approved for evaluation" },
  { id: "approved_prompt_example", label: "Approved as prompt example" },
  { id: "approved_training", label: "Approved for training" },
  { id: "rejected", label: "Rejected" },
  { id: "compliance_hold", label: "Compliance hold" },
];

function statusTone(status: string): string {
  if (["connected", "active"].includes(status)) return "bg-emerald-100 text-emerald-800 border-emerald-300";
  if (["ringing", "initiating", "queued"].includes(status)) return "bg-amber-100 text-amber-800 border-amber-300";
  if (["held"].includes(status)) return "bg-sky-100 text-sky-800 border-sky-300";
  if (["failed", "missed", "canceled"].includes(status)) return "bg-rose-100 text-rose-800 border-rose-300";
  if (status === "completed") return "bg-slate-100 text-slate-700 border-slate-300";
  return "bg-slate-100 text-slate-600 border-slate-300";
}

function copyLine(line: string) {
  void navigator.clipboard?.writeText(line).then(
    () => toast.success("Copied — say it in Dialpad"),
    () => toast.message(line),
  );
}

export function DialpadCallView({ initialClinicId = null }: { initialClinicId?: string | null }) {
  const [status, setStatus] = useState<IntegrationStatus | null>(null);
  const [statusLoading, setStatusLoading] = useState(true);
  const [queue, setQueue] = useState<QueueClinic[]>([]);
  const [queueLoading, setQueueLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selectedClinic, setSelectedClinic] = useState<QueueClinic | null>(null);
  const [clinicDetail, setClinicDetail] = useState<Record<string, unknown> | null>(null);
  const [initiating, setInitiating] = useState(false);
  const [activeCall, setActiveCall] = useState<DialpadCall | null>(null);
  const [ending, setEnding] = useState(false);
  const [history, setHistory] = useState<DialpadCall[]>([]);
  const [transcript, setTranscript] = useState<TranscriptSegment[]>([]);
  const [transcriptState, setTranscriptState] = useState<"idle" | "loading" | "not_ready" | "ready" | "unavailable">("idle");
  const [summary, setSummary] = useState<string | null>(null);
  const [tick, setTick] = useState(0);
  const [checklist, setChecklist] = useState<Record<string, boolean>>({});
  const [recoveryLine, setRecoveryLine] = useState<string | null>(null);
  const [notesSaveState, setNotesSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");

  const [outcome, setOutcome] = useState<string>("connected");
  const [notes, setNotes] = useState("");
  const [directoryPermission, setDirectoryPermission] = useState<"granted" | "denied" | "pending">("pending");
  const [bookingLinkPermission, setBookingLinkPermission] = useState<"granted" | "denied" | "pending">("pending");
  const [decisionMakerReached, setDecisionMakerReached] = useState(false);
  const [followUpRequired, setFollowUpRequired] = useState(false);
  const [nextAction, setNextAction] = useState("");
  const [nextActionAt, setNextActionAt] = useState("");
  const [contactFirstName, setContactFirstName] = useState("");
  const [contactLastName, setContactLastName] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [trainingReview, setTrainingReview] = useState("requires_review");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const notesTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSavedNotesRef = useRef("");

  const loadStatus = useCallback(async () => {
    setStatusLoading(true);
    try {
      const res = await fetch("/api/integrations/dialpad/status");
      const data = await res.json();
      setStatus(data.status ?? null);
    } catch {
      setStatus(null);
    } finally {
      setStatusLoading(false);
    }
  }, []);

  const loadQueue = useCallback(async () => {
    setQueueLoading(true);
    try {
      const res = await fetch("/api/call-queue");
      const data = await res.json();
      setQueue(Array.isArray(data.queue) ? data.queue : []);
    } catch {
      setQueue([]);
    } finally {
      setQueueLoading(false);
    }
  }, []);

  const loadHistory = useCallback(async (clinicId?: string) => {
    try {
      const url = clinicId
        ? `/api/integrations/dialpad/calls?clinicId=${encodeURIComponent(clinicId)}`
        : "/api/integrations/dialpad/calls";
      const res = await fetch(url);
      const data = await res.json();
      setHistory(Array.isArray(data.calls) ? data.calls : []);
    } catch {
      setHistory([]);
    }
  }, []);

  const loadClinicDetail = useCallback(async (clinicId: string) => {
    try {
      const res = await fetch(`/api/clinics/${clinicId}`);
      if (!res.ok) {
        setClinicDetail(null);
        return;
      }
      const data = await res.json();
      setClinicDetail(data.clinic ?? data ?? null);
    } catch {
      setClinicDetail(null);
    }
  }, []);

  useEffect(() => {
    void loadStatus();
    void loadQueue();
    void loadHistory();
  }, [loadStatus, loadQueue, loadHistory]);

  // Preselect clinic from navigation (Queue / Clinic Detail / Overview).
  useEffect(() => {
    if (!initialClinicId || queue.length === 0) return;
    const match = queue.find((c) => c.id === initialClinicId);
    if (match) {
      setSelectedClinic(match);
      void loadClinicDetail(match.id);
      void loadHistory(match.id);
    } else {
      void loadClinicDetail(initialClinicId);
      setSelectedClinic({
        id: initialClinicId,
        name: "Selected clinic",
        city: null,
        state: null,
        timezone: null,
        primaryPhone: null,
        pipelineStage: "ready_to_call",
        callAttempts: 0,
        lastContactedAt: null,
        nextAction: null,
        nextActionAt: null,
        followUp: null,
      });
    }
  }, [initialClinicId, queue, loadClinicDetail, loadHistory]);

  useEffect(() => {
    if (!activeCall || !ACTIVE_STATUSES.includes(activeCall.status)) return;
    const t = setInterval(() => setTick((v) => v + 1), 1000);
    return () => clearInterval(t);
  }, [activeCall]);

  useEffect(() => {
    if (!activeCall || !ACTIVE_STATUSES.includes(activeCall.status)) {
      if (pollRef.current) clearInterval(pollRef.current);
      pollRef.current = null;
      return;
    }
    pollRef.current = setInterval(async () => {
      try {
        const res = await fetch(`/api/integrations/dialpad/calls/${activeCall.id}`);
        if (!res.ok) return;
        const data = await res.json();
        if (data.call) {
          setActiveCall(data.call);
          if (typeof data.call.notes === "string" && !notes && data.call.notes) {
            setNotes(data.call.notes);
            lastSavedNotesRef.current = data.call.notes;
          }
          if (!ACTIVE_STATUSES.includes(data.call.status)) {
            toast.info(`Call ${TERMINAL_LABELS[data.call.status] ?? data.call.status}.`);
            void loadHistory(data.call.clinicId);
          }
        }
      } catch {
        // transient poll failure
      }
    }, 2500);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
      pollRef.current = null;
    };
  }, [activeCall?.id, activeCall?.status, loadHistory, notes]);

  // Autosave notes to the active prospect_calls row while the call is live / just ended.
  useEffect(() => {
    if (!activeCall?.id) return;
    if (notes === lastSavedNotesRef.current) return;
    if (notesTimerRef.current) clearTimeout(notesTimerRef.current);
    notesTimerRef.current = setTimeout(async () => {
      setNotesSaveState("saving");
      try {
        const res = await fetch(`/api/calls/${activeCall.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ notes }),
        });
        if (!res.ok) throw new Error("save failed");
        lastSavedNotesRef.current = notes;
        setNotesSaveState("saved");
      } catch {
        setNotesSaveState("error");
      }
    }, 1200);
    return () => {
      if (notesTimerRef.current) clearTimeout(notesTimerRef.current);
    };
  }, [notes, activeCall?.id]);

  const filteredQueue = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return queue;
    return queue.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        (c.city ?? "").toLowerCase().includes(q) ||
        (c.state ?? "").toLowerCase().includes(q),
    );
  }, [queue, search]);

  const callDurationLabel = useMemo(() => {
    void tick;
    if (!activeCall) return "0:00";
    const startMs = activeCall.connectedAt ? new Date(activeCall.connectedAt).getTime() : null;
    if (!startMs) return "0:00";
    const endMs = activeCall.endedAt ? new Date(activeCall.endedAt).getTime() : Date.now();
    const totalSec = Math.max(0, Math.floor((endMs - startMs) / 1000));
    return `${Math.floor(totalSec / 60)}:${String(totalSec % 60).padStart(2, "0")}`;
  }, [activeCall, tick]);

  const briefing = useMemo(() => {
    const detail = clinicDetail as Record<string, unknown> | null;
    const name = (detail?.name as string) || selectedClinic?.name || "Clinic";
    const city = (detail?.city as string) || selectedClinic?.city;
    const state = (detail?.state as string) || selectedClinic?.state;
    const timezone = (detail?.timezone as string) || selectedClinic?.timezone;
    const phone = (detail?.primaryPhone as string) || selectedClinic?.primaryPhone;
    const website = (detail?.website as string) || selectedClinic?.website || null;
    const services = Array.isArray(detail?.services)
      ? (detail?.services as Array<{ service?: string } | string>).map((s) => (typeof s === "string" ? s : s.service ?? "")).filter(Boolean)
      : selectedClinic?.services ?? [];
    const telehealth = (detail?.telehealth as boolean | null | undefined) ?? selectedClinic?.telehealth ?? null;
    const contacts = Array.isArray(detail?.contacts) ? (detail?.contacts as Array<Record<string, unknown>>) : [];
    const notesFromClinic = (detail?.notes as string) || selectedClinic?.notes || null;
    const stage = (detail?.pipelineStage as string) || selectedClinic?.pipelineStage || "—";
    const attempts = Number(detail?.callAttempts ?? selectedClinic?.callAttempts ?? 0);
    const lastContactedAt = (detail?.lastContactedAt as string) || selectedClinic?.lastContactedAt;
    return {
      name,
      city,
      state,
      timezone,
      phone,
      website,
      services,
      telehealth,
      contacts,
      notesFromClinic,
      stage,
      attempts,
      lastContactedAt,
    };
  }, [clinicDetail, selectedClinic]);

  const selectClinic = useCallback(
    (clinic: QueueClinic) => {
      setSelectedClinic(clinic);
      setRecoveryLine(null);
      void loadClinicDetail(clinic.id);
      void loadHistory(clinic.id);
    },
    [loadClinicDetail, loadHistory],
  );

  const endCall = useCallback(async () => {
    if (!activeCall || ending) return;
    setEnding(true);
    try {
      const res = await fetch(`/api/integrations/dialpad/calls/${activeCall.id}/end`, { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(data.error ?? "Could not end the call.");
        return;
      }
      if (data.call) setActiveCall(data.call);
      toast.success(data.message ?? "Call ended.");
    } catch {
      toast.error("Network error while ending the call.");
    } finally {
      setEnding(false);
    }
  }, [activeCall, ending]);

  const startCall = useCallback(
    async (clinic: QueueClinic, overrideNumber?: string) => {
      if (initiating) return;
      // Unlock browser audio on the same click so mock ringtone can play.
      try {
        const AudioCtx =
          window.AudioContext ||
          (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        const ctx = new AudioCtx();
        await ctx.resume();
        const osc = ctx.createOscillator();
        const g = ctx.createGain();
        g.gain.value = 0.0001;
        osc.connect(g);
        g.connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + 0.01);
        void ctx.close();
      } catch {
        /* audio unlock optional */
      }
      setInitiating(true);
      selectClinic(clinic);
      setActiveCall(null);
      setEnding(false);
      setTranscript([]);
      setSummary(null);
      setTranscriptState("idle");
      setSaved(false);
      setOutcome("connected");
      setNotes("");
      lastSavedNotesRef.current = "";
      setNotesSaveState("idle");
      setDirectoryPermission("pending");
      setBookingLinkPermission("pending");
      setDecisionMakerReached(false);
      setFollowUpRequired(false);
      setNextAction("");
      setNextActionAt("");
      setContactFirstName("");
      setContactLastName("");
      setContactEmail("");
      setTrainingReview("requires_review");
      setChecklist({});
      setRecoveryLine(null);
      toast.info("Initiating Dialpad call…");
      try {
        const res = await fetch("/api/integrations/dialpad/calls", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            clinicId: clinic.id,
            source: "founder-led",
            ...(overrideNumber ? { phoneNumber: overrideNumber } : {}),
          }),
        });
        const data = await res.json();
        if (!res.ok) {
          toast.error(data.error ?? "Could not start the Dialpad call.");
          return;
        }
        toast.success(data.message ?? "Dialpad is ringing your active Dialpad device.");
        if (data.appLaunchUrl && typeof window !== "undefined") {
          // Fallback helper if ring initiation needs the desktop app foregrounded.
          window.open(data.appLaunchUrl, "_blank", "noopener,noreferrer");
        }
        setActiveCall({
          id: data.callSessionId,
          clinicId: clinic.id,
          status: data.status,
          startedAt: new Date().toISOString(),
          ringingAt: null,
          connectedAt: null,
          endedAt: null,
          durationMs: null,
          durationSec: null,
          externalNumber: data.externalNumber,
          transcriptStatus: "none",
          recordingAvailable: false,
          failureCode: null,
          failureMessage: null,
          outcome: null,
          notes: null,
          recapSummary: null,
          mode: data.mode,
        });
      } catch {
        toast.error("Network error while starting the Dialpad call.");
      } finally {
        setInitiating(false);
      }
    },
    [initiating, selectClinic],
  );

  const loadTranscript = useCallback(async () => {
    if (!activeCall) return;
    setTranscriptState("loading");
    try {
      const res = await fetch(`/api/integrations/dialpad/calls/${activeCall.id}/transcript`);
      const data = await res.json();
      if (res.status === 202) {
        setTranscriptState("not_ready");
        return;
      }
      if (data.status === "unavailable") {
        setTranscriptState("unavailable");
        return;
      }
      setTranscript(Array.isArray(data.segments) ? data.segments : []);
      setSummary(data.summary ?? null);
      setTranscriptState("ready");
    } catch {
      setTranscriptState("not_ready");
    }
  }, [activeCall]);

  const saveOutcome = useCallback(async () => {
    if (!activeCall || !selectedClinic || saving) return;
    setSaving(true);
    try {
      if (contactFirstName.trim() && contactLastName.trim()) {
        await fetch(`/api/clinics/${selectedClinic.id}/contacts`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            firstName: contactFirstName.trim(),
            lastName: contactLastName.trim(),
            email: contactEmail.trim() || undefined,
            isDecisionMaker: decisionMakerReached,
            isPrimary: true,
            notes: `Captured during founder-led call ${activeCall.id}`,
          }),
        }).catch(() => undefined);
      }

      const res = await fetch(`/api/clinics/${selectedClinic.id}/calls`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          callSessionId: activeCall.id,
          outcome,
          answered: Boolean(activeCall.connectedAt) || ["permission_granted", "permission_denied", "connected", "interested", "meeting_booked", "not_interested", "do_not_call"].includes(outcome),
          decisionMakerReached,
          notes,
          followUpRequired: followUpRequired || outcome === "call_back_requested" || outcome === "busy" || outcome === "clinic_closed",
          nextAction: nextAction || (followUpRequired ? "Follow up on directory permission" : undefined),
          nextActionAt: nextActionAt || undefined,
          durationSec: activeCall.durationSec ?? 0,
          callEnvironment: activeCall.mode === "mock" ? "practice" : "live",
          doNotCall: outcome === "do_not_call",
          directoryPermissionStatus: directoryPermission,
          structuredData: {
            provider: "dialpad",
            mode: "founder_led",
            directoryPermissionStatus: directoryPermission,
            bookingLinkPermissionStatus: bookingLinkPermission,
            checklist,
            trainingEligible: true,
            trainingReviewStatus: trainingReview,
          },
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        toast.error(data.error ?? "Failed to save the call outcome.");
        return;
      }
      await fetch(`/api/integrations/dialpad/calls/${activeCall.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          trainingReviewStatus: trainingReview,
          directoryPermissionStatus: directoryPermission,
          bookingLinkPermissionStatus: bookingLinkPermission,
        }),
      }).catch(() => undefined);
      toast.success(outcome === "do_not_call" ? "Marked Do Not Call — removed from queue." : "Call outcome saved.");
      setSaved(true);
      void loadQueue();
      void loadHistory(selectedClinic.id);
    } catch {
      toast.error("Network error while saving the outcome.");
    } finally {
      setSaving(false);
    }
  }, [
    activeCall,
    selectedClinic,
    saving,
    outcome,
    decisionMakerReached,
    notes,
    followUpRequired,
    nextAction,
    nextActionAt,
    directoryPermission,
    bookingLinkPermission,
    trainingReview,
    checklist,
    contactFirstName,
    contactLastName,
    contactEmail,
    loadQueue,
    loadHistory,
  ]);

  const markClinicStage = useCallback(
    async (clinic: QueueClinic, toStage: string, message: string) => {
      try {
        const res = await fetch(`/api/clinics/${clinic.id}/stage`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            toStage,
            reason: "Updated from Founder-Led Call Mode",
            relatedCallId: activeCall?.id,
          }),
        });
        if (res.ok) {
          toast.success(message);
          void loadQueue();
        } else {
          toast.error("Update failed.");
        }
      } catch {
        toast.error("Update failed.");
      }
    },
    [loadQueue, activeCall?.id],
  );

  const callActive = Boolean(activeCall && ACTIVE_STATUSES.includes(activeCall.status));
  const callEnded = Boolean(activeCall && !ACTIVE_STATUSES.includes(activeCall.status));
  const assist = useCallAssist({ callActive });

  if (statusLoading) {
    return (
      <Card className="p-8 text-center text-sm text-muted-foreground">
        Checking Dialpad integration status…
      </Card>
    );
  }

  if (!status?.enabled) {
    return (
      <Card className="p-8 space-y-2 text-center">
        <PhoneCall className="size-8 mx-auto text-muted-foreground" />
        <p className="font-semibold">Dialpad integration is disabled</p>
        <p className="text-sm text-muted-foreground">
          Set <code>DIALPAD_INTEGRATION_ENABLED=true</code> and <code>DIALPAD_MODE=mock</code> (or{" "}
          <code>live</code> with credentials) to enable Founder-Led calling.
        </p>
      </Card>
    );
  }

  const isMock = status.mode === "mock";

  return (
    <div className="space-y-4">
      <Card className="p-3 border-sky-200 bg-sky-50/40">
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <Badge className="bg-sky-700 text-white font-bold">Founder-Led</Badge>
          <Badge variant="outline" className="font-bold uppercase">
            Dialpad {status.mode}
          </Badge>
          <span className="font-medium text-sky-950">
            You are speaking. Dialpad handles the phone. No AI voice.
          </span>
          {isMock && (
            <Badge className="bg-indigo-600 text-white font-bold">Mock Dialpad — no real calls</Badge>
          )}
          {!status.configured && (
            <Badge variant="outline" className="border-rose-300 text-rose-700">
              <AlertTriangle className="size-3 mr-1" />
              {status.configErrors.join(" ")}
            </Badge>
          )}
          <span className="text-muted-foreground">
            API: {status.apiConnection === "ok" ? "connected" : status.apiConnection}
          </span>
          <span className="text-muted-foreground">
            User: {status.dialpadUserDisplayName ?? (status.dialpadUserConfigured ? "configured" : "not configured")}
          </span>
          <span className="text-muted-foreground">
            Last webhook: {status.lastWebhookAt ? relativeTime(new Date(status.lastWebhookAt)) : "never"}
          </span>
          <Button variant="ghost" size="sm" className="h-6 px-2 ml-auto" onClick={() => void loadStatus()}>
            <RefreshCw className="size-3" />
          </Button>
        </div>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        <Card className="p-3 space-y-2 lg:col-span-3">
          <div className="flex items-center justify-between">
            <span className="font-bold text-sm flex items-center gap-1.5">
              <Building2 className="size-4" /> Outreach Queue
            </span>
            <Button variant="ghost" size="sm" className="h-7 px-2" onClick={() => void loadQueue()}>
              <RefreshCw className="size-3.5" />
            </Button>
          </div>
          <div className="relative">
            <Search className="size-3.5 absolute left-2.5 top-2.5 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search clinics…"
              className="h-8 pl-8 text-xs"
            />
          </div>
          <div className="space-y-1.5 max-h-[640px] overflow-y-auto pr-1">
            {queueLoading && <p className="text-xs text-muted-foreground p-2">Loading queue…</p>}
            {!queueLoading && filteredQueue.length === 0 && (
              <p className="text-xs text-muted-foreground p-2">No callable clinics in the queue.</p>
            )}
            {filteredQueue.map((clinic) => (
              <div
                key={clinic.id}
                className={`border rounded-lg p-2.5 text-xs space-y-1 cursor-pointer transition-colors ${
                  selectedClinic?.id === clinic.id ? "border-sky-400 bg-sky-50/50" : "hover:bg-accent/40"
                }`}
                onClick={() => selectClinic(clinic)}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-semibold truncate">{clinic.name}</span>
                  <Badge variant="outline" className="text-[10px] shrink-0">
                    {clinic.pipelineStage.replace(/_/g, " ")}
                  </Badge>
                </div>
                <div className="flex items-center gap-2 text-muted-foreground">
                  <MapPin className="size-3" />
                  {[clinic.city, clinic.state].filter(Boolean).join(", ") || "Unknown"}
                  <Clock className="size-3 ml-1" />
                  {localTime(clinic.timezone)}
                </div>
                <div className="flex items-center justify-between text-muted-foreground">
                  <span>{formatPhone(clinic.primaryPhone)}</span>
                  <span>
                    {clinic.callAttempts} attempt{clinic.callAttempts === 1 ? "" : "s"}
                  </span>
                </div>
                <div className="flex items-center gap-1 pt-1" onClick={(e) => e.stopPropagation()}>
                  <Button
                    size="sm"
                    className="h-7 text-[11px] bg-sky-700 hover:bg-sky-800 text-white"
                    disabled={initiating || callActive || !clinic.primaryPhone}
                    onClick={() => void startCall(clinic)}
                  >
                    <PhoneCall className="size-3 mr-1" /> Call with Dialpad
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 px-2 text-[11px]"
                    onClick={() => void markClinicStage(clinic, "do_not_call", "Marked Do Not Call.")}
                  >
                    <Ban className="size-3 mr-1" /> DNC
                  </Button>
                </div>
              </div>
            ))}
          </div>

        </Card>

        <div className="lg:col-span-5 space-y-4">
          {selectedClinic && (
            <Card className="p-4 space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-bold text-base">{briefing.name}</p>
                  <p className="text-xs text-muted-foreground flex flex-wrap items-center gap-2 mt-1">
                    <span className="inline-flex items-center gap-1">
                      <MapPin className="size-3" />
                      {[briefing.city, briefing.state].filter(Boolean).join(", ") || "Location unknown"}
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <Clock className="size-3" />
                      Local {localTime(briefing.timezone)}
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <PhoneCall className="size-3" />
                      {formatPhone(briefing.phone)}
                    </span>
                    {briefing.website && (
                      <a
                        href={briefing.website.startsWith("http") ? briefing.website : `https://${briefing.website}`}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 text-sky-700 hover:underline"
                      >
                        <Globe className="size-3" /> Website
                      </a>
                    )}
                  </p>
                </div>
                {!callActive && (
                  <Button
                    className="bg-sky-700 hover:bg-sky-800 text-white"
                    disabled={initiating || !briefing.phone}
                    onClick={() => void startCall(selectedClinic)}
                  >
                    <PhoneCall className="size-4 mr-1" /> Call with Dialpad
                  </Button>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                <div className="rounded-lg border bg-card p-3 space-y-1.5">
                  <p className="font-bold uppercase text-[10px] text-muted-foreground tracking-wide">Pre-call briefing</p>
                  <p>
                    <span className="text-muted-foreground">Stage:</span> {String(briefing.stage).replace(/_/g, " ")}
                  </p>
                  <p>
                    <span className="text-muted-foreground">Attempts:</span> {briefing.attempts}
                    {briefing.lastContactedAt
                      ? ` · last ${relativeTime(new Date(briefing.lastContactedAt))}`
                      : " · never contacted"}
                  </p>
                  <p>
                    <span className="text-muted-foreground">Telehealth:</span>{" "}
                    {briefing.telehealth === true ? "Yes" : briefing.telehealth === false ? "No / unknown" : "Unknown"}
                  </p>
                  <p>
                    <span className="text-muted-foreground">Services:</span>{" "}
                    {briefing.services.length ? briefing.services.slice(0, 6).join(", ") : "Not researched"}
                  </p>
                  {briefing.contacts[0] && (
                    <p className="inline-flex items-center gap-1">
                      <User className="size-3" />
                      {[briefing.contacts[0].firstName, briefing.contacts[0].lastName].filter(Boolean).join(" ")}
                      {briefing.contacts[0].title ? ` · ${String(briefing.contacts[0].title)}` : ""}
                    </p>
                  )}
                  {briefing.notesFromClinic && (
                    <p className="text-muted-foreground border-t pt-1.5 mt-1.5">
                      Prior notes: {briefing.notesFromClinic}
                    </p>
                  )}
                </div>
                <div className="rounded-lg border bg-emerald-50/40 p-3 space-y-1.5">
                  <p className="font-bold uppercase text-[10px] text-emerald-800 tracking-wide flex items-center gap-1">
                    <Target className="size-3" /> Call objective
                  </p>
                  <p className="text-emerald-950">{FOUNDER_CALL_OBJECTIVE}</p>
                  <p className="text-[11px] text-muted-foreground pt-1">Gaps to verify:</p>
                  <ul className="list-disc pl-4 text-[11px] text-muted-foreground space-y-0.5">
                    {FOUNDER_GAPS_TO_VERIFY.map((gap) => (
                      <li key={gap}>{gap}</li>
                    ))}
                  </ul>
                </div>
              </div>
            </Card>
          )}

          {!activeCall && (
            <Card className="p-4 space-y-2">
              <p className="text-[11px] font-bold uppercase text-muted-foreground">
                Dial pad{selectedClinic ? ` — logs to ${selectedClinic.name}` : ""}
              </p>
              <DialKeypad
                disabled={initiating || callActive || !selectedClinic}
                hint={
                  selectedClinic
                    ? "Rings your Dialpad device, then dials this number. Great for test dry-runs."
                    : "Select a clinic on the left first so the call is logged to the right record."
                }
                onDial={(number) => {
                  if (!selectedClinic) {
                    toast.error("Select a clinic first so the call is logged correctly.");
                    return;
                  }
                  void startCall(selectedClinic, number);
                }}
              />
            </Card>
          )}

          {activeCall && (
            <Card className="p-4 space-y-3">
              <CallHud
                clinicName={selectedClinic?.name ?? "Clinic"}
                location={[briefing.city, briefing.state].filter(Boolean).join(", ")}
                number={activeCall.externalNumber}
                status={activeCall.status}
                durationLabel={callDurationLabel}
                isMock={isMock}
                callActive={callActive}
                assist={assist}
                ending={ending}
                onEndCall={() => void endCall()}
              />

              {callActive && (activeCall.status === "initiating" || activeCall.status === "ringing") && (
                <div className="text-xs text-muted-foreground bg-accent/40 rounded p-2.5">
                  {isMock
                    ? "Mock dry-run: listen for the browser ringtone, then wait for Connected (or hit End call). No real phone rings."
                    : "Dialpad is ringing your device. Answer there and speak in Dialpad — this dashboard is your cue card, not the phone speaker."}
                </div>
              )}

              <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Mic className="size-3" /> Recording:{" "}
                  {activeCall.recordingAvailable ? "available" : "unavailable until Dialpad returns it"}
                </span>
                <span className="flex items-center gap-1">
                  <FileText className="size-3" /> Transcript: {activeCall.transcriptStatus ?? "none"}
                </span>
                {activeCall.failureMessage && (
                  <span className="text-rose-600 flex items-center gap-1">
                    <AlertTriangle className="size-3" /> {activeCall.failureMessage}
                  </span>
                )}
              </div>

              {(callActive || callEnded) && (
                <>
                  <div className="border rounded-lg p-3 space-y-2">
                    <p className="text-[11px] font-bold uppercase text-muted-foreground">
                      Quick responses — tap to copy and show
                    </p>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-1.5">
                      {FOUNDER_QUICK_RESPONSES.map((qr) => (
                        <button
                          key={qr.id}
                          type="button"
                          className="text-left text-[11px] border rounded-md p-2 hover:bg-accent/50 transition-colors"
                          onClick={() => {
                            setRecoveryLine(qr.line);
                            copyLine(qr.line);
                          }}
                        >
                          <span className="font-semibold block text-slate-700">{qr.trigger}</span>
                          <span className="text-muted-foreground line-clamp-2">{qr.line}</span>
                        </button>
                      ))}
                    </div>
                    {recoveryLine && (
                      <p className="text-xs bg-amber-50 border border-amber-200 rounded p-2 text-amber-950">
                        {recoveryLine}
                      </p>
                    )}
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div className="border rounded-lg p-3 space-y-1.5">
                      <p className="text-[11px] font-bold uppercase text-muted-foreground">Fast capture checklist</p>
                      {FOUNDER_OBJECTIVE_CHECKLIST.map((item) => (
                        <label key={item.id} className="flex items-center gap-2 text-xs">
                          <input
                            type="checkbox"
                            checked={Boolean(checklist[item.id])}
                            onChange={(e) =>
                              setChecklist((prev) => ({ ...prev, [item.id]: e.target.checked }))
                            }
                          />
                          {item.label}
                        </label>
                      ))}
                    </div>
                    <div className="border rounded-lg p-3 space-y-1.5">
                      <div className="flex items-center justify-between">
                        <p className="text-[11px] font-bold uppercase text-muted-foreground">Live notes</p>
                        <span className="text-[10px] text-muted-foreground">
                          {notesSaveState === "saving"
                            ? "Saving…"
                            : notesSaveState === "saved"
                              ? "Autosaved"
                              : notesSaveState === "error"
                                ? "Save failed"
                                : "Autosave on"}
                        </span>
                      </div>
                      <Textarea
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                        placeholder="Capture permission, contact, services, next step…"
                        className="text-xs min-h-36"
                      />
                    </div>
                  </div>
                </>
              )}

              {callActive && (
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" className="h-8 text-xs" disabled>
                    <PhoneOff className="size-3.5 mr-1" /> Hang up in the Dialpad app
                  </Button>
                </div>
              )}

              {callEnded && (
                <div className="space-y-3 border-t pt-3">
                  <div className="flex items-center justify-between">
                    <p className="font-bold text-sm flex items-center gap-1.5">
                      <CheckCircle2 className="size-4 text-emerald-600" /> Post-call workflow
                    </p>
                    <span className="text-xs text-muted-foreground">
                      Duration {activeCall.durationSec ? `${activeCall.durationSec}s` : "—"}
                    </span>
                  </div>

                  {activeCall.recapSummary && (
                    <div className="text-xs bg-accent/40 rounded p-2.5">
                      <span className="font-semibold">Dialpad summary: </span>
                      {activeCall.recapSummary}
                    </div>
                  )}

                  <div className="space-y-1.5">
                    <div className="flex items-center gap-2">
                      <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => void loadTranscript()}>
                        <FileText className="size-3 mr-1" />
                        {transcriptState === "ready" ? "Reload transcript" : "Load transcript / artifacts"}
                      </Button>
                      {transcriptState === "not_ready" && (
                        <span className="text-xs text-amber-700">
                          Still processing at Dialpad — unavailable until returned.
                        </span>
                      )}
                      {transcriptState === "unavailable" && (
                        <span className="text-xs text-muted-foreground">No transcript available for this call.</span>
                      )}
                    </div>
                    {summary && transcriptState === "ready" && (
                      <p className="text-xs bg-accent/30 rounded p-2">{summary}</p>
                    )}
                    {transcriptState === "ready" && transcript.length > 0 && (
                      <div className="border rounded max-h-56 overflow-y-auto p-2 space-y-1.5">
                        {transcript
                          .filter((s) => s.segmentType === "transcript")
                          .map((s) => (
                            <p key={s.sequenceNum} className="text-xs">
                              <span
                                className={`font-semibold ${
                                  s.speakerRole === "operator" ? "text-emerald-700" : "text-slate-700"
                                }`}
                              >
                                {s.speaker}:
                              </span>{" "}
                              {s.text}
                            </p>
                          ))}
                      </div>
                    )}
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                    <div className="space-y-1">
                      <label className="font-semibold text-muted-foreground">Outcome</label>
                      <Select
                        value={outcome}
                        onValueChange={(v) => {
                          setOutcome(v);
                          if (v === "permission_granted") setDirectoryPermission("granted");
                          if (v === "permission_denied") setDirectoryPermission("denied");
                          if (v === "do_not_call") setFollowUpRequired(false);
                          if (v === "busy" || v === "clinic_closed" || v === "call_back_requested") {
                            setFollowUpRequired(true);
                          }
                        }}
                      >
                        <SelectTrigger className="h-8 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {CALL_OUTCOMES.map((o) => (
                            <SelectItem key={o.id} value={o.id}>
                              {o.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1">
                      <label className="font-semibold text-muted-foreground">Directory permission</label>
                      <Select value={directoryPermission} onValueChange={(v) => setDirectoryPermission(v as never)}>
                        <SelectTrigger className="h-8 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="pending">Pending / not discussed</SelectItem>
                          <SelectItem value="granted">Permission granted</SelectItem>
                          <SelectItem value="denied">Permission denied</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1">
                      <label className="font-semibold text-muted-foreground">Booking-link permission</label>
                      <Select value={bookingLinkPermission} onValueChange={(v) => setBookingLinkPermission(v as never)}>
                        <SelectTrigger className="h-8 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="pending">Pending / not discussed</SelectItem>
                          <SelectItem value="granted">Granted</SelectItem>
                          <SelectItem value="denied">Denied</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1">
                      <label className="font-semibold text-muted-foreground">Training review</label>
                      <Select value={trainingReview} onValueChange={setTrainingReview}>
                        <SelectTrigger className="h-8 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {TRAINING_REVIEW_OPTIONS.map((o) => (
                            <SelectItem key={o.id} value={o.id}>
                              {o.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="flex items-center gap-2 pt-1">
                      <input
                        id="dm-reached"
                        type="checkbox"
                        checked={decisionMakerReached}
                        onChange={(e) => setDecisionMakerReached(e.target.checked)}
                      />
                      <label htmlFor="dm-reached">Decision-maker reached</label>
                    </div>
                    <div className="flex items-center gap-2 pt-1">
                      <input
                        id="follow-up"
                        type="checkbox"
                        checked={followUpRequired}
                        onChange={(e) => setFollowUpRequired(e.target.checked)}
                      />
                      <label htmlFor="follow-up">Schedule follow-up</label>
                    </div>
                    {followUpRequired && (
                      <>
                        <div className="space-y-1">
                          <label className="font-semibold text-muted-foreground">Next action</label>
                          <Input
                            value={nextAction}
                            onChange={(e) => setNextAction(e.target.value)}
                            placeholder="e.g. Email directory summary"
                            className="h-8 text-xs"
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="font-semibold text-muted-foreground">Follow-up date</label>
                          <Input
                            type="datetime-local"
                            value={nextActionAt}
                            onChange={(e) => setNextActionAt(e.target.value)}
                            className="h-8 text-xs"
                          />
                        </div>
                      </>
                    )}
                    <div className="space-y-1 md:col-span-2">
                      <label className="font-semibold text-muted-foreground">Capture contact (optional)</label>
                      <div className="grid grid-cols-3 gap-2">
                        <Input
                          value={contactFirstName}
                          onChange={(e) => setContactFirstName(e.target.value)}
                          placeholder="First"
                          className="h-8 text-xs"
                        />
                        <Input
                          value={contactLastName}
                          onChange={(e) => setContactLastName(e.target.value)}
                          placeholder="Last"
                          className="h-8 text-xs"
                        />
                        <Input
                          value={contactEmail}
                          onChange={(e) => setContactEmail(e.target.value)}
                          placeholder="Email"
                          className="h-8 text-xs"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 flex-wrap">
                    <Button
                      className="bg-emerald-600 hover:bg-emerald-700 text-white"
                      size="sm"
                      disabled={saving || saved}
                      onClick={() => void saveOutcome()}
                    >
                      <ShieldCheck className="size-3.5 mr-1" />
                      {saved ? "Saved" : saving ? "Saving…" : "Save & complete"}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-rose-700 border-rose-200"
                      disabled={saving || saved || !selectedClinic}
                      onClick={async () => {
                        if (!activeCall || !selectedClinic || saving) return;
                        setOutcome("do_not_call");
                        setFollowUpRequired(false);
                        setSaving(true);
                        try {
                          const res = await fetch(`/api/clinics/${selectedClinic.id}/calls`, {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({
                              callSessionId: activeCall.id,
                              outcome: "do_not_call",
                              answered: Boolean(activeCall.connectedAt),
                              notes,
                              doNotCall: true,
                              followUpRequired: false,
                              callEnvironment: activeCall.mode === "mock" ? "practice" : "live",
                              structuredData: { provider: "dialpad", mode: "founder_led", checklist },
                            }),
                          });
                          if (!res.ok) {
                            toast.error("Could not mark Do Not Call.");
                            return;
                          }
                          await fetch(`/api/clinics/${selectedClinic.id}/stage`, {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({
                              toStage: "do_not_call",
                              reason: "Immediate DNC from Founder-Led Call Mode",
                              relatedCallId: activeCall.id,
                            }),
                          }).catch(() => undefined);
                          toast.success("Marked Do Not Call — removed from queue.");
                          setSaved(true);
                          void loadQueue();
                        } catch {
                          toast.error("Could not mark Do Not Call.");
                        } finally {
                          setSaving(false);
                        }
                      }}
                    >
                      <Ban className="size-3.5 mr-1" /> Mark DNC now
                    </Button>
                    {saved && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setActiveCall(null);
                          setSelectedClinic(null);
                          setClinicDetail(null);
                        }}
                      >
                        Next clinic
                      </Button>
                    )}
                  </div>
                </div>
              )}
            </Card>
          )}

          <DialpadCti />

          <Card className="p-3 space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-bold text-sm flex items-center gap-1.5">
                <History className="size-4" /> Call History
                {selectedClinic && (
                  <span className="text-muted-foreground font-normal">— {selectedClinic.name}</span>
                )}
              </span>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 px-2"
                onClick={() => void loadHistory(selectedClinic?.id)}
              >
                <RefreshCw className="size-3.5" />
              </Button>
            </div>
            <div className="space-y-1.5 max-h-72 overflow-y-auto">
              {history.length === 0 && (
                <p className="text-xs text-muted-foreground p-2">No Dialpad calls yet.</p>
              )}
              {history.map((call) => (
                <div key={call.id} className="border rounded p-2 text-xs flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate">
                      {formatPhone(call.externalNumber)} ·{" "}
                      {call.startedAt ? relativeTime(new Date(call.startedAt)) : "unknown"}
                    </p>
                    <p className="text-muted-foreground truncate">
                      {call.outcome && call.outcome !== "not_started" ? call.outcome.replace(/_/g, " ") : "no outcome"}
                      {call.durationSec ? ` · ${call.durationSec}s` : ""}
                      {call.transcriptStatus === "stored" ? " · transcript" : " · transcript pending/unavailable"}
                      {call.recordingAvailable ? " · recording" : ""}
                      {call.mode === "mock" ? " · mock" : ""}
                    </p>
                  </div>
                  <Badge className={`border shrink-0 ${statusTone(call.status)}`}>
                    {TERMINAL_LABELS[call.status] ?? call.status}
                  </Badge>
                </div>
              ))}
            </div>
          </Card>
        </div>

        <div className="lg:col-span-4 space-y-4">
          <CopilotPanel assist={assist} callActive={callActive} />
        </div>
      </div>
    </div>
  );
}
