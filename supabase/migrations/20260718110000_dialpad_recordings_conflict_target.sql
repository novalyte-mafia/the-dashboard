-- PostgREST upsert (ON CONFLICT (call_session_id, recording_provider_id))
-- cannot infer a *partial* unique index. Replace the partial index from
-- 20260718100000 with a full unique index; Postgres allows multiple NULL
-- recording_provider_id rows either way, so legacy local-backup rows are
-- unaffected.
DROP INDEX IF EXISTS public.call_recordings_provider_recording_uidx;

CREATE UNIQUE INDEX IF NOT EXISTS call_recordings_provider_recording_uidx
  ON public.call_recordings (call_session_id, recording_provider_id);
