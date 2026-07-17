-- Novalyte AI Call Copilot — business knowledge base (RAG foundation)
-- Uses Postgres full-text search; pgvector can be added later for semantic retrieval.

create table if not exists copilot_knowledge_sources (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  source_type text not null default 'markdown',
  source_path text,
  approval_status text not null default 'approved' check (approval_status in ('approved', 'draft', 'outdated', 'rejected', 'internal')),
  version text not null default '1.0',
  is_enabled boolean not null default true,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_reviewed_at timestamptz
);

create table if not exists copilot_knowledge_entries (
  id uuid primary key default gen_random_uuid(),
  source_id uuid references copilot_knowledge_sources(id) on delete set null,
  category text not null,
  title text not null,
  content text not null,
  tags text[] not null default '{}',
  keywords text[] not null default '{}',
  call_stages text[] not null default '{}',
  approval_status text not null default 'approved' check (approval_status in ('approved', 'draft', 'outdated', 'rejected', 'internal')),
  external_approved boolean not null default true,
  confidence numeric(4,2) not null default 0.90,
  source_section text,
  version text not null default '1.0',
  effective_at timestamptz not null default now(),
  expires_at timestamptz,
  is_enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  search_document tsvector
);

create index if not exists copilot_knowledge_entries_search_idx
  on copilot_knowledge_entries using gin (search_document);

create or replace function copilot_knowledge_entries_search_document_update()
returns trigger language plpgsql as $$
begin
  new.search_document := to_tsvector('english',
    coalesce(new.title, '') || ' ' || coalesce(new.content, '') || ' ' || array_to_string(coalesce(new.keywords, '{}'), ' ')
  );
  return new;
end;
$$;

create trigger copilot_knowledge_entries_search_document_trg
  before insert or update on copilot_knowledge_entries
  for each row execute function copilot_knowledge_entries_search_document_update();
create index if not exists copilot_knowledge_entries_category_idx
  on copilot_knowledge_entries (category);
create index if not exists copilot_knowledge_entries_enabled_idx
  on copilot_knowledge_entries (is_enabled, approval_status);

create table if not exists copilot_response_feedback (
  id uuid primary key default gen_random_uuid(),
  call_session_id text,
  rating text not null check (rating in (
    'helpful', 'not_helpful', 'incorrect', 'too_long', 'too_aggressive',
    'repetitive', 'not_relevant', 'factually_inaccurate', 'used_successfully', 'edited_before_speaking'
  )),
  original_suggestion text,
  final_response_used text,
  transcript_context text,
  retrieved_knowledge jsonb,
  call_stage text,
  objection_type text,
  metadata jsonb,
  created_at timestamptz not null default now()
);

create index if not exists copilot_response_feedback_session_idx
  on copilot_response_feedback (call_session_id);
create index if not exists copilot_response_feedback_rating_idx
  on copilot_response_feedback (rating, created_at desc);
