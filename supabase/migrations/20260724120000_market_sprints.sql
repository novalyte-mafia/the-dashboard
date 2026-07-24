-- Market Sprint: reusable concentrated geographic outreach + Miami seed
-- Applied remotely via Supabase MCP; kept in-repo for reproducibility.

create table if not exists market_sprints (
  id text primary key default gen_random_uuid()::text,
  name text not null,
  slug text not null unique,
  primary_city text not null,
  state text not null,
  state_abbreviation text not null,
  metro_area text,
  county_names text[] not null default '{}',
  included_cities text[] not null default '{}',
  excluded_cities text[] not null default '{}',
  zip_prefixes text[] not null default '{}',
  zip_patterns text[] not null default '{}',
  timezone text not null default 'America/New_York',
  status text not null default 'planning'
    check (status in (
      'planning','researching','active_outreach','building_coverage',
      'campaign_ready','active_campaign','paused','completed'
    )),
  treatment_categories text[] not null default '{}',
  target_clinic_count integer,
  campaign_readiness_threshold integer not null default 15,
  min_approved_listings integer not null default 8,
  min_category_coverage integer not null default 3,
  is_default boolean not null default false,
  started_at timestamptz,
  target_completion_date date,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists market_sprints_status_idx on market_sprints(status);
create index if not exists market_sprints_default_idx on market_sprints(is_default) where is_default = true;

create table if not exists market_sprint_clinics (
  id text primary key default gen_random_uuid()::text,
  market_sprint_id text not null references market_sprints(id) on delete cascade,
  clinic_id text not null references prospect_clinics(id) on delete cascade,
  cohort_status text not null default 'unreviewed'
    check (cohort_status in (
      'unreviewed','research_needed','researching','ready_to_call','calling',
      'attempted','follow_up_required','interested','permission_granted',
      'profile_review_pending','approved','published','not_interested',
      'do_not_call','invalid','closed'
    )),
  research_status text not null default 'unreviewed'
    check (research_status in ('unreviewed','research_needed','researching','complete','flagged')),
  match_reason text,
  match_confidence text not null default 'city'
    check (match_confidence in ('city','zip','county','manual','metro')),
  duplicate_of_clinic_id text references prospect_clinics(id) on delete set null,
  duplicate_flags jsonb not null default '[]'::jsonb,
  verification_flags jsonb not null default '[]'::jsonb,
  priority integer not null default 0,
  notes text,
  added_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (market_sprint_id, clinic_id)
);

create index if not exists market_sprint_clinics_sprint_idx on market_sprint_clinics(market_sprint_id);
create index if not exists market_sprint_clinics_clinic_idx on market_sprint_clinics(clinic_id);
create index if not exists market_sprint_clinics_status_idx on market_sprint_clinics(cohort_status);
create index if not exists market_sprint_clinics_research_idx on market_sprint_clinics(research_status);

alter table market_sprints enable row level security;
alter table market_sprint_clinics enable row level security;
