# Novalyte Founder Call Copilot — Implementation Plan

**Status:** Planning complete; implementation not started under this plan  
**Horizon:** Operational by Monday (no 4-hour rush)  
**Foundation:** `/Users/jamilyakasai/Downloads/the-dashboard` (current Novalyte admin dashboard)  
**Branch (at plan authoring):** `codex/production-mobile-call-activity`  
**Last known commit at plan authoring:** `3e00b64b166bcd8323c20fc44bdef5b5e6fbfabf`

---

## 1. Product objective

The first production release is a **founder-led real-time call copilot** for clinic **directory-permission** calls.

Jamil (founder) speaks with the clinic. The AI never speaks to the clinic in this mode.

The copilot must:

- Support the founder while he speaks.
- Listen to both sides of the call (browser softphone audio).
- Produce a live transcript with speaker labels.
- Identify what the clinic has just asked or communicated.
- Track the current conversation stage.
- Suggest exactly what to say next (short, speakable, correct).
- Prevent rambling, repetition, contradictions, and irrelevant answers.
- Keep the call focused exclusively on permission to include the clinic in Novalyte’s **free men’s health directory**.
- Record and store the call, transcript, notes, outcome, and follow-up information.
- Reduce cognitive load under pressure (anti-freeze: calm, concise, accurate next line).

**Success for v1:** The founder can complete controlled rehearsals and at least one low-risk live clinic call without credibility damage, with suggestions that match the clinic’s latest complete statement and never introduce paid acquisition.

---

## 2. Non-goals for the first release

This release is **not**:

- An autonomous AI caller (Kaizen-style agent that speaks first).
- A fully automated outbound campaign or queue auto-dialer.
- A patient-acquisition sales call.
- An advertising pitch.
- A paid listing offer.
- An AI voice speaking to the clinic on the founder’s behalf.
- A Twilio-based telephony stack.
- A personal-phone-to-speaker workaround.
- A merge of Kaizen acquisition GTM knowledge into live suggestions.

The AI **must not** introduce leads, advertising, contracts, pricing packages, paid acquisition, or future commercial services unless the founder **explicitly** moves the call into that subject (out of scope for v1 permission calls; treat as prohibited).

---

## 3. Existing-system assessment

### 3.1 `~/Downloads/the-dashboard` (SELECTED FOUNDATION)

| Area | Status | Notes / paths |
|------|--------|----------------|
| Telnyx WebRTC softphone | Implemented, **unverified live PSTN** | `src/components/admin/views/calls.tsx`, `src/app/api/telephony/token/route.ts`, `session/route.ts` |
| Deepgram stereo STT | Implemented, **unverified channel fidelity** | `calls.tsx` (mic=ch0 Jamil, remote=ch1 Clinic), `src/app/api/copilot/deepgram/route.ts` |
| Silent copilot suggest API | Partial | `src/app/api/copilot/suggest/route.ts` — deterministic-first for known intents |
| Transcript reasoning | Partial / **unsafe gaps** | `src/lib/calls/transcript-context.ts` — cost polarity bug (“Does it cost?” → “Yes — free”); DNC falls through |
| Directory-only guard | Implemented | `src/lib/calls/directory-only-guard.ts` |
| Recording + consent | Partial | Routes under `src/app/api/calls/[id]/consent`, `recording`, `analyze`; remote hangup finalize incomplete; local-backup route referenced but missing |
| Knowledge RAG | Partial | `src/lib/knowledge/*`, migrations `20260717020000_copilot_knowledge_base.sql` |
| Simulation / Vapi practice | Implemented | Practice mode in `calls.tsx`; `src/app/api/vapi/practice-*` — rehearsal for AI clinic, not founder softphone proof |
| Call Console (legacy) | Separate / weaker | `src/components/admin/views/call-console.tsx` — do not use as live path |
| Anti-freeze UI hierarchy | **Missing** | No Say now / Shorter / Do not say / Freeze / Reason structure |
| Conversation stage machine | **Missing** | Intent→stage mapping only; UI chips mismatch live stages |
| Regression scripts | Partial | `scripts/test-copilot-regression.mjs`, `scripts/test-simulation-copilot-flow.mjs` |

