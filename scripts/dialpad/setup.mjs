#!/usr/bin/env node
/**
 * Dialpad webhook + call-event subscription setup.
 *
 * Usage:
 *   node scripts/dialpad/setup.mjs             # dry run (no mutations)
 *   node scripts/dialpad/setup.mjs --apply     # create missing resources
 *
 * Reads DIALPAD_* variables from the environment (falls back to .env in the
 * repo root). Never prints the API key or webhook secret. Never deletes
 * existing Dialpad webhooks — cleanup instructions are printed instead.
 */
import { readFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const APPLY = process.argv.includes("--apply");
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");

// Minimal .env loader (no new dependency); process.env wins.
if (existsSync(resolve(ROOT, ".env"))) {
  for (const line of readFileSync(resolve(ROOT, ".env"), "utf8").split("\n")) {
    const match = line.match(/^([A-Z0-9_]+)=("?)(.*)\2\s*$/);
    if (match && process.env[match[1]] === undefined) process.env[match[1]] = match[3];
  }
}

const API_BASE = (process.env.DIALPAD_API_BASE_URL || "https://dialpad.com/api/v2").replace(/\/+$/, "");
const API_KEY = process.env.DIALPAD_API_KEY;
const USER_ID = process.env.DIALPAD_USER_ID;
const WEBHOOK_SECRET = process.env.DIALPAD_WEBHOOK_SECRET;
const APP_URL = (process.env.NEXT_PUBLIC_APP_URL || "").replace(/\/+$/, "");

const CALL_STATES = [
  "preanswer",
  "calling",
  "ringing",
  "connected",
  "hold",
  "queued",
  "hangup",
  "missed",
  "voicemail",
  "recording",
  "call_transcription",
  "recap_summary",
];

function fail(message) {
  console.error(`✗ ${message}`);
  process.exit(1);
}

if (!API_KEY) fail("DIALPAD_API_KEY is not set.");
if (!WEBHOOK_SECRET) fail("DIALPAD_WEBHOOK_SECRET is not set.");
if (!APP_URL) fail("NEXT_PUBLIC_APP_URL is not set (needed to build the hook URL).");

const HOOK_URL = `${APP_URL}/api/integrations/dialpad/webhook`;

async function api(method, path, body) {
  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${API_KEY}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  let json = null;
  try {
    json = JSON.parse(text);
  } catch {
    /* non-JSON error body */
  }
  if (!res.ok) {
    const detail = json?.error?.message ?? text.slice(0, 200);
    throw new Error(`${method} ${path} -> HTTP ${res.status}: ${detail}`);
  }
  return json;
}

async function main() {
  console.log(`Dialpad setup (${APPLY ? "APPLY" : "DRY RUN"})`);
  console.log(`  API base:  ${API_BASE}`);
  console.log(`  Hook URL:  ${HOOK_URL}`);

  // 1. Test authentication.
  if (USER_ID) {
    const user = await api("GET", `/users/${encodeURIComponent(USER_ID)}`);
    console.log(`✓ Authenticated. Dialpad user: ${user?.display_name ?? user?.id ?? USER_ID}`);
  } else {
    console.log("! DIALPAD_USER_ID not set — skipping user check (calls will require it).");
    await api("GET", "/webhooks");
    console.log("✓ Authenticated (webhook list readable).");
  }

  // 2. Create or reuse the webhook.
  const hookList = await api("GET", "/webhooks");
  const existingHook = (hookList?.items ?? []).find((h) => h?.hook_url === HOOK_URL);
  let webhookId = existingHook?.id ?? null;
  if (existingHook) {
    console.log(`✓ Webhook already exists (id ${existingHook.id}); reusing it.`);
    if (!existingHook.signature?.secret) {
      console.log("! Existing webhook has NO signature secret. Production requires a signed webhook.");
      console.log("  Recreate it with a secret or contact Dialpad support; this script never deletes webhooks.");
    }
  } else if (APPLY) {
    const created = await api("POST", "/webhooks", { hook_url: HOOK_URL, secret: WEBHOOK_SECRET });
    webhookId = created?.id;
    console.log(`✓ Created webhook id ${webhookId} (signed, HS256 JWT).`);
  } else {
    console.log(`→ Would create signed webhook for ${HOOK_URL}. Run with --apply to create.`);
  }

  // 3. Create or reuse the call-event subscription.
  const subList = await api("GET", "/subscriptions/call");
  const existingSub = (subList?.items ?? []).find(
    (s) => String(s?.webhook?.id ?? "") === String(webhookId ?? "") && webhookId != null,
  );
  if (existingSub) {
    console.log(`✓ Call event subscription already exists (id ${existingSub.id}); states: ${(existingSub.call_states ?? []).join(", ")}`);
  } else if (APPLY && webhookId != null) {
    const sub = await api("POST", "/subscriptions/call", {
      endpoint_id: Number(webhookId),
      call_states: CALL_STATES,
      enabled: true,
      ...(USER_ID ? { target_type: "user", target_id: Number(USER_ID) } : {}),
    });
    console.log(`✓ Created call event subscription id ${sub?.id}.`);
  } else {
    console.log(`→ Would create call event subscription (states: ${CALL_STATES.join(", ")})${USER_ID ? ` scoped to user ${USER_ID}` : ""}. Run with --apply.`);
  }

  console.log("\nRecord these operational IDs somewhere secure:");
  console.log(`  webhook_id:      ${webhookId ?? "(not created yet)"}`);
  console.log(`  subscription_id: ${existingSub?.id ?? "(created on --apply)"}`);
  console.log("\nTo disable later: set DIALPAD_INTEGRATION_ENABLED=false (app side), and/or");
  console.log("disable the subscription in Dialpad. This script never deletes Dialpad webhooks.");
}

main().catch((err) => fail(err.message));
