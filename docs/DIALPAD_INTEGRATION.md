# Dialpad Integration

Production integration between the Novalyte AI Command Center and Dialpad.
Dialpad owns the phone number, PSTN calling, audio devices, native recording,
native transcription, and AI coaching. Novalyte owns clinic records, the call
queue, call initiation, status tracking, outreach history, notes, outcomes,
follow-ups, transcript storage, and training-data curation.

## Architecture

```
Clinic record (prospect_clinics)
      ↓  user clicks "Call with Dialpad"  (Calls page → Dialpad mode)
POST /api/integrations/dialpad/calls
      ↓  validates: auth, role, phone (E.164), do-not-call, archived,
      ↓  calling hours (live mode), duplicate/cooldown checks
Provisional call session (prospect_calls, status = initiating)
      ↓  server-only Dialpad client
POST https://dialpad.com/api/v2/call   (user_id, phone_number, custom_data)
      ↓  Dialpad rings the operator's active Dialpad device
Human conducts the call in the Dialpad app
      ↓  signed webhooks (JWT HS256)
POST /api/integrations/dialpad/webhook
      ↓  verify → dedupe (call_events) → match session (custom_data →
      ↓  provider call id → number+time fallback) → state machine update
prospect_calls status: ringing → connected → completed/failed/…
      ↓  terminal state ⇒ enrichment jobs (dialpad_enrichment_jobs)
GET /api/cron/dialpad-enrichment  (Vercel Cron, every 5 min)
      ↓  call details → transcript → recording metadata (with retry/backoff)
call_transcript_segments + call_recordings + prospect_calls updated
      ↓
Post-call panel: outcome, permissions, follow-up, training-review status
```

Key modules (all server-only except the UI):

| Path | Purpose |
| --- | --- |
| `src/lib/dialpad/env.ts` | Zod-validated config; modes `disabled\|mock\|live`; fails closed |
| `src/lib/dialpad/client.ts` | Typed HTTP client: auth header, timeouts, 429/Retry-After, normalized errors |
| `src/lib/dialpad/service.ts` | Domain layer: initiation, webhook processing, enrichment, reconciliation, diagnostics |
| `src/lib/dialpad/mock.ts` | Deterministic mock provider (never contacts Dialpad) |
| `src/lib/dialpad/state-machine.ts` | Ranked status transitions; no regression from terminal states |
| `src/lib/dialpad/jwt.ts` | HS256 JWT verification (node:crypto, no new dependency) |
| `src/lib/dialpad/normalizers.ts` | Provider state → normalized status; transcript normalization; event keys |
| `src/lib/dialpad/intelligence.ts` | `CallIntelligenceProvider` adapter; `supportsLiveTranscript()` returns `false` |
| `src/components/admin/views/dialpad/dialpad-call-view.tsx` | Calls-page Dialpad mode (queue, active call, post-call workflow) |
| `src/components/admin/views/dialpad/dialpad-cti.tsx` | Optional CTI iframe (flag + client ID gated) |

## Integration modes

Set with `DIALPAD_MODE` (never inferred from `NODE_ENV`):

- `disabled` — all Dialpad features hidden. Also the effective mode whenever
  `DIALPAD_INTEGRATION_ENABLED` is not `true`.
- `mock` — local development and automated tests. Never contacts Dialpad,
  never dials real numbers, shows a visible "Mock Dialpad" badge, simulates
  ringing/connected/completed, delayed transcripts, and provider errors
  (dial `+15005550429` to simulate rate limiting, `+15005550404` for a
  provider failure).
- `live` — real Dialpad API. Fails closed with explicit `configErrors` when
  `DIALPAD_API_KEY`, `DIALPAD_USER_ID`, or `DIALPAD_WEBHOOK_SECRET` are missing.

## Environment variables

Server-side (never expose, never log):

