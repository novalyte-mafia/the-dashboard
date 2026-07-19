import { z } from "zod";

/**
 * Runtime validation for untrusted Dialpad payloads. Schemas are permissive
 * (passthrough + nullable) because Dialpad omits fields per state; unknown
 * provider fields are preserved rather than rejected.
 */

const partySchema = z
  .object({
    phone: z.string().nullish(),
    type: z.string().nullish(),
    id: z.union([z.string(), z.number()]).nullish(),
    email: z.string().nullish(),
    name: z.string().nullish(),
    office_id: z.number().nullish(),
  })
  .passthrough();

export const recordingDetailSchema = z
  .object({
    id: z.union([z.string(), z.number()]).nullish(),
    url: z.string().nullish(),
    duration: z.number().nullish(),
    start_time: z.number().nullish(),
    recording_type: z.string().nullish(),
  })
  .passthrough();

/** Webhook call-event payload / GET call payload. */
export const dialpadCallEventSchema = z
  .object({
    call_id: z.union([z.number(), z.string()]).nullish(),
    state: z.string().nullish(),
    direction: z.string().nullish(),
    date_started: z.number().nullish(),
    date_rang: z.number().nullish(),
    date_connected: z.number().nullish(),
    date_ended: z.number().nullish(),
    duration: z.number().nullish(),
    total_duration: z.number().nullish(),
    internal_number: z.string().nullish(),
    external_number: z.string().nullish(),
    custom_data: z.string().nullish(),
    contact: partySchema.nullish(),
    target: partySchema.nullish(),
    proxy_target: partySchema.nullish(),
    entry_point_call_id: z.union([z.number(), z.string()]).nullish(),
    operator_call_id: z.union([z.number(), z.string()]).nullish(),
    master_call_id: z.union([z.number(), z.string()]).nullish(),
    is_transferred: z.boolean().nullish(),
    was_recorded: z.boolean().nullish(),
    recording_details: z.array(recordingDetailSchema).nullish(),
    event_timestamp: z.number().nullish(),
    transcription_text: z.string().nullish(),
    voicemail_link: z.string().nullish(),
    recap_summary: z.string().nullish(),
    recap_outcome: z.string().nullish(),
  })
  .passthrough();

export type ValidatedDialpadCallEvent = z.infer<typeof dialpadCallEventSchema>;

export const dialpadRingCallResponseSchema = z
  .object({ call_id: z.union([z.number(), z.string()]).nullish() })
  .passthrough();

export const dialpadTranscriptSchema = z
  .object({
    call_id: z.union([z.number(), z.string()]).nullish(),
    lines: z
      .array(
        z
          .object({
            content: z.string().nullish(),
            name: z.string().nullish(),
            time: z.string().nullish(),
            type: z.string().nullish(),
            user_id: z.union([z.number(), z.string()]).nullish(),
            contact_id: z.string().nullish(),
          })
          .passthrough(),
      )
      .nullish(),
  })
  .passthrough();

export const dialpadCallCollectionSchema = z
  .object({
    cursor: z.string().nullish(),
    items: z.array(dialpadCallEventSchema).nullish(),
  })
  .passthrough();

export const dialpadWebhookSchema = z
  .object({
    id: z.union([z.number(), z.string()]).nullish(),
    hook_url: z.string().nullish(),
    signature: z
      .object({ algo: z.string().nullish(), type: z.string().nullish(), secret: z.string().nullish() })
      .passthrough()
      .nullish(),
  })
  .passthrough();

export const dialpadSubscriptionSchema = z
  .object({
    id: z.union([z.number(), z.string()]).nullish(),
    call_states: z.array(z.string()).nullish(),
    enabled: z.boolean().nullish(),
    webhook: dialpadWebhookSchema.nullish(),
    target_type: z.string().nullish(),
    target_id: z.union([z.number(), z.string()]).nullish(),
  })
  .passthrough();

/** Compact custom_data envelope Novalyte attaches to outbound calls. */
export const dialpadCustomDataSchema = z.object({
  v: z.literal(1),
  call_session_id: z.string().min(1),
  clinic_id: z.string().min(1),
  contact_id: z.string().nullable(),
  campaign_id: z.string().nullable(),
  operator_user_id: z.string().min(1),
  source: z.string().min(1),
});
