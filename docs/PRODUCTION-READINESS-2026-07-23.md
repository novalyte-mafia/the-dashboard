# Production readiness report — 2026-07-23

Honest status after the founder call-coach deploy plus the follow-on analytics / notifications / verification / SEO fixes.

## 1. Implementation summary (this pass)

| Area | What changed |
|------|----------------|
| Call console | Personal-phone + silent coach mode live on admin (prior commit) |
| Analytics | Session replay deep links on Live Activity; event label aliases fixed |
| Notifications | Slack/email deep links honor `?view=form-submissions&submission=`; Retry can flush marketing cron; outbox uses `retrying` before final `failed` |
| Verification | Approve/reject now persist via Directory API (verify only — never auto-publish) |
| Audit logs | Live `/api/activity` instead of mock fixtures |
| Pipeline | `interested` → `directory_approved` allowed next stage |
| SEO / brand | Ads layout title → Novalyte AI; PostHog project token documented; analytics event doc `page_view` |
| Server analytics | Campaign lead + investor access/meeting emit `captureServerEvent` |

## 2. Readiness scorecard

| Capability | Status | Notes |
|------------|--------|-------|
| Clinic outreach / call sheet | Ready | Personal phone + coach on admin.novalyte.io |
| Call console (founder-led) | Ready | AI does not speak as founder |
| Website traffic tracking | Ready / Partial | PostHog + GA wired; confirm prod token present |
| Session recording | Ready / Partial | Masking on; admin deep links added; requires PostHog UI access |
| Lead capture → Supabase | Ready | Unified form envelope |
| Slack notifications | Ready / Owner config | Needs `SLACK_FORM_WEBHOOK_URL` in prod |
| Email notifications | Ready / Owner config | Needs Resend + admin emails |
| Clinic verification persist | Ready | Queue now writes; publish still gated |
| Directory publishing | Ready | No auto-publish from prospects |
| Technical SEO | Ready | robots/sitemap/index policy already shipped |
| Journal SEO | Ready | Schema + metadata present |
| Search Console | Owner action | See `SEO-AUDIT.md` / `docs/seo-indexing.md` |
| Production deployment | Ready | admin + marketing Vercel projects |

## 3. Manual owner actions

- [ ] Confirm Vercel prod has `DEEPGRAM_API_KEY` + `DEEPGRAM_PROJECT_ID` (coach)
- [ ] Confirm `NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN` on marketing site
- [ ] Confirm Slack + Resend notification env vars
- [ ] Set matching `FORM_NOTIFICATION_CRON_SECRET` / `CRON_SECRET` on **both** admin + marketing for immediate Retry flush
- [ ] Google Search Console: verify `novalyte.io`, submit `https://novalyte.io/sitemap.xml`
- [ ] Bing Webmaster: optional mirror of GSC
- [ ] Browser mic permission when using Coach + my phone

## 4. Testing report (this pass)

| Test | Status | Environment | Notes |
|------|--------|-------------|-------|
| Deploy personal-phone coach | Passed | admin production | Alias admin.novalyte.io Ready |
| Notification deep-link routing | Passed (code) | local change | Needs smoke click after deploy |
| Session replay link rendering | Passed (code) | local change | Needs live `$session_id` events |
| Verification approve persist | Passed (code) | local change | Does not publish |
| Form notification `retrying` status | Passed (code) | marketing change | |
| Full E2E form → Slack/email | Requires owner credentials | production | Not re-run in this pass |
| Full SEO crawl / GSC index request | Requires owner credentials | production | Docs exist |
| Telnyx browser softphone | Partial | production | Optional; personal-phone path is primary |

## 5. Still not claimed from the full brief

- Full clinic information collection form for every Phase 5 field
- Expanded pipeline statuses beyond existing CRM stages
- Full Search Console API rankings UI
- Exhaustive mobile QA matrix
- Fabricated analytics / fake visitors (intentionally never)

## 6. Deploy order

1. Dashboard (`the-dashboard`) → admin.novalyte.io  
2. Marketing (`z.ai-novalyte-new-homepage`) → novalyte.io / ads.novalyte.io  
