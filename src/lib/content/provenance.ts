import "server-only";

import { getSupabaseAdmin } from "@/lib/supabase/admin";
import type { GenerationProvenance } from "@/lib/content/generation-types";

const MAX_PROVENANCE_EVENTS = 50;

/**
 * Appends a generation event to the draft's "generationProvenance" jsonb log.
 *
 * Best-effort by design: provenance must never block returning generated
 * content to the editor, so failures (missing article, migration not yet
 * applied) are reported as `false` rather than thrown. This helper only ever
 * touches the provenance column — article content is written exclusively by
 * the explicit save/apply flow, never by generation.
 */
export async function recordGenerationProvenance(
  articleId: string,
  event: GenerationProvenance,
): Promise<boolean> {
  try {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from("Article")
      .select("generationProvenance")
      .eq("id", articleId)
      .maybeSingle();
    if (error || !data) return false;

    const existing = Array.isArray(data.generationProvenance) ? data.generationProvenance : [];
    const next = [
      ...existing.slice(-(MAX_PROVENANCE_EVENTS - 1)),
      {
        kind: event.kind,
        provider: event.provider,
        model: event.model,
        promptInputs: event.promptInputs,
        status: event.status,
        attempts: event.attempts,
        durationMs: event.durationMs,
        createdBy: event.createdBy ?? null,
        createdAt: new Date().toISOString(),
      },
    ];

    const { error: updateError } = await supabase
      .from("Article")
      .update({ generationProvenance: next })
      .eq("id", articleId);
    return !updateError;
  } catch {
    return false;
  }
}
