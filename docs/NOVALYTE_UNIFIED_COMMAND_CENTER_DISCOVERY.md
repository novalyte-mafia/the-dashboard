# Novalyte AI Unified Admin Command Center

## Discovery report and implementation architecture

**Date:** July 16, 2026  
**Scope:** Read-only inspection of `the-dashboard`, `z.ai-novalyte-new-homepage`, the linked Supabase project, the current Vercel project, and the clinic prospect CSV files in Downloads.

No clinic data was imported, no clinic was published, no external calling or advertising service was connected, and no database migration was applied during this phase.

## 1. Architecture confirmation

The intended boundary is correct and should be enforced technically:

- `the-dashboard` is the private operational command center.
- `novalyte.io` is the public presentation, acquisition, application, and discovery layer.
- Supabase/Postgres is the shared system of record.
- Imported clinic records are private prospects, not public directory listings.
- A prospect can become public only through an explicit permission, enrichment, verification, approval, and publication workflow.
- Imported, manual, staged, live, test, mock, rejected, suspended, and archived states must be stored per record and per workflow. A single application-wide mock flag is not sufficient.

The first implementation milestone should be a secure private prospecting foundation and a transaction-safe publication boundary, not simultaneous implementation of every visible dashboard module.

## 2. Repository and infrastructure findings

### 2.1 Admin dashboard repository

Repository: `/Users/jamilyakasai/Downloads/the-dashboard`

#### Technology and structure

- Next.js 16.2.10 App Router, React 19, TypeScript, Tailwind, and shadcn/Radix components.
- Prisma 6 schema backed by a tracked local SQLite database at `db/custom.db`.
- 85 admin view components and 13 navigation groups covering command center, acquisition, revenue, directory, patients, demand, advertising, workforce, marketplace, content, automation, analytics, and administration.
- The dashboard has no Git remote and no Vercel project linkage in the inspected checkout.
- `npm run lint` passes.
- `npm run build` passes, but `next.config.ts` explicitly ignores TypeScript build errors.
- Next.js warns that the workspace root is inferred incorrectly because a parent lockfile and the local Bun lockfile both exist.

#### Functional SQLite-backed core

The following areas have actual Prisma API routes and persisted SQLite behavior:

- Admin members and session records.
- Clinics, locations, contacts, services, and pipeline history.
- Call logs and call queue data.
- Follow-up tasks.
- Deals and deal-stage history.
- Directory profile status records.
- Activity records and notifications.
- Dashboard aggregate metrics.

Relevant files:

- `prisma/schema.prisma`
- `src/lib/db.ts`
- `src/lib/auth.ts`
- `src/lib/data.ts`
- `src/app/api/clinics/**`
- `src/app/api/call-queue/route.ts`
- `src/app/api/follow-ups/**`
- `src/app/api/deals/**`
- `src/app/api/directory/**`
- `src/app/api/dashboard/route.ts`

The local database currently contains 16 clinics, 15 contacts, 24 call sessions, 10 follow-ups, 6 deals, 6 directory profiles, 25 activity records, 3 notifications, and 3 admin members. These are seed/demo records, not production data.

#### UI-only or mock-backed modules

`src/config/app-config.ts` sets `mockMode: true` and `authEnabled: false`. `src/services/index.ts` is the central service abstraction, but only a subset of its non-mock branches exist. The following service domains always return mock data today:

- Public-directory operations inside the dashboard service layer.
- Patient leads and clinic matching.
- Demand intelligence.
- Advertising campaigns.
- Workforce professionals, jobs, and applications.
- Marketplace products and orders.
- Content and articles.
- Automations and AI usage.
- Integrations and audit events.
- Notifications and much of global activity.
- The executive dashboard service, including conversion metrics and revenue/patient metrics.

Several view files also define inline mock collections or calculated mock metrics. Examples include provider records, call intelligence, feature flags, application health, media, SEO briefs, content performance, credentials, payments, and analytics trends.

The Call Console is a UI state machine. It simulates dialing, ringing, connection, timer, notes, outcomes, and objections; it has no live telephony provider.

The Import Center is presentation-only. It reads a selected filename, displays a hard-coded mapping table and fabricated history, and shows success toasts. It does not parse, validate, preview, queue, import, reverse, or persist uploaded rows.

#### Misleading data-mode labeling

