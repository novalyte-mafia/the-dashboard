"use client";

import { useEffect, useState } from "react";
import { SectionCard } from "@/components/admin/shared";
import { Button } from "@/components/ui/button";
import { recoveryLineForStage, RESET_LINE } from "@/lib/cold-trainer/fallbacks";
import { formatDuration } from "@/lib/cold-trainer/metrics";
import type { CoachStage, TalkListenMetrics } from "@/lib/cold-trainer/types";
import { Wind } from "lucide-react";
import { cn } from "@/lib/utils";

export function CalmRecoveryColumn({
  stage,
  metrics,
  stuck,
  onStuck,
  recoveryOverride,
}: {
  stage: CoachStage;
  metrics: TalkListenMetrics;
  stuck: boolean;
  onStuck: () => void;
  recoveryOverride?: string;
}) {
  const line = recoveryOverride || recoveryLineForStage(stage);

  return (
    <div className="flex flex-col gap-4">
      <SectionCard title="Founder reset" bodyClassName="p-4">
        <Button className="w-full" variant={stuck ? "secondary" : "outline"} onClick={onStuck}>
          <Wind className="size-4" /> I’m stuck
        </Button>
        {stuck && (
          <div className="mt-3 space-y-3">
            <p className="text-sm text-teal-800">{RESET_LINE}</p>
            <BreathTimer />
            <p className="text-sm font-medium">{line}</p>
          </div>
        )}
      </SectionCard>
      <SectionCard title="Supportive metrics" bodyClassName="p-4">
        <Metric label="Talk / listen" value={metrics.talkListenLabel} warn={metrics.talkingTooLong} />
        <Metric label="Longest monologue" value={formatDuration(metrics.longestFounderMonologueMs)} warn={metrics.longestFounderMonologueMs > 18000} />
        <Metric label="Questions asked" value={String(metrics.questionCount)} />
        <Metric label="Interruptions" value={String(metrics.interruptionCount)} />
        <Metric label="Pace" value={metrics.wordsPerMinute ? `${metrics.wordsPerMinute} WPM` : "—"} warn={metrics.wordsPerMinute > 170} />
        <Metric label="Filler words" value={String(metrics.fillerCount)} />
        <Metric label="Silences > 4s" value={String(metrics.silenceOver4sCount)} />
        <p className={cn("mt-3 text-sm", metrics.talkingTooLong ? "font-semibold text-amber-700" : "text-teal-700")}>
          {metrics.supportiveCue}
        </p>
      </SectionCard>
    </div>
  );
}

function Metric({ label, value, warn }: { label: string; value: string; warn?: boolean }) {
  return (
    <div className="flex items-start justify-between gap-2 border-b border-border/60 py-1.5 text-xs last:border-0">
      <span className="text-muted-foreground">{label}</span>
      <span className={cn("text-right", warn && "text-amber-700")}>{value}</span>
    </div>
  );
}

function BreathTimer() {
  const [phase, setPhase] = useState<"in" | "out">("in");
  const [left, setLeft] = useState(4);

  useEffect(() => {
    const tick = window.setInterval(() => {
      setLeft((n) => {
        if (n <= 1) {
          setPhase((p) => (p === "in" ? "out" : "in"));
          return 0;
        }
        return n - 1;
      });
    }, 1000);
    return () => window.clearInterval(tick);
  }, []);

  useEffect(() => {
    setLeft(phase === "in" ? 4 : 6);
  }, [phase]);

  return (
    <div className="rounded-lg border border-teal-200 bg-teal-50/70 p-3 text-center">
      <div
        className={cn(
          "mx-auto mb-2 size-16 rounded-full border-2 border-teal-600 transition-transform duration-1000",
          phase === "in" ? "scale-110" : "scale-90",
        )}
      />
      <p className="text-sm text-teal-800">{phase === "in" ? "Inhale" : "Exhale"} · {left}s</p>
    </div>
  );
}
