-- Persist the provider lifecycle on the original call attempt. These columns
-- are intentionally additive so existing call history remains readable.
ALTER TABLE IF EXISTS public.prospect_calls
  ADD COLUMN IF NOT EXISTS "durationSec" integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "direction" text NOT NULL DEFAULT 'outbound',
  ADD COLUMN IF NOT EXISTS "attemptNumber" integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS "decisionMakerReached" boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "interestLevel" text NOT NULL DEFAULT 'unknown',
  ADD COLUMN IF NOT EXISTS "objections" text NOT NULL DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS "nextAction" text,
  ADD COLUMN IF NOT EXISTS "nextActionAt" timestamptz,
  ADD COLUMN IF NOT EXISTS "followUpRequired" boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "pipelineStageRecommendation" text,
  ADD COLUMN IF NOT EXISTS "doNotCall" boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "invalidNumber" boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "provider" text NOT NULL DEFAULT 'vapi',
  ADD COLUMN IF NOT EXISTS "providerCallId" text,
  ADD COLUMN IF NOT EXISTS "status" text NOT NULL DEFAULT 'initiated',
  ADD COLUMN IF NOT EXISTS "failureCode" text,
  ADD COLUMN IF NOT EXISTS "failureMessage" text,
  ADD COLUMN IF NOT EXISTS "transcript" text NOT NULL DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS "aiSuggestions" text NOT NULL DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS "structuredData" text NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS "metadata" text NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS "recordingUrl" text,
  ADD COLUMN IF NOT EXISTS "updatedAt" timestamptz NOT NULL DEFAULT now();

CREATE INDEX IF NOT EXISTS prospect_calls_status_started_at_idx
  ON public.prospect_calls ("status", "startedAt" DESC);

CREATE INDEX IF NOT EXISTS prospect_calls_provider_call_id_idx
  ON public.prospect_calls ("providerCallId");

ALTER TABLE IF EXISTS public.prospect_calls ENABLE ROW LEVEL SECURITY;