**Reusable as-is:** Telnyx + Deepgram wiring, directory-only guard, recording schema migration, Calls view shell, suggest route structure.  
**Must fix before live clinic:** polarity, DNC, unknown-intent safe fallbacks, suggestion hierarchy UI, hangup finalize, rehearsal gate.  
**Replace/extend:** thin intent switch → full state machine + validator.

### 3.2 `~/Downloads/novalyte-abm-3` (Kaizen — richest ABM voice ops)

| Area | Status | Notes / paths |
|------|--------|----------------|
| Product mode | Autonomous Vapi caller | AI speaks first — **wrong mode** for founder copilot |
| Voice API | More complete | `api/voice/[...path].ts` (~1132 lines); slim `api/dev/_voice/handler.js` for local |
| Prompt sync | Implemented (full path) | `server/_lib/vapiAssistantSync.ts`, `kaizenSystemPrompt.ts` |
| Knowledge model | Implemented, **wrong GTM** | `src/lib/kaizenKnowledgeModel.ts`, `docs/kaizen-knowledge/novalyte-voice-knowledge.json` — patient acquisition |
| Dangerous seed copy | Present | `src/data/seeds/voiceAgent.ts` — pay-per-consult, guaranteed consults |
| Live operator cockpit | Implemented | `src/features/cockpit/LiveConsole.tsx`, `CallStage.tsx`, `ConsoleContext.tsx` |
| Outcomes taxonomy | Useful | `src/lib/callState.ts` |
| Schema | Real | `supabase/migrations/20260411195000_voice_ops_vapi.sql`, `20260430000000_operator_console.sql` |
| Telnyx/Deepgram first-party | Absent | Types only mention telnyx/twilio |
| Dual handlers / orphan UI | Debt | Unrouted `VoiceAgentPage.tsx`, docks |

**Adapt:** outcome codes, quiet hours/DNC patterns, knowledge *schema shape*, cockpit layout ideas.  
**Reject:** Kaizen persona, acquisition knowledge, autonomous dial as live path, operator “Say” that forces AI speech to clinic.

### 3.3 `~/Downloads/new-abm-main 2` (earlier Kaizen console)

| Area | Status | Notes / paths |
|------|--------|----------------|
| Voice console UI | Implemented thinner | `src/pages/VoiceAgent.tsx` |
| Voice API | Partial / **routing risk** | `api/_voice/[...path].js` — `req.query.path` may never be set under unified API |
| Vapi dial | Code present | No first-party STT/TTS |
| Schema | Conflicting bootstraps | Multiple `voice_ops` migrations; ID type conflicts |
| Founder copilot | Absent | |
| Secrets in docs | Risk | Deployment markdown historically contained credentials — rotate if still valid; do not copy |

**Reuse lightly:** operational ideas only. Prefer `novalyte-abm-3` over this for any pattern reference.

### 3.4 Kaizen naming rule

Legacy code may say **Kaizen**. Production Novalyte product uses **Novalyte** naming only. Do not carry Kaizen into UI, prompts, or public copy.

---

## 4. Recommended architecture

### 4.1 Foundation decision

| Decision | Choice | Why |
|----------|--------|-----|
| Foundation repo | `the-dashboard` | Already has founder mode, Telnyx, Deepgram, silent coach, directory guard |
| Not foundation | Kaizen ABM repos | Autonomous caller; wrong GTM; no Telnyx/Deepgram pipeline |
| Telephony | Telnyx WebRTC | No Twilio; browser softphone |
| Transcription | Deepgram streaming multichannel | Stereo diarization path already coded |
| Model (optional polish) | GLM via existing keys | Only after deterministic policy; never primary for cost/DNC |
| Simulation clinic AI | Vapi web (existing) | Rehearsal only; not live PSTN foundation |
| Persistence | Supabase | Existing prospect + call recording migrations |
| Deployment | Vercel (existing project) | After Monday readiness criteria pass |

