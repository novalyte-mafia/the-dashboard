# Provider integrations

The dashboard keeps provider credentials server-side. Never prefix these keys with `NEXT_PUBLIC_` and never commit their values.

## Required variables

```env
FIRECRAWL_API_KEY=
FIRECRAWL_API_URL=https://api.firecrawl.dev
VAPI_API_KEY=
VAPI_ASSISTANT_ID=
VAPI_PHONE_NUMBER_ID=
VAPI_API_URL=https://api.vapi.ai
GLM_API_KEY=
GLM_API_URL=https://open.bigmodel.cn/api/paas/v4
GLM_MODEL=glm-5
```

## Current readiness

- Firecrawl: connected and verified through `/api/research/clinic` with a live website scrape.
- Vapi: the dashboard route is implemented and fail-closed, but outbound calls require a valid Vapi token plus `VAPI_ASSISTANT_ID` and `VAPI_PHONE_NUMBER_ID`. The supplied token did not authenticate against Vapi, so no call was placed.
- GLM: the copilot route is implemented and fail-closed. The configured GLM endpoint responded with an account balance/resource error during verification; refill or enable the provider account before using live suggestions.

## Safe behavior

- Research and copilot requests are authenticated server routes.
- Demo records cannot start provider actions.
- Vapi calls require an explicit user click and reject do-not-call, archived, missing-phone, or unconfigured records.
- Provider errors are returned to the interface; they are never presented as successful work.

## Vercel

Configure the same server-side variables separately for each Vercel target. Production and Development are configured for the `novalyte-dashboard` project. Preview variables require a connected Git repository in Vercel; the current project is not connected to one yet.
