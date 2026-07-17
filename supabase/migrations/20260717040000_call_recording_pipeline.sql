-- Call recording, consent, transcript segments, copilot suggestions, post-call analysis,
-- and training-dataset governance. Additive only — preserves existing prospect_calls data.

-- ---------------------------------------------------------------------------
-- Recording consent events (separate from call outcome)
-- ---------------------------------------------------------------------------
create table if not exists public.call_consent_events (
  id uuid primary key default gen_random_uuid(),
  call_session_id text not null,
  clinic_id text not null,
  consent_status text not null default 'pending' check (consent_status in (
    'not_required', 'pending', 'verbal_consent_obtained', 'written_consent_obtained',
    'declined', 'unknown', 'recording_disabled', 'compliance_review_required'
  )),
  jurisdiction text,
  consent_script text,
  consent_wording text,
  recorded_by_admin_id text,
  metadata jsonb not null default '{}',
  created_at timestamptz not null default now()
);

create index if not exists call_consent_events_session_idx
  on public.call_consent_events (call_session_id, created_at desc);

-- ---------------------------------------------------------------------------
-- Call recordings (cloud + local metadata)
-- ---------------------------------------------------------------------------
create table if not exists public.call_recordings (
  id uuid primary key default gen_random_uuid(),
  call_session_id text not null,
  clinic_id text not null,
  contact_id text,
  admin_id text,
  provider_call_id text,
  recording_provider_id text,
  storage_bucket text not null default 'call-recordings',
  storage_path text,
  file_type text not null default 'audio/webm',
  file_size bigint,
  audio_duration_sec integer,
  checksum_sha256 text,
  recording_status text not null default 'initializing' check (recording_status in (
    'initializing', 'active', 'paused', 'failed', 'audio_unavailable',
    'consent_required', 'uploading', 'uploaded', 'local_backup_saved',
    'cloud_save_failed', 'local_save_failed', 'finalized'
  )),
  consent_status text not null default 'pending',
  transcript_status text not null default 'pending',
  analysis_status text not null default 'pending',
  retention_status text not null default 'active',
  upload_attempts integer not null default 0,
  error_details text,
  started_at timestamptz,
  ended_at timestamptz,
  idempotency_key text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists call_recordings_idempotency_uniq
  on public.call_recordings (call_session_id, idempotency_key);

create unique index if not exists call_recordings_session_primary_idx
  on public.call_recordings (call_session_id)
  where recording_status not in ('failed', 'cloud_save_failed', 'local_save_failed');

create index if not exists call_recordings_clinic_idx
  on public.call_recordings (clinic_id, created_at desc);

-- ---------------------------------------------------------------------------
-- Local backup metadata
-- ---------------------------------------------------------------------------
create table if not exists public.call_local_backups (
  id uuid primary key default gen_random_uuid(),
  call_session_id text not null,
  recording_id uuid references public.call_recordings(id) on delete set null,
  local_root_path text not null,
  relative_path text not null,
  checksum_sha256 text,
  file_size bigint,
  backup_status text not null default 'pending' check (backup_status in (
    'pending', 'saved', 'failed', 'skipped'
  )),
  cloud_upload_status text not null default 'pending',
  metadata jsonb not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists call_local_backups_session_path_idx
  on public.call_local_backups (call_session_id, relative_path);

-- ---------------------------------------------------------------------------
-- Transcript segments (final + diagnostic partials)
-- ---------------------------------------------------------------------------
create table if not exists public.call_transcript_segments (
  id uuid primary key default gen_random_uuid(),
  call_session_id text not null,
  sequence_num integer not null,
  speaker text not null,
  text text not null,
  is_final boolean not null default true,
  provider text default 'deepgram',
  confidence numeric(5,4),
  started_at timestamptz,
  ended_at timestamptz,
  metadata jsonb not null default '{}',
  created_at timestamptz not null default now()
);

create unique index if not exists call_transcript_segments_session_seq_idx
  on public.call_transcript_segments (call_session_id, sequence_num);

create index if not exists call_transcript_segments_session_idx
  on public.call_transcript_segments (call_session_id, created_at);

-- ---------------------------------------------------------------------------
-- Copilot suggestions (per call, for training review)
-- ---------------------------------------------------------------------------
create table if not exists public.call_copilot_suggestions (
  id uuid primary key default gen_random_uuid(),
  call_session_id text not null,
  sequence_num integer not null,
  suggested_response text not null,
  response_type text,
  call_stage text,
  reason text,
  knowledge_sources jsonb not null default '[]',
  grounding_status text,
  confidence numeric(4,2),
  clinic_utterance text,
  was_used boolean,
  was_edited boolean,
  final_response_used text,
  latency_ms integer,
  metadata jsonb not null default '{}',
  created_at timestamptz not null default now()
);

create index if not exists call_copilot_suggestions_session_idx
  on public.call_copilot_suggestions (call_session_id, sequence_num);

-- ---------------------------------------------------------------------------
-- Post-call analysis
-- ---------------------------------------------------------------------------
create table if not exists public.call_post_analyses (
  id uuid primary key default gen_random_uuid(),
  call_session_id text not null unique,
  clinic_id text not null,
  summary text,
  directory_permission_result text,
  contact_reached boolean,
  decision_maker_status text,
  information_collected jsonb not null default '{}',
  information_missing jsonb not null default '[]',
  clinic_questions jsonb not null default '[]',
  objections_raised jsonb not null default '[]',
  operator_responses jsonb not null default '[]',
  copilot_suggestions_summary jsonb not null default '{}',
  strong_moments jsonb not null default '[]',
  weak_moments jsonb not null default '[]',
  missed_opportunities jsonb not null default '[]',
  compliance_concerns jsonb not null default '[]',
  follow_up_action text,
  recommended_follow_up_date timestamptz,
  clinic_interest_level text,
  call_quality_score numeric(4,2),
  transcript_confidence_score numeric(4,2),
  recording_quality_score numeric(4,2),
  training_eligibility_recommendation text check (training_eligibility_recommendation in (
    'eligible', 'excluded', 'requires_review'
  )),
  analysis_status text not null default 'pending' check (analysis_status in (
    'pending', 'processing', 'completed', 'failed'
  )),
  raw_analysis jsonb not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists call_post_analyses_clinic_idx
  on public.call_post_analyses (clinic_id, created_at desc);

-- ---------------------------------------------------------------------------
-- Call lifecycle events
-- ---------------------------------------------------------------------------
create table if not exists public.call_events (
  id uuid primary key default gen_random_uuid(),
  call_session_id text not null,
  event_type text not null,
  event_status text,
  payload jsonb not null default '{}',
  created_at timestamptz not null default now()
);

create index if not exists call_events_session_idx
  on public.call_events (call_session_id, created_at);

-- ---------------------------------------------------------------------------
-- Training dataset governance on prospect_calls
-- ---------------------------------------------------------------------------
alter table if exists public.prospect_calls
  add column if not exists "callEnvironment" text default 'live',
  add column if not exists "consentStatus" text default 'pending',
  add column if not exists "recordingStatus" text default 'not_started',
  add column if not exists "recordingId" text,
  add column if not exists "idempotencyKey" text,
  add column if not exists "trainingEligible" text default 'requires_review',
  add column if not exists "trainingReviewStatus" text default 'pending',
  add column if not exists "transcriptQuality" text,
  add column if not exists "recordingQuality" text,
  add column if not exists "directoryPermissionStatus" text,
  add column if not exists "postAnalysisId" text;

create unique index if not exists prospect_calls_idempotency_key_idx
  on public.prospect_calls ("idempotencyKey")
  where "idempotencyKey" is not null;

-- ---------------------------------------------------------------------------
-- RLS — admin service role only for sensitive tables
-- ---------------------------------------------------------------------------
alter table public.call_consent_events enable row level security;
alter table public.call_recordings enable row level security;
alter table public.call_local_backups enable row level security;
alter table public.call_transcript_segments enable row level security;
alter table public.call_copilot_suggestions enable row level security;
alter table public.call_post_analyses enable row level security;
alter table public.call_events enable row level security;

-- Service role bypasses RLS. Authenticated admin policies can be added when auth.uid() maps to admin members.
-- Rollback guidance: drop tables in reverse dependency order; alter prospect_calls columns can remain nullable.

-- Supabase Storage bucket (private) — run once in Supabase dashboard if insert fails:
-- insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
-- values ('call-recordings', 'call-recordings', false, 104857600, array['audio/webm','audio/ogg','audio/wav'])
-- on conflict (id) do nothing;
