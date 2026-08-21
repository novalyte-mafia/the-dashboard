-- Draft fields for research-driven outreach (human send / copy only).

alter table public.outreach_prospects
  add column if not exists draft_subject text,
  add column if not exists draft_message text,
  add column if not exists draft_generated_at timestamptz,
  add column if not exists draft_evidence_ids jsonb not null default '[]'::jsonb,
  add column if not exists draft_status text,
  add column if not exists draft_angle text,
  add column if not exists contact_route_type text not null default 'none',
  add column if not exists last_verified_at timestamptz,
  add column if not exists verification_result jsonb;

comment on column public.outreach_prospects.draft_status is
  'DRAFT | VERIFIED_READY | NEEDS_REVIEW | SENT | COPIED. SENT/COPIED are operator logs, not automated delivery.';
comment on column public.outreach_prospects.contact_route_type is
  'email | web_form | none';
