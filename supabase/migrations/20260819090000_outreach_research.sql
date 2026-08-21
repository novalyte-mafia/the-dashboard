-- Outreach research workspace (prospect discovery, public evidence, contact routes).
-- Service-role access via getSupabaseAdmin(); RLS enabled for defense in depth.
-- This module does not send messages or submit contact forms.

create table if not exists public.outreach_prospects (
  id text primary key,
  organization_id text not null default 'novalyte',
  clinic_name text not null,
  canonical_domain text,
  website_url text,
  public_business_profile_url text,
  city text,
  state_or_region text,
  country text not null default 'US',
  postal_code text,
  latitude double precision,
  longitude double precision,
  vertical text not null default 'mens_health',
  business_category text,
  status text not null default 'NEW',
  research_confidence text not null default 'NEEDS_REVIEW',
  source_type text not null default 'MANUAL',
  owner_id text,
  notes text,
  is_suppressed boolean not null default false,
  suppression_reason text,
  is_demo boolean not null default false,
  contact_search_completed boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_researched_at timestamptz,
  archived_at timestamptz
);

create table if not exists public.outreach_evidence (
  id text primary key,
  prospect_id text not null references public.outreach_prospects(id) on delete cascade,
  evidence_type text not null,
  source_type text not null,
  source_url text not null,
  source_title text,
  excerpt text,
  structured_data jsonb not null default '{}'::jsonb,
  observed_at timestamptz,
  captured_at timestamptz not null default now(),
  confidence text not null default 'NEEDS_REVIEW',
  content_hash text,
  captured_by text not null,
  is_demo boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.outreach_contact_routes (
  id text primary key,
  prospect_id text not null references public.outreach_prospects(id) on delete cascade,
  channel_type text not null,
  value text not null,
  is_publicly_published boolean not null default true,
  source_url text,
  source_context text,
  verification_status text not null default 'UNVERIFIED',
  verification_notes text,
  confidence text not null default 'NEEDS_REVIEW',
  is_do_not_contact boolean not null default false,
  suppression_reason text,
  is_manual_record boolean not null default false,
  captured_at timestamptz not null default now(),
  last_reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.outreach_research_jobs (
  id text primary key,
  prospect_id text not null references public.outreach_prospects(id) on delete cascade,
  job_type text not null,
  adapter_name text not null,
  status text not null default 'QUEUED',
  requested_by text not null,
  started_at timestamptz,
  completed_at timestamptz,
  error_message text,
  result_summary jsonb not null default '{}'::jsonb,
  is_demo boolean not null default false,
  idempotency_key text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists outreach_research_jobs_idempotency_idx
  on public.outreach_research_jobs (prospect_id, idempotency_key)
  where idempotency_key is not null;

create table if not exists public.outreach_activity (
  id text primary key,
  prospect_id text not null,
  actor_id text,
  event_type text not null,
  entity_type text not null,
  entity_id text,
  description text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.outreach_saved_views (
  id text primary key,
  user_id text not null,
  name text not null,
  route text not null default 'prospects',
  filters jsonb not null default '{}'::jsonb,
  sort jsonb not null default '{}'::jsonb,
  visible_columns jsonb not null default '[]'::jsonb,
  is_default boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.outreach_suppressions (
  id text primary key,
  prospect_id text,
  contact_route_id text,
  reason text not null,
  source text not null,
  created_by text not null,
  created_at timestamptz not null default now(),
  expires_at timestamptz
);

create index if not exists outreach_prospects_status_idx on public.outreach_prospects (status, updated_at desc);
create index if not exists outreach_evidence_prospect_idx on public.outreach_evidence (prospect_id, captured_at desc);
create index if not exists outreach_routes_prospect_idx on public.outreach_contact_routes (prospect_id, captured_at desc);
create index if not exists outreach_activity_prospect_idx on public.outreach_activity (prospect_id, created_at desc);

alter table public.outreach_prospects enable row level security;
alter table public.outreach_evidence enable row level security;
alter table public.outreach_contact_routes enable row level security;
alter table public.outreach_research_jobs enable row level security;
alter table public.outreach_activity enable row level security;
alter table public.outreach_saved_views enable row level security;
alter table public.outreach_suppressions enable row level security;
