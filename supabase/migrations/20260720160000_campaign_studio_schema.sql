-- Campaign Studio Phase 1 schema
-- Service-role only; RLS enabled with no permissive anon policies.

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------

create or replace function cs_set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Reference tables
-- ---------------------------------------------------------------------------

create table if not exists cs_treatment_verticals (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  name text not null,
  category text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger cs_treatment_verticals_updated_at
  before update on cs_treatment_verticals
  for each row execute function cs_set_updated_at();

create table if not exists cs_geo_entities (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('country','state','metro','county','city','neighborhood','zip')),
  slug text not null,
  name text not null,
  parent_id uuid references cs_geo_entities(id) on delete set null,
  state_code text,
  created_at timestamptz not null default now()
);

create unique index if not exists cs_geo_entities_kind_slug_parent_idx
  on cs_geo_entities (kind, slug, coalesce(parent_id, '00000000-0000-0000-0000-000000000000'::uuid));

create index if not exists cs_geo_entities_parent_idx on cs_geo_entities(parent_id);
create index if not exists cs_geo_entities_kind_idx on cs_geo_entities(kind);

create table if not exists cs_templates (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  name text not null,
  page_type text not null check (page_type in (
    'service_location','paid_conversion','regional_discovery','clinic_campaign',
    'educational_article','qa_article','treatment_comparison','general_campaign'
  )),
  description text,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists cs_template_versions (
  id uuid primary key default gen_random_uuid(),
  template_id uuid not null references cs_templates(id) on delete cascade,
  version int not null,
  modules jsonb not null default '[]'::jsonb,
  required_modules text[] not null default '{}',
  optional_modules text[] not null default '{}',
  compliance_rules jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique(template_id, version)
);

-- ---------------------------------------------------------------------------
-- Campaigns & targets
-- ---------------------------------------------------------------------------

create table if not exists cs_campaigns (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  internal_name text,
  objective text,
  traffic_type text check (traffic_type in (
    'organic','paid_search','paid_social','directory','education','market_test'
  )),
  vertical_id uuid references cs_treatment_verticals(id) on delete set null,
  status text not null default 'draft' check (status in ('draft','active','paused','archived')),
  owner_admin_id text,
  metrics jsonb not null default '{}'::jsonb,
  settings jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger cs_campaigns_updated_at
  before update on cs_campaigns
  for each row execute function cs_set_updated_at();

create index if not exists cs_campaigns_status_idx on cs_campaigns(status);
create index if not exists cs_campaigns_vertical_idx on cs_campaigns(vertical_id);

create table if not exists cs_campaign_targets (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references cs_campaigns(id) on delete cascade,
  vertical_id uuid references cs_treatment_verticals(id) on delete set null,
  geo_id uuid references cs_geo_entities(id) on delete set null,
  intent text,
  clinic_ids text[] not null default '{}',
  include boolean not null default true,
  warnings jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

create unique index if not exists cs_campaign_targets_unique_idx
  on cs_campaign_targets (
    campaign_id,
    coalesce(vertical_id, '00000000-0000-0000-0000-000000000000'::uuid),
    coalesce(geo_id, '00000000-0000-0000-0000-000000000000'::uuid),
    coalesce(intent, '')
  );

create index if not exists cs_campaign_targets_campaign_idx on cs_campaign_targets(campaign_id);

-- ---------------------------------------------------------------------------
-- Pages
-- ---------------------------------------------------------------------------

create table if not exists cs_pages (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid references cs_campaigns(id) on delete set null,
  template_version_id uuid references cs_template_versions(id) on delete set null,
  page_type text,
  host text not null default 'organic' check (host in ('organic','ads')),
  slug text not null,
  path text not null unique,
  service_slug text,
  state_slug text,
  city_slug text,
  geo_id uuid references cs_geo_entities(id) on delete set null,
  vertical_id uuid references cs_treatment_verticals(id) on delete set null,
  status text not null default 'draft' check (status in (
    'draft','generating','generation_failed','needs_review','changes_requested',
    'approved','scheduled','published','paused','archived','redirected'
  )),
  indexing_policy text not null default 'noindex_follow' check (indexing_policy in (
    'index_follow','noindex_follow','noindex_nofollow','draft_inaccessible'
  )),
  public_title text,
  internal_title text,
  seo_title text,
  seo_description text,
  canonical_url text,
  hero jsonb not null default '{}'::jsonb,
  cta_primary text,
  cta_secondary text,
  form_config jsonb not null default '{}'::jsonb,
  routing_config jsonb not null default '{}'::jsonb,
  related_article_id text,
  current_version int not null default 1,
  published_at timestamptz,
  scheduled_for timestamptz,
  quality_score int,
  override_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(host, slug)
);

create trigger cs_pages_updated_at
  before update on cs_pages
  for each row execute function cs_set_updated_at();

create index if not exists cs_pages_campaign_idx on cs_pages(campaign_id);
create index if not exists cs_pages_status_idx on cs_pages(status);
create index if not exists cs_pages_path_idx on cs_pages(path);

create table if not exists cs_page_versions (
  id uuid primary key default gen_random_uuid(),
  page_id uuid not null references cs_pages(id) on delete cascade,
  version int not null,
  snapshot jsonb not null default '{}'::jsonb,
  blocks jsonb not null default '[]'::jsonb,
  editor_admin_id text,
  change_summary text,
  approved_by text,
  approved_at timestamptz,
  created_at timestamptz not null default now(),
  unique(page_id, version)
);

create table if not exists cs_page_clinics (
  id uuid primary key default gen_random_uuid(),
  page_id uuid not null references cs_pages(id) on delete cascade,
  clinic_id text not null,
  is_primary boolean not null default false,
  weight numeric not null default 1,
  unique(page_id, clinic_id)
);

-- ---------------------------------------------------------------------------
-- Generation & quality
-- ---------------------------------------------------------------------------

create table if not exists cs_generation_jobs (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid references cs_campaigns(id) on delete set null,
  page_id uuid references cs_pages(id) on delete set null,
  status text not null default 'queued' check (status in ('queued','running','succeeded','failed')),
  payload jsonb not null default '{}'::jsonb,
  error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  finished_at timestamptz
);

create trigger cs_generation_jobs_updated_at
  before update on cs_generation_jobs
  for each row execute function cs_set_updated_at();

create table if not exists cs_generation_audit (
  id uuid primary key default gen_random_uuid(),
  job_id uuid references cs_generation_jobs(id) on delete set null,
  page_id uuid references cs_pages(id) on delete set null,
  model text,
  prompt_version text,
  sources jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists cs_quality_reports (
  id uuid primary key default gen_random_uuid(),
  page_id uuid not null references cs_pages(id) on delete cascade,
  score int,
  checks jsonb not null default '[]'::jsonb,
  blocking boolean not null default false,
  override_reason text,
  created_at timestamptz not null default now()
);

create index if not exists cs_quality_reports_page_idx on cs_quality_reports(page_id, created_at desc);

-- ---------------------------------------------------------------------------
-- Redirects, experiments, analytics
-- ---------------------------------------------------------------------------

create table if not exists cs_redirects (
  id uuid primary key default gen_random_uuid(),
  from_path text unique not null,
  to_path text not null,
  status_code int not null default 301,
  page_id uuid references cs_pages(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists cs_experiments (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  status text not null default 'draft',
  created_at timestamptz not null default now()
);

create table if not exists cs_experiment_variants (
  id uuid primary key default gen_random_uuid(),
  experiment_id uuid not null references cs_experiments(id) on delete cascade,
  label text not null,
  page_id uuid references cs_pages(id) on delete set null,
  weight numeric not null default 1,
  created_at timestamptz not null default now()
);

create table if not exists cs_page_analytics_daily (
  page_id uuid not null references cs_pages(id) on delete cascade,
  day date not null,
  views int not null default 0,
  leads int not null default 0,
  form_starts int not null default 0,
  form_completions int not null default 0,
  cta_clicks int not null default 0,
  primary key (page_id, day)
);

-- ---------------------------------------------------------------------------
-- patient_leads attribution columns
-- ---------------------------------------------------------------------------

alter table if exists patient_leads
  add column if not exists cs_page_id uuid,
  add column if not exists cs_campaign_id uuid;

-- ---------------------------------------------------------------------------
-- Seed data
-- ---------------------------------------------------------------------------

insert into cs_treatment_verticals (slug, name, category) values
  ('trt', 'TRT', 'hormone'),
  ('sexual-health', 'Sexual Health', 'specialty'),
  ('weight-management', 'Weight Management', 'metabolic'),
  ('glp-1', 'GLP-1', 'metabolic'),
  ('peptides', 'Peptides', 'wellness'),
  ('hair-restoration', 'Hair Restoration', 'aesthetic'),
  ('primary-care', 'Primary Care', 'general'),
  ('telehealth', 'Telehealth', 'virtual')
on conflict (slug) do nothing;

-- Geo hierarchy: US -> California -> Los Angeles -> cities
insert into cs_geo_entities (id, kind, slug, name, parent_id, state_code) values
  ('a1000000-0000-4000-8000-000000000001', 'country', 'us', 'United States', null, null)
on conflict do nothing;

insert into cs_geo_entities (id, kind, slug, name, parent_id, state_code) values
  ('a1000000-0000-4000-8000-000000000002', 'state', 'california', 'California', 'a1000000-0000-4000-8000-000000000001', 'CA')
on conflict do nothing;

insert into cs_geo_entities (id, kind, slug, name, parent_id, state_code) values
  ('a1000000-0000-4000-8000-000000000003', 'metro', 'los-angeles', 'Los Angeles', 'a1000000-0000-4000-8000-000000000002', 'CA')
on conflict do nothing;

insert into cs_geo_entities (kind, slug, name, parent_id, state_code) values
  ('city', 'beverly-hills', 'Beverly Hills', 'a1000000-0000-4000-8000-000000000003', 'CA'),
  ('city', 'santa-monica', 'Santa Monica', 'a1000000-0000-4000-8000-000000000003', 'CA'),
  ('city', 'west-hollywood', 'West Hollywood', 'a1000000-0000-4000-8000-000000000003', 'CA'),
  ('city', 'pasadena', 'Pasadena', 'a1000000-0000-4000-8000-000000000003', 'CA'),
  ('city', 'long-beach', 'Long Beach', 'a1000000-0000-4000-8000-000000000003', 'CA')
on conflict do nothing;

insert into cs_templates (id, slug, name, page_type, description) values
  ('b1000000-0000-4000-8000-000000000001', 'service-location', 'Service Location', 'service_location', 'Organic service + geo landing page'),
  ('b1000000-0000-4000-8000-000000000002', 'paid-conversion', 'Paid Conversion', 'paid_conversion', 'Paid ads conversion landing page')
on conflict (slug) do nothing;

insert into cs_template_versions (template_id, version, modules, required_modules, optional_modules, compliance_rules) values
  (
    'b1000000-0000-4000-8000-000000000001',
    1,
    '["hero","value_props","faq","cta","form","clinic_list"]'::jsonb,
    array['hero','cta','form'],
    array['value_props','faq','clinic_list'],
    '{"require_disclaimer": true, "no_medical_claims": true}'::jsonb
  ),
  (
    'b1000000-0000-4000-8000-000000000002',
    1,
    '["hero","benefits","social_proof","faq","cta","form"]'::jsonb,
    array['hero','cta','form'],
    array['benefits','social_proof','faq'],
    '{"require_disclaimer": true, "no_medical_claims": true, "paid_traffic": true}'::jsonb
  )
on conflict (template_id, version) do nothing;

-- ---------------------------------------------------------------------------
-- RLS: enabled, no anon policies, service_role only
-- ---------------------------------------------------------------------------

do $$
declare
  tbl text;
begin
  foreach tbl in array array[
    'cs_treatment_verticals','cs_geo_entities','cs_templates','cs_template_versions',
    'cs_campaigns','cs_campaign_targets','cs_pages','cs_page_versions','cs_page_clinics',
    'cs_generation_jobs','cs_generation_audit','cs_quality_reports','cs_redirects',
    'cs_experiments','cs_experiment_variants','cs_page_analytics_daily'
  ] loop
    execute format('alter table %I enable row level security', tbl);
    execute format('revoke all on table %I from anon', tbl);
    execute format('grant all on table %I to service_role', tbl);
  end loop;
end $$;
