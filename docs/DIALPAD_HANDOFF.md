# Dialpad Integration — Handoff

## What was completed

A production Dialpad integration inside `the-dashboard` that lets an operator
select a clinic, click **Call with Dialpad**, conduct the call in the Dialpad
desktop/browser/CTI app, and have call records, events, transcripts, recording
metadata, notes, outcomes, and follow-ups land in Supabase.

All seven phases from the original brief are implemented:

1. Feature flags, env validation, Dialpad server client, additive migrations
2. Call initiation API, provisional sessions, mock call flow, Call with Dialpad UI
3. Signed webhook endpoint, event persistence, state machine, active-call UI
4. Enrichment jobs (call details / transcript / recording), cron route, post-call panel
5. Call history, transcript display, recording access, outcomes, follow-ups, training-review status
6. Reconciliation job, diagnostics endpoint, unit + E2E tests, documentation
7. Optional CTI component behind a disabled feature flag

The existing Telnyx/Vapi practice-call flow on the Calls page is unchanged.
Dialpad is a separate mode toggle on the same page.

## Files created

### Core library — `src/lib/dialpad/`

- `env.ts`, `errors.ts`, `types.ts`, `schemas.ts`, `phone.ts`, `custom-data.ts`
- `jwt.ts`, `state-machine.ts`, `normalizers.ts`, `log.ts`, `sanitize.ts`
- `client.ts`, `mock.ts`, `service.ts`, `intelligence.ts`
- `__tests__/` — phone, env, custom-data, jwt, state-machine, normalizers, errors, service-schedule

### API routes

- `src/app/api/integrations/dialpad/calls/route.ts`
- `src/app/api/integrations/dialpad/calls/[id]/route.ts`
- `src/app/api/integrations/dialpad/calls/[id]/transcript/route.ts`
- `src/app/api/integrations/dialpad/calls/[id]/recording/route.ts`
- `src/app/api/integrations/dialpad/webhook/route.ts`
- `src/app/api/integrations/dialpad/status/route.ts`
- `src/app/api/integrations/dialpad/cti/route.ts`
- `src/app/api/cron/dialpad-enrichment/route.ts`
- `src/app/api/cron/dialpad-reconcile/route.ts`

### UI

- `src/components/admin/views/dialpad/dialpad-call-view.tsx`
- `src/components/admin/views/dialpad/dialpad-cti.tsx`

### Tooling / tests / docs

