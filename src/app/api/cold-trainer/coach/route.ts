import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSessionAdmin } from "@/lib/auth";
import { generateColdTrainerCoach } from "@/lib/cold-trainer/generate";
import type { ClinicContextPayload, PrepFields, TalkListenMetrics, TranscriptTurn } from "@/lib/cold-trainer/types";

const CALL_GOAL_ENUM = ["Find decision-maker", "Verify listing", "Request permission", "Book follow-up", "Re-engage"] as const;
const STAGE_ENUM = ["opening", "routing", "relevance", "discovery", "objection", "ask", "wrap_up", "reset"] as const;

const turnSchema = z.object({
  id: z.string().max(80),
  speaker: z.enum(["founder", "prospect", "unknown"]),
  text: z.string().max(2000),
  at: z.string().max(40),
  confident: z.boolean(),
  words: z.number().optional(),
  durationMs: z.number().optional(),
});

const clinicSchema = z.object({
  clinic_id: z.string().max(120).nullable(),
  is_seed: z.boolean(),
  clinic_name: z.string().min(1).max(200),
  location: z.string().max(200).default(""),
  clinic_type: z.string().max(80).default(""),
  phone: z.string().max(80).default(""),
  website: z.string().max(300).default(""),
  address: z.string().max(300).default(""),
  known_services: z.string().max(800).default(""),
  contact_name: z.string().max(160).default(""),
  contact_role: z.string().max(160).default(""),
  contact_id: z.string().max(120).nullable(),
  email: z.string().max(200).default(""),
  readiness_score: z.string().max(20).default(""),
  status: z.string().max(80).default(""),
  directory_status: z.string().max(80).default(""),
  previous_calls: z.string().max(2000).default(""),
  notes: z.string().max(2000).default(""),
  call_goal: z.enum(CALL_GOAL_ENUM),
  approved_value_proposition: z.string().max(500).default(""),
  prohibited_claims: z.array(z.string().max(200)).max(8),
  missing_facts: z.array(z.string().max(40)).max(12).default([]),
});

const schema = z.object({
  clinic: clinicSchema,
  turns: z.array(turnSchema).max(80).default([]),
  call_goal: z.enum(CALL_GOAL_ENUM),
  current_stage: z.enum(STAGE_ENUM),
  metrics: z.object({
    founderMs: z.number(),
    listenMs: z.number(),
    talkListenLabel: z.string().max(200),
    longestFounderMonologueMs: z.number(),
    questionCount: z.number(),
    interruptionCount: z.number(),
    wordsPerMinute: z.number(),
    fillerCount: z.number(),
    silenceOver4sCount: z.number(),
    talkingTooLong: z.boolean(),
    supportiveCue: z.string().max(200),
  }),
  prep: z.object({
    myGoal: z.string().max(400).default(""),
    valueProposition: z.string().max(400).default(""),
    desiredNextStep: z.string().max(400).default(""),
    mustNotClaim: z.string().max(400).default(""),
    notesToRemember: z.string().max(800).default(""),
  }),
  stuck: z.boolean().optional(),
});

export async function POST(req: NextRequest) {
  if (!(await getSessionAdmin())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const parsed = schema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "Invalid coaching request." }, { status: 400 });

  const suggestion = await generateColdTrainerCoach({
    clinic: parsed.data.clinic as ClinicContextPayload,
    turns: parsed.data.turns as TranscriptTurn[],
    callGoal: parsed.data.call_goal,
    currentStage: parsed.data.current_stage,
    metrics: parsed.data.metrics as TalkListenMetrics,
    prep: parsed.data.prep as PrepFields,
    stuck: parsed.data.stuck,
  });

  return NextResponse.json({ suggestion });
}
