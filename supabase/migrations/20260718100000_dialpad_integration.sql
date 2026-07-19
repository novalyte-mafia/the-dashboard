-- Dialpad integration (additive, non-destructive).
--
-- Design notes:
-- * `prospect_calls` is the existing call-session table (camelCase quoted
--   columns). It is extended, not replaced, so all existing Telnyx/Vapi call
--   history remains readable.
-- * New tables use snake_case, matching call_recordings / call_events style.
-- * RLS is enabled with NO authenticated policies on every new table. The
--   application accesses Postgres exclusively through the server-side
--   service-role client (src/lib/supabase/admin.ts), which bypasses RLS.
--   Enabling RLS without policies denies anon/authenticated access entirely.
--   This matches the existing security model of every call table in this
--   database. Route-level auth (requireAdminRole) is the effective boundary.

-- ---------------------------------------------------------------------------
-- 1. prospect_calls: Dialpad lifecycle columns
-- ---------------------------------------------------------------------------
ALTER TABLE IF EXISTS public.prospect_calls
  ADD COLUMN IF NOT EXISTS "providerMasterCallId" text,
  ADD COLUMN IF NOT EXISTS "providerUserId" text,
  ADD COLUMN IF NOT EXISTS "externalNumber" text,
  ADD COLUMN IF NOT EXISTS "internalNumber" text,
  ADD COLUMN IF NOT EXISTS "outboundCallerId" text,
  ADD COLUMN IF NOT EXISTS "previousStatus" text,
  ADD COLUMN IF NOT EXISTS "ringingAt" timestamptz,
  ADD COLUMN IF NOT EXISTS "connectedAt" timestamptz,
  ADD COLUMN IF NOT EXISTS "lastEventAt" timestamptz,
  ADD COLUMN IF NOT EXISTS "durationMs" bigint,
  ADD COLUMN IF NOT EXISTS "transcriptStatus" text NOT NULL DEFAULT 'none',
  ADD COLUMN IF NOT EXISTS "recordingAvailable" boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "providerCustomData" jsonb,
  ADD COLUMN IF NOT EXISTS "providerMetadata" jsonb NOT NULL DEFAULT '{}'::jsonb;

CREATE INDEX IF NOT EXISTS prospect_calls_provider_provider_call_id_idx
  ON public.prospect_calls ("provider", "providerCallId");

-- One session per provider call id (partial: legacy rows may share nulls).
CREATE UNIQUE INDEX IF NOT EXISTS prospect_calls_dialpad_call_id_uidx
  ON public.prospect_calls ("providerCallId")
  WHERE "provider" = 'dialpad' AND "providerCallId" IS NOT NULL;

CREATE INDEX IF NOT EXISTS prospect_calls_external_number_idx
  ON public.prospect_calls ("externalNumber");

CREATE INDEX IF NOT EXISTS prospect_calls_last_event_at_idx
  ON public.prospect_calls ("lastEventAt" DESC);

CREATE INDEX IF NOT EXISTS prospect_calls_admin_created_idx
  ON public.prospect_calls ("adminId", "startedAt" DESC);

-- ---------------------------------------------------------------------------
-- 2. call_events: provider audit + idempotency columns
--    (existing columns: id, call_session_id, event_type, event_status,
--     payload, created_at)
-- ---------------------------------------------------------------------------
ALTER TABLE IF EXISTS public.call_events
  ADD COLUMN IF NOT EXISTS provider text,
  ADD COLUMN IF NOT EXISTS provider_event_key text,
  ADD COLUMN IF NOT EXISTS provider_call_id text,
  ADD COLUMN IF NOT EXISTS event_state text,
  ADD COLUMN IF NOT EXISTS event_timestamp timestamptz,
  ADD COLUMN IF NOT EXISTS received_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS processed_at timestamptz,
  ADD COLUMN IF NOT EXISTS processing_status text NOT NULL DEFAULT 'processed',
  ADD COLUMN IF NOT EXISTS processing_error text,
  ADD COLUMN IF NOT EXISTS payload_hash text;

-- Idempotency: a provider event may be delivered more than once.
CREATE UNIQUE INDEX IF NOT EXISTS call_events_provider_event_key_uidx
  ON public.call_events (provider, provider_event_key)
  WHERE provider_event_key IS NOT NULL;

