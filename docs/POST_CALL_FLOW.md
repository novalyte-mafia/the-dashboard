# What happens after a Dialpad clinic call

## During the call

1. You click **Call with Dialpad** from the dashboard (Founder-Led mode).
2. A `prospect_calls` row is created in Supabase immediately (provisional session).
3. Dialpad rings your device — speak in Dialpad.
4. Webhooks update call status (`ringing` → `connected` → …).
5. **Recording must be enabled in Dialpad** (office/user setting). The app cannot force Dialpad to record; it stores whatever Dialpad returns.

## When you hang up

```
Hangup (Dialpad and/or dashboard End call)
  → call session marked completed in Supabase (prospect_calls)
  → enrichment jobs queued: call_details + transcript + recording
  → Vercel cron every 5 min pulls Dialpad APIs
  → transcript lines → call_transcript_segments
  → recording metadata (Dialpad URL) → call_recordings
  → prospect_calls flags: transcriptStatus, recordingAvailable, recordingStatus
```

Hourly reconcile repairs missed webhooks.

## What you do in the UI (mandatory after each call)

1. Open the **Post-call workflow** panel.
2. Click **Load transcript / artifacts** (may take a few minutes).
3. Set:
   - Call outcome
   - Directory permission (`granted` / `denied` / `pending`)
   - Booking-link preference (if discussed)
   - Training review notes (optional)
4. Capture contact / follow-up if needed.
5. **Save** → updates clinic stage + creates `prospect_tasks` follow-up when required.

## Where data lives (Supabase)

| Data | Table |
|------|--------|
| Call session, permission, outcome | `prospect_calls` |
| Webhook event log | `call_events` |
| Transcript lines | `call_transcript_segments` |
| Recording metadata (Dialpad URL) | `call_recordings` |
| Enrichment queue | `dialpad_enrichment_jobs` |
| Follow-ups | `prospect_tasks` |

Note: Dialpad recordings are **not** mirrored into a private Storage bucket yet — we store Dialpad’s recording URL + metadata. Playback goes through `/api/integrations/dialpad/calls/[id]/recording`.

## Pre-flight before tomorrow’s first live clinic call

1. Vercel Production: `DIALPAD_MODE=live` and `DIALPAD_INTEGRATION_ENABLED=true`
2. Dialpad: Call Recording ON + AI Transcription ON for your user
3. Webhook pointing at `https://novalyte-dashboard.vercel.app/api/integrations/dialpad/webhook`
4. Crons running (`dialpad-enrichment` every 5m, `dialpad-reconcile` hourly)
5. Make one **test call to your own number**, hang up, confirm:
   - row in `prospect_calls`
   - transcript loads in UI
   - recording shows available
6. Then call clinics

## First-call objective (unchanged)

Permission → correct contact → verified public details → clear next step.  
Do not pitch paid acquisition on this call.
