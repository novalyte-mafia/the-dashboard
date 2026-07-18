# HANDOFF — Novalyte Founder Call Copilot

**Purpose:** Continuity for any coding agent continuing this work without re-inspecting from scratch.  
**Update rule:** Update this file continuously as work progresses. Do not wait until the end.  
**Plan companion:** `IMPLEMENTATION_PLAN.md`

---

## 1. Project summary

### What is being built
A **founder-led real-time call copilot** inside the Novalyte admin dashboard. The founder (Jamil) places browser-based calls to clinics and speaks personally. The AI listens, transcribes, tracks conversation state, and shows a short, accurate next line to say.

### Why
Cold calling under pressure causes freezing, rambling, repetition, and credibility risk. The product removes the burden of formulating every response while keeping the human as the speaker.

### What “founder mode” means
- Human speaks to the clinic at all times.
- AI is a **silent thinking partner**, not an autonomous voice agent.
- No AI TTS into the live clinic call.
- Simulation mode may use an AI clinic for rehearsal; that is not the live PSTN path.

### Free-directory objective
First live calls are **only** about obtaining permission to include the clinic in Novalyte’s **free men’s health directory** and confirming public listing details. No paid acquisition, advertising, leads, contracts, or pricing packages.

### What the AI may / may not do

**May:** Suggest short spoken lines; classify intent; track stage; warn; store suggestions for review.

**May not:** Speak to the clinic; invent facts; claim permission/listing without evidence; introduce paid acquisition; contradict the clinic’s question (especially cost polarity); generate from unstable partials.

### Successful first release
Monday readiness criteria in `IMPLEMENTATION_PLAN.md` §14 all pass; at least one controlled non-clinic E2E call; rehearsal scenario suite green; then optional low-risk clinic call.

---

## 2. Critical product rules (non-negotiable)

1. Jamil speaks; AI does not speak for him in founder mode.
2. AI is a real-time thinking partner.
3. First call type = free directory permission only.
4. No paid acquisition discussion.
5. No advertising pitch.
6. No lead-generation promise.
7. No autonomous dialing campaign.
8. No Twilio.
9. No personal-phone-to-speaker workaround.
10. No fabricated clinic information.
11. No assumption that permission was granted.
12. No long live-call scripts (keep suggestions speakable).
13. No response from incomplete/unstable clinic statements.
14. No contradictory yes/no answers (especially cost: must be **No — free**, never **Yes — free** to “does it cost?”).
15. Do not use Kaizen name in production UI/prompts.
16. Do not claim ready without tracing + testing the complete path.
17. Do not rush; correctness over calendar urgency (deadline is Monday operational readiness, not 4 hours).

---

## 3. Repository map

### Primary repo (foundation)
`/Users/jamilyakasai/Downloads/the-dashboard`

### Reference only (do not treat as runtime foundation)
| Path | Role |
|------|------|
| `~/Downloads/novalyte-abm-3` | Richest Kaizen/Vapi autonomous agent + cockpit patterns |
| `~/Downloads/new-abm-main 2` | Earlier thinner Kaizen voice console; routing debt |

### Important paths in `the-dashboard`

