import "server-only";
import { db } from "@/lib/db";
import {
  getQuoCall,
  getQuoCallRecordings,
  getQuoCallSummary,
  getQuoCallTranscript,
  type QuoCallRecording,
  type QuoCallSummary,
  type QuoCallTranscript,
  type QuoTranscriptDialogue,
} from "./client";

export type QuoEnrichment = {
  summaryText: string | null;
  nextSteps: string[];
  transcriptText: string | null;
  dialogue: QuoTranscriptDialogue[];
  recordingUrl: string | null;
  recordings: QuoCallRecording[];
  summaryStatus: string | null;
  transcriptStatus: string | null;
  durationSec: number | null;
  answered: boolean | null;
  quoStatus: string | null;
};

function formatDialogue(dialogue: QuoTranscriptDialogue[] | null | undefined): string | null {
  if (!dialogue?.length) return null;
  return dialogue
    .map((d) => {
      const who = d.userId ? "You" : d.identifier || "Them";
      return `${who}: ${d.content}`;
    })
    .join("\n");
}

function formatSummary(summary: QuoCallSummary | null): string | null {
  if (!summary?.summary?.length) return null;
  return summary.summary.join("\n");
}

export async function fetchQuoEnrichment(quoCallId: string): Promise<QuoEnrichment> {
  const [call, summary, transcript, recordings] = await Promise.all([
    getQuoCall(quoCallId).catch(() => null),
    getQuoCallSummary(quoCallId),
    getQuoCallTranscript(quoCallId),
    getQuoCallRecordings(quoCallId),
  ]);

  const completedRecording = recordings.find((r) => r.status === "completed" && r.url) ?? recordings[0];
  const dialogue = transcript?.dialogue ?? [];
  const durationFromCall =
    typeof call?.duration === "number" ? Math.max(0, Math.round(call.duration)) : null;
  const durationFromTranscript =
    typeof transcript?.duration === "number" ? Math.max(0, Math.round(transcript.duration)) : null;

  return {
    summaryText: formatSummary(summary),
    nextSteps: summary?.nextSteps ?? [],
    transcriptText: formatDialogue(dialogue),
    dialogue,
    recordingUrl: completedRecording?.url ?? null,
    recordings,
    summaryStatus: summary?.status ?? null,
    transcriptStatus: transcript?.status ?? null,
    durationSec: durationFromCall ?? durationFromTranscript,
    answered: Boolean(call?.answeredAt) || null,
    quoStatus: typeof call?.status === "string" ? call.status : null,
  };
}

/** Persist Quo summary/transcript/recording onto an existing call session. */
export async function enrichCallSessionFromQuo(opts: {
  callSessionId: string;
  quoCallId: string;
}): Promise<{ ok: true; enrichment: QuoEnrichment } | { ok: false; error: string }> {
  const session = await db.callSession.findUnique({ where: { id: opts.callSessionId } });
  if (!session) return { ok: false, error: "Call session not found" };

  const enrichment = await fetchQuoEnrichment(opts.quoCallId);
  const existingStructured = safeJson(session.structuredData) ?? {};
  const existingMeta = safeJson(session.metadata) ?? {};
  const existingProviderMeta =
    session.providerMetadata && typeof session.providerMetadata === "object"
      ? (session.providerMetadata as Record<string, unknown>)
      : {};

  const shortNote = [
    enrichment.summaryText
      ? `Quo summary: ${enrichment.summaryText.slice(0, 400)}`
      : enrichment.transcriptText
        ? `Quo transcript captured (${enrichment.dialogue.length} lines).`
        : "Quo call details refreshed.",
    enrichment.recordingUrl ? "Recording available." : null,
  ]
    .filter(Boolean)
    .join(" ");

  await db.callSession.update({
    where: { id: session.id },
    data: {
      provider: "quo",
      providerCallId: opts.quoCallId,
      recordingUrl: enrichment.recordingUrl ?? session.recordingUrl,
      transcript: enrichment.transcriptText
        ? JSON.stringify(enrichment.dialogue)
        : session.transcript,
      durationSec: enrichment.durationSec ?? session.durationSec,
      answered: enrichment.answered ?? session.answered,
      outcome:
        session.outcome === "not_started" || session.outcome === "no_answer"
          ? enrichment.answered
            ? "connected"
            : session.outcome
          : session.outcome,
      notes:
        !session.notes ||
        session.notes.startsWith("Synced from Quo") ||
        session.notes.startsWith("Auto-logged from Quo") ||
        session.notes.startsWith("Quo call details")
          ? shortNote
          : session.notes,
      structuredData: JSON.stringify({
        ...existingStructured,
        provider: "quo",
        quoCallId: opts.quoCallId,
        quoStatus: enrichment.quoStatus,
        quoSummary: enrichment.summaryText,
        quoNextSteps: enrichment.nextSteps,
        quoTranscriptStatus: enrichment.transcriptStatus,
        quoSummaryStatus: enrichment.summaryStatus,
        quoRecordingUrl: enrichment.recordingUrl,
        quoDialogue: enrichment.dialogue,
        hasTranscript: Boolean(enrichment.transcriptText),
        hasRecording: Boolean(enrichment.recordingUrl),
        hasSummary: Boolean(enrichment.summaryText),
      }),
      metadata: JSON.stringify({
        ...existingMeta,
        quoEnrichedAt: new Date().toISOString(),
        quoCallId: opts.quoCallId,
      }),
      providerMetadata: {
        ...existingProviderMeta,
        mode: existingProviderMeta.mode ?? "quo_enrichment",
        source: "quo-enrichment",
        quoCallId: opts.quoCallId,
        quoSummary: enrichment.summaryText,
        quoNextSteps: enrichment.nextSteps,
        quoRecordingUrl: enrichment.recordingUrl,
        recap_summary: enrichment.summaryText,
      },
    } as never,
  });

  // Best-effort dialpad lifecycle columns (may exist in prod even if Prisma types lag).
  try {
    await db.callSession.update({
      where: { id: session.id },
      data: {
        transcriptStatus: enrichment.transcriptText
          ? "stored"
          : enrichment.transcriptStatus === "in-progress"
            ? "pending"
            : undefined,
        recordingAvailable: Boolean(enrichment.recordingUrl) || undefined,
      } as never,
    });
  } catch {
    /* columns may be absent in some environments */
  }

  return { ok: true, enrichment };
}

function safeJson(raw: string | null | undefined): Record<string, unknown> | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as unknown;
    return parsed && typeof parsed === "object" ? (parsed as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}