The current executive UI says “Real-time view,” “Generated from live records,” and displays financial and patient metrics while `mockMode` is true. A footer-level mode label is not sufficient because individual modules mix SQLite seed data, service mocks, and inline mocks. Data provenance must be visible at card, table, metric, and record level.

#### Authentication and authorization

The dashboard is not private in its current runtime behavior:

- `getSessionAdmin()` falls back to the first active admin whenever no valid session exists.
- `/api/auth/session` and operational APIs return data to an unauthenticated request.
- A default HMAC secret is used if `NOVALYTE_SESSION_SECRET` is missing.
- Seed credentials use a shared hard-coded development password.
- API routes check only whether an admin object exists. They do not enforce role- or action-level permissions.
- Directory publication changes are available to any active admin identity because there is no specific publisher permission.
- Activity rows are ordinary mutable data, not an append-only security audit log.

#### Current clinic/directory conflict

The dashboard schema describes `Clinic` as a “single canonical record.” It contains prospect pipeline fields, outreach state, scoring, sales value, notes, and `directoryStatus`. `DirectoryProfile` is one-to-one with that same record. This is better than putting every directory field directly on `Clinic`, but it does not provide the required private-prospect/public-listing isolation.

The publication endpoint updates status strings directly. It does not require permission-to-list evidence, a completed verification review, a dedicated publishing role, an idempotency key, a transaction that writes a public projection, or an immutable publication event.

#### Deployment and repository risks

- `.env` is tracked by Git.
- `db/custom.db` is tracked by Git.
- The checkout has no remote, CI workflow, or deployment configuration.
- Production build type validation is disabled.
- The SQLite file cannot support multi-instance serverless deployment or become the shared company system of record.

### 2.2 Public website repository

Repository: `/Users/jamilyakasai/Downloads/z.ai-novalyte-new-homepage`

#### Technology and deployment

- Next.js 16.2.10 and React 19.
- Deployed on Vercel as `novalyte-ai-updated`, with `novalyte.io` and `www.novalyte.io` aliases.
- Uses `@supabase/supabase-js` and a custom Prisma-shaped adapter in `src/lib/db.ts`.
- The server-side adapter uses the Supabase service-role client for reads and writes.
- The GitHub repository is private.

#### Existing production data and flows

Verified through aggregate, read-only queries:

- 6 `Clinic` rows: 4 verified, 1 under review, and 1 pending.
- 0 clinic locations, providers, treatments, or reviews.
- 0 clinic applications and 0 legacy clinic onboarding records.
- 6 database `Article` rows.
- 16 legacy `Professional` rows.
- 1 authenticated workforce professional profile and 1 associated application.
- 52 job postings and 52 workforce match records.
- 9 vendors and 69 marketplace listings.
- 3 Supabase Auth users: 2 confirmed and 1 unconfirmed.
- Storage buckets: public `professional-avatars`; private `professional-resumes`; private `professional-credentials`.

The professional registration/onboarding flow now uses Supabase Auth, user/profile linkage, authenticated status resolution, branded email templates, notification delivery tracking, and professional RLS policies.

Contact submissions use Supabase, Slack, and Resend with delivery records. PostHog, Google Analytics, and Vercel Analytics are consent-gated on the client. Server-side conversion events exist for key form submissions.

#### Public directory source and publication bypass

`src/app/page.tsx` queries every clinic where `deletedAt` is null. It sorts verified clinics first but does not require `verified = true`, an approved verification status, or a published status. `DirectoryView` defaults to displaying all received clinics; “Verified only” is optional.

The anon key can read all six current clinic rows, including the pending and under-review rows. `src/app/sitemap.ts` also creates directory URLs for every non-deleted clinic.

There is no dedicated publication status on the public `Clinic` model. `verified` and `verificationStatus` are being used as partial substitutes, and neither is enforced by the website query.

#### Unauthenticated clinic management paths

The public website exposes two critical mutation paths without authentication:

- `POST /api/clinics/[id]/claim` accepts an authorization boolean and email, then marks a clinic claimed.
- `PUT /api/clinics/[id]` updates the clinic and replaces locations, providers, and treatments using the service role.

The claim flow navigates directly to the clinic dashboard. No Supabase clinic-user account, ownership relationship, verified claim token, admin approval, or authorization policy protects these mutations.

These routes must be disabled or protected before the public directory is connected to the new command center.

#### Clinic applications