| Path | Role |
|------|------|
| `IMPLEMENTATION_PLAN.md` | Full architecture + phases |
| `HANDOFF.md` | This file |
| `src/components/admin/views/calls.tsx` | **Main founder call UI** (Live + Simulation) |
| `src/components/admin/views/call-console.tsx` | Legacy console — not the target live path |
| `src/app/api/telephony/token/route.ts` | Telnyx WebRTC token |
| `src/app/api/telephony/session/route.ts` | Call session create |
| `src/app/api/telephony/voice/route.ts` | TeXML dial (not primary WebRTC path) |
| `src/app/api/copilot/deepgram/route.ts` | Deepgram temp key for listen |
| `src/app/api/copilot/suggest/route.ts` | Suggestion orchestration |
| `src/app/api/copilot/tts/route.ts` | TTS (practice/rehearsal; not live founder speech) |
| `src/app/api/copilot/feedback/route.ts` | Suggestion feedback |
| `src/app/api/copilot/knowledge/*` | Knowledge admin APIs |
| `src/app/api/calls/[id]/consent/route.ts` | Consent events |
| `src/app/api/calls/[id]/recording/route.ts` | Recording upload |
| `src/app/api/calls/[id]/analyze/route.ts` | Post-call analysis |
| `src/app/api/vapi/practice-*` | Simulation AI clinic |
| `src/lib/calls/transcript-context.ts` | Intent + deterministic suggestions (**needs polarity/DNC fix**) |
| `src/lib/calls/directory-only-guard.ts` | Commercial language block |
| `src/lib/calls/recording-consent.ts` | Consent scripts/jurisdiction |
| `src/lib/calls/post-call-analysis.ts` | Heuristic analysis |
| `src/lib/knowledge/*` | RAG retrieval + GLM generate |
| `src/lib/providers/vapi.ts`, `glm.ts` | Provider clients |
| `supabase/migrations/20260717020000_copilot_knowledge_base.sql` | Knowledge tables |
| `supabase/migrations/20260717040000_call_recording_pipeline.sql` | Recording/consent/transcript pipeline |
| `scripts/test-copilot-regression.mjs` | Deterministic regression |
| `scripts/test-simulation-copilot-flow.mjs` | Screenshot scenario flow |
| `scripts/generate-ai-dialogue-recording.mjs` | Optional two-AI audio demo |
| `scripts/test-controlled-call-pipeline.mjs` | Pipeline test (no PSTN) |
| `public/copilot-demo/` | Generated rehearsal audio (untracked) |

### Entry points
- Admin app: `src/components/admin/admin-app.tsx` — view id `"calls"` → `CallsView`
- Sidebar: Command Center → **Calls** (not only Call Console)

### Deployment
- Vercel project historically: `novalyte-dashboard` under Novalyte team
- Prior prod deploy attempt failed on Vercel file upload API error (see Known issues)

---

## 4. Architecture decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Foundation | `the-dashboard` | Founder mode + Telnyx + Deepgram + silent coach already present |
| Reject as foundation | Kaizen ABM repos | Autonomous Vapi caller; acquisition GTM; no Telnyx/Deepgram stack |
| Reuse from novalyte-abm-3 | Outcome taxonomy ideas, quiet hours/DNC patterns, knowledge *schema shape*, cockpit layout ideas | High value without wrong product mode |
| Reject from Kaizen | Persona name, patient-acquisition knowledge, assistant-speaks-first dial, force-AI-say-to-clinic | Conflicts with founder + directory-only |
| Telephony | Telnyx WebRTC | No Twilio; browser softphone |
| Transcription | Deepgram multichannel streaming | Existing stereo path |
| Suggestion primary | Deterministic library + policy | Trust under pressure; polarity-safe |
| Suggestion secondary | GLM only when allowed | Optional wording; never for cost/DNC/decline |
| Guardrails | Pre + post validator + directory-only | Prevent contradictions |
| State | Explicit `CallConversationState` + stage machine | Not fragment→LLM only |
| Recording | Browser MediaRecorder + Supabase Storage `call-recordings` | Mandatory for official live |
| Realtime transport | Telnyx RTC + Deepgram WS + HTTP suggest | No custom SIP required for v1 |
| Deployment | Vercel | Existing; deploy only after readiness |
| Browser | Modern Chromium/Safari with mic permissions; headphones recommended | Echo control |

---

## 5. Implementation status

