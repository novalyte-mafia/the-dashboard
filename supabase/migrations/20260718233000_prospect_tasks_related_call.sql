-- Link follow-up tasks to the call session that created them (Founder-Led CRM loop).
ALTER TABLE public.prospect_tasks
  ADD COLUMN IF NOT EXISTS "relatedCallId" text NULL;

ALTER TABLE public.prospect_tasks
  ADD COLUMN IF NOT EXISTS "relatedDealId" text NULL;

CREATE INDEX IF NOT EXISTS prospect_tasks_related_call_idx
  ON public.prospect_tasks ("relatedCallId")
  WHERE "relatedCallId" IS NOT NULL;
