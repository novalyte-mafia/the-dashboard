"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNav } from "@/components/admin/admin-app";
import { CallKeypad } from "./call-audio";
import { CallBar } from "./call-bar";
import { CallPlanColumn } from "./call-plan-column";
import { LiveCoachingColumn } from "./live-coaching-column";
import { CalmRecoveryColumn } from "./calm-recovery-column";
import { PostCallReview } from "./post-call-review";
import { PracticeMode, practiceReply } from "./practice-mode";
import { seedClinicPayload } from "./seed-clinic";
import { extractReviewFromTranscript } from "@/lib/cold-trainer/extract";
import { fallbackForGoal, FALLBACKS } from "@/lib/cold-trainer/fallbacks";
import { mapClinicToPayload } from "@/lib/cold-trainer/map-clinic";
import { computeTalkListenMetrics } from "@/lib/cold-trainer/metrics";
import {
  DEFAULT_PREP,
  type CallGoal,
  type ClinicContextPayload,
  type CoachStage,
  type CoachSuggestion,
  type CoachingEvent,
  type MicStatus,
  type PostCallReview as Review,
  type PracticePersonaId,
  type PrepFields,
  type TranscriptTurn,
} from "@/lib/cold-trainer/types";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

function turnId(): string {
  return `t_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}

function isTypingTarget(el: EventTarget | null): boolean {
  if (!(el instanceof HTMLElement)) return false;
  const tag = el.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || el.isContentEditable;
}

export function ColdTrainerView({ clinicId }: { clinicId?: string | null }) {
  const { navigate } = useNav();
  const [clinic, setClinic] = useState<ClinicContextPayload>(() => seedClinicPayload());
  const [prep, setPrep] = useState<PrepFields>(DEFAULT_PREP);
  const [goal, setGoal] = useState<CallGoal>("Find decision-maker");
  const [stage, setStage] = useState<CoachStage>("opening");
  const [suggestion, setSuggestion] = useState<CoachSuggestion | null>(() => fallbackForGoal("Find decision-maker"));
  const [turns, setTurns] = useState<TranscriptTurn[]>([]);
  const [events, setEvents] = useState<CoachingEvent[]>([]);
  const [micStatus, setMicStatus] = useState<MicStatus>("ready");
  const [consent, setConsent] = useState(false);
  const [recordingEnabled, setRecordingEnabled] = useState(false);
  const [elapsedMs, setElapsedMs] = useState(0);
  const [stuck, setStuck] = useState(false);
  const [practice, setPractice] = useState(false);
  const [persona, setPersona] = useState<PracticePersonaId>("receptionist");
  const [practiceDraft, setPracticeDraft] = useState("");
  const [reviewOpen, setReviewOpen] = useState(false);
  const [review, setReview] = useState<Review | null>(null);
  const [saving, setSaving] = useState(false);
  const [noteOpen, setNoteOpen] = useState(false);
  const [noteDraft, setNoteDraft] = useState("");
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [analyser, setAnalyser] = useState<AnalyserNode | null>(null);
  const [reviewLoading, setReviewLoading] = useState(false);

  const turnsRef = useRef<TranscriptTurn[]>([]);
  const suggestionRef = useRef<CoachSuggestion | null>(suggestion);
  const eventsRef = useRef<CoachingEvent[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const archiveChunksRef = useRef<Blob[]>([]);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const founderSpeakerRef = useRef<number | null>(null);
  const startedAtRef = useRef<number | null>(null);
  const coachAbortRef = useRef<AbortController | null>(null);
  const lastCoachAtRef = useRef(0);
  const clinicRef = useRef(clinic);
  const prepRef = useRef(prep);
  const goalRef = useRef(goal);
  const stageRef = useRef(stage);
  const sessionIdRef = useRef<string | null>(null);
  const recordingRef = useRef(false);
  const noteInputRef = useRef<HTMLInputElement>(null);

  clinicRef.current = clinic;
  prepRef.current = prep;
  goalRef.current = goal;
  stageRef.current = stage;
  suggestionRef.current = suggestion;
  eventsRef.current = events;
  sessionIdRef.current = sessionId;
  recordingRef.current = recordingEnabled;

  const metrics = useMemo(() => computeTalkListenMetrics(turns), [turns]);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!clinicId) {
        setClinic(seedClinicPayload(prepRef.current, goalRef.current));
        return;
      }
      try {
        const [clinicRes, callsRes] = await Promise.all([
          fetch(`/api/clinics/${clinicId}`),
          fetch(`/api/clinics/${clinicId}/calls`),
        ]);
        if (cancelled) return;
        if (!clinicRes.ok) {
          setClinic(seedClinicPayload(prepRef.current, goalRef.current));
          toast.message("Clinic not found — using Retreat Wellness seed. Facts stay empty.");
          return;
        }
        const clinicJson = await clinicRes.json();
        const callsJson = callsRes.ok ? await callsRes.json() : { calls: [] };
        const mapped = mapClinicToPayload(clinicJson.clinic, callsJson.calls ?? [], prepRef.current, goalRef.current);
        setClinic(mapped ?? seedClinicPayload(prepRef.current, goalRef.current));
      } catch {
        if (!cancelled) setClinic(seedClinicPayload(prepRef.current, goalRef.current));
      }
    }
    void load();
    return () => { cancelled = true; };
  }, [clinicId]);

  useEffect(() => {
    setClinic((c) => ({ ...c, call_goal: goal, approved_value_proposition: prep.valueProposition }));
  }, [goal, prep.valueProposition]);

  useEffect(() => {
    if (micStatus !== "listening" || !startedAtRef.current) return;
    const tick = window.setInterval(() => {
      setElapsedMs(Date.now() - (startedAtRef.current ?? Date.now()));
    }, 250);
    return () => window.clearInterval(tick);
  }, [micStatus]);

  const pushEvent = useCallback((event: CoachingEvent) => {
    setEvents((prev) => {
      const next = [...prev, event].slice(-80);
      eventsRef.current = next;
      return next;
    });
  }, []);

  const requestCoach = useCallback(async (nextTurns: TranscriptTurn[], opts?: { stuck?: boolean; stage?: CoachStage }) => {
    const now = Date.now();
    if (!opts?.stuck && now - lastCoachAtRef.current < 900) return;
    lastCoachAtRef.current = now;
    coachAbortRef.current?.abort();
    const ac = new AbortController();
    coachAbortRef.current = ac;
    const liveMetrics = computeTalkListenMetrics(nextTurns);
    try {
      const res = await fetch("/api/cold-trainer/coach", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: ac.signal,
        body: JSON.stringify({
          clinic: clinicRef.current,
          turns: nextTurns.slice(-40),
          call_goal: goalRef.current,
          current_stage: opts?.stage ?? stageRef.current,
          metrics: liveMetrics,
          prep: prepRef.current,
          stuck: Boolean(opts?.stuck),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.suggestion) throw new Error(data.error || "Coach unavailable");
      const next = data.suggestion as CoachSuggestion;
      setSuggestion(next);
      suggestionRef.current = next;
      setStage(next.stage);
      stageRef.current = next.stage;
      pushEvent({ at: new Date().toISOString(), type: "coach", detail: next.say_next, suggestion: next });
    } catch (err) {
      if ((err as { name?: string }).name === "AbortError") return;
      const fallback = fallbackForGoal(goalRef.current);
      setSuggestion(fallback);
      setStage(fallback.stage);
    }
  }, [pushEvent]);

  const appendTurn = useCallback((turn: TranscriptTurn, coach = true) => {
    const next = [...turnsRef.current, turn].slice(-60);
    turnsRef.current = next;
    setTurns(next);
    if (!coach) return;
    const last = turn;
    const founderLong = last.speaker === "founder" && last.text.trim().split(/\s+/).length >= 40;
    if (last.speaker !== "founder" || founderLong) void requestCoach(next);
  }, [requestCoach]);

  const stopListening = useCallback(() => {
    recorderRef.current?.stop();
    recorderRef.current = null;
    try { wsRef.current?.close(); } catch { /* ignore */ }
    wsRef.current = null;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    void audioCtxRef.current?.close().catch(() => undefined);
    audioCtxRef.current = null;
    analyserRef.current = null;
    setAnalyser(null);
    setMicStatus((s) => (s === "listening" || s === "connecting" ? "paused" : s));
  }, []);

  const attachAnalyser = useCallback(async (stream: MediaStream) => {
    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new AudioCtx();
    audioCtxRef.current = ctx;
    if (ctx.state === "suspended") await ctx.resume();
    const source = ctx.createMediaStreamSource(stream);
    const node = ctx.createAnalyser();
    node.fftSize = 1024;
    source.connect(node);
    analyserRef.current = node;
    setAnalyser(node);
  }, []);

  const startDeepgram = useCallback(async () => {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    streamRef.current = stream;
    await attachAnalyser(stream);
    const tokenRes = await fetch("/api/copilot/deepgram");
    const tokenData = await tokenRes.json().catch(() => ({}));
    if (!tokenRes.ok || !tokenData.token) throw new Error(tokenData.error || "Deepgram token unavailable.");
    const params = new URLSearchParams({
      model: "nova-2",
      smart_format: "true",
      interim_results: "false",
      endpointing: "400",
      diarize: "true",
      utterances: "true",
      punctuate: "true",
    });
    const ws = new WebSocket(`wss://api.deepgram.com/v1/listen?${params}`, ["token", tokenData.token]);
    wsRef.current = ws;
    await new Promise<void>((resolve, reject) => {
      const timer = window.setTimeout(() => reject(new Error("Coach connection timed out.")), 8000);
      ws.onopen = () => {
        window.clearTimeout(timer);
        resolve();
      };
      ws.onerror = () => {
        window.clearTimeout(timer);
        reject(new Error("Coach connection failed."));
      };
    });
    let mimeType = "audio/webm";
    if (!MediaRecorder.isTypeSupported(mimeType)) mimeType = "audio/ogg";
    if (!MediaRecorder.isTypeSupported(mimeType)) mimeType = "";
    const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
    recorderRef.current = recorder;
    archiveChunksRef.current = [];
    recorder.ondataavailable = (e) => {
      if (e.data.size > 0 && ws.readyState === WebSocket.OPEN) ws.send(e.data);
      if (recordingRef.current && e.data.size > 0) archiveChunksRef.current.push(e.data);
    };
    recorder.start(250);
    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(String(event.data));
        const text: string = msg?.channel?.alternatives?.[0]?.transcript ?? "";
        if (!msg?.is_final || !text.trim()) return;
        const wordSpeaker = msg?.channel?.alternatives?.[0]?.words?.[0]?.speaker;
        const utteranceSpeaker = typeof wordSpeaker === "number" ? wordSpeaker : 0;
        if (founderSpeakerRef.current === null) founderSpeakerRef.current = utteranceSpeaker;
        let speakerLabel: TranscriptTurn["speaker"] = "founder";
        let confident = true;
        if (utteranceSpeaker !== founderSpeakerRef.current) {
          const conf = Number(msg?.channel?.alternatives?.[0]?.confidence ?? 0);
          if (conf >= 0.65) {
            speakerLabel = "prospect";
            confident = true;
          } else {
            speakerLabel = "unknown";
            confident = false;
          }
        }
        appendTurn({
          id: turnId(),
          speaker: speakerLabel,
          text: text.trim(),
          at: new Date().toISOString(),
          confident,
          words: text.trim().split(/\s+/).length,
        });
      } catch {
        /* keepalive */
      }
    };
    ws.onclose = () => {
      if (wsRef.current === ws) setMicStatus((s) => (s === "listening" ? "paused" : s));
    };
  }, [appendTurn, attachAnalyser]);

  const startCoaching = useCallback(async () => {
    if (!consent) {
      toast.error("Acknowledge the consent notice before Start Coaching.");
      return;
    }
    setMicStatus("connecting");
    founderSpeakerRef.current = null;
    startedAtRef.current = Date.now();
    setElapsedMs(0);
    setStuck(false);
    setSuggestion(fallbackForGoal(goalRef.current));
    try {
      const created = await fetch("/api/cold-trainer/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clinic_id: clinicRef.current.clinic_id,
          contact_id: clinicRef.current.contact_id,
          call_goal: goalRef.current,
          consent_status: "transcription_acknowledged",
          recording_status: recordingRef.current ? "active" : "not_started",
          prep: prepRef.current,
        }),
      }).then((r) => r.json());
      const id = created?.session?.id ?? null;
      setSessionId(id);
      sessionIdRef.current = id;
      if (practice) {
        try {
          const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
          streamRef.current = stream;
          await attachAnalyser(stream);
        } catch {
          /* typed practice still works without mic */
        }
        setMicStatus("listening");
        toast.success("Practice coaching is on — type or speak your line. No outbound call.");
        return;
      }
      await startDeepgram();
      setMicStatus("listening");
      toast.success("Listening on your mic. You are the caller — this is not an outbound agent.");
    } catch (err) {
      setMicStatus("ready");
      toast.error(err instanceof Error ? err.message : "Could not start coaching.");
    }
  }, [consent, practice, startDeepgram, attachAnalyser]);

  const pauseCoaching = useCallback(() => {
    stopListening();
    setMicStatus("paused");
    pushEvent({ at: new Date().toISOString(), type: "pause", detail: "Paused listening" });
  }, [pushEvent, stopListening]);

  const resumeCoaching = useCallback(async () => {
    if (practice) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        streamRef.current = stream;
        await attachAnalyser(stream);
      } catch {
        /* typed practice still works without mic */
      }
      setMicStatus("listening");
      return;
    }
    try {
      setMicStatus("connecting");
      await startDeepgram();
      setMicStatus("listening");
    } catch (err) {
      setMicStatus("paused");
      toast.error(err instanceof Error ? err.message : "Could not resume.");
    }
  }, [practice, startDeepgram, attachAnalyser]);

  const emergencyReset = useCallback(() => {
    stopListening();
    setMicStatus("paused");
    setStuck(true);
    setStage("reset");
    const reset = { ...FALLBACKS.reset };
    setSuggestion(reset);
    pushEvent({ at: new Date().toISOString(), type: "reset", detail: reset.say_next, suggestion: reset });
  }, [pushEvent, stopListening]);

  const endCall = useCallback(async () => {
    stopListening();
    setMicStatus("ready");
    if (recordingRef.current && archiveChunksRef.current.length) {
      const blob = new Blob(archiveChunksRef.current, { type: "audio/webm" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `cold-trainer-${Date.now()}.webm`;
      a.click();
      URL.revokeObjectURL(url);
    }
    const payload = {
      transcript: turnsRef.current,
      coaching_events: eventsRef.current,
      suggested_lines: eventsRef.current.map((e) => e.suggestion).filter(Boolean),
      talk_listen_metrics: computeTalkListenMetrics(turnsRef.current),
      clinic: clinicRef.current,
      prep: prepRef.current,
      call_goal: goalRef.current,
    };
    const id = sessionIdRef.current;
    setReview(null);
    setReviewOpen(true);
    setReviewLoading(true);
    let nextReview: Review | null = null;
    try {
      if (id) {
        const res = await fetch(`/api/cold-trainer/sessions/${id}/complete`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        const data = await res.json().catch(() => ({}));
        nextReview = data.review ?? null;
      }
      if (!nextReview) {
        const res = await fetch("/api/cold-trainer/review", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        const data = await res.json().catch(() => ({}));
        nextReview = data.review ?? extractReviewFromTranscript(turnsRef.current, computeTalkListenMetrics(turnsRef.current));
      }
    } catch {
      nextReview = extractReviewFromTranscript(turnsRef.current, computeTalkListenMetrics(turnsRef.current));
    }
    setReview(nextReview);
    setReviewLoading(false);
  }, [stopListening]);

  const onStuck = useCallback(() => {
    setStuck(true);
    setStage("reset");
    pushEvent({ at: new Date().toISOString(), type: "stuck", detail: "Founder stuck" });
    void requestCoach(turnsRef.current, { stuck: true, stage: "reset" });
  }, [pushEvent, requestCoach]);

  const sendPracticeLine = useCallback(() => {
    const text = practiceDraft.trim();
    if (!text) return;
    setPracticeDraft("");
    const founderTurn: TranscriptTurn = {
      id: turnId(),
      speaker: "founder",
      text,
      at: new Date().toISOString(),
      confident: true,
    };
    const prospectTurn: TranscriptTurn = {
      id: turnId(),
      speaker: "prospect",
      text: practiceReply(persona, text, turnsRef.current.filter((t) => t.speaker === "prospect").length),
      at: new Date().toISOString(),
      confident: true,
    };
    const next = [...turnsRef.current, founderTurn, prospectTurn].slice(-60);
    turnsRef.current = next;
    setTurns(next);
    if (micStatus === "ready") setMicStatus("listening");
    if (!startedAtRef.current) startedAtRef.current = Date.now();
    void requestCoach(next);
  }, [micStatus, persona, practiceDraft, requestCoach]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (isTypingTarget(e.target) || reviewOpen) return;
      if (e.code === "Space") {
        e.preventDefault();
        if (micStatus === "listening") pauseCoaching();
        else if (micStatus === "paused") void resumeCoaching();
      } else if (e.key === "r" || e.key === "R") {
        e.preventDefault();
        emergencyReset();
      } else if (e.key === "n" || e.key === "N") {
        e.preventDefault();
        setNoteOpen(true);
        window.setTimeout(() => noteInputRef.current?.focus(), 50);
      } else if (e.key === "e" || e.key === "E") {
        e.preventDefault();
        void endCall();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [emergencyReset, endCall, micStatus, pauseCoaching, resumeCoaching, reviewOpen]);

  useEffect(() => () => stopListening(), [stopListening]);

  useEffect(() => {
    if (!sessionId || micStatus !== "listening") return;
    const id = window.setInterval(() => {
      void fetch(`/api/cold-trainer/sessions/${sessionId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          transcript: turnsRef.current,
          coaching_events: eventsRef.current,
          talk_listen_metrics: computeTalkListenMetrics(turnsRef.current),
        }),
      });
    }, 8000);
    return () => window.clearInterval(id);
  }, [sessionId, micStatus]);

  const resetSessionState = () => {
    stopListening();
    turnsRef.current = [];
    eventsRef.current = [];
    setTurns([]);
    setEvents([]);
    setElapsedMs(0);
    startedAtRef.current = null;
    setSessionId(null);
    setReviewOpen(false);
    setReview(null);
    setReviewLoading(false);
    setStuck(false);
    setStage("opening");
    setSuggestion(fallbackForGoal(goal));
    setMicStatus("ready");
  };

  const realClinicId = clinic.clinic_id;

  const saveCallNote = async () => {
    if (!review || !realClinicId) {
      toast.error("Open a real clinic to save a call note.");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(`/api/clinics/${realClinicId}/calls`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          outcome: review.outcome,
          notes: [
            review.notes,
            review.verifiedDetails && `Verified: ${review.verifiedDetails}`,
            review.permissions && `Permission: ${review.permissions}`,
            `Scorecard — well: ${review.scorecard.whatWentWell}`,
          ].filter(Boolean).join("\n"),
          answered: true,
          durationSec: Math.round(elapsedMs / 1000),
          objections: review.objectionTags,
          nextAction: review.nextAction,
          nextActionAt: review.followUpDate || undefined,
          followUpRequired: Boolean(review.followUpDate),
          callEnvironment: practice ? "practice" : "live",
          provider: "cold_trainer",
          structuredData: {
            transcript: turnsRef.current,
            coldTrainer: true,
            scorecard: review.scorecard,
          },
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Could not save call note.");
      if (sessionId && data.call?.id) {
        await fetch(`/api/cold-trainer/sessions/${sessionId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ created_call_id: data.call.id, call_outcome: review.outcome }),
        });
      }
      toast.success("Call note saved to the clinic record.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Save failed.");
    } finally {
      setSaving(false);
    }
  };

  const scheduleFollowUp = async () => {
    if (!review?.followUpDate || !realClinicId) return;
    setSaving(true);
    try {
      const res = await fetch("/api/follow-ups", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: `Follow up with ${clinic.clinic_name}`,
          clinicId: realClinicId,
          dueDate: review.followUpDate,
          description: review.followUpNotes || review.nextAction,
          taskType: "phone_call",
        }),
      });
      if (!res.ok) throw new Error("Could not schedule follow-up.");
      toast.success("Follow-up scheduled.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Follow-up failed.");
    } finally {
      setSaving(false);
    }
  };

  const createContact = async () => {
    if (!review || !realClinicId) return;
    const parts = review.contactName.trim().split(/\s+/);
    const firstName = parts[0] || "Unknown";
    const lastName = parts.slice(1).join(" ") || "Contact";
    setSaving(true);
    try {
      const res = await fetch(`/api/clinics/${realClinicId}/contacts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          firstName,
          lastName,
          title: review.contactRole,
          email: review.contactEmail,
          contactType: "general_contact",
        }),
      });
      if (!res.ok) throw new Error("Could not create contact.");
      toast.success("Contact created.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Contact failed.");
    } finally {
      setSaving(false);
    }
  };

  const updateClinic = async () => {
    if (!review || !realClinicId) return;
    setSaving(true);
    try {
      const body: Record<string, unknown> = {
        notes: [clinic.notes, review.verifiedDetails, review.notes].filter(Boolean).join("\n"),
      };
      if (review.verifiedClinicFields.phone) body.primaryPhone = review.verifiedClinicFields.phone;
      if (review.contactEmail) body.generalEmail = review.contactEmail;
      const res = await fetch(`/api/clinics/${realClinicId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error("Could not update clinic.");
      toast.success("Clinic updated.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Update failed.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-teal-200 bg-teal-50 px-4 py-2 text-sm text-teal-800">
        Founder Call Copilot — not an autonomous calling agent.
      </div>
      <CallBar
        clinicName={clinic.clinic_name}
        location={clinic.location}
        contactName={clinic.contact_name}
        contactRole={clinic.contact_role}
        phone={clinic.phone}
        goal={goal}
        onGoalChange={setGoal}
        stage={stage}
        elapsedMs={elapsedMs}
        micStatus={micStatus}
        recordingEnabled={recordingEnabled}
        onRecordingChange={setRecordingEnabled}
        consentAcknowledged={consent}
        onConsentChange={setConsent}
        onStart={() => void startCoaching()}
        onPause={pauseCoaching}
        onResume={() => void resumeCoaching()}
        onEnd={() => void endCall()}
        onReset={emergencyReset}
        practice={practice}
        canEnd={micStatus === "listening" || micStatus === "paused" || turns.length > 0}
        analyser={analyser}
        callOn={micStatus === "listening"}
      />
      <div className="grid gap-4 xl:grid-cols-[280px_minmax(0,1fr)_260px]">
        <CallPlanColumn clinic={clinic} prep={prep} onPrepChange={setPrep} />
        <LiveCoachingColumn
          suggestion={suggestion}
          talkingTooLong={metrics.talkingTooLong}
          turns={turns}
          stage={stage}
          onUseAlternate={() => {
            if (!suggestion?.alternate) return;
            setSuggestion({ ...suggestion, say_next: suggestion.alternate, alternate: suggestion.say_next });
          }}
        />
        <div className="flex flex-col gap-4">
          <CallKeypad />
          <CalmRecoveryColumn stage={stage} metrics={metrics} stuck={stuck} onStuck={onStuck} />
        </div>
      </div>
      <PracticeMode
        enabled={practice}
        persona={persona}
        onToggle={(on) => {
          setPractice(on);
          if (on) toast.message("Practice mode — scripted replies only. No outbound calling.");
        }}
        onPersona={setPersona}
        draft={practiceDraft}
        onDraftChange={setPracticeDraft}
        onSend={sendPracticeLine}
      />
      {noteOpen && (
        <div className="flex gap-2">
          <Input
            ref={noteInputRef}
            value={noteDraft}
            onChange={(e) => setNoteDraft(e.target.value)}
            placeholder="Quick note for this call…"
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                setPrep((p) => ({ ...p, notesToRemember: [p.notesToRemember, noteDraft.trim()].filter(Boolean).join("\n") }));
                pushEvent({ at: new Date().toISOString(), type: "note", detail: noteDraft.trim() });
                setNoteDraft("");
                setNoteOpen(false);
              }
            }}
          />
          <Button variant="outline" onClick={() => setNoteOpen(false)}>Close</Button>
        </div>
      )}
      <p className="text-[11px] text-muted-foreground">
        Shortcuts: Space pause/resume · R emergency reset · N note · E end call.
        {clinic.is_seed ? " Using seed clinic Retreat Wellness and MedSpa, PLLC — no invented phone, services, or contacts." : ""}
        {" "}
        <button className="underline hover:text-foreground" onClick={() => navigate("clinics")}>Open clinic database</button>
      </p>
      <PostCallReview
        open={reviewOpen}
        review={review}
        onChange={setReview}
        onClose={() => setReviewOpen(false)}
        onSaveNote={() => void saveCallNote()}
        onScheduleFollowUp={() => void scheduleFollowUp()}
        onCreateContact={() => void createContact()}
        onUpdateClinic={() => void updateClinic()}
        onStartAnother={resetSessionState}
        saving={saving}
        loading={reviewLoading}
        isSeed={clinic.is_seed}
        practice={practice}
      />
    </div>
  );
}