`src/app/api/clinic-application/route.ts` validates and creates a standalone `ClinicApplication` record with a human-readable application ID. This is a useful intake boundary because submission does not automatically create a public clinic.

However, the workflow stops at submission:

- No authenticated clinic account is attached.
- No match to an existing prospect or organization is performed.
- No review task or verification-review record is created.
- No document workflow exists.
- No controlled conversion to a staged profile exists.
- No publication transaction exists.
- No admin-facing Supabase dashboard module consumes these application rows.

The legacy `ClinicOnboarding` endpoint is a second, simpler intake system and should be retired after its callers are migrated.

#### Patient data

Assessments and consultation requests store contact and health-intent data in Supabase through public server routes. Aggregate inspection showed no current rows, but these models can contain sensitive personal and health-related information. They must not be joined casually into general analytics, exported broadly, or exposed to clinic users without a documented minimum-necessary routing model, retention policy, and access audit.

No claim of HIPAA compliance should be made based only on the selected infrastructure.

#### Content duplication

The database contains `Article` records and `src/app/page.tsx` loads them, but the Journal UI ignores that collection and uses `src/lib/article-content.ts` as its real source. The dashboard content module uses mock articles. There are therefore three conflicting article systems: database rows, source-controlled article content, and dashboard mocks.

#### Supabase schema and migration state

- The linked project is `iuuhcnwqozjrehmgpcqo`.
- The repository migration ledger contains only six July 16 professional-registration migrations, and all six appear remotely applied.
- The earlier base schema exists in `prisma/supabase_migration.sql`, not in Supabase migration history.
- The base schema uses mixed PascalCase and snake_case names and contains no RLS definitions in that SQL file.
- The generated database types describe many tables not reproducible from the six committed Supabase migrations alone.
- This is migration drift: a clean environment cannot be rebuilt reliably from the current migration directory.
- Supabase CLI 2.95.4 is installed; 2.109.1 is available.
- Live database statistics and advisor inspection were blocked by a temporary CLI database-role authentication failure. No security-advisor result is claimed in this report.

Anon read checks confirm broad access to `Clinic`, `Article`, legacy `Professional`, `JobPosting`, `Vendor`, and approved marketplace data. Private application/form tables returned zero rows to anon in the current state, but the exact grants and all policies still need a successful schema/advisor audit before migration work.

#### Environment separation

- Vercel has production Supabase URL, anon key, service-role key, Resend, and Slack variables.
- Supabase credentials are not configured for Vercel Preview or Development.
- Analytics variables exist for Production, Preview, and Development.
- The local `.env` is tracked and contains database and external-service secrets.
- `db/custom.db` is also tracked in the website repository.
- Only one Supabase project reference is present. No separate staging Supabase project was found.

The tracked secrets should be treated as exposed repository credentials even though the GitHub repository is private. They should be rotated, removed from tracking, and replaced with environment-managed values before dashboard integration.

## 3. Clinic dataset findings

### Files identified

- `/Users/jamilyakasai/Downloads/5k-accounts.csv`
- `/Users/jamilyakasai/Downloads/account-5k.csv`

Both are approximately 1.3 MB and parse to 5,266 data records. Their row values are identical in the same order. Only two header names differ:

- `name` versus `clinic_name`
- `google_place_id` versus `clinic_id`

The brief names `5k-accounts.csv`, so that file should be the source artifact. Its SHA-256 should be stored on the eventual import batch. The second file should be treated as an alternate export, not imported separately.

### Columns

`name`, `type`, `vertical`, `street`, `city`, `state`, `zip`, `phone`, `email`, `website`, `rating`, `reviews`, `services`, `manager_name`, `manager_email`, `owner_name`, `owner_email`, `market`, `affluence_score`, `crm_status`, `google_place_id`.

### Completeness and quality

- All 5,266 rows have a name, street, city, type, vertical, services value, market, affluence score, CRM status, and source ID.
- `google_place_id` is unique across all 5,266 rows.
- 162 ZIP values are missing.
- 117 phones are missing; one populated phone fails basic 10-digit normalization.
- 309 websites are missing; one populated website fails a basic hostname check.
- 5,230 general emails are missing; only 36 rows have an email and those reduce to 21 normalized unique values.
- All manager and owner name/email fields are empty.
- 369 ratings and review counts are missing.
- 163 rows contain an invalid U.S. state value across 87 distinct invalid tokens. Values such as city names, street fragments, suite values, `USA`, `UK`, and `ON` indicate source-field shifting or address parsing failure.
- 5,181 rows say `Ready to import`; 85 say `Already synced`. The latter must not be re-imported blindly.

