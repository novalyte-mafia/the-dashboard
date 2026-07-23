"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  PhoneCall,
  PhoneOff,
  Delete,
  Mic,
  MicOff,
  Sparkles,
  Radio,
  BookOpen,
  Plus,
  X,
  Check,
  RotateCcw,
  Compass,
  ListChecks,
  Volume2,
} from "lucide-react";
import { toast } from "sonner";
import { formatPhone } from "@/lib/format";
import { FOUNDER_TALKING_POINTS, FOUNDER_RECOVERY_ACTIONS } from "@/lib/calls/founder-led-script";
import { suggestFromTranscriptContext } from "@/lib/calls/transcript-context";

/* ------------------------------------------------------------------ */
/* Dial keypad                                                         */
/* ------------------------------------------------------------------ */

const KEYPAD_KEYS: Array<{ digit: string; letters: string }> = [
  { digit: "1", letters: "" },
  { digit: "2", letters: "ABC" },
  { digit: "3", letters: "DEF" },
  { digit: "4", letters: "GHI" },
  { digit: "5", letters: "JKL" },
  { digit: "6", letters: "MNO" },
  { digit: "7", letters: "PQRS" },
  { digit: "8", letters: "TUV" },
  { digit: "9", letters: "WXYZ" },
  { digit: "*", letters: "" },
  { digit: "0", letters: "+" },
  { digit: "#", letters: "" },
];

