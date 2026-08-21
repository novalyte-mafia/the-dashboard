"use client";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import type { PracticePersonaId } from "@/lib/cold-trainer/types";

const PERSONAS: { id: PracticePersonaId; label: string; blurb: string }[] = [
  { id: "receptionist", label: "Receptionist", blurb: "Wants to know what this is regarding before routing." },
  { id: "skeptical_owner", label: "Skeptical owner", blurb: "Guards time and asks if this is a sales call." },
  { id: "busy_manager", label: "Busy manager", blurb: "In a meeting. Wants email or a later callback." },
  { id: "friendly_office_manager", label: "Friendly office manager", blurb: "Helpful, will share an email if you stay brief." },
];

export function practiceReply(persona: PracticePersonaId, founderLine: string, turnCount: number): string {
  const text = founderLine.toLowerCase();
  switch (persona) {
    case "receptionist":
      if (turnCount === 0) return "Front desk, this is Amy — how can I help you?";
      if (/\b(profile|listing|novalyte|online)\b/.test(text)) return "Is this a sales call? What’s this regarding, exactly?";
      if (/\b(right person|who|manager|owner)\b/.test(text)) return "I can take a message. Our office manager handles that, but she’s with a patient.";
      return "Okay… do you want me to take a message, or is there a number to call back?";
    case "skeptical_owner":
      if (turnCount === 0) return "This is the owner. Make it quick.";
      if (/\bsales|leads|patients|rank\b/.test(text)) return "We’re not interested in another marketing vendor.";
      if (/\b(verify|listing|profile|permission|directory)\b/.test(text)) return "Who told you to call us? We didn’t ask for this.";
      return "What’s the actual ask here? I have two minutes.";
    case "busy_manager":
      if (turnCount === 0) return "You’ve caught me between patients — I really can’t talk.";
      if (/\bemail|follow|later|time\b/.test(text)) return "Email is better. Use the info@ on the website… actually, do you already have it?";
      return "Can this wait? I’m walking into a meeting.";
    case "friendly_office_manager":
      if (turnCount === 0) return "Hi, this is Dana, office manager — what can I do for you?";
      if (/\bemail|send|note\b/.test(text)) return "Sure, dana@example-clinic.test is fine, and I’m the one who handles listings.";
      if (/\bpermission|directory|profile\b/.test(text)) return "If it’s just verifying our public info, that’s probably okay — what do you need?";
      return "Yeah, I can help with that. What details are you trying to confirm?";
    default: {
      const _exhaustive: never = persona;
      return _exhaustive;
    }
  }
}

export function PracticeMode({
  enabled,
  persona,
  onToggle,
  onPersona,
  draft,
  onDraftChange,
  onSend,
  onSpeak,
  listening,
}: {
  enabled: boolean;
  persona: PracticePersonaId;
  onToggle: (on: boolean) => void;
  onPersona: (id: PracticePersonaId) => void;
  draft: string;
  onDraftChange: (v: string) => void;
  onSend: () => void;
  onSpeak?: () => void;
  listening?: boolean;
}) {
  return (
    <Card className="gap-0 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-sm font-semibold">Practice mode</p>
          <p className="text-xs text-muted-foreground">Scripted replies only — no outbound calling</p>
        </div>
        <Button size="sm" variant={enabled ? "secondary" : "outline"} onClick={() => onToggle(!enabled)}>
          {enabled ? "Exit practice" : "Enter practice"}
        </Button>
      </div>
      {enabled && (
        <div className="mt-3 space-y-3 border-t border-border/70 pt-3">
          <div className="flex flex-wrap gap-2">
            {PERSONAS.map((p) => (
              <Button
                key={p.id}
                size="sm"
                variant={persona === p.id ? "default" : "outline"}
                onClick={() => onPersona(p.id)}
              >
                {p.label}
              </Button>
            ))}
          </div>
          <p className="text-xs text-muted-foreground">{PERSONAS.find((p) => p.id === persona)?.blurb}</p>
          <div className="flex gap-2">
            <Input
              value={draft}
              onChange={(e) => onDraftChange(e.target.value)}
              placeholder="Type what you would say…"
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  onSend();
                }
              }}
            />
            <Button onClick={onSend} disabled={!draft.trim()}>Say it</Button>
            {onSpeak && (
              <Button variant="outline" onClick={onSpeak}>{listening ? "Mic on" : "Use mic"}</Button>
            )}
          </div>
        </div>
      )}
    </Card>
  );
}