### Duplicate indicators

- Exact normalized `name + street + city + state`: no duplicates.
- Source ID: no duplicates.
- Normalized phone: 187 duplicate groups containing 446 rows, maximum group size 8.
- Normalized website/domain: 357 duplicate groups containing 2,168 rows, maximum group size 187.

Shared domains and phones are not sufficient duplicate keys. They often represent multi-location groups, franchises, call centers, or common corporate websites. The data is best interpreted as location-level source records that may roll up into fewer organizations.

### Import risks

- Organization-versus-location matching is required before creating clinic accounts.
- State/address failures must be quarantined or corrected, not silently coerced.
- Source IDs and import-batch hashes are needed for idempotency.
- Website and phone matches should produce review candidates, not automatic merges.
- Contact enrichment cannot be assumed because decision-maker fields are empty.
- Ratings and reviews are third-party source data and require provenance, freshness, and usage-policy review before public display.
- `Already synced` rows need reconciliation against the actual prior destination and source identifiers.
- Services are semicolon-delimited classifications and should map to a controlled treatment/service taxonomy with unmatched values preserved.

## 4. Architectural risks and conflicts

### Priority 0: contain before integration

1. Dashboard authentication bypass through first-admin fallback.
2. Dashboard operational APIs accessible without a real session.
3. Public unauthenticated clinic claim and full-profile update routes.
4. Public directory and sitemap include non-deleted clinics without publication enforcement.
5. Anon can read pending and under-review clinic rows.
6. Production-capable secrets are tracked in `.env` files.

### Priority 1: foundation blockers

1. Prospect and directory state share one dashboard `Clinic` identity and one lifecycle.
2. Supabase baseline schema is outside the migration ledger.
3. Dashboard has no Supabase integration despite the settings UI claiming it is connected.
4. Global mock mode and “live” labels make data provenance unreliable.
5. No staging Supabase environment exists in the inspected setup.
6. No granular RBAC or dedicated publishing authorization exists.
7. No immutable audit trail exists for critical actions.
8. No safe, repeatable import implementation exists.
9. No transaction-safe prospect/application-to-publication workflow exists.
10. Website content, database content, and dashboard content are conflicting sources.

### Priority 2: integrity and scalability

- Status fields are unconstrained strings.
- Money uses floating-point values in the dashboard.
- Several JSON structures are stored as strings.
- Soft deletion is inconsistent; some relations cascade-delete historical activity.
- No row-level import error model, match-candidate model, rollback marker, or reversal workflow exists.
- Dashboard pagination uses offset pagination and hard limits; deeper prospecting lists should use cursor pagination.
- No background job/claim mechanism exists for imports, syncs, publication, notifications, or enrichment.
- Public form routes do not share a consistent rate-limiting and abuse-prevention layer.
- Observability is split across logs, PostHog, Vercel, Slack, and database delivery records without a unified job/event model.

## 5. Proposed target architecture

```text
Public users
    |
    v
novalyte.io (public Next.js app)
    | read only approved public projections
    | submit applications/leads through validated server routes
    v
Supabase public API boundary
    - public clinic directory projection
    - published content projection
    - approved jobs/marketplace projections
    - tightly scoped form RPCs or server routes

Founder/admin
    |
    v
the-dashboard (private Next.js app)
    | Supabase Auth + MFA + server-side authorization
    | no service-role key in browser
    v
Admin BFF / server actions / route handlers
    |
    v
Private Supabase schemas
    - IAM and permissions
    - prospecting and outreach
    - applications and verification
    - staged directory content
    - calls and tasks
    - content, workforce, marketplace, demand, integrations
    - append-only audit events
    |
    +--> background jobs/import workers
    |
    +--> explicit publish transaction
             |
             v
        public read projection
```

### Boundary rules

- Private prospecting tables are never exposed to `anon` or ordinary public clients.
- The dashboard browser uses an authenticated user session and never receives a service-role key.
- Admin mutations go through server-side commands that check both identity and permission.
- Public clients query only approved projections with RLS as a second enforcement layer.
- A prospect ID is never used as a public listing ID.
- A clinic organization may have many prospect source records, applications, locations, and outreach activities, but at most one active directory profile per approved organization/version as defined by policy.
- Every import, match, verification, status change, publish, unpublish, export, and sensitive read creates an audit event.
- Mock/test data is isolated by environment and labeled by `data_source`/`environment`, never represented only by a global UI flag.