CREATE INDEX IF NOT EXISTS call_events_provider_call_id_idx
  ON public.call_events (provider_call_id);

CREATE INDEX IF NOT EXISTS call_events_processing_status_idx
  ON public.call_events (processing_status)
  WHERE processing_status <> 'processed';

-- call_events.call_session_id is NOT NULL in the original table but Dialpad
-- events can arrive before a session match is found. Relax it (additive-safe:
-- existing rows keep their values).
ALTER TABLE IF EXISTS public.call_events
  ALTER COLUMN call_session_id DROP NOT NULL;

-- ---------------------------------------------------------------------------
-- 3. call_transcript_segments: provider-sourced transcripts
--    (existing: id, call_session_id, sequence_num, speaker, text, is_final,
--     provider, confidence, started_at, ended_at, metadata, created_at)
-- ---------------------------------------------------------------------------
ALTER TABLE IF EXISTS public.call_transcript_segments
  ADD COLUMN IF NOT EXISTS provider_call_id text,
  ADD COLUMN IF NOT EXISTS speaker_role text,
  ADD COLUMN IF NOT EXISTS segment_type text NOT NULL DEFAULT 'transcript';

CREATE INDEX IF NOT EXISTS call_transcript_segments_provider_call_id_idx
  ON public.call_transcript_segments (provider_call_id);

-- ---------------------------------------------------------------------------
-- 4. call_recordings: provider recording references
--    (existing: id, call_session_id, clinic_id, ..., recording_provider_id,
--     storage_bucket, storage_path, ...)
-- ---------------------------------------------------------------------------
ALTER TABLE IF EXISTS public.call_recordings
  ADD COLUMN IF NOT EXISTS provider text,
  ADD COLUMN IF NOT EXISTS provider_call_id text,
  ADD COLUMN IF NOT EXISTS provider_url text,
  ADD COLUMN IF NOT EXISTS recording_type text,
  ADD COLUMN IF NOT EXISTS duration_ms bigint,
  ADD COLUMN IF NOT EXISTS available_at timestamptz;

CREATE INDEX IF NOT EXISTS call_recordings_provider_call_id_idx
  ON public.call_recordings (provider_call_id);

-- One row per provider recording per session.
CREATE UNIQUE INDEX IF NOT EXISTS call_recordings_provider_recording_uidx
  ON public.call_recordings (call_session_id, recording_provider_id)
  WHERE recording_provider_id IS NOT NULL;

-- ---------------------------------------------------------------------------
-- 5. dialpad_user_mappings: map Novalyte admins to Dialpad users
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.dialpad_user_mappings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  app_user_id text NOT NULL,
  dialpad_user_id text NOT NULL,
  dialpad_email text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS dialpad_user_mappings_app_user_uidx
  ON public.dialpad_user_mappings (app_user_id)
  WHERE is_active;

CREATE INDEX IF NOT EXISTS dialpad_user_mappings_dialpad_user_idx
  ON public.dialpad_user_mappings (dialpad_user_id);

ALTER TABLE public.dialpad_user_mappings ENABLE ROW LEVEL SECURITY;

-- ---------------------------------------------------------------------------
-- 6. dialpad_enrichment_jobs: durable post-call enrichment queue
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.dialpad_enrichment_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  call_session_id text NOT NULL,
  provider_call_id text,
  job_type text NOT NULL CHECK (job_type IN ('call_details', 'transcript', 'recording')),
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'canceled')),
  attempt_count integer NOT NULL DEFAULT 0,
  run_after timestamptz NOT NULL DEFAULT now(),
  locked_at timestamptz,
  last_error text,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Only one live job per (session, type); completed/failed history preserved.
CREATE UNIQUE INDEX IF NOT EXISTS dialpad_enrichment_jobs_active_uidx
  ON public.dialpad_enrichment_jobs (call_session_id, job_type)
  WHERE status IN ('pending', 'processing');

CREATE INDEX IF NOT EXISTS dialpad_enrichment_jobs_claim_idx
  ON public.dialpad_enrichment_jobs (status, run_after)
  WHERE status = 'pending';

ALTER TABLE public.dialpad_enrichment_jobs ENABLE ROW LEVEL SECURITY;
