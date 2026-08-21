"use client";

import { CallWaveform } from "./call-audio";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { formatDuration } from "@/lib/cold-trainer/metrics";
import { CALL_GOALS, type CallGoal, type CoachStage, type MicStatus } from "@/lib/cold-trainer/types";
import { formatPhone } from "@/lib/format";
import { AlertTriangle, Mic, MicOff, Pause, PhoneOff, Play, RotateCcw } from "lucide-react";

const STAGE_LABEL: Record<CoachStage, string> = {
  opening: "Opening",
  routing: "Opening",
  relevance: "Discovery",
  discovery: "Discovery",
  objection: "Objection",
  ask: "Ask",
  wrap_up: "Wrap-up",
  reset: "Paused",
};

function micLabel(status: MicStatus): string {
  switch (status) {
    case "idle":
      return "Mic ready";
    case "ready":
      return "Mic ready";
    case "connecting":
      return "Connecting";
    case "listening":
      return "Listening";
    case "paused":
      return "Paused";
    default: {
      const _exhaustive: never = status;
      return _exhaustive;
    }
  }
}

export function CallBar({
  clinicName,
  location,
  contactName,
  contactRole,
  phone,
  goal,
  onGoalChange,
  stage,
  elapsedMs,
  micStatus,
  recordingEnabled,
  onRecordingChange,
  consentAcknowledged,
  onConsentChange,
  onStart,
  onPause,
  onResume,
  onEnd,
  onReset,
  practice,
  canEnd,
  analyser,
  callOn,
}: {
  clinicName: string;
  location: string;
  contactName: string;
  contactRole: string;
  phone: string;
  goal: CallGoal;
  onGoalChange: (goal: CallGoal) => void;
  stage: CoachStage;
  elapsedMs: number;
  micStatus: MicStatus;
  recordingEnabled: boolean;
  onRecordingChange: (on: boolean) => void;
  consentAcknowledged: boolean;
  onConsentChange: (on: boolean) => void;
  onStart: () => void;
  onPause: () => void;
  onResume: () => void;
  onEnd: () => void;
  onReset: () => void;
  practice: boolean;
  canEnd: boolean;
  analyser: AnalyserNode | null;
  callOn: boolean;
}) {
  const listening = micStatus === "listening";
  const paused = micStatus === "paused";
  const connecting = micStatus === "connecting";

  return (
    <Card className="sticky top-0 z-20 gap-0 p-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="min-w-[180px] flex-1">
          <p className="text-sm font-semibold">{clinicName}</p>
          <p className="text-xs text-muted-foreground">
            {location || "Location unknown"}
            {contactName ? ` · ${contactName}${contactRole ? ` · ${contactRole}` : ""}` : " · No contact on file"}
          </p>
        </div>
        <div className="text-xs text-muted-foreground">{phone ? formatPhone(phone) : "No phone on file"}</div>
        <Select value={goal} onValueChange={(v) => onGoalChange(v as CallGoal)}>
          <SelectTrigger className="h-8 w-[190px] text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {CALL_GOALS.map((g) => (
              <SelectItem key={g} value={g}>{g}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Badge className="border-teal-200 bg-teal-50 text-teal-800">{STAGE_LABEL[stage]}</Badge>
        <div className="font-mono text-sm tabular-nums">{formatDuration(elapsedMs)}</div>
        <Badge
          variant="secondary"
          className={
            listening
              ? "bg-teal-600 text-white"
              : paused
                ? "bg-amber-100 text-amber-800 border border-amber-200"
                : "bg-muted text-muted-foreground"
          }
        >
          {listening ? <Mic className="size-3" /> : <MicOff className="size-3" />}
          {micLabel(micStatus)}
        </Badge>
        {!listening && !paused && (
          <Button size="sm" onClick={onStart} disabled={!consentAcknowledged || connecting}>
            {connecting ? "Starting…" : practice ? "Start Practice" : "Start Coaching"}
          </Button>
        )}
        {listening && (
          <Button size="sm" variant="outline" onClick={onPause}><Pause className="size-4" /> Pause</Button>
        )}
        {paused && (
          <Button size="sm" onClick={onResume}><Play className="size-4" /> Resume</Button>
        )}
        <Button size="sm" variant="destructive" onClick={onEnd} disabled={!canEnd}>
          <PhoneOff className="size-4" /> End Call
        </Button>
        <Button size="sm" variant="outline" className="text-amber-700 border-amber-200" onClick={onReset}>
          <RotateCcw className="size-4" /> Emergency Reset
        </Button>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-4 border-t border-border/70 pt-3 text-xs text-muted-foreground">
        <label className="flex items-center gap-2">
          <Switch checked={consentAcknowledged} onCheckedChange={onConsentChange} />
          I understand transcription starts only after Start Coaching.
        </label>
        <label className="flex items-center gap-2">
          <Switch checked={recordingEnabled} onCheckedChange={onRecordingChange} disabled={listening} />
          Optional recording (separate, default off)
        </label>
        {practice && <Badge variant="outline" className="border-teal-200 text-teal-800">Practice — no outbound call</Badge>}
        <span className="inline-flex items-center gap-1 text-amber-700">
          <AlertTriangle className="size-3" />
          Make sure you comply with applicable call-recording and consent laws before enabling live transcription or recording.
        </span>
      </div>
      <div className="mt-3 border-t border-border/70 pt-3">
        <CallWaveform analyser={analyser} active={callOn} />
      </div>
    </Card>
  );
}
