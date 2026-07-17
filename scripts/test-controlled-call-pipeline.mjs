#!/usr/bin/env node
/**
 * Controlled pipeline test — does NOT dial a real clinic.
 * Validates: session tables, consent, recording upload, local backup, post-call analysis.
 */
import { readFileSync, existsSync } from "fs";
import { join } from "path";
import { createHash } from "crypto";

function loadEnv() {
  const envPath = join(process.cwd(), ".env");
  if (!existsSync(envPath)) return;
  for (const line of readFileSync(envPath, "utf8").split("\n")) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}

loadEnv();

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
const BASE = process.env.TEST_BASE_URL?.trim() || "http://localhost:3000";

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env");
  process.exit(1);
}

const headers = {
  apikey: SERVICE_KEY,
  Authorization: `Bearer ${SERVICE_KEY}`,
  "Content-Type": "application/json",
};

async function sb(path, init = {}) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, { ...init, headers: { ...headers, ...(init.headers || {}) } });
  const text = await res.text();
  let json = null;
  try { json = text ? JSON.parse(text) : null; } catch { json = text; }
  return { ok: res.ok, status: res.status, json };
}

async function main() {
  console.log("=== Controlled call pipeline test (no PSTN dial) ===\n");

  // 1. Verify tables
  const tables = ["call_recordings", "call_consent_events", "call_post_analyses", "copilot_knowledge_entries"];
  for (const t of tables) {
    const r = await sb(`${t}?select=id&limit=1`);
    console.log(r.ok ? `✓ table ${t}` : `✗ table ${t} (${r.status})`);
  }

  // 2. Find a test clinic (use a synthetic ID prefix for test session)
  const clinics = await sb("prospect_clinics?select=id,name&limit=1");
  const clinicId = clinics.json?.[0]?.id ?? "test-clinic-controlled";
  const clinicName = clinics.json?.[0]?.name ?? "Controlled Test Clinic";
  console.log(`\nUsing clinic: ${clinicName} (${clinicId})`);

  const sessionId = `test-controlled-${Date.now()}`;
  const idempotencyKey = `${sessionId}-primary`;

  // 3. Create test call session in prospect_calls
  const sessionRes = await sb("prospect_calls", {
    method: "POST",
    headers: { ...headers, Prefer: "return=representation" },
    body: JSON.stringify({
      id: sessionId,
      clinicId,
      startedAt: new Date().toISOString(),
      status: "ended",
      outcome: "test_controlled",
      provider: "test_harness",
      callEnvironment: "practice",
      transcript: JSON.stringify([
        { speaker: "Jamil", text: "Hi, this is Jamil with Novalyte AI about your free directory listing." },
        { speaker: "Clinic", text: "Is this free?" },
        { speaker: "Jamil", text: "Yes, completely free — just permission to list your public details." },
        { speaker: "Clinic", text: "Yes, you can list us." },
      ]),
      structuredData: JSON.stringify({ testHarness: true }),
      durationSec: 45,
    }),
  });
  console.log(sessionRes.ok ? `✓ created test session ${sessionId}` : `✗ session create (${sessionRes.status})`, sessionRes.json?.message ?? "");

  // 4. Consent event
  const consentRes = await sb("call_consent_events", {
    method: "POST",
    headers: { ...headers, Prefer: "return=representation" },
    body: JSON.stringify({
      call_session_id: sessionId,
      clinic_id: clinicId,
      consent_status: "not_required",
      jurisdiction: "test",
      consent_script: "Test harness consent",
    }),
  });
  console.log(consentRes.ok ? "✓ consent event recorded" : `✗ consent (${consentRes.status})`);

  // 5. Upload minimal audio to storage (tiny webm header bytes)
  const fakeAudio = Buffer.from([0x1a, 0x45, 0xdf, 0xa3, 0x00, 0x00, 0x00, 0x00]);
  const storagePath = `${clinicId}/${sessionId}/${idempotencyKey}.webm`;
  const uploadRes = await fetch(`${SUPABASE_URL}/storage/v1/object/call-recordings/${storagePath}`, {
    method: "POST",
    headers: {
      apikey: SERVICE_KEY,
      Authorization: `Bearer ${SERVICE_KEY}`,
      "Content-Type": "audio/webm",
      "x-upsert": "true",
    },
    body: fakeAudio,
  });
  console.log(uploadRes.ok ? `✓ storage upload ${storagePath}` : `✗ storage upload (${uploadRes.status})`);

  const checksum = createHash("sha256").update(fakeAudio).digest("hex");
  const recRes = await sb("call_recordings", {
    method: "POST",
    headers: { ...headers, Prefer: "return=representation" },
    body: JSON.stringify({
      call_session_id: sessionId,
      clinic_id: clinicId,
      storage_bucket: "call-recordings",
      storage_path: storagePath,
      file_type: "audio/webm",
      file_size: fakeAudio.length,
      checksum_sha256: checksum,
      recording_status: "uploaded",
      consent_status: "not_required",
      idempotency_key: idempotencyKey,
      audio_duration_sec: 45,
    }),
  });
  console.log(recRes.ok ? "✓ recording metadata saved" : `✗ recording metadata (${recRes.status})`);

  // 6. Post-call analysis via API (if server up)
  try {
    const analyzeRes = await fetch(`${BASE}/api/calls/${sessionId}/analyze`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        durationSec: 45,
        consentStatus: "not_required",
        recordingStatus: "uploaded",
        transcript: [
          { speaker: "Jamil", text: "Hi, this is Jamil with Novalyte AI about your free directory listing." },
          { speaker: "Clinic", text: "Is this free?" },
          { speaker: "Clinic", text: "Yes, you can list us." },
        ],
        copilotSuggestions: [{ suggested_response: "Yes—the listing is free.", was_used: true }],
      }),
    });
    if (analyzeRes.status === 401) {
      console.log("⚠ post-call analyze API requires login (expected in dev) — verifying DB analysis insert directly");
      const { generatePostCallAnalysis } = await import("../src/lib/calls/post-call-analysis.ts");
      const analysis = generatePostCallAnalysis({
        callSessionId: sessionId,
        clinicId,
        clinicName,
        transcript: [
          { speaker: "Jamil", text: "free directory listing" },
          { speaker: "Clinic", text: "Yes, you can list us." },
        ],
        durationSec: 45,
        consentStatus: "not_required",
        recordingStatus: "uploaded",
        copilotSuggestions: [{ suggested_response: "Yes—the listing is free.", was_used: true }],
        qualification: {},
      });
      const paRes = await sb("call_post_analyses", {
        method: "POST",
        headers: { ...headers, Prefer: "return=representation" },
        body: JSON.stringify({
          call_session_id: sessionId,
          clinic_id: clinicId,
          summary: analysis.summary,
          directory_permission_result: analysis.directoryPermissionResult,
          contact_reached: analysis.contactReached,
          analysis_status: "completed",
          raw_analysis: analysis,
          training_eligibility_recommendation: analysis.trainingEligibilityRecommendation,
        }),
      });
      console.log(paRes.ok ? `✓ post-call analysis saved (permission: ${analysis.directoryPermissionResult})` : `✗ analysis (${paRes.status})`);
    } else {
      const body = await analyzeRes.json().catch(() => ({}));
      console.log(analyzeRes.ok ? `✓ post-call analyze API (${body.analysis?.directoryPermissionResult})` : `✗ analyze API (${analyzeRes.status})`);
    }
  } catch (e) {
    console.log("⚠ analyze step skipped:", e instanceof Error ? e.message : String(e));
  }

  // 7. Verify retrieval
  const verify = await sb(`call_post_analyses?call_session_id=eq.${sessionId}&select=directory_permission_result,training_eligibility_recommendation`);
  console.log("\n=== Results ===");
  console.log(JSON.stringify(verify.json, null, 2));
  console.log("\nControlled pipeline test complete. Session ID:", sessionId);
  console.log("Clean up: delete test rows when done reviewing.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