### 4.2 End-to-end execution flow

| Step | Action | Owner |
|------|--------|-------|
| 1 | Clinic record selected from queue | Admin UI (`CallsView`) + `prospect_clinics` |
| 2 | Browser-based call initiated | Telnyx WebRTC (`/api/telephony/token`, `calls.tsx`) |
| 3 | Mic + remote audio captured | Browser MediaStream / Telnyx remote stream |
| 4 | Audio streamed to transcription | Deepgram listen WS (`/api/copilot/deepgram` temp key) |
| 5 | Partial + final transcripts processed | Client merge (2800ms) + server `groupTranscriptTurns` |
| 6 | Speaker roles identified | Channel index: 0=Jamil, 1=Clinic |
| 7 | Conversation state updated | **New:** `CallConversationState` module |
| 8 | Clinic intent classified | Deterministic classifier on **latest grouped clinic turn** |
| 9 | Deterministic safety rules applied | Pre-generation guardrails + directory-only |
| 10 | Suggestion generated | Deterministic library primary; optional GLM only if allowed |
| 11 | Suggestion validated | Post-generation validator (polarity, prohibited topics, length) |
| 12 | Suggestion shown in real time | Copilot panel hierarchy |
| 13 | Recording + transcript persisted | MediaRecorder → `/api/calls/[id]/recording`; segments tables |
| 14 | Outcome, notes, follow-up stored | Existing save call log + follow-ups |
| 15 | Review / scoring | Post-call panel + suggestion feedback |

### 4.3 Target module layout (to implement)

```
src/lib/calls/
  conversation-state.ts      # structured state model
  call-stage-machine.ts      # stages + transitions
  intent-classifier.ts       # latest-turn intents (evolve from transcript-context)
  response-library.ts        # exact speakable lines + shorter + do-not-say + freeze
  suggestion-validator.ts    # pre/post rules
  directory-only-guard.ts    # keep
  transcript-pipeline.ts     # fragment merge policy (extract from UI)
  recording-consent.ts       # keep / harden

src/app/api/copilot/
  suggest/route.ts           # orchestrate: state → classify → library → validate → optional GLM
```

---

## 5. Conversation intelligence design

### 5.1 Structured state model (`CallConversationState`)

Required fields (minimum):

| Field | Type / meaning |
|-------|----------------|
| `call_stage` | Enum from stage machine |
| `latest_clinic_utterance` | Latest **grouped complete** clinic turn |
| `latest_jamil_utterance` | Latest founder turn |
| `detected_question` | Normalized question text if any |
| `detected_intent` | Enum (purpose, cost, sales, email, busy, decline, dnc, grant, …) |
| `permission_status` | `unknown` \| `pending` \| `granted` \| `declined` \| `dnc` |
| `cost_concern` | boolean / resolved |
| `gatekeeper_status` | `none` \| `active` \| `passed` |
| `info_provided` | `{ phone?, services?, accepting?, email?, contact_name? }` |
| `info_required` | Remaining fields for listing |
| `objections_raised` | string[] |
| `commitments_by_founder` | string[] (e.g. “will email summary”) |
| `response_required` | boolean |
| `suggested_primary` | string |
| `suggested_shorter` | string |
| `suggested_ask_next` | string \| null |
| `do_not_say` | string[] |
| `freeze_recovery` | string |
| `reason_internal` | string (not spoken) |
| `prohibited_topics_active` | string[] |
| `confidence` | 0–1 |
| `source` | `deterministic` \| `validated_ai` \| `fallback_card` |
| `escalation` | `none` \| `clarify` \| `follow_up` \| `end_call` |
| `transcript_revision` | monotonic int for stale rejection |
| `clinic_still_speaking` | boolean |

