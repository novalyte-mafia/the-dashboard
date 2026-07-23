# Telephony Diagnosis — Outbound Calling & Call Logging

**Date:** 2026-07-23  
**Scope:** Novalyte admin dashboard (`novalyte-dashboard` / admin.novalyte.io)

## Executive verdict

Browser outbound calling fails because **Telnyx production environment variables exist as empty strings**. The softphone code path is real, but `/api/telephony/token` cannot mint a WebRTC token without `TELNYX_API_KEY`, `TELNYX_CREDENTIAL_ID`, and `TELNYX_PHONE_NUMBER`.

Separately, today’s three cell-phone outreach calls were never logged because:

1. They were placed on a personal phone **outside** the dashboard softphone.
2. The **Log Call** dialog existed in code but was **not wired into any UI**, so there was no 60-second path to record external calls.

## Answers to the diagnosis checklist

| # | Question | Answer |
| --- | --- | --- |
| 1 | Provider the dashboard uses | **Telnyx WebRTC** for browser calling. Dialpad exists but is **disabled by default**. Vapi is used for AI/practice console only. |
| 2 | Integration complete? | **Partial.** Softphone UI + session create + token route + TeXML voice stub exist. No Telnyx call-status webhook. Dialpad full stack exists but is off. |
| 3 | What happens on Call click | Creates `prospect_calls` row → requests Telnyx token → `@telnyx/webrtc` `newCall`. With empty env, status API reports `configured: false` and UI toasts config errors / blocks softphone. |
| 4 | Exact failure point | `GET /api/telephony/token` → 503 when env empty; UI never registers a Telnyx client, so no ring audio and no two-way media. |
| 5 | Credentials missing/invalid? | **Missing (empty).** Vercel Production has the variable *names* but values are `""`. Local `.env.local` also has empty Telnyx keys. |
| 6 | Phone number purchased/configured? | Cannot verify in Telnyx portal without API key. Env `TELNYX_PHONE_NUMBER` is empty in Production pull. |
| 7 | Account verification/payment required? | Unknown until valid API key works. Code is not the blocker — empty secrets are. |
| 8 | Browser-based calling supported? | **Yes, via Telnyx WebRTC** when credentials are present. |
| 9 | Can Dialpad do embedded calling? | Dialpad path rings an operator **device/app** then connects clinic (CTI), not a first-class in-browser WebRTC softphone. Current account/env also empty/`disabled`. |
| 10 | Is Telnyx the better fit? | **Yes** for in-browser mic/speaker calling. Keep Dialpad disabled unless CTI on a Dialpad desk phone is intentionally required. |

## Why today’s calls vanished

- Product design of Founder-Led “personal phone” mode coaches while **you** dial on your cell — it does **not** capture PSTN metadata from the carrier.
- Without starting a personal-phone coaching session **or** using Log Call, no `prospect_calls` row is written.
- Log Call dialog was orphaned (never mounted).

## Provider decision

**Selected primary:** Telnyx WebRTC softphone  
**Secondary fallback:** Manual “Log external call” for cell-phone / off-platform dials  
**Not primary:** Dialpad (disabled; wrong model for browser mic/speaker)

## Outside-the-codebase steps (required to place live softphone calls)

1. Telnyx portal → create/copy **API Key**
2. Telnyx → **Credential Connections** (WebRTC) → copy **Credential ID**
3. Telnyx → **Numbers** → outbound number in E.164 (`+1…`)
4. Set on Vercel project `novalyte-dashboard` **Production** (non-empty):
   - `TELNYX_API_KEY`
   - `TELNYX_CREDENTIAL_ID`
   - `TELNYX_PHONE_NUMBER`
5. Optional for coach while on personal phone: `DEEPGRAM_API_KEY`, `DEEPGRAM_PROJECT_ID`
6. Redeploy admin dashboard after env update
7. In Chrome: allow microphone → Founder-Led → **Call in browser** → test dial to your own cell first

Until step 4–6 are done, softphone calling **cannot** succeed. Code changes below make failures loud, restore external call logging, and harden post-call capture.
