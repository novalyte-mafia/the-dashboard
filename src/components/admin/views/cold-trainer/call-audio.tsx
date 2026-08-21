"use client";

import { useEffect, useRef, useState } from "react";
import { SectionCard } from "@/components/admin/shared";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Delete } from "lucide-react";

const KEYS = [
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
] as const;

const DTMF: Record<string, [number, number]> = {
  "1": [697, 1209],
  "2": [697, 1336],
  "3": [697, 1477],
  "4": [770, 1209],
  "5": [770, 1336],
  "6": [770, 1477],
  "7": [852, 1209],
  "8": [852, 1336],
  "9": [852, 1477],
  "*": [941, 1209],
  "0": [941, 1336],
  "#": [941, 1477],
};

function playDtmf(digit: string) {
  const pair = DTMF[digit];
  if (!pair || typeof window === "undefined") return;
  const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  const ctx = new AudioCtx();
  const gain = ctx.createGain();
  gain.gain.value = 0.08;
  gain.connect(ctx.destination);
  for (const freq of pair) {
    const osc = ctx.createOscillator();
    osc.type = "sine";
    osc.frequency.value = freq;
    osc.connect(gain);
    osc.start();
    osc.stop(ctx.currentTime + 0.12);
  }
  window.setTimeout(() => void ctx.close(), 200);
}

export function CallWaveform({ analyser, active }: { analyser: AnalyserNode | null; active: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const rafRef = useRef(0);

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
        ctx.strokeStyle = "#0f766e";
        ctx.beginPath();
        const slice = w / data.length;
        for (let i = 0; i < data.length; i += 1) {
          const y = (data[i] / 128) * (h / 2);
          if (i === 0) ctx.moveTo(0, y);
          else ctx.lineTo(i * slice, y);
        }
        ctx.stroke();
      } else {
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

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Call audio</p>
        <span className={cn("text-[11px] font-medium", active ? "text-teal-700" : "text-muted-foreground")}>
          {active ? "Call on — listening" : "Idle"}
        </span>
      </div>
      <canvas
        ref={canvasRef}
        width={720}
        height={64}
        className={cn(
          "h-14 w-full rounded-md border",
          active ? "border-teal-200 bg-teal-50/40" : "bg-muted/40",
        )}
      />
    </div>
  );
}

export function CallKeypad() {
  const [digits, setDigits] = useState("");

  const press = (digit: string) => {
    setDigits((prev) => (prev + digit).slice(-24));
    playDtmf(digit);
  };

  return (
    <SectionCard
      title="Keypad"
      description="For IVR while you are already on the call. Does not place a call."
      action={
        <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setDigits("")} disabled={!digits}>
          <Delete className="size-3.5" /> Clear
        </Button>
      }
      bodyClassName="p-4"
    >
      <div className="mb-3 rounded-md border bg-muted/40 px-3 py-2 font-mono text-sm tracking-[0.2em] min-h-9">
        {digits || <span className="tracking-normal text-muted-foreground">Enter extension or menu key</span>}
      </div>
      <div className="grid grid-cols-3 gap-2">
        {KEYS.map((key) => (
          <button
            key={key.digit}
            type="button"
            onClick={() => press(key.digit)}
            className="flex h-12 flex-col items-center justify-center rounded-lg border bg-background text-sm font-semibold hover:bg-accent hover:border-primary/40 active:bg-primary/10 transition-colors"
          >
            <span>{key.digit}</span>
            {key.letters ? <span className="text-[9px] font-medium tracking-widest text-muted-foreground">{key.letters}</span> : null}
          </button>
        ))}
      </div>
    </SectionCard>
  );
}
