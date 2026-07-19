#!/usr/bin/env node
/**
 * Dialpad mock-mode end-to-end flow test.
 *
 * Requires a running dev server (npm run dev) configured with:
 *   DIALPAD_MODE=mock
 *   DIALPAD_INTEGRATION_ENABLED=true
 *
 * The script refuses to run unless the server reports mock mode, so it can
 * never place a real call. It exercises:
 *   initiate -> ringing -> connected -> completed (simulated events)
 *   duplicate + out-of-order webhook handling
 *   delayed transcript enrichment
 *   outcome + follow-up persistence
 *
 * Usage: node scripts/test-dialpad-mock-flow.mjs [--base-url http://localhost:3000]
 */
import { readFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
if (existsSync(resolve(ROOT, ".env"))) {
  for (const line of readFileSync(resolve(ROOT, ".env"), "utf8").split("\n")) {
    const m = line.match(/^([A-Z0-9_]+)=("?)(.*)\2\s*$/);
    if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[3];
  }
}

const argIdx = process.argv.indexOf("--base-url");
const BASE = (argIdx > -1 ? process.argv[argIdx + 1] : process.env.DIALPAD_TEST_BASE_URL) || "http://localhost:3000";
const ACCESS_CODE = process.env.NOVALYTE_ACCESS_CODE;

let cookie = "";
let passed = 0;
let failed = 0;

function ok(name, condition, detail = "") {
  if (condition) {
    passed += 1;
    console.log(`  ✓ ${name}`);
  } else {
    failed += 1;
    console.error(`  ✗ ${name}${detail ? ` — ${detail}` : ""}`);
  }
}

async function api(method, path, body, extraHeaders = {}) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: { "Content-Type": "application/json", cookie, ...extraHeaders },
    body: body === undefined ? undefined : typeof body === "string" ? body : JSON.stringify(body),
    redirect: "manual",
  });
  const setCookie = res.headers.get("set-cookie");
  if (setCookie) cookie = setCookie.split(";")[0];
  let json = null;
  try {
    json = await res.clone().json();
  } catch {
    /* non-JSON */
  }
  return { res, json };
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function main() {
  console.log(`Dialpad mock flow test against ${BASE}`);

  // 1. Login.
  if (!ACCESS_CODE) throw new Error("NOVALYTE_ACCESS_CODE is not set.");
  const login = await api("POST", "/api/auth/login", { accessCode: ACCESS_CODE });
  ok("login", login.res.ok, JSON.stringify(login.json));
  if (!login.res.ok) throw new Error("Cannot continue without a session.");

  // 2. Verify mock mode — hard safety gate.
  const status = await api("GET", "/api/integrations/dialpad/status");
  const mode = status.json?.status?.mode;
  ok("integration enabled", status.json?.status?.enabled === true);
  if (mode !== "mock") {
    throw new Error(`Refusing to run: server mode is "${mode}", not "mock". This test never places real calls.`);
  }
  ok("mock mode confirmed", true);

  // 3. Create an isolated test clinic.
  const clinicName = `Dialpad Mock Test Clinic ${Date.now()}`;
  const createClinic = await api("POST", "/api/clinics", {
    name: clinicName,
    primaryPhone: "+16015550142",
    city: "Testville",
    state: "MS",
    timezone: "America/Chicago",
    pipelineStage: "ready_to_call",
    priority: "normal",
  });
  const clinicId = createClinic.json?.clinic?.id ?? createClinic.json?.id;
  ok("test clinic created", Boolean(clinicId), JSON.stringify(createClinic.json).slice(0, 200));
  if (!clinicId) throw new Error("Cannot continue without a clinic.");

  try {
    // 4. Initiate the mock call.
    const initiate = await api("POST", "/api/integrations/dialpad/calls", { clinicId, source: "mock-flow-test" });
    ok("call initiated", initiate.res.ok && initiate.json?.status === "initiating", JSON.stringify(initiate.json));
    ok("mock badge mode returned", initiate.json?.mode === "mock");
    const sessionId = initiate.json?.callSessionId;
    if (!sessionId) throw new Error("No call session id.");

    // 4b. Double-click protection.
    const dup = await api("POST", "/api/integrations/dialpad/calls", { clinicId, source: "mock-flow-test" });
    ok("duplicate initiation blocked", dup.res.status === 409, `status ${dup.res.status}`);

    // 5. Observe simulated lifecycle: ringing -> connected -> completed.
    const seen = new Set();
    let call = null;
    const deadline = Date.now() + 60_000;
    while (Date.now() < deadline) {
      const poll = await api("GET", `/api/integrations/dialpad/calls/${sessionId}`);
      call = poll.json?.call;
      if (call?.status) seen.add(call.status);
      if (call?.status === "completed") break;
      await sleep(1500);
    }
    ok("observed ringing state", seen.has("ringing"), [...seen].join(","));
    ok("observed connected state", seen.has("connected"), [...seen].join(","));
    ok("call completed", call?.status === "completed", call?.status);
    ok("server timestamps recorded", Boolean(call?.connectedAt && call?.endedAt));
    ok("duration recorded", Number(call?.durationSec) > 0, String(call?.durationSec));

    // 6. Out-of-order webhook: a stale ringing event must not regress status.
    const stale = await api("POST", "/api/integrations/dialpad/webhook", {
      call_id: call.providerCallId,
      state: "ringing",
      direction: "outbound",
      event_timestamp: new Date(call.startedAt).getTime() + 1,
      external_number: call.externalNumber,
      date_started: new Date(call.startedAt).getTime(),
    });
    ok("stale webhook accepted", stale.res.ok, JSON.stringify(stale.json));
    const afterStale = await api("GET", `/api/integrations/dialpad/calls/${sessionId}`);
    ok("stale ringing did not overwrite completed", afterStale.json?.call?.status === "completed", afterStale.json?.call?.status);

    // 6b. Exact duplicate webhook is deduplicated.
    const dupEvent = await api("POST", "/api/integrations/dialpad/webhook", {
      call_id: call.providerCallId,
      state: "ringing",
      direction: "outbound",
      event_timestamp: new Date(call.startedAt).getTime() + 1,
      external_number: call.externalNumber,
      date_started: new Date(call.startedAt).getTime(),
    });
    ok("duplicate webhook detected", dupEvent.json?.outcome === "duplicate", JSON.stringify(dupEvent.json));

    // 7. Enrichment: transcript is delayed, then becomes available.
    let transcriptStatus = null;
    const enrichDeadline = Date.now() + 120_000;
    let sawNotReady = false;
    while (Date.now() < enrichDeadline) {
      await api("POST", "/api/cron/dialpad-enrichment");
      const t = await api("GET", `/api/integrations/dialpad/calls/${sessionId}/transcript`);
      if (t.res.status === 202) sawNotReady = true;
      if (t.res.status === 200 && t.json?.status === "stored") {
        transcriptStatus = t.json;
        break;
      }
      await sleep(5000);
    }
    ok("transcript delayed then available", Boolean(transcriptStatus), sawNotReady ? "saw not_ready first" : "never stored");
    ok("transcript has segments", (transcriptStatus?.segments?.length ?? 0) > 3, String(transcriptStatus?.segments?.length));
    const recordings = await api("GET", `/api/integrations/dialpad/calls/${sessionId}/recording`);
    ok("recording metadata stored", recordings.json?.recordings?.length > 0, JSON.stringify(recordings.json).slice(0, 120));

    // 8. Outcome + follow-up persistence.
    const outcome = await api("POST", `/api/clinics/${clinicId}/calls`, {
      callSessionId: sessionId,
      outcome: "interested",
      answered: true,
      decisionMakerReached: true,
      notes: "Mock flow test outcome",
      followUpRequired: true,
      nextAction: "Send directory confirmation email",
      nextActionAt: new Date(Date.now() + 86_400_000).toISOString(),
      durationSec: call.durationSec,
      structuredData: { provider: "dialpad", directoryPermissionStatus: "granted" },
    });
    ok("outcome saved", outcome.res.ok, JSON.stringify(outcome.json).slice(0, 200));

    const review = await api("PATCH", `/api/integrations/dialpad/calls/${sessionId}`, {
      trainingReviewStatus: "approved_analytics",
      directoryPermissionStatus: "granted",
      bookingLinkPermissionStatus: "pending",
    });
    ok("training review saved", review.res.ok && review.json?.call?.trainingReviewStatus === "approved_analytics");

    const followUps = await api("GET", "/api/follow-ups?view=upcoming");
    ok("follow-up task exists", JSON.stringify(followUps.json ?? {}).includes("Send directory confirmation email"));
  } finally {
    // Cleanup: archive the test clinic so it leaves the queue.
    await api("PATCH", `/api/clinics/${clinicId}`, { archived: true, notes: "dialpad mock flow test artifact" });
  }

  console.log(`\n${passed} passed, ${failed} failed`);
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error(`✗ ${err.message}`);
  process.exit(1);
});