- `scripts/dialpad/setup.mjs`
- `scripts/test-dialpad-mock-flow.mjs`
- `vitest.config.ts`, `src/test/server-only-stub.ts`
- `docs/DIALPAD_INTEGRATION.md` (this handoff's companion)
- `docs/DIALPAD_HANDOFF.md`

### Migrations

- `supabase/migrations/20260718100000_dialpad_integration.sql`
- `supabase/migrations/20260718110000_dialpad_recordings_conflict_target.sql`
- Plus six empty placeholder files (`20260716055803…` … `20260716080400…`) so
  local migration history aligns with migrations that were applied directly on
  the remote database before tracking was aligned. They contain no SQL.

## Files modified

- `.env.example` — Dialpad + CRON placeholders
- `vercel.json` — enrichment (*/5) and reconcile (hourly) crons
- `package.json` / `package-lock.json` — `vitest`, `test`, `test:dialpad-flow` scripts
- `src/components/admin/views/calls.tsx` — Dialpad mode toggle + `DialpadCallView`
- `src/app/api/clinics/route.ts` — fix `fromStage` null violation on clinic create
  (pre-existing bug surfaced by the Dialpad mock-flow test)
- `docs/PROVIDER_INTEGRATIONS.md` — Dialpad section (see companion edit)

## Migrations created / applied

Applied to the linked remote project `iuuhcnwqozjrehmgpcqo`
(Novalyte-AI-Updated) via `supabase db push --linked`:

1. `20260718100000_dialpad_integration.sql` — additive columns + new tables
2. `20260718110000_dialpad_recordings_conflict_target.sql` — full unique index
   for PostgREST recording upserts

Also repaired the local↔remote migration history for four earlier migrations
that already existed on the remote but were unmarked locally
(`20260716132521`, `20260716141511`, `20260717020000`, `20260717040000`).

## Environment variables still needed (for live mode)

Already set locally for mock mode:

```
DIALPAD_MODE=mock
DIALPAD_INTEGRATION_ENABLED=true
DIALPAD_CTI_ENABLED=false
NEXT_PUBLIC_DIALPAD_CTI_ENABLED=false
```

For the first live test / production, set these server-side (Vercel Production
scope; never `NEXT_PUBLIC_` for secrets):

```
DIALPAD_MODE=live
DIALPAD_INTEGRATION_ENABLED=true
DIALPAD_API_KEY=<from Dialpad admin>
DIALPAD_USER_ID=<numeric Dialpad user id>
DIALPAD_OUTBOUND_CALLER_ID=<optional E.164 owned by Dialpad>
DIALPAD_WEBHOOK_SECRET=<shared secret you choose; same value in Dialpad webhook>
NEXT_PUBLIC_APP_URL=https://<your-production-host>
CRON_SECRET=<random string; same value protecting /api/cron/*>
```

Optional later:

```
DIALPAD_CTI_ENABLED=true
DIALPAD_CTI_CLIENT_ID=<issued by Dialpad after origin allowlisting>
NEXT_PUBLIC_DIALPAD_CTI_ENABLED=true
```

## Manual Dialpad steps still needed

1. Create an API key with call + transcript + webhook scopes.
2. Identify the Dialpad user ID that will place calls.
3. Confirm an outbound caller ID (if you want a specific CLID).
4. Confirm recording / transcription are enabled for that office/user in Dialpad.
5. Run `node scripts/dialpad/setup.mjs --apply` against production env to
   create the signed webhook and call-event subscription.
6. Optionally insert a `dialpad_user_mappings` row mapping each Novalyte admin
   to their Dialpad user.
7. CTI (later): request a CTI client ID from Dialpad and have them allowlist
   the dashboard origin. Do not enable the CTI flags until that is done.

## CTI provisioning status

**Not provisioned.** The component is implemented and gated behind
`DIALPAD_CTI_ENABLED=false` (default). The core call flow works without it.

## Remaining limitations

- No live external transcript stream — Dialpad public API is post-call only.
  During a call, use Dialpad native coaching + Novalyte talk track / objection
  cards. `supportsLiveTranscript()` returns `false`.
- Recording playback redirects to the provider URL after auth; no Supabase
  Storage mirror yet.
- Reconciliation covers a recent-window of concluded calls only.
- Calling-hours enforcement only applies when clinic timezone data exists and
  only in live mode.
- Mock mode must never be left enabled in production.

## Exact test steps (mock, already verified)

```bash
# 1. Env
DIALPAD_MODE=mock
DIALPAD_INTEGRATION_ENABLED=true

# 2. Dev server
npm run dev

# 3. Unit tests
npx vitest run
# Expected: 56 passed

# 4. E2E mock flow (against the running server)
node scripts/test-dialpad-mock-flow.mjs
# Expected: 21 passed, 0 failed
# The script refuses to run unless the server reports mock mode.

# 5. Manual UI check
# Admin → Calls → Dialpad mode → select a clinic → Call with Dialpad
# Observe: Initiating → Mock Dialpad badge → ringing → connected → completed
# Open transcript after enrichment; save outcome + follow-up.
```

## Exact steps for the first authorized live test

Do **not** place a real clinic call without explicit authorization. Prefer a
controlled internal/test number first.

1. Confirm `DIALPAD_MODE=live` and all required credentials are set in the
   target environment (dev or a preview — not production until the dry run
   succeeds).
2. Confirm Dialpad recording/transcription are on for the test user.
3. Run `node scripts/dialpad/setup.mjs` (dry run), review the planned webhook
   URL and states, then `--apply`.
4. Open `/api/integrations/dialpad/status` as an admin — mode=`live`,
   `configErrors=[]`, API connection status healthy.
5. Choose a **test** destination number you control (not a real clinic).
6. From the Calls → Dialpad page, click **Call with Dialpad**.
7. Answer on the Dialpad device; confirm the dashboard moves
   initiating → ringing → connected.
8. End the call; confirm completed status, enrichment jobs enqueue, transcript
   and recording metadata appear within a few minutes (or after a manual
   `POST /api/cron/dialpad-enrichment` with the cron secret).
9. Save an outcome + follow-up; confirm they appear on the clinic and in
   Follow-ups.
10. Only after this controlled test succeeds, authorize a real clinic call.

## Recommended next phase

1. Provision Dialpad CTI (client ID + origin allowlist) and enable the flag.
2. Optional: mirror recordings into a private Supabase Storage bucket with
   short-lived signed URLs and retention tracking.
3. Optional: per-operator Dialpad user mapping UI (today: table insert /
   `DIALPAD_USER_ID` fallback).
4. Future: if Dialpad grants verified live-stream transcript access, flip
   `supportsLiveTranscript()` and wire `subscribeToLiveTranscript()` —
   without fabricating streams from speaker/mic capture.
