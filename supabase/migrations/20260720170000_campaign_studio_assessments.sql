-- Campaign Studio embedded assessments
-- Extends pages with versioned assessment configs that reuse the public assessment engine.

create table if not exists cs_assessment_templates (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  name text not null,
  category text not null,
  assessment_engine_slug text not null,
  description text,
  mode text not null default 'full' check (mode in ('full','short','qualification')),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger cs_assessment_templates_updated_at
  before update on cs_assessment_templates
  for each row execute function cs_set_updated_at();

create table if not exists cs_assessment_template_versions (
  id uuid primary key default gen_random_uuid(),
  template_id uuid not null references cs_assessment_templates(id) on delete cascade,
  version int not null,
  status text not null default 'draft' check (status in ('draft','approved','published','retired')),
  config jsonb not null default '{}'::jsonb,
  question_ids text[] not null default '{}',
  required_question_ids text[] not null default '{}',
  optional_question_ids text[] not null default '{}',
  eligibility_rules jsonb not null default '{}'::jsonb,
  disqualification_rules jsonb not null default '{}'::jsonb,
  consent_version text not null default 'v1',
  consent_copy text,
  completion_message text,
  next_action text not null default 'show_clinics',
  approved_by text,
  approved_at timestamptz,
  created_at timestamptz not null default now(),
  unique(template_id, version)
);

-- Page-level assessment attachment (stable published pointer)
alter table cs_pages
  add column if not exists assessment_template_id uuid references cs_assessment_templates(id) on delete set null,
  add column if not exists assessment_version_id uuid references cs_assessment_template_versions(id) on delete set null,
  add column if not exists assessment_placement text[] not null default array['below_hero'],
  add column if not exists assessment_status text not null default 'unconfigured'
    check (assessment_status in ('unconfigured','draft','ready','published','invalid'));

create table if not exists cs_page_assessment_bindings (
  id uuid primary key default gen_random_uuid(),
  page_id uuid not null references cs_pages(id) on delete cascade,
  template_id uuid not null references cs_assessment_templates(id),
  version_id uuid not null references cs_assessment_template_versions(id),
  placement text[] not null default array['below_hero'],
  routing_config jsonb not null default '{}'::jsonb,
  prefill jsonb not null default '{}'::jsonb,
  last_tested_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(page_id)
);

create trigger cs_page_assessment_bindings_updated_at
  before update on cs_page_assessment_bindings
  for each row execute function cs_set_updated_at();

-- Attribution on analytics daily
alter table cs_page_analytics_daily
  add column if not exists assessment_views int not null default 0,
  add column if not exists assessment_starts int not null default 0,
  add column if not exists assessment_completions int not null default 0,
  add column if not exists assessment_abandons int not null default 0;

-- Seed assessment templates mapped to public engine slugs
insert into cs_assessment_templates (id, slug, name, category, assessment_engine_slug, description, mode) values
  ('c1000000-0000-4000-8000-000000000001', 'trt-full', 'TRT Full Assessment', 'trt', 'testosterone-replacement-therapy', 'Full TRT informational assessment', 'full'),
  ('c1000000-0000-4000-8000-000000000002', 'trt-short', 'TRT Short Conversion', 'trt', 'testosterone-replacement-therapy', 'Shorter paid-campaign TRT assessment', 'short'),
  ('c1000000-0000-4000-8000-000000000003', 'weight-full', 'Weight Management Full', 'weight-management', 'medical-weight-loss', 'Full weight-management assessment', 'full'),
  ('c1000000-0000-4000-8000-000000000004', 'weight-short', 'Weight Management Short', 'weight-management', 'medical-weight-loss', 'Short conversion weight assessment', 'short'),
  ('c1000000-0000-4000-8000-000000000005', 'glp1-full', 'GLP-1 Full', 'glp-1', 'glp-1', 'GLP-1 program assessment', 'full'),
  ('c1000000-0000-4000-8000-000000000006', 'sexual-health-full', 'Sexual Health Full', 'sexual-health', 'erectile-dysfunction', 'Sexual health / ED assessment', 'full'),
  ('c1000000-0000-4000-8000-000000000007', 'peptides-full', 'Peptide Therapy Full', 'peptides', 'peptide-therapy', 'Peptide therapy assessment', 'full'),
  ('c1000000-0000-4000-8000-000000000008', 'hair-full', 'Hair Restoration Full', 'hair-restoration', 'hair-restoration', 'Hair restoration assessment', 'full'),
  ('c1000000-0000-4000-8000-000000000009', 'telehealth-eligibility', 'Telehealth Eligibility', 'telehealth', 'testosterone-replacement-therapy', 'Telehealth-focused eligibility flow', 'qualification'),
  ('c1000000-0000-4000-8000-00000000000a', 'clinic-matching', 'General Clinic Matching', 'general', 'hormone-optimization', 'Broader clinic-matching assessment', 'full')
on conflict (slug) do nothing;

insert into cs_assessment_template_versions (
  template_id, version, status, config, consent_version, consent_copy, completion_message, next_action, approved_at
)
select
  t.id,
  1,
  'published',
  jsonb_build_object(
    'engine_slug', t.assessment_engine_slug,
    'mode', t.mode,
    'skip_known_geo', true,
    'skip_known_treatment', true
  ),
  'v1',
  'I acknowledge this assessment is informational and does not provide a medical diagnosis. I consent to being contacted about care navigation.',
  'Your responses have been received. Final eligibility must be determined by a licensed provider.',
  'show_clinics',
  now()
from cs_assessment_templates t
on conflict (template_id, version) do nothing;

-- Vertical → default assessment template mapping helper column on verticals
alter table cs_treatment_verticals
  add column if not exists default_assessment_slug text;

update cs_treatment_verticals set default_assessment_slug = 'trt-full' where slug = 'trt';
update cs_treatment_verticals set default_assessment_slug = 'sexual-health-full' where slug = 'sexual-health';
update cs_treatment_verticals set default_assessment_slug = 'weight-full' where slug = 'weight-management';
update cs_treatment_verticals set default_assessment_slug = 'glp1-full' where slug = 'glp-1';
update cs_treatment_verticals set default_assessment_slug = 'peptides-full' where slug = 'peptides';
update cs_treatment_verticals set default_assessment_slug = 'hair-full' where slug = 'hair-restoration';
update cs_treatment_verticals set default_assessment_slug = 'telehealth-eligibility' where slug = 'telehealth';
update cs_treatment_verticals set default_assessment_slug = 'clinic-matching' where slug = 'primary-care';

do $$
declare
  tbl text;
begin
  foreach tbl in array array[
    'cs_assessment_templates','cs_assessment_template_versions','cs_page_assessment_bindings'
  ] loop
    execute format('alter table %I enable row level security', tbl);
    execute format('revoke all on table %I from anon', tbl);
    execute format('grant all on table %I to service_role', tbl);
  end loop;
end $$;
