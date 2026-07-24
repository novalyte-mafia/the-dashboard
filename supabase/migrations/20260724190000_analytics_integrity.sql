-- Analytics integrity: internal devices + conversion classification
create table if not exists internal_analytics_devices (
  id uuid primary key default gen_random_uuid(),
  owner_user_id text not null,
  owner_email text,
  label text not null,
  token_hash text not null unique,
  device_type text,
  browser text,
  operating_system text,
  user_agent_hash text,
  first_registered_at timestamptz not null default now(),
  last_seen_at timestamptz,
  status text not null default 'active' check (status in ('active', 'revoked')),
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists internal_analytics_devices_owner_idx
  on internal_analytics_devices (owner_user_id);
create index if not exists internal_analytics_devices_status_idx
  on internal_analytics_devices (status);

alter table form_submissions
  add column if not exists is_test boolean not null default false,
  add column if not exists traffic_classification text,
  add column if not exists conversion_classification text;

create index if not exists form_submissions_is_test_idx on form_submissions (is_test);
