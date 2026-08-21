"use client";

import { useEffect, useRef, useState } from "react";
import { SectionCard } from "@/components/admin/shared";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { CONVERSATION_MAP, type CoachStage, type CoachSuggestion, type TranscriptTurn } from "@/lib/cold-trainer/types";
import { Copy, Pause, Play } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

function mapHighlight(stage: CoachStage): string {
  switch (stage) {
    case "opening":
      return "opening";
    case "routing":
      return "routing";
    case "relevance":
      return "relevance";
    case "discovery":
      return "discovery";
    case "objection":
      return "ask";
    case "ask":
      return "ask";
    case "wrap_up":
      return "wrap_up";
    case "reset":
      return "opening";
    default: {
      const _exhaustive: never = stage;
      return _exhaustive;
    }
  }
}

export function LiveCoachingColumn({
  suggestion,
  talkingTooLong,
  turns,
  stage,
  onUseAlternate,
}: {
  suggestion: CoachSuggestion | null;
  talkingTooLong: boolean;
  turns: TranscriptTurn[];
  stage: CoachStage;
  onUseAlternate: () => void;
}) {
  const [pauseScroll, setPauseScroll] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const current = mapHighlight(stage);
  const currentIdx = CONVERSATION_MAP.findIndex((s) => s.id === current);

  useEffect(() => {
    if (!pauseScroll) bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [turns, pauseScroll]);

  const copy = async () => {
    if (!suggestion?.say_next) return;
    await navigator.clipboard.writeText(suggestion.say_next);
    toast.success("Copied — say this next.");
  };

  return (
    <div className="flex min-h-0 flex-col gap-4">
      <Card className={cn(
        "gap-0 p-5",
        talkingTooLong ? "border-amber-200 bg-amber-50/60" : "border-teal-200 bg-teal-50/50",
      )}>
        <p className={cn(
          "mb-2 text-[11px] font-semibold uppercase tracking-wide",
          talkingTooLong ? "text-amber-700" : "text-teal-700",
        )}>
          Say this next
        </p>
        {talkingTooLong && (
          <p className="mb-2 text-sm font-semibold text-amber-700">Stop here. Ask a question.</p>
        )}
        <p className="text-2xl font-semibold leading-snug tracking-tight md:text-[28px]">
          {suggestion?.say_next || "Click Start Coaching when you are on the call. Then glance here."}
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Button size="sm" variant="secondary" onClick={copy} disabled={!suggestion}><Copy className="size-4" /> Copy</Button>
          {suggestion?.alternate && (
            <Button size="sm" variant="outline" onClick={onUseAlternate}>Alternate phrase</Button>
          )}
        </div>
        {suggestion && (
          <div className="mt-4 grid gap-2 text-xs text-muted-foreground md:grid-cols-2">
            <div><span className="font-medium text-foreground/70">Why this works: </span>{suggestion.reason}</div>
            <div><span className="font-medium text-foreground/70">Delivery: </span>{suggestion.delivery_cue}</div>
            <div><span className="font-medium text-foreground/70">Tone: </span>{suggestion.tone ?? "Calm"}</div>
            <div><span className="font-medium text-foreground/70">Next: </span>{suggestion.next_action.replaceAll("_", " ")}</div>
          </div>
        )}
      </Card>

      <SectionCard
        title="Live conversation"
        action={
          <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setPauseScroll((v) => !v)}>
            {pauseScroll ? <Play className="size-3" /> : <Pause className="size-3" />}
            {pauseScroll ? "Resume scroll" : "Pause scroll"}
          </Button>
        }
        bodyClassName="p-0"
      >
        <div className="h-[240px] space-y-2 overflow-y-auto px-4 py-3 nv-scroll">
          {turns.length === 0 && <p className="text-xs text-muted-foreground">No transcript yet. Nothing is invented.</p>}
          {turns.map((t) => (
            <div key={t.id} className={cn("rounded-md px-2.5 py-1.5 text-sm", speakerClass(t))}>
              <span className="mr-2 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">{labelFor(t)}</span>
              {t.text}
            </div>
          ))}
          <div ref={bottomRef} />
        </div>
      </SectionCard>

      <SectionCard title="Conversation map" bodyClassName="p-4">
        <div className="flex flex-wrap gap-2">
          {CONVERSATION_MAP.map((step, idx) => (
            <Badge
              key={step.id}
              variant={step.id === current ? "default" : "outline"}
              className={
                step.id === current
                  ? ""
                  : idx === currentIdx + 1
                    ? "border-teal-200 bg-teal-50 text-teal-800"
                    : "text-muted-foreground"
              }
            >
              {idx + 1}. {step.label}
            </Badge>
          ))}
        </div>
        {currentIdx >= 0 && currentIdx < CONVERSATION_MAP.length - 1 && (
          <p className="mt-2 text-xs text-muted-foreground">Next: {CONVERSATION_MAP[currentIdx + 1].label}</p>
        )}
      </SectionCard>
    </div>
  );
}

function labelFor(turn: TranscriptTurn): string {
  if (turn.speaker === "founder") return "Founder";
  if (turn.speaker === "prospect" && turn.confident) return "Prospect";
  return "Unknown";
}

function speakerClass(turn: TranscriptTurn): string {
  if (turn.speaker === "founder") return "bg-muted/70";
  if (turn.speaker === "prospect" && turn.confident) return "bg-sky-50 text-sky-950";
  return "bg-muted/40 text-muted-foreground";
}