### 5.2 Partial transcript policy

- Do **not** run suggestion generation on unstable partials.
- Deepgram: only `is_final` (or equivalent) feeds the classifier.
- Client: merge same-speaker fragments within ~2800ms; debounce copilot 1100–2200ms.
- Require “complete enough” heuristic OR terminal punctuation OR timeout after silence.
- Increment `transcript_revision` on every clinic update; ignore API responses with older revision.
- Abort in-flight suggest requests when a newer clinic turn arrives.

### 5.3 Generation order (hard)

1. Update state from grouped transcript.  
2. Classify intent on **latest clinic turn only**.  
3. Apply pre-generation guardrails (blocked actions).  
4. Select deterministic library response if intent known OR policy requires deterministic.  
5. Else optional GLM with policy + directory-only + max length.  
6. Post-generation validator; reject → fallback card line.  
7. Display hierarchy to founder.

---

## 6. Deterministic guardrails

### 6.1 Pre-generation

- If clinic is still speaking → no new primary suggestion (listening state).
- If `permission_status === dnc` → only compliance close; block all pitch.
- If unanswered direct question → block checklist advance (email/phone/booking asks).
- If intent is cost → force cost template; never GLM.
- If intent is decline/dnc → force exit templates; never persuade.
- Directory-only: strip/block acquisition language before any model call.

### 6.2 Hard content rules

- Cost question (“does it cost / any fee / how much”) → response must begin with **“No”** (or equivalent clear negative on cost), then free/no obligation. **Never** begin with “Yes” to a cost question.
- Never describe the listing as paid.
- Never introduce advertising, patient leads, or paid acquisition.
- Never claim clinic already listed / partnership / patients ready.
- Never claim permission granted unless clear grant detected.
- Never fabricate clinic details.
- Never answer a question the clinic did not ask (no topic jump).
- Never repeat full introduction unless clinic asks what this is / clarify.
- Max speakable length: prefer ≤ 2 short sentences (~30 spoken words).
- One primary response; alternatives only in labeled secondary slots.
- DNC / remove us → acknowledge + end; no email upsell unless they ask.

### 6.3 Post-generation validator

Reject or rewrite if:

- Prohibited commercial patterns (`directory-only-guard.ts` + expanded).
- Cost polarity failure (yes-framing on cost intent).
- Permission asserted without grant fact.
- Length > threshold.
- Repeats last 2 suggestions nearly identically.
- Conflicts with `blocked_actions` in policy.

Rejected → `fallback_card` line for current stage + low confidence warning.

---

## 7. Call-stage state machine

### 7.1 Stages

`ready` → `dialing` → `connected` → `greeting` → `gatekeeper` → `reason_for_call` → `directory_explanation` → `cost_question` → `information_request` → `permission_pending` → `permission_granted` | `permission_declined` | `not_interested` | `do_not_call` → `public_detail_confirmation` → `contact_confirmation` → `follow_up_requested` → `call_ending` → `completed`  
Also: `wrong_number`, `failed_disconnected` from almost any live stage.

### 7.2 Per-stage summary

