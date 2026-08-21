-- C-Cold Trainer founder copilot sessions.
-- Service-role access via getSupabaseAdmin(); RLS enabled for defense in depth.

create table if not exists public.cold_trainer_sessions (
  id text primary key,
  clinic_id text,
  contact_id text,
  user_id text,
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  call_goal text,
  call_outcome text,
  transcript jsonb not null default '[]'::jsonb,
  coaching_events jsonb not null default '[]'::jsonb,
  suggested_lines jsonb not null default '[]'::jsonb,
  talk_listen_metrics jsonb not null default '{}'::jsonb,
  extracted_contacts jsonb not null default '[]'::jsonb,
  verified_clinic_fields jsonb not null default '{}'::jsonb,
  objection_tags jsonb not null default '[]'::jsonb,
  follow_up_date date,
  follow_up_notes text,
  created_call_id text,
  consent_status text not null default 'unknown',
  recording_status text not null default 'not_started',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists cold_trainer_sessions_clinic_started_idx
  on public.cold_trainer_sessions (clinic_id, started_at desc);

create index if not exists cold_trainer_sessions_user_started_idx
  on public.cold_trainer_sessions (user_id, started_at desc);

alter table public.cold_trainer_sessions enable row level security;
