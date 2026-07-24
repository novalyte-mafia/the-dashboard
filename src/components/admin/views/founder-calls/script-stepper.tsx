"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  FOUNDER_TALKING_POINTS,
  FOUNDER_RECOVERY_ACTIONS,
  FOUNDER_QUICK_RESPONSES,
} from "@/lib/calls/founder-led-script";
import { toast } from "sonner";

function copyLine(line: string) {
  void navigator.clipboard?.writeText(line).then(
    () => toast.success("Copied — say it on this call"),
    () => toast.message(line),
  );
}

function personalize(template: string, vars: Record<string, string | null | undefined>) {
  let out = template;
  // Prefer clinic-specific opener replacements without broken undefined language
  if (vars.personalizedOpening && template === FOUNDER_TALKING_POINTS[0]?.line) {
    return vars.personalizedOpening;
  }
  if (vars.decisionMakerOpening && template === FOUNDER_TALKING_POINTS[3]?.line) {
    return vars.decisionMakerOpening;
  }
  out = out
    .replace(/\byour clinic\b/gi, vars.clinicName || "your clinic")
    .replace(/\bMiami area\b/gi, vars.primaryCity ? `${vars.primaryCity} area` : "Miami area");
  return out;
}

export function ScriptStepper({
  clinicName,
  personalizedOpening,
  decisionMakerOpening,
  primaryCity,
}: {
  compact?: boolean;
  clinicName?: string;
  personalizedOpening?: string | null;
  decisionMakerOpening?: string | null;
  primaryCity?: string | null;
}) {
  const [step, setStep] = useState(0);
  const [showFull, setShowFull] = useState(false);
  const [rescue, setRescue] = useState<string | null>(null);

  useEffect(() => {
    setStep(0);
  }, [clinicName]);

  const vars = {
    clinicName,
    personalizedOpening,
    decisionMakerOpening,
    primaryCity,
  };

  const current = FOUNDER_TALKING_POINTS[step] ?? FOUNDER_TALKING_POINTS[0];
  const line = personalize(current.line, vars);
  const total = FOUNDER_TALKING_POINTS.length;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
          Script · Step {step + 1} of {total}
        </p>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-7 text-[11px]"
          onClick={() => setShowFull((v) => !v)}
        >
          {showFull ? "Hide full script" : "Show full script"}
        </Button>
      </div>

      <div className="rounded-lg border border-emerald-200 bg-emerald-50/60 p-3 space-y-2">
        <p className="text-xs font-semibold text-emerald-950">{current.label}</p>
        <p className="text-sm leading-relaxed text-emerald-950">{line}</p>
        <p className="text-[11px] text-emerald-800/80">
          Purpose: move the call forward without pitching paid services.
        </p>
      </div>

      <div className="flex flex-wrap gap-1.5">
        <Button
          type="button"
          size="sm"
          className="h-8 bg-emerald-700 hover:bg-emerald-800 text-white"
          disabled={step >= total - 1}
          onClick={() => setStep((s) => Math.min(total - 1, s + 1))}
        >
          Made it — Next
        </Button>
        <Button type="button" size="sm" variant="outline" className="h-8" onClick={() => copyLine(line)}>
          Stay here / Copy
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="h-8"
          disabled={step <= 0}
          onClick={() => setStep((s) => Math.max(0, s - 1))}
        >
          Back
        </Button>
        {FOUNDER_RECOVERY_ACTIONS.map((action) => (
          <Button
            key={action.id}
            type="button"
            size="sm"
            variant="outline"
            className="h-8"
            onClick={() => {
              setRescue(action.line);
              copyLine(action.line);
            }}
          >
            {action.label}
          </Button>
        ))}
      </div>

      {rescue && (
        <p className="text-xs rounded border border-amber-200 bg-amber-50 p-2 text-amber-950">{rescue}</p>
      )}

      <div className="space-y-1">
        <p className="text-[10px] font-bold uppercase text-muted-foreground">Quick responses</p>
        <div className="grid grid-cols-1 gap-1 max-h-40 overflow-y-auto">
          {FOUNDER_QUICK_RESPONSES.slice(0, showFull ? undefined : 6).map((qr) => (
            <button
              key={qr.id}
              type="button"
              className="text-left text-[11px] border rounded-md px-2 py-1.5 hover:bg-accent/50"
              onClick={() => {
                setRescue(qr.line);
                copyLine(qr.line);
              }}
            >
              <span className="font-semibold block">{qr.trigger}</span>
              <span className="text-muted-foreground line-clamp-1">{qr.line}</span>
            </button>
          ))}
        </div>
      </div>

      {showFull && (
        <div className="border rounded-lg p-3 space-y-2 max-h-64 overflow-y-auto">
          {FOUNDER_TALKING_POINTS.map((tp, idx) => (
            <button
              key={tp.id}
              type="button"
              className={`block w-full text-left text-xs rounded p-2 ${
                idx === step ? "bg-emerald-50 border border-emerald-200" : "hover:bg-accent/40"
              }`}
              onClick={() => setStep(idx)}
            >
              <span className="font-semibold">{tp.label}</span>
              <span className="block text-muted-foreground mt-0.5">{personalize(tp.line, vars)}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