| Item | Status | Notes |
|------|--------|-------|
| Inspection of ABM + Kaizen | Done | See IMPLEMENTATION_PLAN §3 |
| IMPLEMENTATION_PLAN.md | Done | Created |
| HANDOFF.md | In progress | Continuously updated |
| Shared call-state model (`CallConversationState`) | Not started | Types started in `copilot-types.ts` |
| Stage machine | Not started | |
| Response library + polarity/DNC fix | **Implemented + tested** | `response-library.ts`, classifier fixes |
| Suggestion validator | **Implemented + tested** | `suggestion-validator.ts` |
| Transcript pipeline extract | Not started | Logic still inline in calls.tsx |
| Suggest API orchestration harden | **Implemented** | All permission intents forced deterministic |
| Anti-freeze UI hierarchy | **Implemented** | Calls panel: Say now / Shorter / Do not say / Freeze / Emergency card |
| Telnyx live PSTN verification | Not started | Code present, unverified |
| Deepgram channel verification | Not started | |
| Recording hangup finalize | Blocked/known issue | Remote hangup may skip finalize |
| Local-backup API | Missing | Referenced, route absent |
| Rehearsal scenario gate | **Expanded** | 25 regression scenarios PASS |
| Supabase suggestion/event tables | Partial | Recording pipeline migration exists |
| Monday readiness | Not started | |
| Live clinic call | Deferred | Blocked until readiness |

### Already in tree

| Area | Files | What | Limitation | Next |
|------|-------|------|------------|------|
| Types | `src/lib/calls/copilot-types.ts` | Shared intents + facts + policy | Not full CallConversationState yet | Expand state model |
| Response library | `src/lib/calls/response-library.ts` | Speakable primary/shorter/doNotSay/freeze | Hierarchy not yet in UI | Wire Calls UI |
| Validator | `src/lib/calls/suggestion-validator.ts` | Cost polarity rewrite, DNC, length, commercial | — | Keep expanding |
| Classifier + suggest | `transcript-context.ts`, `suggest/route.ts` | Deterministic-only for permission call | UI hierarchy pending | Anti-freeze panel |
| Regression | `scripts/test-copilot-regression.mjs` | 25 scenarios | Run via `npx tsx` | Add to CI later |

---

## 6. Current working state

### Runs
- Next.js app: `npx next dev -p 3000` (or project script)
- Local URL: `http://localhost:3000/`
- Navigate: Command Center → **Calls** → Live or Simulation

### Commands
```bash
cd /Users/jamilyakasai/Downloads/the-dashboard
npm run dev          # if defined; else npx next dev -p 3000
node scripts/test-copilot-regression.mjs
node scripts/test-simulation-copilot-flow.mjs
npx tsc --noEmit
npm run build
```

### Services required
- Supabase (URL + service role)
- Telnyx (live dial)
- Deepgram (STT/TTS)
- GLM (optional AI path)
- Vapi (simulation only)

### Env var names
See §7. **Never commit secrets. Do not paste values into this file.**

### Known runtime / quality issues
- Cost question → “Yes — free” polarity failure (verified via node).
- “Do not call us again” → falls through to directory pitch.
- “What is Novalyte?” / “Where did you get our info?” → weak default pitch.
- Stage UI chips mismatch live `call_stage` values.
- Prior Vercel prod deploy failed (API Internal Server on file upload).
- Uncommitted local changes on branch (see §11).

### Lint / TS
- Full-repo eslint historically noisy; focus on changed files.
- `tsc` was green after prior suggest route type fix; re-run after each phase.

### Deployment status
- Not deploying under this plan until Monday readiness criteria pass.
- Do not treat old dashboard URL as proof of new copilot behavior.

---

## 7. Environment variables (names only)