## 6. Proposed Supabase data model

Use lowercase snake_case for new objects. Preserve existing tables during migration; do not rename or delete working production tables until consumers have moved and rollback has expired.

### IAM and administration

- `iam.admin_members`: `auth_user_id`, status, display identity, MFA requirement.
- `iam.roles`: founder, administrator, sales, operations, directory reviewer, publisher, content editor, analyst.
- `iam.permissions`: module/action pairs such as `prospects.export`, `directory.publish`, `patients.view_sensitive`, `integrations.manage`.
- `iam.member_roles` and `iam.role_permissions`.
- `iam.saved_views` and optional scoped assignments.

Authorization facts belong in database membership tables and controlled `app_metadata`, not user-editable `user_metadata`.

### Organization and prospecting core

- `ops.organizations`: canonical private business identity, not inherently public.
- `ops.organization_locations`: normalized physical/telehealth operating locations.
- `ops.clinic_prospects`: outreach lifecycle, qualification, permission-to-list status, assignment, priority, archival.
- `ops.prospect_sources`: immutable source identity, source record ID, source URL/file, collected timestamp, raw snapshot hash, import batch.
- `ops.clinic_contacts`: decision-makers and contact consent/opt-out state.
- `ops.tags`, `ops.prospect_tags`, `ops.assignments`.
- `ops.outreach_activities`: channel-neutral activity timeline.
- `ops.calls`: provider-neutral call metadata and disposition.
- `ops.call_artifacts`: recording/transcript/summary pointers with retention and access classification.
- `ops.tasks`: follow-ups and next actions.
- `ops.opportunities` and `ops.opportunity_history` for commercial work.

`organizations` solves organization/location rollup. `clinic_prospects` solves private sales state. Neither is directly public.

### Import and matching

- `ops.import_batches`: file name, SHA-256, schema version, mapping, environment, dry-run flag, status, counts, creator, timestamps, reversal state.
- `ops.import_rows`: batch row number, raw JSON, normalized JSON, source ID, processing status, matched entity, action taken.
- `ops.import_errors`: row, field, code, severity, original value, normalized value, resolution.
- `ops.entity_match_candidates`: candidate organization/location, match signals, score, decision, reviewer.
- `ops.sync_jobs`: idempotency key, attempts, lease owner, status, error, timing.

Use batch inserts/COPY into a staging table, then short transactions to promote validated rows. Use atomic `ON CONFLICT` upserts on source identity. Worker claims should use `FOR UPDATE SKIP LOCKED`. A per-file transaction advisory lock can prevent concurrent processing of the same SHA-256.

### Applications, verification, and directory staging

- `directory.clinic_applications`: intake record linked optionally to an organization/prospect after reviewed matching.
- `directory.application_contacts` and `directory.application_documents`.
- `directory.verification_reviews`: reviewer, checklist/version, evidence, decision, notes, expiry/reverification date.
- `directory.clinic_profiles`: staged editorial profile, version, lifecycle status.
- `directory.profile_locations`, `directory.profile_providers`, `directory.profile_media`.
- `directory.treatment_catalog` and `directory.profile_treatments`.
- `directory.publication_requests`: requested version, requester, readiness snapshot.
- `directory.publication_events`: append-only approval, publish, unpublish, suspend, restore history.
- `public.public_clinic_profiles` plus public child projections, or a security-invoker API view that exposes only the approved version.

Recommended statuses:

- Prospect: `new`, `researching`, `ready_for_outreach`, `contacted`, `qualified`, `not_interested`, `do_not_contact`, `permission_to_list`, `converted`, `rejected`, `archived`.
- Application: `draft`, `submitted`, `under_review`, `information_required`, `approved`, `rejected`, `withdrawn`.
- Verification: `not_started`, `in_progress`, `information_required`, `verified`, `failed`, `expired`, `suspended`.
- Profile: `draft`, `ready_for_review`, `changes_required`, `approved`, `published`, `unpublished`, `suspended`, `archived`.
- Data source: `imported`, `manual`, `application`, `synced`, `derived`, `mock`, `test`.
- Environment: `development`, `staging`, `production`.

