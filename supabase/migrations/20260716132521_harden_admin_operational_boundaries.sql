-- Keep prospect records, public listings, and admin activity auditable and
-- separated. The dashboard uses the server-side service role; anonymous and
-- browser clients must not be able to read or mutate these internal tables.

DO $$
BEGIN
  IF to_regclass('public.prospect_directory_profiles') IS NOT NULL THEN
    ALTER TABLE public.prospect_directory_profiles
      ADD COLUMN IF NOT EXISTS public_clinic_id text;
    CREATE INDEX IF NOT EXISTS prospect_directory_profiles_public_clinic_id_idx
      ON public.prospect_directory_profiles(public_clinic_id);
    ALTER TABLE public.prospect_directory_profiles ENABLE ROW LEVEL SECURITY;
  END IF;

  IF to_regclass('public.prospect_clinics') IS NOT NULL THEN
    ALTER TABLE public.prospect_clinics ENABLE ROW LEVEL SECURITY;
    CREATE INDEX IF NOT EXISTS prospect_clinics_archived_stage_idx
      ON public.prospect_clinics(archived, pipeline_stage);
  END IF;

  IF to_regclass('public.prospect_calls') IS NOT NULL THEN
    ALTER TABLE public.prospect_calls ENABLE ROW LEVEL SECURITY;
    CREATE INDEX IF NOT EXISTS prospect_calls_clinic_started_idx
      ON public.prospect_calls(clinic_id, started_at DESC);
  END IF;

  IF to_regclass('public.prospect_tasks') IS NOT NULL THEN
    ALTER TABLE public.prospect_tasks ENABLE ROW LEVEL SECURITY;
    CREATE INDEX IF NOT EXISTS prospect_tasks_due_status_idx
      ON public.prospect_tasks(status, due_date);
  END IF;
END $$;

-- Do not create permissive policies here. The server route layer validates the
-- signed admin session and role before using the service-role client.