| Variable | Service | Required for | Verified? | Scope | If missing |
|----------|---------|--------------|-----------|-------|------------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase | App data | Check locally | all | Data fails |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase | Server writes | Check | server | API 500 |
| `NOVALYTE_ACCESS_CODE` | Auth | Login | — | all | Auth fail |
| `NOVALYTE_SESSION_SECRET` | Auth | Sessions | — | server | Auth fail |
| `NOVALYTE_ADMIN_EMAIL` | Auth | Admin identity | — | server | — |
| `NEXT_PUBLIC_DATA_MODE` | App | demo/hybrid/live | — | client | Wrong data mode |
| `TELNYX_API_KEY` | Telnyx | Live softphone | Must verify | server | Cannot dial |
| `TELNYX_CREDENTIAL_ID` | Telnyx | WebRTC token | Must verify | server | Token fail |
| `TELNYX_PHONE_NUMBER` | Telnyx | Caller ID | Must verify | server | Dial fail |
| `DEEPGRAM_API_KEY` | Deepgram | STT (+ TTS) | Must verify | server | No transcript |
| `DEEPGRAM_PROJECT_ID` | Deepgram | Temp keys | Must verify | server | Token fail |
| `GLM_API_KEY` | GLM | Optional AI suggest | Optional for deterministic-only | server | AI path fails; OK if deterministic-only |
| `GLM_MODEL` / `GLM_API_URL` | GLM | Model endpoint | Optional | server | Defaults used |
| `VAPI_API_KEY` | Vapi | Simulation | Optional for live | server | Simulation fallback |
| `VAPI_ASSISTANT_ID` | Vapi | Simulation | Optional | server | Simulation fail |
| `VAPI_PHONE_NUMBER_ID` | Vapi | Outbound Vapi (not founder path) | N/A founder | server | — |
| `HUME_VOICE_ID` / `HUME_CUSTOM_VOICE` | Vapi practice voice | Simulation polish | Optional | server | Default voice |
| `FIRECRAWL_API_KEY` | Research | Unrelated to call MVP | No | server | Research fail |
| `POSTHOG_*` | Analytics | Optional | No | — | No analytics |

**Note:** `.env.example` is incomplete vs Telnyx/Deepgram — update `.env.example` during Phase 3 without secrets.

---

## 8. Database state

### Migrations in repo
- `20260716132521_harden_admin_operational_boundaries.sql`
- `20260716141511_call_session_provider_lifecycle.sql`
- `20260717020000_copilot_knowledge_base.sql`
- `20260717040000_call_recording_pipeline.sql`

### Applied remotely (as of prior session — re-verify)
- Knowledge + recording pipeline reported applied to linked project `iuuhcnwqozjrehmgpcqo`
- Private bucket `call-recordings` created
- `prospect_calls.callEnvironment` added manually in prior work

### Pending
- New tables for `ai_suggestions`, richer `call_events`, prompt_versions (per plan) — **not started**
- RLS audit vs Kaizen-style open policies — ensure dashboard policies are admin-safe

### Seed
- Copilot knowledge may need admin “Seed approved bundle” — verify before relying on RAG

### Cleanup
- Do not commit `.env`
- `public/copilot-demo/`, `public/voice-previews/` may be local artifacts

---

## 9. Provider state

| Provider | Purpose | Config | Verified? | Webhooks | Local | Prod | Limits |
|----------|---------|--------|-----------|----------|-------|------|--------|
| Telnyx | Live softphone | API key + credential + number | **Unverified this plan** | voice route exists | Token via API | Same | WebRTC browser limits |
| Deepgram | STT (+ Aura TTS) | API key + project | **Unverified live stereo** | N/A (client WS) | Temp key route | Same | Channel fidelity risk |
| GLM | Optional suggest polish | API key | Present historically | N/A | Server | Server | Rate limits (429 seen in demos) |
| Vapi | Simulation clinic only | API key + assistant | Practice path | practice proxy | Proxy origin | Same | Not founder live |
| Supabase | DB + storage | URL + service role | Partially | N/A | Local/prod project | Same | — |

---

## 10. Test results

