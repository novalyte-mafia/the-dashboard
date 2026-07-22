# Investor Portal Audit — investor.novalyte.io

**Audit date:** July 21, 2026
**Auditor method:** Live HTTP checks against production (unauthenticated surface) + full source-code review of every gated page (`z.ai-novalyte-new-homepage/src/app/investor/**`, `src/components/investor/**`). The gate-locked pages render exactly what the source defines, so code review is authoritative for gated content.

## Verdict

**Safe to send to investors now — with 3 fixes recommended first (see P1 list).** The portal is professionally designed, gated correctly, mobile responsive, and contains no exposed secrets, mock data, or fabricated claims. The remaining issues are honesty-preserving gaps (deliberately unpublished data) plus a small amount of visible attorney-placeholder language that should be tightened before wide distribution.

## Verified live (July 21, 2026)

| Check | Result |
|---|---|
| DNS `investor.novalyte.io` → 76.76.21.21 | PASS (Cloudflare + Google DoH) |
| HTTPS / SSL (Vercel) | PASS |
| Access gate blocks all routes | PASS — `/` and `/company` 307-redirect to `/investor/gate`; no investor copy in unauthenticated HTML (leak-checked) |
| Wrong-code handling | PASS by code review — 401 with generic error; 8 attempts / 10 min rate limit per hashed IP |
| Access cookie | httpOnly, signed HMAC-SHA256, `secure` in production, 30-day expiry, invalidated if `INVESTOR_ACCESS_CODE` rotates |
| `noindex` on all investor routes | PASS (metadata `robots: index:false` + `/investor` disallowed in robots.txt; not in sitemap) |
| Cache headers on gate redirect | PASS — `private, no-cache, no-store` |
| Exposed environment variables / secrets | NONE found in page payloads; service-role key is server-only (`src/lib/supabase/admin.ts` is `server-only`) |
| Data room storage | Private bucket, founder-only upload API, 60-second signed URLs, per-download audit log |
| Mock data | NONE — dashboard mocks, ROI calculator defaults, and demo metrics are explicitly excluded from investor content |

## Content inventory (what an investor with the code sees)

**Gated overview pages (code `1750-44`):** Overview, Company, Market, Product, Technology, Business Model, Go-to-Market, Roadmap, Investment, Contact/Request Access, Sign In.
**Authenticated workspace (approved investors only):** Workspace, Traction, Financials, Data Room, Updates, Meet.
**Founder admin:** Requests, Investors, Documents, Metrics, Fundraising/Terms, Activity.

Content accuracy model: every metric carries a status label (Actual / Estimated / Projected / Target / Under development / Planned / Founder-provided / Pending validation). Product modules show honest Completed / In progress / Planned status. Unknown values are omitted, not invented.

## Prioritized issues

### P1 — Fix before wide outreach (quick)

1. **Visible attorney placeholders in the footer.** The shell footer renders "[ATTORNEY REVIEW REQUIRED] Forward-looking statements placeholder — replace with counsel-approved language" and legal list items literally say "placeholder" (`src/components/investor/shell.tsx` lines ~180–218). An investor will see the word "placeholder." Recommendation: replace with short, conservative interim language (e.g., "This portal contains forward-looking statements that involve risks and uncertainties. Nothing herein is an offer to sell securities.") and keep the full counsel review as an internal TODO. *Do not remove the disclaimers — reword them.*
2. **Founder section is thin.** Company page shows founder name/title/email and a sentence saying the bio/photo are "pending founder publication." Investors weight founder pages heavily at pre-seed. Recommendation: add a 3–5 sentence founder bio, a photo, and LinkedIn URL. This is founder input, ~30 minutes of work, highest ROI fix on the portal.
3. **Fundraise page says "Founder input required — not published."** This is honest but reads as unfinished. Recommendation: replace with one deliberate sentence: "Round details are shared directly in conversation — request a meeting." (The page already has the CTA; just remove the "Founder input required" system phrasing from `investorContent.fundraising.status`.)

### P2 — Strengthen soon (this week)

4. **No product screenshots.** Pages describe the live modules but show no visual proof. Recommendation: add 3–5 sanitized screenshots (directory, Campaign Studio landing page with embedded assessment, admin call console) to the Product page.
5. **Market page has no sized market.** `marketSizing` is intentionally empty pending cited sources. Recommendation: add 2–3 entries with reputable citations (e.g., published TRT/men's-health market reports) with `metricStatus` labels and source URLs.
6. **Traction page will render its empty state** ("Quantitative metrics are pending founder validation") until metrics are entered via founder admin. Recommendation: seed 4–6 honest metrics through `/investor/admin/metrics` — e.g., clinics in prospect database (Actual), clinic profiles published (Actual), landing pages live (Actual), assessments deployed (Actual). Real small numbers labeled "Actual" beat empty states.
7. **Data room is empty.** Upload at least: one-page overview PDF, product architecture one-pager, GTM plan. (Founder admin → Documents.)

### P3 — Nice to have

8. Dedicated OG image for the investor host (currently inherits site default).
9. Sign-in page lacks a "forgot password" path (Supabase invite flow covers first login; add reset later).
10. `/investor/gate` URL shows in the browser bar after redirect (cosmetic; a middleware rewrite could keep it cleaner).
11. Terms-acceptance gate before data-room download is soft (profile check exists; full click-through acceptance flow is built server-side but no UI prompt yet).

## Claims audit (checked against codebase reality)

| Portal claim | Verified? |
|---|---|
| Directory live with verification workflow | TRUE — live on novalyte.io |
| Workforce routes shipped | TRUE |
| Marketplace routes + moderation shipped | TRUE |
| Campaign Studio deployed on ads.novalyte.io | TRUE |
| Command Center on admin.novalyte.io | TRUE |
| Assessments "In progress — production volume not yet validated" | TRUE and honestly labeled |
| Any revenue/customer/traction numbers | NONE claimed — correct for current stage |

**No unsupported claims found.** The portal never claims revenue, users, or partnerships that don't exist.

## Security summary

- Two-layer access: shared access code (signed cookie) → Supabase auth for confidential workspace. Access code alone never unlocks the data room.
- RLS on all `investor_*` tables; roles enforced from `app_metadata.account_types` (not user-editable metadata).
- Documents served only via short-lived (60s) signed URLs after server-side authorization; revocation removes role and blocks new URLs.
- Append-only `investor_access_events` audit trail (gate unlocks, page views, downloads).
- Rate limiting on gate attempts and access-request submissions.

**Residual risk (acceptable, disclose to no one):** the shared access code is one code for all invitees — anyone who leaks it can view the gated overview (not the data room). Rotate `INVESTOR_ACCESS_CODE` if leaked; old cookies die automatically.