| Variable | Required | Notes |
| --- | --- | --- |
| `DIALPAD_MODE` | yes | `disabled` \| `mock` \| `live` |
| `DIALPAD_INTEGRATION_ENABLED` | yes | master switch, `true`/`false` |
| `DIALPAD_API_BASE_URL` | no | defaults to `https://dialpad.com/api/v2` |
| `DIALPAD_API_KEY` | live only | server-only secret |
| `DIALPAD_USER_ID` | live only | numeric Dialpad user ID that places calls |
| `DIALPAD_OUTBOUND_CALLER_ID` | no | E.164; must be a number owned by the Dialpad account |
| `DIALPAD_WEBHOOK_SECRET` | live only | HS256 secret for signed webhooks |
| `DIALPAD_CTI_ENABLED` | no | optional CTI phase |
| `DIALPAD_CTI_CLIENT_ID` | CTI only | issued by Dialpad after origin allowlisting |
| `NEXT_PUBLIC_DIALPAD_CTI_ENABLED` | no | client hint only; contains no secret |
| `NEXT_PUBLIC_APP_URL` | live only | used to build the webhook URL in setup |
| `CRON_SECRET` | production | protects `/api/cron/*` routes |

Placeholders live in `.env.example`. Do not commit real values.

## Dialpad account setup (live mode)