| Test | Date | Env | Result | Notes | Fix | Retest |
|------|------|-----|--------|-------|-----|--------|
| `npx tsx scripts/test-copilot-regression.mjs` (25 scenarios) | 2026-07-17 | local | **PASS** | Cost polarity, DNC, FAQs covered | — | Re-run after classifier changes |
| Cost polarity spot check | 2026-07-17 | local | **PASS** (fixed) | Was Yes-framing; now No — free | response-library + validator | Done |
| DNC spot check | 2026-07-17 | local | **PASS** (fixed) | Was directory pitch; now compliance close | do_not_call intent | Done |
| Simulation flow script | 2026-07-17 | local | **PASS** | Directory listing question OK | — | Keep |
| Anti-freeze UI | — | — | **Not run** | API fields ready; UI not wired | Wire calls.tsx | Pending |
| Telnyx PSTN E2E | — | — | **Not run** | — | — | Pending |
| Deepgram stereo live | — | — | **Not run** | — | — | Pending |
| Vercel prod deploy | 2026-07-17 | Vercel | **FAIL** | Invalid JSON / Internal Server on `/v2/files` | Retry later after readiness | Deferred |
| Full Monday readiness | — | — | Not started | — | — | — |

---

## 11. Known issues and risks

### Critical
1. ~~Cost polarity~~ — **Fixed** in library/validator (25-scenario PASS). Still require UI verify before live clinic.
2. ~~DNC mishandling~~ — **Fixed** (`do_not_call`). Still require UI verify.
3. **Live softphone unverified** — Impact: call failure. Action: controlled Telnyx test. **Blocks live clinic.**

### High
4. Anti-freeze UI hierarchy not wired (API returns fields; Calls UI still single line).
5. Recording finalize on remote hangup incomplete.
6. Local-backup route missing.

### Medium
7. Stage UI vs live stages mismatch.
8. Full stage machine / CallConversationState not extracted yet.
9. Dual Call Console vs Calls navigation confusion.
10. Uncommitted WIP on branch.

### Low
11. Demo audio folders untracked.
12. Regression requires `npx tsx` (not plain `node`).

---

## 12. Exact next steps (for the next agent)

1. Run `npx tsx scripts/test-copilot-regression.mjs` — must stay PASS.
2. Manual UI check: Command Center → **Calls** → confirm Say now / Shorter / Do not say / Freeze / Emergency card render.
3. Implement `call-stage-machine.ts` + expand `CallConversationState` (Phase 4–5).
4. Controlled Telnyx + Deepgram test on non-clinic numbers; record in §10.
5. Fix recording finalize on hangup + local-backup route or remove dead reference.
6. Do not deploy / do not dial real clinics until Monday readiness checklist is complete.
7. Update this HANDOFF after each step.

---

## 13. Last known good checkpoint

| Field | Value |
|-------|-------|
| Git branch | `codex/production-mobile-call-activity` |
| Latest commit (HEAD) | `3e00b64b166bcd8323c20fc44bdef5b5e6fbfabf` — *Fix live copilot ignoring clinic answers and sounding scripted.* |
| Tracks remote | `origin/codex/production-mobile-call-activity` |
| Uncommitted at handoff authoring | Modified: `.env` (do not commit), `suggest/route.ts`, `calls.tsx`, `transcript-context.ts`, `copilot-generate.ts`. **New:** `copilot-types.ts`, `response-library.ts`, `suggestion-validator.ts`, `IMPLEMENTATION_PLAN.md`, `HANDOFF.md`, regression/demo scripts, `public/copilot-demo/`, `public/voice-previews/` |
| Last passing test command | `npx tsx scripts/test-copilot-regression.mjs` — **ALL PASSED (25 scenarios)** |
| Last successful E2E workflow | Simulation flow script PASS; live Telnyx PSTN not verified |
| Safe rollback point | `3e00b64` on branch; discard uncommitted WIP only with explicit user approval |

**Commit policy:** Do not commit unless user requests. Never commit `.env` or secrets.

---

## 14. Continuity note

If context limits hit mid-implementation: another agent should start at **§12 Exact next steps**, verify §10 test table, and refuse live clinic dials until softphone verification (Critical #3) and anti-freeze UI (High #4) are done.
