import type { TalkListenMetrics, TranscriptTurn } from "./types";

const FILLERS = /\b(um+|uh+|er+|ah+|like|you know|basically|actually|so yeah|kind of|sort of)\b/gi;

export function countFillers(text: string): number {
  return (text.match(FILLERS) ?? []).length;
}

export function countQuestions(text: string): number {
  return (text.match(/\?/g) ?? []).length;
}

function words(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

function durationOf(turn: TranscriptTurn, nextAt?: string): number {
  if (turn.durationMs && turn.durationMs > 0) return turn.durationMs;
  const start = Date.parse(turn.at);
  const end = nextAt ? Date.parse(nextAt) : start + Math.max(800, words(turn.text) * 400);
  return Math.max(400, end - start);
}

export function computeTalkListenMetrics(turns: TranscriptTurn[], now = Date.now()): TalkListenMetrics {
  let founderMs = 0;
  let listenMs = 0;
  let longestFounderMonologueMs = 0;
  let questionCount = 0;
  let interruptionCount = 0;
  let fillerCount = 0;
  let silenceOver4sCount = 0;
  let founderWords = 0;

  for (let i = 0; i < turns.length; i += 1) {
    const turn = turns[i];
    const next = turns[i + 1];
    const ms = durationOf(turn, next?.at);
    if (i > 0) {
      const gap = Date.parse(turn.at) - Date.parse(turns[i - 1].at) - durationOf(turns[i - 1], turn.at);
      if (gap > 4000) silenceOver4sCount += 1;
    }
    if (turn.speaker === "founder") {
      founderMs += ms;
      founderWords += words(turn.text);
      questionCount += countQuestions(turn.text);
      fillerCount += countFillers(turn.text);
      longestFounderMonologueMs = Math.max(longestFounderMonologueMs, ms);
      if (i > 0 && turns[i - 1].speaker !== "founder") {
        const prevEnd = Date.parse(turns[i - 1].at) + durationOf(turns[i - 1], turn.at);
        if (Date.parse(turn.at) - prevEnd < 350) interruptionCount += 1;
      }
    } else {
      listenMs += ms;
    }
  }

  if (turns.length) {
    const last = turns[turns.length - 1];
    const trailing = now - Date.parse(last.at);
    if (trailing > 4000) silenceOver4sCount += 1;
  }

  const talkShare = founderMs + listenMs === 0 ? 0 : founderMs / (founderMs + listenMs);
  const wpm = founderMs > 0 ? Math.round((founderWords / (founderMs / 60000)) || 0) : 0;
  const lastFounder = [...turns].reverse().find((t) => t.speaker === "founder");
  const lastFounderLong = lastFounder ? words(lastFounder.text) >= 40 || durationOf(lastFounder) > 18000 : false;
  const talkingTooLong = lastFounderLong || longestFounderMonologueMs > 20000;

  let talkListenLabel = "Even so far — keep asking, then listen.";
  if (talkShare > 0.7) talkListenLabel = "You’re carrying the call — ask a question and stop.";
  else if (talkShare < 0.35 && listenMs > 4000) talkListenLabel = "Good pause—let them answer.";
  else if (talkShare > 0.55) talkListenLabel = "Shorten the next response.";

  let supportiveCue = talkListenLabel;
  if (talkingTooLong) supportiveCue = "Stop here. Ask a question.";
  else if (wpm > 170) supportiveCue = "You are speaking quickly—slow by about 15%.";
  else if (silenceOver4sCount > 0 && lastFounder && !lastFounderLong) supportiveCue = "Good pause—let them answer.";
  else if (questionCount === 0 && founderWords > 20) supportiveCue = "Ask a question now.";

  return {
    founderMs,
    listenMs,
    talkListenLabel,
    longestFounderMonologueMs,
    questionCount,
    interruptionCount,
    wordsPerMinute: wpm,
    fillerCount,
    silenceOver4sCount,
    talkingTooLong,
    supportiveCue,
  };
}

export function formatDuration(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}