1. **API key** — Dialpad Admin Settings → Advanced/Developer → API keys
   (requires a plan with API access; see
   [help.dialpad.com/docs/create-an-api-key](https://help.dialpad.com/docs/create-an-api-key)).
   Scopes needed: calls (initiate/read), transcripts (read), webhooks +
   call event subscriptions (manage).
2. **User ID** — the Dialpad user who will place calls. Find it via
   `GET /api/v2/users` or the Dialpad admin console; set `DIALPAD_USER_ID`.
3. **Outbound caller ID** — optional; must be a number provisioned on the
   Dialpad account. Set `DIALPAD_OUTBOUND_CALLER_ID` in E.164.
4. **Webhook + call event subscription** — run the setup script:

   ```bash
   node scripts/dialpad/setup.mjs           # dry run: shows what would change
   node scripts/dialpad/setup.mjs --apply   # creates webhook + subscription
   ```

   The script tests authentication, reuses an existing webhook for the same
   URL, creates a signed webhook pointing at
   `${NEXT_PUBLIC_APP_URL}/api/integrations/dialpad/webhook`, subscribes to
   call events, prints the returned IDs, and never prints secrets. It never
   deletes existing Dialpad webhooks; to disable one, remove it from the
   Dialpad admin console or API manually.
5. **User mapping** — insert a row into `dialpad_user_mappings` linking the
   Novalyte admin (`app_user_id` = admin member id) to the Dialpad user id.
   Calls fall back to `DIALPAD_USER_ID` when no mapping exists.

## API routes

| Route | Method | Purpose |
| --- | --- | --- |
| `/api/integrations/dialpad/calls` | POST | initiate a call (auth + role required) |
| `/api/integrations/dialpad/calls` | GET | recent Dialpad call sessions |
| `/api/integrations/dialpad/calls/[id]` | GET / PATCH | session status; review/permission updates |
| `/api/integrations/dialpad/calls/[id]/transcript` | GET | post-call transcript (202 while pending) |
| `/api/integrations/dialpad/calls/[id]/recording` | GET | recording metadata; `?recordingId=` redirects after authorization |
| `/api/integrations/dialpad/webhook` | POST | signed call events (JWT HS256) |
| `/api/integrations/dialpad/status` | GET | sanitized diagnostics (no secrets) |
| `/api/integrations/dialpad/cti` | GET | CTI availability info |
| `/api/cron/dialpad-enrichment` | GET/POST | enrichment worker (CRON_SECRET or admin session) |
| `/api/cron/dialpad-reconcile` | GET/POST | reconciliation worker (CRON_SECRET or admin session) |

## Database

Two additive migrations (no destructive changes):

- `supabase/migrations/20260718100000_dialpad_integration.sql`
  - `prospect_calls`: adds `providerMasterCallId`, `providerUserId`,
    `externalNumber`, `internalNumber`, `outboundCallerId`, `previousStatus`,
    `ringingAt`, `connectedAt`, `lastEventAt`, `durationMs`,
    `transcriptStatus`, `recordingAvailable`, `providerCustomData`,
    `providerMetadata`, `trainingReviewStatus`, `directoryPermissionStatus`,
    `bookingLinkPermissionStatus`, plus indexes (provider+providerCallId
    unique partial, status, lastEventAt, externalNumber).
  - `call_events`: adds `provider`, `provider_event_key` (unique),
    `provider_call_id`, `event_state`, `event_timestamp`, `received_at`,
    `processed_at`, `processing_status`, `processing_error`, `payload_hash`.
  - `call_transcript_segments`: adds `provider_call_id`, `speaker_role`,
    `segment_type`.
  - `call_recordings`: adds `provider`, `provider_call_id`, `provider_url`,
    `recording_type`, `duration_ms`, `available_at`.
  - New tables: `dialpad_user_mappings`, `dialpad_enrichment_jobs`.
- `supabase/migrations/20260718110000_dialpad_recordings_conflict_target.sql`
  - converts the recordings unique index to a full (non-partial) index so
    PostgREST upserts can use it as an ON CONFLICT target.

RLS: every new table has RLS enabled with **no** anon/authenticated policies,
matching the existing model for all call tables in this database. The browser
never talks to these tables; all access goes through server routes that
validate the signed admin session (`requireAdminRole`) and then use the
service-role client. Provider webhook writes also go through the trusted
server path only.

Apply with:

```bash
supabase db push --linked
```

## Webhook security and idempotency

- Live mode requires a valid HS256 JWT signed with `DIALPAD_WEBHOOK_SECRET`;
  invalid signatures, malformed payloads, and expired tokens are rejected.
  Unsigned JSON is accepted **only** in mock mode.
- Every event is persisted to `call_events` with a unique
  `provider_event_key` and payload hash; duplicates return `outcome:
  "duplicate"` without reprocessing.
- The state machine ranks statuses so a late `ringing` can never overwrite
  `completed`; out-of-order events update audit rows but not the session
  status. Unknown provider states map to `unknown` and are preserved in
  `providerMetadata`.
- Session matching order: `custom_data.call_session_id` → provider call id →
  cautious fallback (number + direction + tight timestamp window).

## Enrichment and reconciliation

- Terminal call states enqueue `call_details`, `transcript`, and `recording`
  jobs in `dialpad_enrichment_jobs`.
- The worker claims jobs atomically (`locked_at`), retries on a schedule of
  ~10s/30s/90s/3m/5m then exponential backoff, stops after a max attempt
  count, and records `last_error` for manual retry.
- Vercel Cron (`vercel.json`): enrichment every 5 minutes, reconciliation
  hourly. Reconciliation lists recently concluded Dialpad calls, matches by
  provider call id (then custom data, then cautious fallback), inserts missed
  calls, repairs incomplete sessions, and reports an audit summary. It never
  matches on phone number alone.

## Recordings

Recording rows store provider references and availability only. The raw
provider URL is never returned in normal API responses; playback goes through
`/api/integrations/dialpad/calls/[id]/recording?recordingId=…`, which checks
the admin session before redirecting. Recording availability depends on the
Dialpad recording configuration and applicable notification/consent
requirements — the UI states this. Recordings are not mirrored into Supabase
Storage in this phase.

## Live-transcript limitation

Dialpad's public API provides **post-call** transcripts. The
`CallIntelligenceProvider` adapter returns `supportsLiveTranscript() ===
false`; nothing in the product simulates a live transcript. During a call the
operator uses Dialpad's native live transcription/AI coaching in the Dialpad
app, plus Novalyte's on-screen talk track and objection-response library. The
UI labels these sources distinctly.

## CTI (optional, off by default)

`DIALPAD_CTI_ENABLED=true` + `DIALPAD_CTI_CLIENT_ID` render the Dialpad-hosted
CTI iframe inside the Dialpad call view. Requirements: Dialpad must provision
the client ID and allowlist the dashboard origin. postMessage communication
validates `https://dialpad.com` as origin and target; listeners are cleaned up
on unmount. Without a client ID the UI shows: "Embedded Dialpad requires a CTI
client ID and dashboard-origin approval from Dialpad." The core integration
does not depend on CTI.

## Local development (mock mode)

```bash
# .env
DIALPAD_MODE=mock
DIALPAD_INTEGRATION_ENABLED=true

npm run dev
# Calls page → "Dialpad" mode → pick a clinic → Call with Dialpad
```

Mock mode simulates the full lifecycle in ~15 seconds and a delayed
transcript, and displays a "Mock Dialpad" badge.

## Testing

```bash
npx vitest run                          # 56 unit tests (env, phone, JWT,
                                        # state machine, normalizers, errors,
                                        # custom data, retry schedule)
node scripts/test-dialpad-mock-flow.mjs # E2E against a running mock-mode dev
                                        # server; refuses to run unless the
                                        # server reports mock mode
```

The E2E script covers: initiation, double-click block, ringing → connected →
completed, stale/duplicate webhook handling, delayed transcript enrichment,
recording metadata, outcome + training-review persistence, and follow-up task
creation. Automated tests can never place real calls.

## Production deployment

1. Set all live-mode env vars in Vercel (Production scope), including
   `CRON_SECRET`.
2. `supabase db push --linked` (or apply the two migrations via CI).
3. Deploy; `vercel.json` registers both cron routes automatically.
4. Run `node scripts/dialpad/setup.mjs --apply` once with production env vars
   to create the webhook + subscription.
5. Check `/api/integrations/dialpad/status` (as an admin) — it reports mode,
   credential presence, webhook freshness, and last provider error without
   exposing secrets.

## Troubleshooting

| Symptom | Check |
| --- | --- |
| Button says integration disabled | `DIALPAD_MODE`, `DIALPAD_INTEGRATION_ENABLED` |
| "Dialpad is not configured" in live mode | `configErrors` in the status endpoint: API key / user id / webhook secret |
| Call stuck in `initiating` | webhook not reachable or not created — re-run setup script; reconciliation will repair it within the hour |
| Webhook 401s | `DIALPAD_WEBHOOK_SECRET` mismatch between Dialpad webhook config and env |
| Transcript never appears | Dialpad transcription may be off for the office/user; job `last_error` in `dialpad_enrichment_jobs` |
| 429 responses | client honors `Retry-After`; initiation has per-user cooldown; wait and retry |
| CTI panel missing | `DIALPAD_CTI_ENABLED`, `DIALPAD_CTI_CLIENT_ID`, and Dialpad origin allowlisting |

## Known limitations

- No live external transcript stream (provider limitation; see above).
- Recording playback redirects to the provider URL; no Supabase Storage
  mirror yet.
- Reconciliation covers the trailing window only (recent concluded calls).
- Calling-hours enforcement applies only where clinic timezone data exists.
- CTI requires Dialpad-side provisioning before it can be enabled.

## Rollback

The integration is flag-gated and additive:

1. Set `DIALPAD_INTEGRATION_ENABLED=false` (or `DIALPAD_MODE=disabled`) and
   redeploy — all Dialpad UI and routes go inert; nothing else changes.
2. Optionally disable the Dialpad webhook in the Dialpad admin console.
3. Migrations are additive (new columns/tables only) and safe to leave in
   place. If removal is ever required, drop the two `dialpad_*` tables and
   the added columns in a new migration; no existing data is touched.