| Stage | Entry | Expected intents | Permitted | Prohibited | Capture | Next |
|-------|-------|------------------|-----------|------------|---------|------|
| ready | Idle | — | Opening prep | Dial without checklist | Clinic profile | dialing |
| dialing | Start call | — | Wait | Suggestions as if live | Provider IDs | connected / failed |
| connected | Audio up | greeting | Consent script if needed | Sales | Consent event | greeting |
| greeting | First talk | hello, who is this | Opening line | Long pitch | — | gatekeeper / reason |
| gatekeeper | Front desk | who/regarding/busy | Listing contact ask | Hard sell | Gatekeeper flag | reason / follow_up / ending |
| reason_for_call | Purpose unclear | what about / why calling | Directory permission | Acquisition | — | directory / cost |
| directory_explanation | Confusion on product | what is Novalyte / how works | Free directory explain | Leads/patients ready | — | cost / info / permission |
| cost_question | Cost/free asked | ask_if_free | **No — free** template | Yes-framing, fees | cost_concern=resolved | permission / info |
| information_request | What do you need | ask_what_details | Public fields scope | PHI, contracts | — | permission / details |
| permission_pending | Asked for permission | wait | Short confirm ask | Pressure | — | granted / declined |
| permission_granted | Clear yes to list | grant | Thanks + one next field | Upsell | permission=granted | public_detail |
| permission_declined | Clear no | decline | Respect close | Persuasion | permission=declined | ending |
| not_interested | Soft/hard no | decline | Close | Pitch | outcome | ending |
| do_not_call | DNC/remove | dnc | Compliance close | Any pitch | dnc=true | ending |
| public_detail_confirmation | After grant | provide_info | One field at a time | New offers | phone/services/etc | contact / follow_up |
| contact_confirmation | Need email/contact | ask_for_email | Collect email | Marketing blasts | email | follow_up / ending |
| follow_up_requested | Callback/email later | busy / email | Schedule | Pressure | follow_up date | ending |
| wrong_number | Wrong party | — | Apologize end | Continue pitch | outcome | ending |
| call_ending | Wrap | — | Short thanks | New topics | — | completed |
| completed | Hangup saved | — | Post-call form | — | outcome/notes | — |
| failed_disconnected | Error/drop | — | Recover/redial policy | Fake success | error log | ready |

---

## 8. Live-response requirements

Primary suggestion:

- 1–3 short sentences.
- Immediately readable.
- Natural spoken English.
- Answers latest **complete** clinic statement.
- Consistent with prior commitments.
- No filler, no unsupported promises.
- Directory-permission objective only.

UI display:

- **Say this now** (dominant).
- **Shorter version**.
- **Ask next** (only when appropriate).
- **Do not say**.
- **If you freeze** (recovery).
- **Reason** (internal).
- Low-confidence warning when `source=fallback` or confidence &lt; threshold.

---

## 9. User-interface plan

Primary surface: **`CallsView`** (`src/components/admin/views/calls.tsx`) — founder cockpit.  
Deprioritize / eventually redirect `call-console.tsx` for live permission calls.

### Left panel
Clinic queue, name, city/state, phone, local time, call status, previous attempts, permission status, Start / Skip / Reschedule / Wrong number / DNC.

### Center panel
Active clinic, call controls, connection/audio state, waveform (optional v1), live transcript with labels, current stage, primary Say this next, Copy, Mark used, Pause suggestions, Request another, Manual context correction.

### Right panel
Objective reminder (free directory permission only), confirmed info, remaining fields, detected objection, notes, outcome, follow-up date, compliance warnings, provider latency/health.

### Pre-dial
Opening line + launch checklist gate (mic, audio, provider, recording, STT, suggest, guardrails, fallback card, outcome form, DNC handling).

---

## 10. Data model

Build on existing tables; add only what is missing.

### Existing (keep / extend)

| Table / area | Purpose | Migration |
|--------------|---------|-----------|
| `prospect_clinics` | Clinic records | prior |
| `prospect_calls` | Call sessions | prior + `callEnvironment` |
| `call_consent_events` | Consent | `20260717040000_call_recording_pipeline.sql` |
| `call_recordings` | Recording metadata + storage path | same |
| `call_transcript_segments` (if present in migration) | Segments | same |
| `call_post_analyses` | Post-call | same |
| Copilot knowledge tables | RAG | `20260717020000_copilot_knowledge_base.sql` |
| Storage bucket `call-recordings` | Private audio | ops |

### Required / to add or harden

