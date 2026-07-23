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
import { CallHud, CopilotPanel, DialKeypad, useCallAssist } from "./founder-call-hud";
import { useTelnyxFounderCall, type FounderCallStatus } from "@/hooks/use-telnyx-founder-call";

/**
 * Founder-Led Call Mode.
 *
 * Paths:
 * 1. Personal phone (default for today) — you dial on your phone; this tab coaches via mic.
 * 2. Telnyx browser softphone — you speak in-browser when Telnyx is configured.
 *
 * AI never speaks as the founder. Suggestions stay on screen.
 */

interface TelephonyStatus {
  provider: string;
  mode: string;
  enabled: boolean;
  configured: boolean;
  configErrors: string[];
  callerNumber: string | null;
  dialpadRequired: boolean;
  audio: string;
  personalPhoneReady?: boolean;
  deepgramConfigured?: boolean;
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

interface FounderCall {
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
  provider?: string | null;
}

interface TranscriptSegment {
  sequenceNum: number;
  speaker: string;
  speakerRole: string | null;
  text: string;
  segmentType: string;
  startedAt: string | null;
}

const ACTIVE_STATUSES = ["queued", "initiating", "dialing", "ringing", "connected", "active", "held", "on_hold"];
const TERMINAL_LABELS: Record<string, string> = {
  completed: "Completed",
  ended: "Ended",
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

function mapUiStatusToDb(status: FounderCallStatus): string {
  if (status === "completed" || status === "canceled") return "ended";
  if (status === "initiating") return "connecting";
  return status;
}

function statusTone(status: string): string {
  if (["connected", "active"].includes(status)) return "bg-emerald-100 text-emerald-800 border-emerald-300";
  if (["ringing", "initiating", "dialing", "queued"].includes(status)) return "bg-amber-100 text-amber-800 border-amber-300";
  if (["held", "on_hold"].includes(status)) return "bg-sky-100 text-sky-800 border-sky-300";
  if (["failed", "missed", "canceled"].includes(status)) return "bg-rose-100 text-rose-800 border-rose-300";
  if (status === "completed" || status === "ended") return "bg-slate-100 text-slate-700 border-slate-300";
  return "bg-slate-100 text-slate-600 border-slate-300";
}

function copyLine(line: string) {
  void navigator.clipboard?.writeText(line).then(
    () => toast.success("Copied — say it on this call"),
    () => toast.message(line),
  );
}

function normalizeHistoryCall(raw: Record<string, unknown>): FounderCall {
  const metadata =
    typeof raw.metadata === "string"
      ? (() => {
          try {
            return JSON.parse(raw.metadata) as Record<string, unknown>;
          } catch {
            return {};
          }
        })()
      : ((raw.metadata as Record<string, unknown> | null) ?? {});
  const structured =
    typeof raw.structuredData === "string"
      ? (() => {
          try {
            return JSON.parse(raw.structuredData) as Record<string, unknown>;
          } catch {
            return {};
          }
        })()
      : ((raw.structuredData as Record<string, unknown> | null) ?? {});
  const providerMeta = (raw.providerMetadata as Record<string, unknown> | null) ?? {};
  return {
    id: String(raw.id),
    clinicId: String(raw.clinicId ?? ""),
    status: String(raw.status ?? "ended"),
    startedAt: raw.startedAt ? String(raw.startedAt) : null,
    ringingAt: raw.ringingAt ? String(raw.ringingAt) : null,
    connectedAt: raw.connectedAt ? String(raw.connectedAt) : null,
    endedAt: raw.endedAt ? String(raw.endedAt) : null,
    durationMs: typeof raw.durationMs === "number" ? raw.durationMs : null,
    durationSec: typeof raw.durationSec === "number" ? raw.durationSec : null,
    externalNumber: (raw.externalNumber as string | null) ?? (metadata.phoneNumber as string | null) ?? null,
    transcriptStatus: (raw.transcriptStatus as string | null) ?? "none",
    recordingAvailable: Boolean(raw.recordingAvailable ?? raw.recordingUrl),
    failureCode: (raw.failureCode as string | null) ?? null,
    failureMessage: (raw.failureMessage as string | null) ?? null,
    outcome: (raw.outcome as string | null) ?? null,
    notes: (raw.notes as string | null) ?? null,
    recapSummary:
      typeof providerMeta.recap_summary === "string"
        ? providerMeta.recap_summary
        : typeof structured.summary === "string"
          ? structured.summary
          : null,
    mode: (providerMeta.mode as string | null) ?? (structured.mode as string | null) ?? null,
    trainingReviewStatus: (raw.trainingReviewStatus as string | null) ?? null,
    attemptNumber: typeof raw.attemptNumber === "number" ? raw.attemptNumber : null,
    provider: (raw.provider as string | null) ?? null,
  };
}

export function DialpadCallView({ initialClinicId = null }: { initialClinicId?: string | null }) {
  const telnyx = useTelnyxFounderCall();
  const [status, setStatus] = useState<TelephonyStatus | null>(null);
  const [statusLoading, setStatusLoading] = useState(true);
  const [queue, setQueue] = useState<QueueClinic[]>([]);
  const [queueLoading, setQueueLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selectedClinic, setSelectedClinic] = useState<QueueClinic | null>(null);
  const [clinicDetail, setClinicDetail] = useState<Record<string, unknown> | null>(null);
  const [initiating, setInitiating] = useState(false);
  /** personal_phone = dial on your phone + ambient coach; browser = Telnyx WebRTC */
  const [dialPath, setDialPath] = useState<"personal_phone" | "browser">("personal_phone");
  const [activeCall, setActiveCall] = useState<FounderCall | null>(null);
  const [ending, setEnding] = useState(false);
  const [history, setHistory] = useState<FounderCall[]>([]);
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

  const notesTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSavedNotesRef = useRef("");
  const activeCallIdRef = useRef<string | null>(null);
  const connectedAtRef = useRef<string | null>(null);

  const persistSession = useCallback(async (callId: string, patch: Record<string, unknown>) => {
    try {
      await fetch(`/api/calls/${callId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
    } catch {
      /* best-effort */
    }
  }, []);

  const loadStatus = useCallback(async () => {
    setStatusLoading(true);
    try {
      const res = await fetch("/api/telephony/status");
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
        ? `/api/calls?clinicId=${encodeURIComponent(clinicId)}&limit=40`
        : "/api/calls?limit=40";
      const res = await fetch(url);
      const data = await res.json();
      const rows = Array.isArray(data.calls) ? data.calls : [];
      setHistory(rows.map((row: Record<string, unknown>) => normalizeHistoryCall(row)));
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
    activeCallIdRef.current = activeCall?.id ?? null;
  }, [activeCall?.id]);

  useEffect(() => {
    if (!activeCall || !ACTIVE_STATUSES.includes(activeCall.status)) return;
    const t = setInterval(() => setTick((v) => v + 1), 1000);
    return () => clearInterval(t);
  }, [activeCall]);

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

  const applyFounderStatus = useCallback(
    (callId: string, next: FounderCallStatus, extras?: { providerCallId?: string | null; failureMessage?: string }) => {
      const now = new Date().toISOString();
      setActiveCall((prev) => {
        if (!prev || prev.id !== callId) return prev;
        const patch: FounderCall = { ...prev, status: next };
        if (next === "ringing" && !prev.ringingAt) patch.ringingAt = now;
        if (next === "connected") {
          if (!prev.connectedAt) {
            patch.connectedAt = now;
            connectedAtRef.current = now;
          }
          patch.status = "connected";
        }
        if (next === "completed" || next === "failed" || next === "canceled") {
          patch.endedAt = now;
          const connectedAt = prev.connectedAt ?? connectedAtRef.current;
          if (connectedAt) {
            const sec = Math.max(0, Math.floor((Date.now() - new Date(connectedAt).getTime()) / 1000));
            patch.durationSec = sec;
            patch.durationMs = sec * 1000;
          }
          if (next === "failed" && extras?.failureMessage) {
            patch.failureMessage = extras.failureMessage;
            patch.failureCode = "TELNYX_CALL_ERROR";
          }
        }
        return patch;
      });

      const dbStatus = mapUiStatusToDb(next);
      const sessionPatch: Record<string, unknown> = { status: dbStatus };
      if (extras?.providerCallId) sessionPatch.providerCallId = extras.providerCallId;
      if (next === "completed" || next === "failed" || next === "canceled") {
        sessionPatch.endedAt = now;
        if (connectedAtRef.current) {
          sessionPatch.durationSec = Math.max(
            0,
            Math.floor((Date.now() - new Date(connectedAtRef.current).getTime()) / 1000),
          );
        }
        if (extras?.failureMessage) {
          sessionPatch.failureCode = "TELNYX_CALL_ERROR";
          sessionPatch.failureMessage = extras.failureMessage;
        }
      }
      void persistSession(callId, sessionPatch);

      if (next === "completed" || next === "failed" || next === "canceled") {
        toast.info(`Call ${TERMINAL_LABELS[next] ?? next}.`);
      }
    },
    [persistSession],
  );

  const endCall = useCallback(async () => {
    if (!activeCall || ending) return;
    setEnding(true);
    try {
      if (activeCall.provider !== "personal_phone" && activeCall.mode !== "personal_phone") {
        telnyx.hangup();
      }
      const now = new Date().toISOString();
      const durationSec = connectedAtRef.current
        ? Math.max(0, Math.floor((Date.now() - new Date(connectedAtRef.current).getTime()) / 1000))
        : activeCall.connectedAt
          ? Math.max(0, Math.floor((Date.now() - new Date(activeCall.connectedAt).getTime()) / 1000))
          : 0;
      setActiveCall((prev) =>
        prev
          ? {
              ...prev,
              status: "completed",
              endedAt: now,
              durationSec,
              durationMs: durationSec * 1000,
            }
          : prev,
      );
      await persistSession(activeCall.id, {
        status: "ended",
        endedAt: now,
        durationSec,
      });
      toast.success(activeCall.mode === "personal_phone" ? "Coaching session ended." : "Call ended.");
      void loadHistory(activeCall.clinicId);
    } catch {
      toast.error("Could not end the call cleanly.");
    } finally {
      setEnding(false);
    }
  }, [activeCall, ending, loadHistory, persistSession, telnyx]);

  const resetCallForm = useCallback(() => {
    setActiveCall(null);
    setEnding(false);
    connectedAtRef.current = null;
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
  }, []);

  const startPersonalPhoneSession = useCallback(
    async (clinic: QueueClinic) => {
      if (initiating) return;
      const destination = (clinic.primaryPhone || "").trim();
      if (!destination) {
        toast.error("This clinic has no phone number.");
        return;
      }
      if (status && status.personalPhoneReady === false) {
        toast.error("Deepgram is not configured — AI coach needs DEEPGRAM_API_KEY + DEEPGRAM_PROJECT_ID.");
        return;
      }

      setInitiating(true);
      setDialPath("personal_phone");
      selectClinic(clinic);
      resetCallForm();
      toast.info("Starting personal-phone coaching session…");

      try {
        const sessionRes = await fetch("/api/telephony/session", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            clinicId: clinic.id,
            callEnvironment: "live",
            mode: "personal_phone",
            phoneNumber: destination,
            idempotencyKey: `personal-${clinic.id}-${Date.now()}`,
          }),
        });
        const sessionData = await sessionRes.json().catch(() => ({}));
        if (!sessionRes.ok || !sessionData.callSessionId) {
          toast.error(sessionData.error ?? "Could not create coaching session.");
          return;
        }

        const callId = String(sessionData.callSessionId);
        const now = new Date().toISOString();
        connectedAtRef.current = now;
        activeCallIdRef.current = callId;
        setActiveCall({
          id: callId,
          clinicId: clinic.id,
          status: "connected",
          startedAt: now,
          ringingAt: null,
          connectedAt: now,
          endedAt: null,
          durationMs: null,
          durationSec: null,
          externalNumber: sessionData.externalNumber ?? destination,
          transcriptStatus: "none",
          recordingAvailable: false,
          failureCode: null,
          failureMessage: null,
          outcome: null,
          notes: null,
          recapSummary: null,
          mode: "personal_phone",
          provider: "personal_phone",
        });

        toast.success("Coach is live — dial the clinic on your phone now. Mute laptop speakers.");
      } catch {
        toast.error("Network error while starting the coaching session.");
      } finally {
        setInitiating(false);
      }
    },
    [initiating, resetCallForm, selectClinic, status],
  );

  const startCall = useCallback(
    async (clinic: QueueClinic, overrideNumber?: string) => {
      if (initiating) return;
      const destination = (overrideNumber || clinic.primaryPhone || "").trim();
      if (!destination) {
        toast.error("This clinic has no phone number.");
        return;
      }
      if (!status?.configured) {
        toast.error(status?.configErrors?.join(", ") || "Telnyx softphone is not configured.");
        return;
      }

      setInitiating(true);
      setDialPath("browser");
      selectClinic(clinic);
      resetCallForm();
      toast.info("Connecting softphone…");

      try {
        const sessionRes = await fetch("/api/telephony/session", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            clinicId: clinic.id,
            callEnvironment: "live",
            mode: "founder_led",
            phoneNumber: destination,
            idempotencyKey: `founder-${clinic.id}-${Date.now()}`,
          }),
        });
        const sessionData = await sessionRes.json().catch(() => ({}));
        if (!sessionRes.ok || !sessionData.callSessionId) {
          toast.error(sessionData.error ?? "Could not create call session.");
          return;
        }

        const callId = String(sessionData.callSessionId);
        setActiveCall({
          id: callId,
          clinicId: clinic.id,
          status: "initiating",
          startedAt: new Date().toISOString(),
          ringingAt: null,
          connectedAt: null,
          endedAt: null,
          durationMs: null,
          durationSec: null,
          externalNumber: sessionData.externalNumber ?? destination,
          transcriptStatus: "none",
          recordingAvailable: false,
          failureCode: null,
          failureMessage: null,
          outcome: null,
          notes: null,
          recapSummary: null,
          mode: "founder_led",
          provider: "telnyx",
        });
        activeCallIdRef.current = callId;

        const result = await telnyx.startOutbound(destination, {
          onStatus: (next, extras) => {
            if (activeCallIdRef.current !== callId) return;
            applyFounderStatus(callId, next, extras);
            if (next === "completed" || next === "failed" || next === "canceled") {
              void loadHistory(clinic.id);
            }
          },
          onError: (message) => {
            toast.error(message);
            applyFounderStatus(callId, "failed", { failureMessage: message });
          },
          onRemoteHangup: () => {
            void loadHistory(clinic.id);
          },
        });

        if (!result.ok) {
          toast.error(result.error);
          await persistSession(callId, {
            status: result.error.includes("Microphone") ? "microphone_denied" : "provider_unavailable",
            failureCode: result.error.includes("Microphone") ? "MICROPHONE_DENIED" : "TELNYX_CONFIGURATION_MISSING",
            failureMessage: result.error,
            endedAt: new Date().toISOString(),
          });
          setActiveCall((prev) =>
            prev && prev.id === callId
              ? {
                  ...prev,
                  status: "failed",
                  endedAt: new Date().toISOString(),
                  failureMessage: result.error,
                }
              : prev,
          );
          return;
        }

        toast.success("Calling from this browser — speak into your mic.");
      } catch {
        toast.error("Network error while starting the call.");
      } finally {
        setInitiating(false);
      }
    },
    [applyFounderStatus, initiating, loadHistory, persistSession, resetCallForm, selectClinic, status, telnyx],
  );

  const loadTranscript = useCallback(async () => {
    if (!activeCall) return;
    setTranscriptState("loading");
    try {
      setTranscript([]);
      setSummary(activeCall.recapSummary);
      setTranscriptState(activeCall.recapSummary ? "ready" : "unavailable");
    } catch {
      setTranscriptState("unavailable");
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

      const durationSec =
        activeCall.durationSec ??
        (activeCall.connectedAt && activeCall.endedAt
          ? Math.max(
              0,
              Math.floor(
                (new Date(activeCall.endedAt).getTime() - new Date(activeCall.connectedAt).getTime()) / 1000,
              ),
            )
          : 0);

      const res = await fetch(`/api/clinics/${selectedClinic.id}/calls`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          callSessionId: activeCall.id,
          outcome,
          answered:
            Boolean(activeCall.connectedAt) ||
            ["permission_granted", "permission_denied", "connected", "interested", "meeting_booked", "not_interested", "do_not_call"].includes(
              outcome,
            ),
          decisionMakerReached,
          notes,
          followUpRequired: followUpRequired || outcome === "call_back_requested" || outcome === "busy" || outcome === "clinic_closed",
          nextAction: nextAction || (followUpRequired ? "Follow up on directory permission" : undefined),
          nextActionAt: nextActionAt || undefined,
          durationSec,
          callEnvironment: "live",
          doNotCall: outcome === "do_not_call",
          directoryPermissionStatus: directoryPermission,
          structuredData: {
            provider: "telnyx",
            mode: "founder_led",
            audio: "browser_webrtc",
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
      await persistSession(activeCall.id, {
        status: "saved",
        notes,
        structuredData: JSON.stringify({
          provider: "telnyx",
          mode: "founder_led",
          audio: "browser_webrtc",
          directoryPermissionStatus: directoryPermission,
          bookingLinkPermissionStatus: bookingLinkPermission,
          checklist,
          trainingEligible: true,
          trainingReviewStatus: trainingReview,
        }),
      });
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
    persistSession,
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
    [activeCall?.id, loadQueue],
  );

  const callActive = Boolean(activeCall && ACTIVE_STATUSES.includes(activeCall.status));
  const callEnded = Boolean(activeCall && !ACTIVE_STATUSES.includes(activeCall.status));
  const isPersonalPhone =
    dialPath === "personal_phone" ||
    activeCall?.mode === "personal_phone" ||
    activeCall?.provider === "personal_phone";
  const assist = useCallAssist({ callActive, autoStartCoach: isPersonalPhone && callActive });

  if (statusLoading) {
    return (
      <Card className="p-8 text-center text-sm text-muted-foreground">
        Checking call coaching status…
      </Card>
    );
  }

  const telnyxReady = Boolean(status?.configured);
  const personalReady = status?.personalPhoneReady !== false;

  return (
    <div className="space-y-4">
      <Card className="p-3 border-violet-200 bg-violet-50/40">
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <Badge className="bg-violet-700 text-white font-bold">Founder-Led</Badge>
          <Badge variant="outline" className="font-bold uppercase">
            Personal phone + coach
          </Badge>
          <span className="font-medium text-violet-950">
            Dial on your phone. This tab listens via mic and shows what to say next — mute laptop speakers.
          </span>
          {telnyxReady && status?.callerNumber && (
            <Badge variant="outline" className="font-mono text-[10px]">
              Browser softphone also ready · From {formatPhone(status.callerNumber)}
            </Badge>
          )}
          {!personalReady && (
            <Badge variant="outline" className="text-rose-700 border-rose-300">
              Deepgram not configured
            </Badge>
          )}
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
                  selectedClinic?.id === clinic.id ? "border-violet-400 bg-violet-50/50" : "hover:bg-accent/40"
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
                <div className="flex items-center gap-1 pt-1 flex-wrap" onClick={(e) => e.stopPropagation()}>
                  <Button
                    size="sm"
                    className="h-7 text-[11px] bg-violet-700 hover:bg-violet-800 text-white"
                    disabled={initiating || callActive || !clinic.primaryPhone}
                    onClick={() => void startPersonalPhoneSession(clinic)}
                  >
                    <Mic className="size-3 mr-1" /> Coach + my phone
                  </Button>
                  {telnyxReady && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 text-[11px]"
                      disabled={initiating || callActive || !clinic.primaryPhone}
                      onClick={() => void startCall(clinic)}
                    >
                      <PhoneCall className="size-3 mr-1" /> Browser
                    </Button>
                  )}
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
                  <div className="flex flex-col gap-1.5 shrink-0">
                    <Button
                      className="bg-violet-700 hover:bg-violet-800 text-white"
                      disabled={initiating || !briefing.phone}
                      onClick={() => void startPersonalPhoneSession(selectedClinic)}
                    >
                      <Mic className="size-4 mr-1" /> Coach + my phone
                    </Button>
                    {telnyxReady && (
                      <Button
                        variant="outline"
                        disabled={initiating || !briefing.phone}
                        onClick={() => void startCall(selectedClinic)}
                      >
                        <PhoneCall className="size-4 mr-1" /> Call in browser
                      </Button>
                    )}
                  </div>
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

          {!activeCall && telnyxReady && (
            <Card className="p-4 space-y-2">
              <p className="text-[11px] font-bold uppercase text-muted-foreground">
                Browser dial pad{selectedClinic ? ` — logs to ${selectedClinic.name}` : ""}
              </p>
              <DialKeypad
                disabled={initiating || callActive || !selectedClinic}
                hint={
                  selectedClinic
                    ? "Optional Telnyx path — dials from this browser. For today, prefer Coach + my phone."
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

          {!activeCall && !telnyxReady && (
            <Card className="p-4 text-xs text-muted-foreground">
              Telnyx browser softphone is not configured — that&apos;s fine for today. Use{" "}
              <strong className="text-foreground">Coach + my phone</strong> on a clinic to start.
              {status?.configErrors?.length ? (
                <span className="block mt-1 text-[11px]">Softphone gaps: {status.configErrors.join(" · ")}</span>
              ) : null}
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
                isMock={false}
                isPersonalPhone={isPersonalPhone}
                callActive={callActive}
                assist={assist}
                ending={ending}
                onEndCall={() => void endCall()}
              />

              {callActive && isPersonalPhone && (
                <div className="text-xs text-violet-950 bg-violet-50 border border-violet-200 rounded p-2.5 space-y-1">
                  <p className="font-semibold">Dial now: {formatPhone(activeCall.externalNumber)}</p>
                  <p>
                    Speakerphone near this laptop mic · mute laptop speakers · say the cue on screen ·
                    capture email + permission after they engage.
                  </p>
                </div>
              )}

              {callActive && !isPersonalPhone && ["initiating", "dialing", "ringing"].includes(activeCall.status) && (
                <div className="text-xs text-muted-foreground bg-accent/40 rounded p-2.5">
                  Ringing through this browser. Keep this tab focused, unmute speakers, and speak into your mic when connected.
                </div>
              )}

              <div className={`rounded-lg border px-3 py-2.5 text-xs ${isPersonalPhone ? "border-violet-200 bg-violet-50 text-violet-950" : "border-sky-200 bg-sky-50 text-sky-950"}`}>
                {isPersonalPhone ? (
                  <>
                    <strong>Personal phone:</strong> You are the voice. AI coaches silently on screen.
                    After hangup, complete permission, outcome, and follow-up below.
                  </>
                ) : (
                  <>
                    <strong>In-browser audio:</strong> Allow microphone access once. Clinic audio plays on your
                    speakers. After hangup, complete the post-call panel (permission, outcome, follow-up).
                  </>
                )}
              </div>

              <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Mic className="size-3" /> Session:{" "}
                  {activeCall.recordingAvailable ? "recording available" : "logged in CRM (notes + outcome)"}
                </span>
                <span className="flex items-center gap-1">
                  <FileText className="size-3" /> Coach: browser mic → Deepgram
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
                      <span className="font-semibold">Call summary: </span>
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
                          Artifacts still processing — try again shortly.
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
                              callEnvironment: "live",
                              structuredData: { provider: "telnyx", mode: "founder_led", audio: "browser_webrtc", checklist },
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
                <p className="text-xs text-muted-foreground p-2">No founder calls yet.</p>
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
                      {call.provider === "telnyx" ? " · telnyx" : call.mode === "mock" ? " · mock" : ""}
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
