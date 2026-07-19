import { dialpadCustomDataSchema } from "./schemas";
import type { DialpadCustomData } from "./types";

/**
 * The custom_data string attached to Dialpad calls. It is passed back on
 * every subscribed call event and is the primary key for matching provider
 * events to Novalyte call sessions.
 *
 * Contains identifiers only — never API keys, PHI, notes, or transcripts.
 * Dialpad documents a 2000-character ceiling; we stay far below it.
 */

export const CUSTOM_DATA_MAX_LENGTH = 1500;

export function buildCustomData(input: {
  callSessionId: string;
  clinicId: string;
  contactId?: string | null;
  campaignId?: string | null;
  operatorUserId: string;
  source?: string;
}): string {
  const payload: DialpadCustomData = {
    v: 1,
    call_session_id: input.callSessionId,
    clinic_id: input.clinicId,
    contact_id: input.contactId ?? null,
    campaign_id: input.campaignId ?? null,
    operator_user_id: input.operatorUserId,
    source: input.source ?? "novalyte-command-center",
  };
  const serialized = JSON.stringify(payload);
  if (serialized.length > CUSTOM_DATA_MAX_LENGTH) {
    throw new Error(`custom_data exceeds ${CUSTOM_DATA_MAX_LENGTH} characters.`);
  }
  return serialized;
}

/** Parses custom_data from a provider payload. Returns null on any mismatch. */
export function parseCustomData(raw: string | null | undefined): DialpadCustomData | null {
  if (!raw) return null;
  try {
    const parsed = dialpadCustomDataSchema.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}