Enforce statuses with Postgres enums or text check constraints. Use `timestamptz`, `numeric` for money, JSONB only for source payloads/flexible metadata, and indexes on every foreign key and frequent status/time filter.

### Publishing transaction

Publishing must be one server-side database transaction:

1. Lock the profile version.
2. Verify the caller has `directory.publish`.
3. Verify application/permission evidence and verification state.
4. Verify required profile completeness and no blocking issue.
5. Insert or update the public projection using an idempotency key/profile version.
6. Mark only that approved version published.
7. Insert an append-only publication event and audit event.
8. Commit, then invalidate website cache through a webhook/tag.

Unpublish/suspend should remove visibility without deleting history. Restore should republish an approved version through the same authorization boundary.

### Later domain models

- Content: pages, structured sections, articles, revisions, authors, tags, media, approvals, schedules, publication events.
- Patient operations: leads, consent records, assessments, routing decisions, routing events, clinic responses, conversion/attribution events, restricted notes.
- Advertising: channel connections, campaigns, ad groups, creatives, budgets, landing pages, synced metrics, attribution events, sync freshness.
- Demand: observed signals, modeled estimates, geographic dimensions, treatment dimensions, supply snapshots, model/version labels.
- Workforce: professional profiles, credentials, verification reviews, employers, jobs, applications, matches, placement stages.
- Marketplace: vendors, vendor reviews, products/services, inventory/availability, orders, fulfillment, pricing revisions.
- Integrations: connections, encrypted secret references, webhooks, sync jobs, failures, replay state.
- Audit: append-only actor, action, resource, before/after hashes, request ID, IP/device metadata where appropriate, environment, timestamp.

## 7. Module-by-module implementation plan

### Admin foundation

Replace fallback auth with Supabase Auth. Require the founder account, MFA, active admin membership, and server-side permission checks. Add route-level protection, session expiry, account suspension, CSRF-safe mutations, and audit logging. Replace the global mock switch with a `DataSourceBadge` and source metadata supplied by every service response.

### Clinic prospecting and outreach

Connect the existing clinic, contact, queue, call log, follow-up, deal, activity, tagging, assignment, and saved-view UI to the private `ops` schema. Preserve useful UI composition while replacing SQLite repositories. Add cursor pagination, indexed search, source filters, data-quality flags, duplicate candidate review, DNC enforcement, exports behind permission, and a complete activity timeline.

### Import Center

Replace the toast-only workflow with upload, hash validation, mapping profiles, dry run, normalization preview, error quarantine, duplicate candidates, batch approval, background execution, progress, downloadable row errors, and reversal. The 5,266-row file should first run in staging as a dry run. No production promotion occurs until totals and sample matches are approved.

### Directory and applications

Build separate queues for applications, identity/organization review, profile completeness, verification, publication requests, published profiles, suspended profiles, and re-verification. Do not let a directory status change mutate prospect state implicitly. Add versioned preview using the public website renderer before publication.

### Website integration

Immediately filter legacy website queries to approved/published records as containment. Then cut over to the dedicated public projection. Remove service-role reads from public page rendering where anon-safe projections suffice. Protect clinic ownership through Supabase Auth, explicit organization membership, approved claim records, and server checks. Remove or disable current unauthenticated claim/update routes.

### Call Console

Define a provider adapter with create-call, status webhook, recording webhook, transcript webhook, and termination methods. Store provider IDs separately. Every call must link to prospect/organization, contact, campaign, admin, and consent jurisdiction. Record disposition and next action independently from provider payloads. Keep recordings/transcripts private with signed URLs, retention rules, legal-consent evidence, and narrow permissions. External provider calls happen outside database transactions.

### Content and website management

Choose Supabase content tables as the eventual source of truth. Import source-controlled Journal content into versioned drafts, verify parity, then switch the public site. Add structured blocks, revisions, preview tokens, approvals, schedules, media references, SEO metadata, and publication audit. Retain source export/backup rather than editing production content without history.

### Patient demand and routing

Create restricted lead/assessment records, normalized consent events, minimum-necessary routing views, assignment, clinic offer/accept/decline events, response-time tracking, and attribution. Separate identifiable patient data from aggregate demand signals. Limit exports and sensitive reads. Define retention/deletion procedures before production routing.

### Advertising operations