| Entity | Purpose | Important fields | Relations | Indexes | RLS | Retention |
|--------|---------|------------------|-----------|---------|-----|-----------|
| call_sessions (or prospect_calls) | One dial attempt | clinic_id, admin_id, provider, status, stage, started/ended, environment | clinic | clinic+started | admin-only | operational |
| call_events | Provider + UI events | session_id, type, payload, ts | session | session+ts | admin-only | 90d+ |
| transcript_segments | Partial/final lines | session_id, speaker, text, is_final, revision, ts | session | session+ts | admin-only | call retention policy |
| speaker_turns | Grouped turns | session_id, speaker, text, start/end | session | session+ts | admin-only | same |
| ai_suggestions | Shown coaches | session_id, primary, shorter, reason, intent, stage, source, confidence, revision, validated | session | session+ts | admin-only | same |
| suggestion_feedback | Used/rejected | suggestion_id, rating, notes | suggestion | suggestion | admin-only | same |
| call_outcomes | Structured outcome | session_id, outcome_code, permission_status, dnc | session | outcome | admin-only | long |
| notes / follow_ups | Operator capture | existing follow-ups APIs | clinic/call | — | admin-only | long |
| prompt_versions | Library/policy versioning | version, hash, active | — | active | admin-only | forever |
| provider_events | Telnyx/Deepgram/Vapi | provider, event, payload redacted | session? | ts | admin-only | 30–90d |
| errors | App errors | code, message, session_id | — | ts | admin-only | 90d |

**RLS:** No open anon `using (true)` policies (lesson from Kaizen migrations). Service role for server routes; authenticated admin policies only.

---

## 11. Observability and debugging

Log (structured, no secrets, minimize PII):

- Audio connect / mute / hangup / reconnect.
- Transcript: final vs partial, speaker, revision, latency from speech end → text.
- Suggest: intent, stage, source, validation pass/fail + reason, timing.
- State transitions.
- Recording start/stop/upload success/fail.
- DB write failures.
- End-to-end: clinic final → suggestion painted (ms).

UI: provider health chips (Telnyx, Deepgram, Suggest). Failures visible — no silent mock success.

---

## 12. Testing strategy

### Automated
- Unit: classifier, polarity, DNC, directory-only, validator length/prohibited.
- State machine: legal/illegal transitions.
- Transcript replay fixtures → expected suggestion.
- API integration: suggest route with fixtures (auth test harness).
- Persistence: recording metadata row after controlled finalize.
- Regression script expanded: `scripts/test-copilot-regression.mjs`.

### Manual
- Browser mic/speaker.
- Controlled Telnyx call (non-clinic).
- Rehearsal mode scenarios.
- Low-risk live clinic only after Monday readiness criteria.

### Scenario library (required)

For each: intent, stage transition, allowed response traits, prohibited, stored outcome.

1. What is this about?  
2. Are you selling something?  
3. Does this cost anything? → **No — free**  
4. What information do you need?  
5. We already have a website.  
6. Who gave you our number?  
7. Send us an email.  
8. The manager is not available.  
9. You can list us.  
10. We are not interested.  
11. Take us off your list. / Do not call.  
12. Are you with Google?  
13. How do patients find the directory?  
14. Will you change our information?  
15. We are not accepting new patients.  

---

## 13. Phased implementation sequence

