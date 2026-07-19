import "server-only";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { db } from "@/lib/db";
import { getDialpadConfig } from "./env";

/**
 * Provider-neutral call-intelligence interface.
 *
 * The initial Dialpad adapter deliberately does NOT support live transcript
 * streaming: Dialpad's public API exposes transcripts post-call (and via the
 * `call_transcription` webhook state), not as an external real-time stream.
 * Live coaching during a Dialpad call comes from Dialpad's own AI inside the
 * Dialpad app. `supportsLiveTranscript()` must stay false until the account
 * has verified, documented live-stream access.
 */

export interface TranscriptSegmentView {
  sequenceNum: number;
  speaker: string;
  speakerRole: string | null;
  text: string;
  segmentType: string;
  startedAt: string | null;
}

export interface RecordingView {
  id: string;
  recordingType: string | null;
  durationMs: number | null;
  availableAt: string | null;
  /** Playback goes through the authenticated recording endpoint, never raw URLs. */
  playbackPath: string;
}

export interface CallIntelligenceProvider {
  readonly provider: string;
  supportsLiveTranscript(): boolean;
  subscribeToLiveTranscript(callSessionId: string, onSegment: (segment: TranscriptSegmentView) => void): () => void;
  getPostCallTranscript(callSessionId: string): Promise<TranscriptSegmentView[]>;
  getCallRecording(callSessionId: string): Promise<RecordingView[]>;
  getCallSummary(callSessionId: string): Promise<string | null>;
}

class DialpadIntelligenceProvider implements CallIntelligenceProvider {
  readonly provider = "dialpad";

  supportsLiveTranscript(): boolean {
    // Do not change without verified Dialpad real-time transcript API access.
    return false;
  }

  subscribeToLiveTranscript(): () => void {
    throw new Error("Dialpad live transcript streaming is not available on this account.");
  }

  async getPostCallTranscript(callSessionId: string): Promise<TranscriptSegmentView[]> {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from("call_transcript_segments")
      .select("sequence_num, speaker, speaker_role, text, segment_type, started_at")
      .eq("call_session_id", callSessionId)
      .eq("provider", "dialpad")
      .order("sequence_num", { ascending: true });
    if (error) throw new Error(`Failed to load transcript: ${error.message}`);
    return (data ?? []).map((row) => ({
      sequenceNum: row.sequence_num,
      speaker: row.speaker,
      speakerRole: row.speaker_role ?? null,
      text: row.text,
      segmentType: row.segment_type ?? "transcript",
      startedAt: row.started_at ?? null,
    }));
  }

  async getCallRecording(callSessionId: string): Promise<RecordingView[]> {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from("call_recordings")
      .select("id, recording_type, duration_ms, available_at")
      .eq("call_session_id", callSessionId)
      .eq("provider", "dialpad");
    if (error) throw new Error(`Failed to load recordings: ${error.message}`);
    return (data ?? []).map((row) => ({
      id: row.id,
      recordingType: row.recording_type ?? null,
      durationMs: row.duration_ms ?? null,
      availableAt: row.available_at ?? null,
      playbackPath: `/api/integrations/dialpad/calls/${callSessionId}/recording?recordingId=${row.id}`,
    }));
  }

  async getCallSummary(callSessionId: string): Promise<string | null> {
    const session = await db.callSession.findUnique({ where: { id: callSessionId } });
    const summary = session?.providerMetadata?.recap_summary;
    return typeof summary === "string" && summary.trim() ? summary : null;
  }
}

export function getCallIntelligenceProvider(): CallIntelligenceProvider {
  const config = getDialpadConfig();
  if (!config.enabled) {
    throw new Error("No call intelligence provider is enabled.");
  }
  return new DialpadIntelligenceProvider();
}
