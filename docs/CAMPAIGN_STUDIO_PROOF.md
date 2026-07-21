# Campaign Studio — Proof Scenarios A–E (+ Assessment)

Definition of done for the Campaign Studio & Landing Page Publishing Engine, including the **embedded assessment** requirement.

## Migrations applied (Supabase `iuuhcnwqozjrehmgpcqo`)

| Migration | Purpose |
|-----------|---------|
| `campaign_studio_schema` | `cs_*` tables, LA geo seed, templates |
| `campaign_studio_assessments` | Assessment templates/versions, page bindings, analytics columns |
| `assessment_campaign_attribution` | `AssessmentSubmission.csPageId`, `csCampaignId`, `attributionJson` |

## Scenario A — Organic TRT × Beverly Hills

| Step | Expected |
|------|----------|
| Wizard: vertical TRT, city Beverly Hills, traffic organic | Campaign + target created |
| Generate | Page at `/find/trt/california/beverly-hills`, status `needs_review`, assessment auto-bound (`trt-full` → engine `testosterone-replacement-therapy`) |
| Editor → Quality | Assessment check passes |
| Approve → Publish | Public page renders on novalyte.io |
| Visitor opens LP | TRT assessment **embedded on page** (not redirect to `/patients`) |
| Complete assessment | `AssessmentSubmission` + `patient_leads` with `cs_page_id` / `cs_campaign_id`; privacy-safe analytics only |

## Scenario B — Paid conversion page

| Step | Expected |
|------|----------|
| Traffic `paid_search` or `paid_social` | Pages on host `ads`, path `/ads/{slug}` |
| Publish | `indexing_policy = noindex_follow` always |
| `ads.novalyte.io/{slug}` | Middleware **redirects** to `/ads/{slug}` |
| Assessment | Short template preferred (`trt-short`); UTMs captured in attributionJson |
| Lead + analytics | Funnel events include `campaign_id`, `page_id`; no PHI in PostHog/GTM |

## Scenario C — Supporting Journal article

| Step | Expected |
|------|----------|
| Campaign detail → Supporting article | POST `/api/campaigns/[id]/article` creates Content Studio draft |
| Optional `pageId` | Sets `cs_pages.related_article_id` |
| Publish article via Content Studio | Journal revalidate + LP revalidate (when configured) |

## Scenario D — Bulk LA cities

| Step | Expected |
|------|----------|
| Wizard LA metro quick-select | Beverly Hills, Santa Monica, West Hollywood, Pasadena, Long Beach |
| Matrix confirm | Remove rows before generate; duplicate path warnings |
| Selective publish | Per-page approve/publish; campaign rollup on overview |

## Scenario E — Security

| Check | Expected |
|-------|----------|
| Draft pages | Public loaders only return `status=published` |
| Campaign APIs | Require `getSessionAdmin` / `requireAdminRole`; clinic JWT cannot call |
| Cross-clinic leads | Portal RLS + `lead_assignments` scope; clinic never sees other clinics’ leads |
| Unapproved clinics | Not rendered on LPs (`cs_page_clinics` + public clinic gate) |
| Assessment admin | Templates/bindings service-role only after admin session |
| Sensitive answers | Not in PostHog/GTM; stored in AssessmentSubmission / patient_leads only |
| Draft assessment configs | Not publicly readable (no anon policies on `cs_assessment_*`) |

## Assessment proof matrix

| Scenario | Assessment behavior |
|----------|---------------------|
| 1 TRT Beverly Hills | Full TRT engine slug; geo prefilled; stays on LP |
| 2 Weight-management | Different template (`medical-weight-loss`); same `AssessmentExperience` |
| 3 Paid short | Short mode + noindex + UTMs |
| 4 Mobile | Embedded panel usable; CTA anchors to `#campaign-assessment` |
| 5 Security | As Scenario E above |

## Ops — ads.novalyte.io

1. In Vercel project `novalyte-ai-updated`, add domain `ads.novalyte.io`
2. DNS CNAME to Vercel
3. Confirm middleware redirect: `https://ads.novalyte.io/test-slug` → `/ads/test-slug`
4. Set `CAMPAIGN_REVALIDATE_SECRET` on marketing site and `CAMPAIGN_REVALIDATE_URL` + secret on dashboard

## Env checklist

**Dashboard**

- `CAMPAIGN_REVALIDATE_URL=https://novalyte.io/api/campaigns/revalidate`
- `CAMPAIGN_REVALIDATE_SECRET`

**Homepage**

- `CAMPAIGN_REVALIDATE_SECRET` (same value)
- Existing Supabase service role for public loaders

## Remaining gaps (known)

- Full Campaign Studio question editor (reorder/conditionals UI) — Phase 1 binds published templates; deep editing still uses shared `assessment-config.ts` engine definitions
- Live A/B traffic splitting UI (schema stubs only)
- PostHog HogQL campaign analytics dashboard (counters in `cs_page_analytics_daily` + event taxonomy ready)
- Prisma migrate for local SQLite AssessmentSubmission columns if using Prisma locally (production uses Supabase table)
