# Campaign Studio Architecture

Command Center module for creating, editing, and publishing geo-targeted landing pages on Novalyte marketing hosts. Phase 1 ships deterministic page generation, quality gates, embedded assessments, and publish-time cache revalidation hooks.

## Hosts

| Host | Domain | Path pattern | Indexing default |
|------|--------|--------------|------------------|
| `organic` | novalyte.io | `/find/{service}/{state}/{city}` | `noindex_follow` until publish with index flag |
| `ads` | ads.novalyte.io | `/ads/{slug}` (host redirects `/slug` → `/ads/slug`) | Always `noindex_follow` |

Organic pages target SEO/service-location intent. Ads pages target paid conversion flows with shorter paths and stricter noindex policy.

## Schema (Supabase)

Core tables (service-role only, RLS enabled, no anon policies):

- **Reference:** `cs_treatment_verticals`, `cs_geo_entities`, `cs_templates`, `cs_template_versions`
- **Campaigns:** `cs_campaigns`, `cs_campaign_targets`
- **Pages:** `cs_pages`, `cs_page_versions`, `cs_page_clinics`
- **Generation / quality:** `cs_generation_jobs`, `cs_generation_audit`, `cs_quality_reports`
- **Assessments:** `cs_assessment_templates`, `cs_assessment_template_versions`, `cs_page_assessment_bindings`
- **Analytics (Phase 2):** `cs_page_analytics_daily`
- **Attribution:** `patient_leads.cs_page_id`, `patient_leads.cs_campaign_id`

Migrations:

- `20260720160000_campaign_studio_schema.sql` — core schema + LA metro seed geo
- `20260720170000_campaign_studio_assessments.sql` — assessment templates + page columns

## Workflows

### Create campaign (Wizard)

1. POST `/api/campaigns` — name, objective, traffic_type, vertical
2. POST `/api/campaigns/[id]/targets` — vertical × geo matrix
3. POST `/api/campaigns/[id]/generate` — deterministic page content per target

Generated pages start in `needs_review`.

### Edit page (Page Editor)

- **Content** — PATCH `/api/campaigns/pages/[id]` (title, SEO, hero, CTA)
- **Assessment** — POST `/api/campaigns/pages/[id]/assessment` (bind template or JSON form_config)
- **Quality** — POST `/api/campaigns/pages/[id]/quality`
- **Publish** — POST `/api/campaigns/pages/[id]/actions` (`submit_review` → `approve` → `publish`)

### Supporting article

POST `/api/campaigns/[id]/article` creates a Journal draft and links `related_article_id` when scoped to a page.

## Embedded assessment requirement

**Every published landing page must embed `AssessmentExperience` using the same assessment engine as `/patients`.**

- Never use redirect-only CTAs to `/patients` as the primary conversion path.
- Configure via `form_config.engine = "assessment"` plus `assessment_slug` (public engine slug) or bind `assessment_version_id`.
- Placements: `hero`, `below_hero`, `mid_page`, `near_clinics`, `sticky_mobile`, `bottom`, `modal`.
- Quality gate blocks publish when `page_type` is `service_location` or `paid_conversion` and assessment is missing.

Vertical defaults (`cs_treatment_verticals.default_assessment_slug`) seed wizard step 5 when the assessments API returns empty.

## SEO rules

| Traffic | Page type | Canonical host | Index on publish |
|---------|-----------|----------------|------------------|
| organic | service_location | novalyte.io | Optional (`index` flag on publish action) |
| paid_search / paid_social | paid_conversion | ads.novalyte.io | Never index |

Quality checks enforce SEO description length (50–160 chars), hero headline, primary CTA, and template assignment.

## Environment variables

| Variable | Purpose |
|----------|---------|
| `CAMPAIGN_REVALIDATE_URL` | Marketing site revalidate endpoint (e.g. `https://novalyte.io/api/campaigns/revalidate`) |
| `CAMPAIGN_REVALIDATE_SECRET` | Bearer secret for revalidate POST |

Both must be set for publish to invalidate edge caches on the marketing site. Missing vars no-op safely in local dev.

## Role matrix

| Action | admin | operations | other |
|--------|-------|------------|-------|
| List campaigns/pages | ✓ | ✓ | — |
| Create campaign / targets / generate | ✓ | ✓ | — |
| Edit page content | ✓ | ✓ | — |
| Quality check | ✓ | ✓ | — |
| Approve / publish | ✓ | ✓ | — |
| Override blocking quality | ✓ | ✓ (with reason) | — |

All routes use `getSessionAdmin` (read) or `requireAdminRole(["admin", "operations"])` (write).

## Scenarios

### A — Organic TRT, LA metro

Traffic `organic`, vertical TRT, cities Beverly Hills + Santa Monica → `service_location` pages on `/find/trt/california/{city}`. Bind TRT assessment, approve, publish with index.

### B — Paid social GLP-1

Traffic `paid_social`, vertical GLP-1, single geo → `paid_conversion` on ads host. Short assessment mode, noindex publish.

### C — Clinic pool override

Wizard step 6 attaches published clinic IDs to targets; generation writes `cs_page_clinics` rows.

### D — Supporting article

From campaign detail, create article → Content Studio draft with campaign tag; link back via `related_article_id`.

### E — Quality override publish

Ops runs quality → blocking assessment missing → bind assessment → re-run quality → approve → publish. Emergency override requires `overrideReason` on publish when checks still block.

## Admin UI (Phase 1)

| View ID | Component | API sources |
|---------|-----------|-------------|
| `campaign-overview` | CampaignOverviewView | `/api/campaigns`, `/api/campaigns/pages` |
| `campaign-wizard` | CampaignWizardView | verticals, geo, assessments, create/targets/generate |
| `campaign-detail` | CampaignDetailView | campaign, pages, article |
| `landing-pages` | LandingPagesView | `/api/campaigns/pages` |
| `page-editor` | PageEditorView | page CRUD, assessment, quality, actions |
| `templates` | TemplatesView | templates + assessments |
| `campaign-analytics` | CampaignAnalyticsView | pages (analytics API TBD) |

Legacy nav IDs (`campaign-dashboard`, `campaign-builder`, `creative-library`, `budget-management`, `lead-attribution`) redirect via `VIEW_MAP` aliases.

## Remaining gaps

- **Deep assessment question editor** — Phase 1 binds published templates to the shared engine (`assessment-config.ts`); full reorder/conditional UI deferred
- **Analytics API** — `cs_page_analytics_daily` increments on submit; dedicated Campaign Analytics HogQL read endpoint TBD
- **AI generation** — Phase 1 uses deterministic content; `cs_generation_jobs` ready for LLM pipeline
- **Clinic validation** — Wizard accepts clinic IDs; no live directory validation in Phase 1
- **Experiments** — Schema present (`cs_experiments`); no UI or assignment logic
- **ads.novalyte.io DNS** — Ops must attach domain in Vercel (see `CAMPAIGN_STUDIO_PROOF.md`)

See also: `docs/CAMPAIGN_STUDIO_PROOF.md` for Scenarios A–E and assessment proof matrix.