| # | Phase | Objective | Scope | Expected files | Dependencies | Acceptance | Tests | Risks | Rollback | Status |
|---|-------|-----------|-------|----------------|--------------|------------|-------|-------|----------|--------|
| 1 | Repo confirmation | Lock foundation | Docs only | this file, HANDOFF | — | Plan approved | Review | Scope creep | N/A | **Done (docs)** |
| 2 | Continuity docs | Agent handoff | IMPLEMENTATION_PLAN, HANDOFF | — | Accurate | — | Drift | Update continuously | **In progress** |
| 3 | Env/provider validation | Keys named + connectivity | `.env.example`, settings | Telnyx, Deepgram, Supabase | Token endpoints 200 | Manual | Missing env | Document gaps | Not started |
| 4 | Shared call-state model | `CallConversationState` | `conversation-state.ts` | — | Types compile | Unit | Overmodeling | Revert file | **Partial** (`copilot-types.ts`) |
| 5 | Stage machine | Transitions | `call-stage-machine.ts` | state model | Transition tests pass | Unit | Wrong edges | Revert | Not started |
| 6 | Guardrail engine | Pre/post rules | `suggestion-validator.ts`, expand directory-only | — | Polarity/DNC tests | Unit | False rejects | Feature flag | **Done (v1)** |
| 7 | Transcript pipeline | Extract merge/debounce | `transcript-pipeline.ts`, calls.tsx | Deepgram | Replay fixtures | Unit+manual | Channel swap | Keep old inline | Not started |
| 8 | Suggestion pipeline | Library + orchestrate | `response-library.ts`, refactor `transcript-context`, suggest route | 4–6 | All scenario library pass | Regression | Gaps in intents | Deterministic-only flag | **Done (v1)** |
| 9 | Validator in API | Reject bad lines | suggest route | 6–8 | Invalid suggestions never returned | Integration | Overblocking | Log + fallback | **Done (via library path)** |
| 10 | Browser calling harden | Hangup finalize, errors | calls.tsx, telephony routes, recording | Telnyx | Controlled call OK | Manual | PSTN issues | Simulation only | Not started |
| 11 | Supabase persistence | Suggestions/events tables | new migration | Supabase | Rows written | Integration | Migration conflict | Migrate down | Not started |
| 12 | Call workspace UI | Hierarchy + panels | calls.tsx | 8–9 | Anti-freeze UI complete | Manual | Scope UI | Hide new panels | **Next** |
| 13 | Recording/playback | Reliable archive | recording routes, fix local-backup | Storage | End Call saves audio | Manual | Upload fail | Local download | Not started |
| 14 | Rehearsal validation | Scenario gate | scripts + Simulation | 8–12 | All scenarios pass | Automated+manual | False confidence | Block live dial | Not started |
| 15 | Controlled test call | Non-clinic PSTN | — | 10–14 | Softphone+STT+suggest | Manual | Audio | — | Not started |
| 16 | Reliability/latency | Observability | logging helpers | — | Latency visible | Manual | Noise in logs | Reduce verbosity | Not started |
| 17 | Limited clinic release | One low-risk clinic | launch checklist | All critical | Monday criteria | Live | Trust damage | Stop dialing | Not started |
| 18 | Post-call loop | Feedback → library | feedback API, HANDOFF updates | — | Issues filed | Review | Neglect | — | Not started |

---

## 14. Monday readiness criteria

Not “UI loads.” All must be true:

- [ ] Real call initiated from intended environment (Telnyx WebRTC).
- [ ] Both sides hear each other clearly.
- [ ] Clinic speech transcribed with acceptable latency (target &lt; ~3s after final).
- [ ] Speaker attribution reliable enough (Jamil vs Clinic).
- [ ] Suggestion matches latest **completed** clinic statement.
- [ ] Cost questions answered with correct **No — free** polarity.
- [ ] Suggestions stay within free-directory objective.
- [ ] System does not repeatedly restart the introduction.
- [ ] Founder can pause or override suggestions.
- [ ] Call recorded when ended from app.
- [ ] Transcript stored.
- [ ] Outcome saved.
- [ ] Failures visible in UI/logs.
- [ ] Disconnected call handled cleanly.
- [ ] Controlled end-to-end non-clinic call passed.
- [ ] Multiple rehearsal scenarios passed without critical contradiction.
- [ ] DNC / not interested never get a continued pitch.
- [ ] Launch checklist enforced before dial (or manually signed in HANDOFF).

---

## 15. Explicit first implementation step (after docs)

**Phase 4–8 core:** Implement `response-library.ts` + fix polarity/DNC in classifier + `suggestion-validator.ts` + expand regression tests — **before** UI chrome and **before** any live clinic dial.

Do not start with visual polish or Kaizen ports.
