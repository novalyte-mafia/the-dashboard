# Novalyte AI — Investor Thesis

**Prepared:** July 21, 2026 · **Basis:** direct inspection of the deployed product, both codebases, Supabase schema, and live URLs. Every "live" claim below was verified in production. No projections are presented as facts.

---

## One-line

Novalyte AI is building the operating infrastructure for men's health clinics — one platform that connects patient demand, verified clinic supply, specialized healthcare workforce, and B2B commerce, starting with the fastest-growing categories in men's health (TRT/hormone optimization, sexual health, GLP-1/weight management, peptides, hair restoration).

## What Novalyte is

A healthcare technology facilitator (not a provider) with five deployed, interlocking modules on one codebase:

| Module | Status (verified in production) |
|---|---|
| Verified clinic directory with publication workflow | **Live** on novalyte.io |
| Patient assessments + intake embedded in campaign landing pages (Campaign Studio) | **Live** on ads.novalyte.io; production patient volume not yet validated |
| Healthcare workforce marketplace (jobs, profiles, applications) | **Live** |
| B2B services marketplace (labs, equipment, billing, credentialing vendors) | **Live** with moderation pipeline |
| Command Center: clinic prospecting CRM + call console for founder-led GTM | **Live** on admin.novalyte.io |
| Journal/editorial system with medical-review metadata | **Live** |
| Gated investor portal with data room | **Live** on investor.novalyte.io |

**Stage:** pre-seed, pre-revenue. Product built; clinic go-to-market in progress. Solo technical-adjacent founder (Jamil Yakasai) doing product + outreach.

## The problem

Men's health clinics — a fragmented, fast-growing category of cash-pay outpatient care — run their businesses on disconnected point solutions: a marketing agency for leads, job boards for staffing, sales reps for supplies, spreadsheets for intake, and no shared demand data. Patients researching TRT or GLP-1 care online face an untrustworthy discovery landscape of affiliate content and lead-gen arbitrage. Nobody owns the full loop from patient intent → verified clinic → intake → staffing → operations.

## Why it matters / why now

- **Demand shift:** patients now research and choose specialized cash-pay care online; TRT, sexual health, and GLP-1 categories have exploded in consumer awareness (Hims & Hers' public growth is the market's proof point).
- **Supply fragmentation:** thousands of independent clinics and med-spas compete against well-funded DTC telehealth (Hims, Ro) without comparable acquisition infrastructure. They are the underserved side of the market.
- **AI timing:** agentic workflows (call handling, intake routing, campaign generation) make it possible for a small team to deliver what previously required an agency headcount — Novalyte's stack is already structured around this (assessment engine, call console, campaign generator).

## Why incumbents don't solve it

- **Zocdoc / directories:** appointment discovery for insurance-based care; no cash-pay men's health depth, no acquisition or operations layer.
- **DTC telehealth (Hims, Ro):** they *compete with* clinics rather than powering them. Novalyte is the pro-clinic counter-position.
- **Marketing agencies:** rent leads, keep no infrastructure, no data compounding.
- **Vertical SaaS (Tebra, Healthie, med-spa software):** practice management, not demand generation; none owns patient acquisition + workforce + commerce in one loop.

## Defensibility hypothesis

Ecosystem compounding: each module feeds the others — directory relationships create distribution for campaigns; campaigns create demand data; demand data makes workforce and marketplace more valuable; all of it produces proprietary operational data in a single vertical. Single-module competitors have to win clinics on one axis; Novalyte's wedge (free verified listing) is zero-friction and every upsell lands on infrastructure that already exists. This is a hypothesis to prove with clinic adoption, not a claimed moat.

## Market

- **Initial:** US men's health clinics and adjacent outpatient specialty care (TRT/hormone, sexual health, weight management, peptides, hair restoration, longevity/wellness).
- **Expansion:** same infrastructure generalizes to other cash-pay specialty verticals (women's hormone health, med-spa/aesthetics, longevity clinics, fertility).
- Formal TAM sizing with cited sources is deliberately unpublished pending validation; directional evidence is the venture-scale outcomes in adjacent categories (Hims & Hers, Ro, Zocdoc, Clipboard Health).

## Business model (planned; none monetized yet)

1. Free verified directory listing (wedge — active now)
2. Clinic onboarding/profile services (near-term)
3. Managed patient-acquisition campaigns (near-term; infrastructure live)
4. Workforce placement/hiring fees (near-term; product live)
5. Marketplace vendor/transaction fees (near-term; product live)
6. Demand intelligence subscriptions (future)
7. Enterprise/multi-site partnerships (future)

## Founder-market fit

Solo founder who designed, built, and deployed the entire ecosystem — public site, three subdomain applications, database architecture with RLS security, and the internal CRM he uses for clinic outreach — while running GTM personally. The honest pitch: exceptional builder velocity and full-stack ownership; the round de-risks the commercial side (first paying clinics) and begins team formation.

## Strongest truthful positioning

**"Vertical operating system + marketplace for men's health clinics"** — at the intersection of:
1. **Vertical SaaS + marketplace** (primary; investors' favorite pattern: Toast, ServiceTitan, Squire analogies)
2. **Patient acquisition infrastructure / provider enablement** (the anti-Hims: powering clinics instead of replacing them)
3. **Healthcare AI / agentic workflows** (secondary; credible because the assessment engine and call-console are real)

Avoid leading with "directory" (sounds like Yelp) or "AI" alone (sounds thesis-less). Lead with the clinic operating layer and the live product breadth.

## Current traction (honest)

- Product: 7 modules live in production (verifiable URLs)
- Revenue: $0
- Paying clinics: 0
- Clinic outreach: founder-led, in progress via internal CRM
- Patient assessment volume: not yet validated at production scale

This is a **pre-traction, post-product** raise: unusual breadth of shipped product for pre-seed, missing commercial proof.

## Capital requirements & next milestone

**Recommended raise:** $500k–$750k pre-seed on SAFEs (see FUNDRAISING-STRATEGY.md), 18-month runway.

**The round must convert product into commercial proof:**
- 100+ verified clinics live in the directory across 3–5 metros
- 10–20 clinics actively using booking/lead flows
- First 3–5 paying clinics (acquisition campaigns or onboarding services)
- 500+ completed patient assessments with routing to clinics
- Repeatable clinic acquisition cost and activation playbook
- Seed-ready metrics narrative

## Honest risk list (say these before investors do)

1. Pre-revenue; monetization unproven
2. Solo founder (mitigation: hiring plan in use of funds)
3. Two-sided cold-start (mitigation: free-listing wedge seeds supply without demand dependency)
4. Regulatory adjacency — clinics are the medical actors, Novalyte is a technology facilitator; compliance posture (no PHI in analytics, RLS, consent flows) is built in, but healthcare marketing rules require ongoing counsel
5. Adjacent giants (Hims/Ro) could move toward clinic enablement — counter-position is that their DTC model structurally conflicts with powering independent clinics
