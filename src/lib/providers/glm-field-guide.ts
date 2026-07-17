import { suggestFromTranscriptContext } from "@/lib/calls/transcript-context";

/** Field-guide fallback — transcript-aware, never re-asks answered checklist items. */
export function generateFieldGuideSuggestion(transcript: string, previousSuggestions: string[] = []) {
  const { suggestion } = suggestFromTranscriptContext({
    transcript,
    latestClinicUtterance: transcript.split("\n").filter(Boolean).at(-1),
    previousSuggestions,
  });
  return suggestion;
}