Start with read-only connection metadata and synced metrics. Label every metric `live`, `synced`, `delayed`, `estimated`, or `mock` and include `synced_at`. Later add controlled campaign mutations after provider-specific approval and budget guardrails. Never represent imported or delayed ad data as real time.

### Demand intelligence

Build observed demand aggregates from consented events and analytics, then layer modeled estimates in separate tables with model/version/confidence fields. Compare demand aggregates with published clinic supply. Do not expose identifiable patient records in market dashboards.

### Workforce

Reuse the working Supabase professional Auth/profile workflow. Add admin review permissions and verification history without merging professionals into clinic-directory records. Replace dashboard mock services with the current workforce tables through server-side admin endpoints. Add employer identity and membership separately.

### Marketplace

Connect vendor onboarding, review, listing approvals, quote requests, and later orders through distinct vendor and marketplace models. Existing legacy seed data needs provenance labeling before it can be treated as live. Publishing and pricing changes require revision history.

### Analytics and reporting

Define metric contracts before dashboards: source tables, filters, time zone, freshness, data mode, and owner. Use aggregate tables/materialized views for expensive metrics. PostHog remains behavioral analytics, not the authoritative operational ledger. Reconcile PostHog/Vercel/GA identifiers through explicit attribution events rather than copying dashboard totals.

### Integrations and administration

Store integration configuration metadata in Supabase but secrets in platform secret storage, never normal tables or browser payloads. Add health, last sync, last error, replay, and ownership. Add immutable audit events for authentication, permissions, imports, exports, publishing, sensitive reads, integration changes, and destructive/archival operations.

## 8. Migration phases

### Phase 0 — Security containment

Objectives:

- Remove dashboard first-admin fallback and default production secret behavior.
- Protect all dashboard routes and APIs.
- Disable/protect unauthenticated clinic claim and update routes.
- Restrict public directory and sitemap to approved published records.
- Rotate and untrack committed credentials.
- Restore TypeScript validation for production builds.

Completion: unauthenticated tests receive 401/403; anon cannot read non-public clinic rows; no secret remains in tracked files; production website regression tests pass.

### Phase 1 — Reproducible Supabase foundation

- Upgrade the Supabase CLI in a controlled change.
- Capture a reviewed baseline migration without rewriting applied history.
- Create a separate staging Supabase project.
- Add IAM, audit, import, organization, prospect, application, staged profile, and publication schemas.
- Add grants, RLS, indexes, constraints, seed-free fixtures, and generated types.

Completion: an empty staging project can be built from migrations and passes security/performance advisors.

### Phase 2 — Private prospecting and import dry run

- Build import parser/normalizer and batch tables.
- Run the 5,266-row file in staging dry-run mode.
- Resolve invalid states and review duplicate candidates.
- Validate organization/location grouping and `Already synced` reconciliation.

Completion: deterministic reruns produce the same row actions; no public records are created; row errors and match decisions reconcile to 5,266.

### Phase 3 — Dashboard CRM cutover

- Replace SQLite clinic/contact/call/follow-up/deal/activity APIs with Supabase server repositories.
- Add module/record data-source labels.
- Migrate only approved local seed data as explicit demo fixtures, not production.
- Keep a temporary read-only SQLite rollback path during acceptance.

Completion: dashboard operates against staging Supabase with real Auth, RBAC, audit, pagination, and no fallback/mock ambiguity in migrated modules.

### Phase 4 — Controlled directory publication

- Build application matching, verification, staged profile, preview, publish, unpublish, suspend, and restore.
- Create the public projection and update the website data layer.
- Remove current direct claim/update behavior.

Completion: only a permitted publisher can publish; public/anon queries return only published records; retries are idempotent; history is preserved.

### Phase 5 — Intake and operations integration

- Connect clinic applications, contact submissions, assessment/lead intake, consultation routing, and notification delivery to dashboard queues.
- Add retention and sensitive-access controls.

Completion: every public submission has a traceable operational record, status timeline, notification result, and audit ID.

### Phase 6 — Content, workforce, and marketplace

- Consolidate Journal content into versioned Supabase content.
- Connect the existing workforce workflow to admin review.
- Connect vendor/listing review and marketplace operations.

Completion: mock services are removed module by module and each public surface reads only approved projections.

### Phase 7 — Telephony, advertising, and demand intelligence

- Add provider adapters, webhooks, recording/transcript controls, ad syncs, attribution, observed demand aggregates, and modeled demand labeling.