export function DialKeypad({
  onDial,
  disabled,
  hint,
}: {
  onDial: (number: string) => void;
  disabled?: boolean;
  hint?: string;
}) {
  const [value, setValue] = useState("");

  const press = (d: string) => setValue((v) => (v + d).slice(0, 20));

  return (
    <div className="space-y-3">
      <Input
        value={value}
        onChange={(e) => setValue(e.target.value.replace(/[^\d+*#]/g, ""))}
        placeholder="+1 (___) ___-____"
        className="h-11 text-center text-lg font-mono tracking-widest"
      />
      <div className="grid grid-cols-3 gap-2">
        {KEYPAD_KEYS.map((k) => (
          <button
            key={k.digit}
            type="button"
            onClick={() => press(k.digit)}
            className="h-12 rounded-xl border bg-card hover:bg-accent active:scale-95 transition-all flex flex-col items-center justify-center"
          >
            <span className="text-lg font-semibold leading-none">{k.digit}</span>
            {k.letters && (
              <span className="text-[9px] text-muted-foreground tracking-[0.2em]">{k.letters}</span>
            )}
          </button>
        ))}
      </div>
      <div className="flex items-center gap-2">
        <Button
          className="flex-1 h-11 bg-emerald-600 hover:bg-emerald-700 text-white text-sm"
          disabled={disabled || value.replace(/\D/g, "").length < 7}
          onClick={() => onDial(value)}
        >
          <PhoneCall className="size-4 mr-1.5" /> Call
        </Button>
        <Button
          variant="outline"
          className="h-11 px-4"
          onClick={() => setValue((v) => v.slice(0, -1))}
          disabled={!value}
        >
          <Delete className="size-4" />
        </Button>
      </div>
      {hint && <p className="text-[11px] text-muted-foreground text-center">{hint}</p>}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Waveform (local mic visualization)                                  */
/* ------------------------------------------------------------------ */

function Waveform({ analyser, active }: { analyser: AnalyserNode | null; active: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const rafRef = useRef<number>(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const draw = () => {
      const w = canvas.width;
      const h = canvas.height;
      ctx.clearRect(0, 0, w, h);

      if (analyser && active) {
        const data = new Uint8Array(analyser.frequencyBinCount);
        analyser.getByteTimeDomainData(data);
        ctx.lineWidth = 2;
        ctx.strokeStyle = "#059669";
        ctx.beginPath();
        const slice = w / data.length;
        for (let i = 0; i < data.length; i++) {
          const y = (data[i] / 128) * (h / 2);
          if (i === 0) ctx.moveTo(0, y);
          else ctx.lineTo(i * slice, y);
        }
        ctx.stroke();
      } else {
        // Idle flat line
        ctx.lineWidth = 1.5;
        ctx.strokeStyle = "#cbd5e1";
        ctx.beginPath();
        ctx.moveTo(0, h / 2);
        ctx.lineTo(w, h / 2);
        ctx.stroke();
      }
      rafRef.current = requestAnimationFrame(draw);
    };
    rafRef.current = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(rafRef.current);
  }, [analyser, active]);

  return <canvas ref={canvasRef} width={560} height={64} className="w-full h-16 rounded-md bg-slate-950/[0.03] border" />;
}

/* ------------------------------------------------------------------ */
/* Shared mic + AI coach state (used by CallHud and CopilotPanel)      */
/* ------------------------------------------------------------------ */

export type CallAssist = {
  analyser: AnalyserNode | null;
  micOn: boolean;
  coachOn: boolean;
  coachConnecting: boolean;
  transcriptLines: string[];
  suggestion: string | null;
  toggleMic: () => Promise<void>;
  startCoach: () => Promise<void>;
  stopAssist: () => void;
  dismissSuggestion: () => void;
};

export function useCallAssist({
  callActive,
  autoStartCoach = false,
}: {
  callActive: boolean;
  /** When true (personal-phone mode), start Deepgram coach as soon as the session is active. */
  autoStartCoach?: boolean;
}): CallAssist {
  const [micOn, setMicOn] = useState(false);
  const [coachOn, setCoachOn] = useState(false);
  const [coachConnecting, setCoachConnecting] = useState(false);
  const [transcriptLines, setTranscriptLines] = useState<string[]>([]);
  const [suggestion, setSuggestion] = useState<string | null>(null);
  const [analyser, setAnalyser] = useState<AnalyserNode | null>(null);

  const streamRef = useRef<MediaStream | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const suggestionsLogRef = useRef<string[]>([]);
  const transcriptRef = useRef<string[]>([]);

  const stopAssist = useCallback(() => {
    try { recorderRef.current?.stop(); } catch { /* already stopped */ }
    recorderRef.current = null;
    try { wsRef.current?.close(); } catch { /* already closed */ }
    wsRef.current = null;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    void audioCtxRef.current?.close().catch(() => undefined);
    audioCtxRef.current = null;
    setAnalyser(null);
    setMicOn(false);
    setCoachOn(false);
    setCoachConnecting(false);
  }, []);

  const startMic = useCallback(async () => {
    if (streamRef.current) return streamRef.current;
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    streamRef.current = stream;
    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new AudioCtx();
    audioCtxRef.current = ctx;
    if (ctx.state === "suspended") await ctx.resume();
    const source = ctx.createMediaStreamSource(stream);
    const node = ctx.createAnalyser();
    node.fftSize = 1024;
    source.connect(node);
    setAnalyser(node);
    setMicOn(true);
    return stream;
  }, []);

  const toggleMic = useCallback(async () => {
    if (micOn) {
      stopAssist();
      return;
    }
    try {
      await startMic();
    } catch {
      toast.error("Microphone access denied - waveform and AI coach need mic permission.");
    }
  }, [micOn, startMic, stopAssist]);

  const startCoach = useCallback(async () => {
    if (coachOn || coachConnecting) return;
    setCoachConnecting(true);
    try {
      const stream = await startMic();
      const tokenRes = await fetch("/api/copilot/deepgram");
      const tokenData = await tokenRes.json().catch(() => ({}));
      if (!tokenRes.ok || !tokenData.token) {
        throw new Error(tokenData.error || "Deepgram token unavailable.");
      }
      const params = new URLSearchParams({
        model: "nova-2",
        smart_format: "true",
        interim_results: "false",
        endpointing: "400",
      });
      const ws = new WebSocket(`wss://api.deepgram.com/v1/listen?${params}`, ["token", tokenData.token]);
      wsRef.current = ws;

      ws.onopen = () => {
        setCoachOn(true);
        setCoachConnecting(false);
        toast.success("AI coach is listening on your mic — speak normally in this browser.");
        let mimeType = "audio/webm";
        if (!MediaRecorder.isTypeSupported(mimeType)) mimeType = "audio/ogg";
        if (!MediaRecorder.isTypeSupported(mimeType)) mimeType = "";
        const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
        recorderRef.current = recorder;
        recorder.ondataavailable = (e) => {
          if (e.data.size > 0 && ws.readyState === WebSocket.OPEN) ws.send(e.data);
        };
        recorder.start(250);
      };

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(String(event.data));
          const text: string = msg?.channel?.alternatives?.[0]?.transcript ?? "";
          if (!msg?.is_final || !text.trim()) return;
          transcriptRef.current = [...transcriptRef.current, text.trim()].slice(-40);
          setTranscriptLines(transcriptRef.current);
          const result = suggestFromTranscriptContext({
            transcript: transcriptRef.current.join("\n"),
            latestClinicUtterance: text.trim(),
            previousSuggestions: suggestionsLogRef.current.slice(-4),
          });
          suggestionsLogRef.current.push(result.suggestion);
          setSuggestion(result.suggestion);
        } catch {
          /* non-JSON keepalive */
        }
      };

      ws.onerror = () => {
        setCoachConnecting(false);
        setCoachOn(false);
        toast.error("AI coach connection lost.");
      };
      ws.onclose = () => {
        setCoachOn(false);
      };
    } catch (err) {
      setCoachConnecting(false);
      toast.error(err instanceof Error ? err.message : "Could not start the AI coach.");
    }
  }, [coachOn, coachConnecting, startMic]);

  // Auto-arm the mic (waveform) when the call goes active; tear down when it ends.
  // Personal-phone mode also starts the silent coach immediately.
  useEffect(() => {
    if (callActive) {
      void startMic()
        .then(() => {
          if (autoStartCoach) void startCoach();
        })
        .catch(() => undefined);
    } else {
      stopAssist();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [callActive, autoStartCoach]);

  useEffect(() => () => stopAssist(), [stopAssist]);

  return {
    analyser,
    micOn,
    coachOn,
    coachConnecting,
    transcriptLines,
    suggestion,
    toggleMic,
    startCoach,
    stopAssist,
    dismissSuggestion: () => setSuggestion(null),
  };
}

/* ------------------------------------------------------------------ */
/* Call HUD: phone-style status header + waveform + assist controls    */
/* ------------------------------------------------------------------ */

const STATUS_META: Record<string, { label: string; tone: string; pulse: boolean }> = {
  queued: { label: "Queued", tone: "bg-slate-400", pulse: true },
  initiating: { label: "Calling...", tone: "bg-amber-500", pulse: true },
  dialing: { label: "Dialing...", tone: "bg-amber-500", pulse: true },
  ringing: { label: "Ringing...", tone: "bg-amber-500", pulse: true },
  connected: { label: "Connected", tone: "bg-emerald-500", pulse: false },
  active: { label: "Connected", tone: "bg-emerald-500", pulse: false },
  held: { label: "On hold", tone: "bg-sky-500", pulse: true },
  on_hold: { label: "On hold", tone: "bg-sky-500", pulse: true },
  completed: { label: "Call ended", tone: "bg-slate-500", pulse: false },
  ended: { label: "Call ended", tone: "bg-slate-500", pulse: false },
  canceled: { label: "No answer", tone: "bg-rose-500", pulse: false },
  failed: { label: "Failed", tone: "bg-rose-600", pulse: false },
  missed: { label: "Missed", tone: "bg-rose-500", pulse: false },
  voicemail: { label: "Voicemail", tone: "bg-slate-500", pulse: false },
};

/** Mock ringtone / connect chime so dry-runs are not silent. */
function useMockCallAudio(status: string, enabled: boolean) {
  const ctxRef = useRef<AudioContext | null>(null);
  const nodesRef = useRef<Array<OscillatorNode | GainNode>>([]);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stop = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    for (const n of nodesRef.current) {
      try {
        if ("stop" in n) (n as OscillatorNode).stop();
      } catch {
        /* already stopped */
      }
    }
    nodesRef.current = [];
  }, []);

  const ensureCtx = useCallback(async () => {
    if (!ctxRef.current) {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      ctxRef.current = new AudioCtx();
    }
    if (ctxRef.current.state === "suspended") await ctxRef.current.resume();
    return ctxRef.current;
  }, []);

  const beep = useCallback(
    async (freq: number, ms: number, gain = 0.08) => {
      const ctx = await ensureCtx();
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = "sine";
      osc.frequency.value = freq;
      g.gain.value = gain;
      osc.connect(g);
      g.connect(ctx.destination);
      nodesRef.current.push(osc, g);
      osc.start();
      window.setTimeout(() => {
        try { osc.stop(); } catch { /* ignore */ }
      }, ms);
    },
    [ensureCtx],
  );

  useEffect(() => {
    if (!enabled) {
      stop();
      return;
    }
    const ringing = status === "initiating" || status === "dialing" || status === "ringing" || status === "queued";
    const connected = status === "connected" || status === "active";

    stop();
    if (ringing) {
      void beep(440, 220);
      void beep(480, 220);
      intervalRef.current = setInterval(() => {
        void beep(440, 220);
        window.setTimeout(() => void beep(480, 220), 230);
      }, 1800);
    } else if (connected) {
      void beep(660, 120, 0.06);
      window.setTimeout(() => void beep(880, 160, 0.05), 140);
    }

    return () => stop();
  }, [status, enabled, beep, stop]);

  useEffect(() => () => {
    stop();
    void ctxRef.current?.close().catch(() => undefined);
  }, [stop]);
}

export function CallHud({
  clinicName,
  location,
  number,
  status,
  durationLabel,
  isMock,
  isPersonalPhone = false,
  callActive,
  assist,
  ending,
  onEndCall,
}: {
  clinicName: string;
  location: string;
  number: string | null;
  status: string;
  durationLabel: string;
  isMock: boolean;
  /** Founder dials on a real phone; this browser only coaches via mic. */
  isPersonalPhone?: boolean;
  callActive: boolean;
  assist: CallAssist;
  ending?: boolean;
  onEndCall?: () => void;
}) {
  const meta = isPersonalPhone && (status === "connected" || status === "active")
    ? { label: "Personal phone · coaching", tone: "bg-violet-500", pulse: false }
    : STATUS_META[status] ?? { label: status, tone: "bg-slate-400", pulse: false };
  const initials = clinicName
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");

  useMockCallAudio(status, isMock && callActive);

  return (
    <div className="rounded-2xl border bg-gradient-to-b from-slate-950 to-slate-900 text-white p-5">
      <div className="flex items-center gap-4">
        <div className="relative shrink-0">
          <div className="size-14 rounded-full bg-sky-600/90 flex items-center justify-center text-lg font-bold">
            {initials || "?"}
          </div>
          {meta.pulse && (
            <span className={`absolute inset-0 rounded-full ${meta.tone} opacity-40 animate-ping`} />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p className="font-bold text-lg truncate">{clinicName}</p>
          <p className="text-sm text-white/70 truncate">
            {formatPhone(number)} {location ? `- ${location}` : ""}
          </p>
        </div>
        <div className="text-right shrink-0">
          <span className="inline-flex items-center gap-1.5 text-sm font-semibold">
            <span className={`size-2.5 rounded-full ${meta.tone} ${meta.pulse ? "animate-pulse" : ""}`} />
            {meta.label}
            {isMock ? " (mock)" : ""}
          </span>
          <p className="font-mono text-2xl tabular-nums mt-0.5">{durationLabel}</p>
        </div>
      </div>

      <div className="mt-4">
        <Waveform analyser={assist.analyser} active={assist.micOn && callActive} />
      </div>

      {callActive && (
        <div className="mt-4 flex justify-center">
          <Button
            size="lg"
            className="h-12 px-8 rounded-full bg-rose-600 hover:bg-rose-700 text-white text-sm font-bold shadow-lg"
            disabled={ending}
            onClick={onEndCall}
          >
            <PhoneOff className="size-4 mr-2" />
            {ending ? "Ending..." : isPersonalPhone ? "End coaching session" : "End call"}
          </Button>
        </div>
      )}

      <div className="mt-3 flex items-center gap-2 flex-wrap">
        <Button
          size="sm"
          variant="secondary"
          className={`h-8 text-xs ${assist.micOn ? "bg-emerald-600 hover:bg-emerald-700 text-white" : "bg-white/10 hover:bg-white/20 text-white"}`}
          onClick={() => void assist.toggleMic()}
        >
          {assist.micOn ? <Mic className="size-3.5 mr-1" /> : <MicOff className="size-3.5 mr-1" />}
          {assist.micOn ? "Mic monitor on" : "Enable mic monitor"}
        </Button>
        <Button
          size="sm"
          variant="secondary"
          className={`h-8 text-xs ${assist.coachOn ? "bg-violet-600 hover:bg-violet-700 text-white" : "bg-white/10 hover:bg-white/20 text-white"}`}
          disabled={assist.coachConnecting || !callActive}
          onClick={() => (assist.coachOn ? assist.stopAssist() : void assist.startCoach())}
        >
          <Sparkles className="size-3.5 mr-1" />
          {assist.coachConnecting ? "Connecting..." : assist.coachOn ? "AI coach listening" : "Start AI coach"}
        </Button>
      </div>

      <div className="mt-3 rounded-lg bg-white/5 border border-white/10 p-2.5 text-[11px] text-white/70 flex items-start gap-2">
        <Volume2 className="size-3.5 mt-0.5 shrink-0 text-amber-300" />
        {isMock ? (
          <span>
            Mock mode has no real phone audio. You should hear a simulated ringtone in this browser
            while it says Ringing, then a short connect chime. Unmute your speakers.
          </span>
        ) : isPersonalPhone ? (
          <span>
            Dial on your personal phone. Keep this tab open. Put the call on speaker near the laptop
            mic (or use earbuds for you). Coach cues stay on screen — mute laptop speakers so the
            clinic never hears the AI.
          </span>
        ) : (
          <span>
            Audio is in this browser — allow mic access, unmute speakers, and speak here. This screen
            is also your cue card, copilot, and CRM. End the call with the hang-up control above.
          </span>
        )}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Copilot panel: your own points, one lane at a time                  */
/* ------------------------------------------------------------------ */

type MyPoint = {
  id: string;
  text: string;
  done: boolean;
};

const MY_POINTS_STORAGE_KEY = "founder-my-points-v1";

function loadMyPoints(): MyPoint[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(MY_POINTS_STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter((p) => p && typeof p.text === "string") : [];
  } catch {
    return [];
  }
}

export function CopilotPanel({
  assist,
  callActive,
}: {
  assist: CallAssist;
  callActive: boolean;
}) {
  const [points, setPoints] = useState<MyPoint[]>([]);
  const [draft, setDraft] = useState("");
  const [scriptIndex, setScriptIndex] = useState(0);
  const [recoveryLine, setRecoveryLine] = useState<string | null>(null);
  const [flash, setFlash] = useState(false);
  const loadedRef = useRef(false);
  const prevActiveRef = useRef(false);

  useEffect(() => {
    setPoints(loadMyPoints());
    loadedRef.current = true;
  }, []);

  useEffect(() => {
    if (!loadedRef.current) return;
    try {
      window.localStorage.setItem(MY_POINTS_STORAGE_KEY, JSON.stringify(points));
    } catch {
      /* storage full or blocked */
    }
  }, [points]);

  // New call: reset progress so the lane starts from your first point.
  useEffect(() => {
    if (callActive && !prevActiveRef.current) {
      setPoints((prev) => prev.map((p) => ({ ...p, done: false })));
      setScriptIndex(0);
      setRecoveryLine(null);
    }
    prevActiveRef.current = callActive;
  }, [callActive]);

  const pendingPoints = points.filter((p) => !p.done);
  const currentPoint = pendingPoints[0] ?? null;
  const scriptStep = FOUNDER_TALKING_POINTS[scriptIndex];

  const lane = useMemo(() => {
    if (recoveryLine) {
      return { source: "Get back on track", text: recoveryLine, isRecovery: true };
    }
    if (currentPoint) {
      const position = points.filter((p) => p.done).length + 1;
      return {
        source: `Your point ${position} of ${points.length}`,
        text: currentPoint.text,
        isRecovery: false,
      };
    }
    return {
      source: `Script - ${scriptStep?.label ?? ""}`,
      text: scriptStep?.line ?? "",
      isRecovery: false,
    };
  }, [recoveryLine, currentPoint, points, scriptStep]);

  const triggerFlash = () => {
    setFlash(true);
    window.setTimeout(() => setFlash(false), 900);
  };

  const madeIt = () => {
    setRecoveryLine(null);
    if (currentPoint) {
      setPoints((prev) => prev.map((p) => (p.id === currentPoint.id ? { ...p, done: true } : p)));
      const remaining = pendingPoints.length - 1;
      if (remaining === 0) toast.success("All your points made. Script takes over from here.");
      return;
    }
    setScriptIndex((i) => Math.min(FOUNDER_TALKING_POINTS.length - 1, i + 1));
  };

  const goBack = () => {
    setRecoveryLine(null);
    const doneOnes = points.filter((p) => p.done);
    if (doneOnes.length > 0 && currentPoint !== null) {
      const last = doneOnes[doneOnes.length - 1];
      setPoints((prev) => prev.map((p) => (p.id === last.id ? { ...p, done: false } : p)));
      return;
    }
    if (doneOnes.length > 0 && currentPoint === null && scriptIndex === 0) {
      const last = doneOnes[doneOnes.length - 1];
      setPoints((prev) => prev.map((p) => (p.id === last.id ? { ...p, done: false } : p)));
      return;
    }
    setScriptIndex((i) => Math.max(0, i - 1));
  };

  const addPoint = () => {
    const text = draft.trim();
    if (!text) return;
    setPoints((prev) => [
      ...prev,
      { id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, text, done: false },
    ]);
    setDraft("");
  };

  return (
    <div className="space-y-3">
      {/* CURRENT LANE */}
      <div
        className={`rounded-xl border-2 p-4 transition-all ${
          lane.isRecovery
            ? "border-amber-400 bg-amber-50"
            : "border-emerald-400 bg-emerald-50"
        } ${flash ? "ring-4 ring-emerald-300" : ""}`}
      >
        <p className="text-[11px] font-bold uppercase tracking-wide text-emerald-900 flex items-center gap-1 mb-1.5">
          <Compass className="size-3.5" /> Say this now - {lane.source}
        </p>
        <p className="text-lg leading-relaxed font-semibold text-slate-900">{lane.text}</p>
        <p className="text-[11px] text-muted-foreground mt-2">
          Finish this point all the way before you move. Don&apos;t jump.
        </p>
        <div className="flex items-center gap-1.5 mt-3 flex-wrap">
          <Button
            size="sm"
            className="h-8 text-xs bg-emerald-600 hover:bg-emerald-700 text-white"
            onClick={madeIt}
          >
            <Check className="size-3.5 mr-1" /> Made it - next
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="h-8 text-xs bg-white"
            onClick={() => {
              triggerFlash();
              toast.info(`Stay on: ${lane.text.slice(0, 80)}`);
            }}
          >
            Stay here
          </Button>
          <Button size="sm" variant="ghost" className="h-8 text-xs" onClick={goBack}>
            <RotateCcw className="size-3.5 mr-1" /> Back
          </Button>
        </div>
      </div>

      {/* I DRIFTED */}
      <div className="rounded-lg border bg-amber-50/50 p-3 space-y-1.5">
        <p className="text-[11px] font-bold uppercase text-amber-900">I drifted - rescue me</p>
        <div className="flex flex-wrap gap-1.5">
          {FOUNDER_RECOVERY_ACTIONS.map((r) => (
            <Button
              key={r.id}
              variant="outline"
              size="sm"
              className="h-7 text-[11px] bg-white"
              onClick={() => setRecoveryLine(r.line)}
            >
              {r.label}
            </Button>
          ))}
          {recoveryLine && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-[11px]"
              onClick={() => setRecoveryLine(null)}
            >
              Back to my lane
            </Button>
          )}
        </div>
      </div>

      {/* AI POINTER */}
      {assist.coachOn && assist.suggestion && (
        <div className="rounded-lg border-2 border-violet-300 bg-violet-50 p-3">
          <p className="text-[11px] font-bold uppercase text-violet-800 flex items-center gap-1 mb-1">
            <Sparkles className="size-3.5" /> AI pointer - they just said something
          </p>
          <p className="text-sm font-medium text-slate-900">{assist.suggestion}</p>
          <Button
            variant="ghost"
            size="sm"
            className="h-6 text-[11px] mt-1.5 px-2"
            onClick={assist.dismissSuggestion}
          >
            <X className="size-3 mr-1" /> Dismiss
          </Button>
        </div>
      )}

      {/* MY POINTS */}
      <Card className="p-3 space-y-2">
        <p className="text-[11px] font-bold uppercase text-muted-foreground flex items-center gap-1">
          <ListChecks className="size-3.5" /> My points - write them before the call
        </p>
        <div className="flex items-center gap-1.5">
          <Input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") addPoint();
            }}
            placeholder="A point I want to make..."
            className="h-8 text-xs"
          />
          <Button size="sm" className="h-8 px-2.5" onClick={addPoint} disabled={!draft.trim()}>
            <Plus className="size-3.5" />
          </Button>
        </div>
        {points.length === 0 && (
          <p className="text-[11px] text-muted-foreground">
            No points yet. Write the things you want to say in your own words - the copilot walks you through
            them one at a time.
          </p>
        )}
        <div className="space-y-1">
          {points.map((p) => (
            <div
              key={p.id}
              className={`flex items-start gap-2 text-xs rounded-md border p-2 ${
                currentPoint?.id === p.id
                  ? "border-emerald-400 bg-emerald-50/60"
                  : p.done
                    ? "opacity-50"
                    : ""
              }`}
            >
              <input
                type="checkbox"
                className="mt-0.5"
                checked={p.done}
                onChange={(e) =>
                  setPoints((prev) =>
                    prev.map((x) => (x.id === p.id ? { ...x, done: e.target.checked } : x)),
                  )
                }
              />
              <span className={`flex-1 ${p.done ? "line-through" : ""}`}>{p.text}</span>
              {currentPoint?.id === p.id && (
                <span className="text-[10px] font-bold text-emerald-700 shrink-0">NOW</span>
              )}
              <button
                type="button"
                className="text-muted-foreground hover:text-rose-600 shrink-0"
                onClick={() => setPoints((prev) => prev.filter((x) => x.id !== p.id))}
              >
                <X className="size-3.5" />
              </button>
            </div>
          ))}
        </div>
        {points.length > 0 && (
          <Button
            variant="ghost"
            size="sm"
            className="h-6 text-[11px] px-2"
            onClick={() => setPoints((prev) => prev.map((p) => ({ ...p, done: false })))}
          >
            <RotateCcw className="size-3 mr-1" /> Reset for next call
          </Button>
        )}
      </Card>

      {/* SCRIPT GUIDE */}
      <Card className="p-3 space-y-1.5">
        <p className="text-[11px] font-bold uppercase text-muted-foreground flex items-center gap-1">
          <BookOpen className="size-3.5" /> Script guide (after your points)
        </p>
        {FOUNDER_TALKING_POINTS.map((tp, i) => (
          <button
            key={tp.id}
            type="button"
            onClick={() => {
              setScriptIndex(i);
              setRecoveryLine(null);
            }}
            className={`w-full text-left text-[11px] rounded-md border p-2 transition-colors ${
              !currentPoint && !recoveryLine && i === scriptIndex
                ? "border-emerald-400 bg-emerald-50/60"
                : "hover:bg-accent/40"
            }`}
          >
            <span className="font-semibold block">{tp.label}</span>
            <span className="text-muted-foreground line-clamp-2">{tp.line}</span>
          </button>
        ))}
      </Card>

      {/* LIVE TRANSCRIPT */}
      {assist.coachOn && (
        <Card className="p-3">
          <p className="text-[11px] font-bold uppercase text-muted-foreground flex items-center gap-1 mb-1.5">
            <Radio className="size-3 text-violet-600 animate-pulse" /> Live transcript (mic)
          </p>
          <div className="max-h-28 overflow-y-auto space-y-0.5">
            {assist.transcriptLines.length === 0 && (
              <p className="text-xs text-muted-foreground">Listening...</p>
            )}
            {assist.transcriptLines.slice(-8).map((line, i) => (
              <p key={i} className="text-xs text-slate-700">{line}</p>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