Completion: external systems are replayable, observable, permission-controlled, and never confused with authoritative or real-time data when delayed.

## 9. Testing and deployment plan

### Database and migration tests

- Apply all migrations to an empty staging project.
- Validate check constraints, uniqueness, FKs, FK indexes, partial/composite indexes, and soft-delete behavior.
- Run Supabase security and performance advisors.
- Test migration rollback/forward procedures and point-in-time recovery expectations.

### RLS and authorization tests

Test as anon, unauthenticated, professional, clinic member, sales admin, directory reviewer, publisher, and founder. Verify both allowed rows/actions and explicit denial. Include IDOR tests against guessed IDs and stale-session/suspended-user tests.

### Import tests

- Valid, malformed, empty, oversized, and changed-schema files.
- 5,266-row dry run, repeat run, interrupted run, partial failure, and reversal.
- Source-ID idempotency and file-hash deduplication.
- Organization/location duplicate candidates.
- Totals reconcile exactly: accepted + quarantined + duplicate + skipped = source rows.

### Publication tests

- Cannot publish without permission, verification, and required data.
- Concurrent publish attempts produce one public version.
- Retry is idempotent.
- Unpublish/suspend removes public visibility and sitemap inclusion without deleting history.
- Public query and direct REST query cannot access drafts.

### UI and integration tests

- Desktop/tablet/mobile dashboard navigation and dense tables.
- Search/filter/sort/cursor pagination and saved views.
- Application-to-review-to-publication end-to-end test.
- Public website directory and clinic profile regression.
- Auth, MFA, session expiry, and logout.
- Slack/Resend/PostHog failures recorded without blocking primary transactions.
- Telephony and advertising use provider sandbox/test accounts before production.

### Performance and observability

- Load test 5,266 prospects plus activity/call histories.
- Explain/analyze core queue, search, timeline, and directory queries.
- Add request IDs, structured server logs, import/sync job telemetry, Vercel runtime monitoring, database delivery status, and alert thresholds.
- Dashboards display source, environment, and freshness for every metric.

### Deployment

1. Create staging Supabase and a protected dashboard preview deployment.
2. Run migrations and dry-run import only in staging.
3. Complete security acceptance and backup verification.
4. Deploy website containment changes independently.
5. Deploy dashboard foundation behind founder-only access.
6. Promote one module at a time with rollback flags scoped to that module.
7. Publish no clinic until publication acceptance tests pass and the founder authorizes the first listing.

## 10. Recommended implementation order

1. Security containment and credential rotation.
2. Reproducible Supabase baseline and separate staging project.
3. Admin Auth, MFA, RBAC, audit, and protected deployment.
4. Organization/prospect/import foundation.
5. Staging dry run of the 5,266-row source.
6. Prospecting, contact, activity, call-log, and follow-up dashboard cutover.
7. Application matching, verification, staged profile, and publication transaction.
8. Public website directory projection cutover.
9. Patient lead/routing controls.
10. Journal/content consolidation.
11. Workforce and marketplace admin connections.
12. Telephony provider, advertising syncs, and demand intelligence.

## 11. Decisions required

These points cannot be resolved safely from repository inspection alone:

1. **Credential rotation timing:** authorize rotation of the tracked Supabase service-role key, Resend key, Slack webhook, database URL/password, and any other value present in tracked `.env` history.
2. **Admin production domain:** choose the private dashboard hostname and whether access should also be gated by Vercel protection, VPN/zero-trust access, or an identity-aware proxy.
3. **Staging ownership:** choose/create the separate Supabase staging project and Vercel dashboard project/team.
4. **Permission-to-list policy:** define what evidence is legally/business-operationally sufficient before a prospect can enter publication review.
5. **Source-data rights:** confirm permitted storage, outreach, enrichment, and public-display uses for Google-derived ratings, reviews, place IDs, and other imported fields.
6. **Retention policy:** define retention and deletion periods for patient leads, assessment data, call recordings, transcripts, uploaded credentials, and audit events.
7. **Call consent policy:** approve jurisdiction-aware recording/transcription consent language and operational procedures before a telephony integration is enabled.
8. **Initial roles:** confirm whether founder-only access is the sole launch role or whether sales, operations, reviewer, publisher, and content roles must be enabled in the first release.

Until these decisions are made, the safe next engineering step is Phase 0 containment plus a staging-only Phase 1 foundation. The prospect CSV should remain untouched.
