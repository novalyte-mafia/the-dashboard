import "server-only";
import { createHash } from "node:crypto";
import { db } from "@/lib/db";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { isWithinCallingHours } from "@/lib/format";
import { getDialpadConfig } from "./env";
import { DialpadError, toDialpadError } from "./errors";
import * as dialpadClient from "./client";
import { buildCustomData, parseCustomData } from "./custom-data";
import { dialpadLog } from "./log";
import {
  MOCK_ERROR_NUMBERS,
  buildMockCallDetails,
  buildMockTranscript,
  computeMockProgress,
  mockProviderCallId,
} from "./mock";
import {
  buildEventKey,
  isEnrichmentSignal,
  mapDialpadState,
  msToIso,
  normalizeTranscriptLines,
} from "./normalizers";
import { decideTransition, isTerminalStatus } from "./state-machine";
import { sanitizeSession } from "./sanitize";
import type { ValidatedDialpadCallEvent } from "./schemas";
import type { DialpadCall, NormalizedCallStatus } from "./types";

const PROVIDER = "dialpad";
const INITIATION_COOLDOWN_MS = 15_000;
const ACTIVE_SESSION_WINDOW_MS = 2 * 60 * 60 * 1000;
const FALLBACK_MATCH_WINDOW_MS = 30 * 60 * 1000;

/** Enrichment retry schedule (seconds by attempt), then exponential backoff. */
const ENRICHMENT_RETRY_SCHEDULE_SEC = [10, 30, 90, 180, 300];
const ENRICHMENT_MAX_ATTEMPTS = 12;
const ENRICHMENT_MAX_BACKOFF_SEC = 3600;

export function enrichmentDelaySec(attemptCount: number): number {
  if (attemptCount < ENRICHMENT_RETRY_SCHEDULE_SEC.length) {
    return ENRICHMENT_RETRY_SCHEDULE_SEC[attemptCount];
  }
  const extra = attemptCount - ENRICHMENT_RETRY_SCHEDULE_SEC.length;
  return Math.min(300 * 2 ** (extra + 1), ENRICHMENT_MAX_BACKOFF_SEC);
}

// ---------------------------------------------------------------------------
// Call initiation
// ---------------------------------------------------------------------------

export interface InitiateCallInput {
  admin: { id: string; role: string };
  clinicId: string;
  contactId?: string | null;
  phoneNumber?: string | null;
  campaignId?: string | null;
  source?: string | null;
}

export interface InitiateCallResult {
  callSessionId: string;
  status: NormalizedCallStatus;
  providerCallId: string | null;
  mode: "mock" | "live";
  externalNumber: string;
  message: string;
}

export async function initiateDialpadCall(input: InitiateCallInput): Promise<InitiateCallResult> {
  const config = getDialpadConfig();
  dialpadLog("dialpad.call.initiation_requested", {
    clinic_id: input.clinicId,
    operator: input.admin.id,
    mode: config.mode,
  });

  if (!config.enabled) {
    throw new DialpadError("integration_disabled", "The Dialpad integration is disabled.");
  }
  if (config.mode === "live" && config.configErrors.length > 0) {
    throw new DialpadError("not_configured", `Dialpad is not fully configured: ${config.configErrors.join(" ")}`);
  }

  const clinic = await db.clinic.findUnique({ where: { id: input.clinicId } });
  if (!clinic) throw new DialpadError("invalid_request", "Clinic not found.");
  if (clinic.doNotCall) {
    throw new DialpadError("do_not_call", "This clinic is marked Do Not Call.");
  }
  if (clinic.archived) {
    throw new DialpadError("invalid_request", "This clinic is archived and cannot be called.");
  }

  // Resolve and normalize the destination number.
  let contact: { id: string; directPhone?: string | null; mobilePhone?: string | null } | null = null;
  if (input.contactId) {
    contact = await db.clinicContact.findUnique({ where: { id: input.contactId } });
    if (!contact) throw new DialpadError("invalid_request", "Contact not found.");
  }
  const { normalizeToE164 } = await import("./phone");
  const rawNumber =
    input.phoneNumber?.trim() ||
    contact?.directPhone ||
    contact?.mobilePhone ||
    clinic.primaryPhone ||
    clinic.secondaryPhone ||
    null;
  const externalNumber = normalizeToE164(rawNumber);
  if (!externalNumber) {
    throw new DialpadError(
      "invalid_phone_number",
      rawNumber ? `The phone number "${rawNumber}" is not a valid dialable number.` : "This clinic has no phone number on file.",
    );
  }

  // Calling-hour enforcement where timezone data exists (live mode only —
  // mock mode never contacts a real clinic).
  if (config.mode === "live" && clinic.timezone && !isWithinCallingHours(clinic.timezone)) {
    throw new DialpadError(
      "outside_calling_hours",
      "It is outside this clinic's permitted calling hours (8am–8pm local time).",
    );
  }

  // Double-click / duplicate protection: initiation cooldown per operator...
  const recentByOperator = await db.callSession.findFirst({
    where: { adminId: input.admin.id, provider: PROVIDER },
    orderBy: { startedAt: "desc" },
  });
  if (recentByOperator?.startedAt && Date.now() - new Date(recentByOperator.startedAt).getTime() < INITIATION_COOLDOWN_MS) {
    if (!isTerminalStatus((recentByOperator.status ?? "unknown") as NormalizedCallStatus)) {
      throw new DialpadError("duplicate_call", "A Dialpad call was just started. Wait a few seconds before dialing again.");
    }
  }
  // ...and one active Dialpad session per clinic.
  const activeForClinic = await db.callSession.findFirst({
    where: { clinicId: input.clinicId, provider: PROVIDER, status: { in: ["queued", "initiating", "ringing", "connected", "active", "held"] } },
    orderBy: { startedAt: "desc" },
  });
  if (
    activeForClinic?.startedAt &&
    Date.now() - new Date(activeForClinic.startedAt).getTime() < ACTIVE_SESSION_WINDOW_MS
  ) {
    throw new DialpadError("duplicate_call", "A Dialpad call to this clinic is already in progress.");
  }

  // Provisional call session BEFORE contacting Dialpad.
  const attemptNumber = Number(clinic.callAttempts ?? 0) + 1;
  const startedAt = new Date();
  const session = await db.callSession.create({
    data: {
      clinicId: input.clinicId,
      contactId: input.contactId ?? null,
      adminId: input.admin.id,
      startedAt,
      attemptNumber,
      provider: PROVIDER,
      callEnvironment: config.mode === "mock" ? "practice" : "live",
      direction: "outbound",
      status: "initiating",
      outcome: "not_started",
      externalNumber,
      outboundCallerId: config.outboundCallerId ?? null,
      transcriptStatus: "none",
      lastEventAt: startedAt,
      providerMetadata: { mode: config.mode, source: input.source ?? "novalyte-command-center" },
      metadata: JSON.stringify({ phoneNumber: externalNumber, dialpadMode: config.mode }),
      structuredData: JSON.stringify({ callEnvironment: config.mode === "mock" ? "practice" : "live", provider: PROVIDER }),
    },
  });

  const customData = buildCustomData({
    callSessionId: session.id,
    clinicId: input.clinicId,
    contactId: input.contactId ?? null,
    campaignId: input.campaignId ?? null,
    operatorUserId: input.admin.id,
    source: input.source ?? undefined,
  });
  await db.callSession.update({
    where: { id: session.id },
    data: { providerCustomData: JSON.parse(customData) },
  });

  // -------------------------------------------------------------------------
  // Mock mode: never contacts Dialpad, never dials real numbers.
  // -------------------------------------------------------------------------
  if (config.mode === "mock") {
    if (externalNumber === MOCK_ERROR_NUMBERS.RATE_LIMITED) {
      await failSession(session.id, "rate_limited", "Mock: Dialpad rate limit.");
      throw new DialpadError("rate_limited", "Dialpad rate limit reached (mock).", { retryAfterSec: 30 });
    }
    if (externalNumber === MOCK_ERROR_NUMBERS.PROVIDER_UNAVAILABLE) {
      await failSession(session.id, "provider_unavailable", "Mock: Dialpad unavailable.");
      throw new DialpadError("provider_unavailable", "Dialpad is temporarily unavailable (mock).");
    }
    if (externalNumber === MOCK_ERROR_NUMBERS.NO_ACTIVE_DEVICE) {
      await failSession(session.id, "invalid_request", "Mock: no active Dialpad device.");
      throw new DialpadError(
        "invalid_request",
        "No active Dialpad device (mock). Open the Dialpad app and try again.",
      );
    }
    const providerCallId = mockProviderCallId(session.id);
    await db.callSession.update({
      where: { id: session.id },
      data: { providerCallId, providerUserId: "mock-user" },
    });
    dialpadLog("dialpad.call.initiated", { call_session_id: session.id, provider_call_id: providerCallId, mode: "mock" });
    return {
      callSessionId: session.id,
      status: "initiating",
      providerCallId,
      mode: "mock",
      externalNumber,
      message: "Mock Dialpad call started. Call progress is simulated.",
    };
  }

  // -------------------------------------------------------------------------
  // Live mode
  // -------------------------------------------------------------------------
  const mapping = await getActiveUserMapping(input.admin.id);
  const dialpadUserId = mapping?.dialpad_user_id ?? config.userId;
  if (!dialpadUserId) {
    await failSession(session.id, "no_user_mapping", "No Dialpad user mapping for this operator.");
    throw new DialpadError(
      "no_user_mapping",
      "No Dialpad user is mapped to your account and no default DIALPAD_USER_ID is configured.",
    );
  }

  try {
    const response = await dialpadClient.initiateCall({
      user_id: Number(dialpadUserId),
      phone_number: externalNumber,
      outbound_caller_id: config.outboundCallerId ?? undefined,
      custom_data: customData,
    });
    // The initiation response may not carry the final call id; webhook
    // matching via custom_data remains the primary association mechanism.
    const providerCallId = response.call_id != null ? String(response.call_id) : null;
    await db.callSession.update({
      where: { id: session.id },
      data: {
        providerCallId,
        providerUserId: String(dialpadUserId),
        providerMetadata: { mode: "live", initiation_response: { call_id: providerCallId } },
      },
    });
    dialpadLog("dialpad.call.initiated", { call_session_id: session.id, provider_call_id: providerCallId, mode: "live" });
    return {
      callSessionId: session.id,
      status: "initiating",
      providerCallId,
      mode: "live",
      externalNumber,
      message: "Dialpad is ringing your active Dialpad device. Answer it to start the call.",
    };
  } catch (err) {
    const normalized = toDialpadError(err);
    await failSession(session.id, normalized.code, normalized.userMessage);
    dialpadLog("dialpad.call.initiation_failed", { call_session_id: session.id, code: normalized.code }, "warn");
    throw normalized;
  }
}

async function failSession(sessionId: string, code: string, message: string) {
  await db.callSession
    .update({
      where: { id: sessionId },
      data: { status: "failed", failureCode: code, failureMessage: message, endedAt: new Date() },
    })
    .catch(() => undefined);
}

async function getActiveUserMapping(appUserId: string): Promise<{ dialpad_user_id: string } | null> {
  const supabase = getSupabaseAdmin();
  const { data } = await supabase
    .from("dialpad_user_mappings")
    .select("dialpad_user_id")
    .eq("app_user_id", appUserId)
    .eq("is_active", true)
    .maybeSingle();
  return data ?? null;
}

// ---------------------------------------------------------------------------
// Session read (with mock progression)
// ---------------------------------------------------------------------------

export async function getDialpadSession(callSessionId: string) {
  const session = await db.callSession.findUnique({ where: { id: callSessionId } });
  if (!session || session.provider !== PROVIDER) return null;

  const config = getDialpadConfig();
  if (config.mode === "mock" && session.providerCallId && !isTerminalStatus(session.status as NormalizedCallStatus)) {
    await advanceMockSession(session);
    return db.callSession.findUnique({ where: { id: callSessionId } });
  }
  return session;
}

/**
 * Ends an active Dialpad call from the Founder-Led console.
 *
 * - Mock: injects a hangup event so the UI can move to the outcome form immediately.
 * - Live: marks the session completed in our CRM. Actual phone audio still hangs up in
 *   the Dialpad app (this dashboard does not carry the call media).
 */
export async function endDialpadCall(input: {
  callSessionId: string;
  adminId: string;
}) {
  const session = await db.callSession.findUnique({ where: { id: input.callSessionId } });
  if (!session || session.provider !== PROVIDER) {
    throw new DialpadError("invalid_request", "Call session not found.");
  }
  if (isTerminalStatus(session.status as NormalizedCallStatus)) {
    return { call: sanitizeSession(session as unknown as Record<string, unknown>), mode: getDialpadConfig().mode };
  }

  const config = getDialpadConfig();
  const nowMs = Date.now();
  const connectedAtMs = session.connectedAt ? new Date(session.connectedAt).getTime() : null;
  const startedAtMs = session.startedAt ? new Date(session.startedAt).getTime() : nowMs;
  const durationMs = connectedAtMs ? Math.max(0, nowMs - connectedAtMs) : null;

  if (config.mode === "mock" && session.providerCallId) {
    const details = buildMockCallDetails({
      providerCallId: session.providerCallId,
      externalNumber: session.externalNumber ?? "+15555550100",
      internalNumber: "+15550001000",
      customData: null,
      startedAtMs,
    });
    await processDialpadEvent(
      {
        ...details,
        custom_data: null,
        state: "hangup",
        event_timestamp: nowMs,
        date_connected: connectedAtMs,
        date_ended: nowMs,
        duration: durationMs,
      } as ValidatedDialpadCallEvent,
      { knownSessionId: session.id },
    );
    const updated = await db.callSession.findUnique({ where: { id: session.id } });
    dialpadLog("dialpad.call.ended", { call_session_id: session.id, mode: "mock", by: input.adminId });
    return {
      call: sanitizeSession((updated ?? session) as unknown as Record<string, unknown>),
      mode: "mock",
    };
  }

  // Live: CRM hangup. Operator still ends audio in Dialpad if the device is still up.
  const updated = await db.callSession.update({
    where: { id: session.id },
    data: {
      status: connectedAtMs ? "completed" : "canceled",
      endedAt: new Date(nowMs),
      durationMs,
      providerMetadata: {
        ...((session.providerMetadata as Record<string, unknown> | null) ?? {}),
        ended_from_dashboard: true,
        ended_by_admin_id: input.adminId,
      },
    },
  });
  dialpadLog("dialpad.call.ended", { call_session_id: session.id, mode: "live", by: input.adminId });
  return { call: sanitizeSession(updated as unknown as Record<string, unknown>), mode: "live" };
}

/**
 * Advances a mock session by synthesizing the provider events implied by
 * elapsed time and running them through the same webhook-processing pipeline
 * as live events.
 */
async function advanceMockSession(session: {
  id: string;
  providerCallId: string;
  startedAt: Date | string;
  externalNumber?: string | null;
}) {
  const startedAtMs = new Date(session.startedAt).getTime();
  const details = buildMockCallDetails({
    providerCallId: session.providerCallId,
    externalNumber: session.externalNumber ?? "+15555550100",
    internalNumber: "+15550001000",
    customData: null,
    startedAtMs,
  });
  const progress = computeMockProgress(startedAtMs, session.externalNumber ?? "+15555550100");

  // Replay the intermediate states so call_events history looks like a real
  // Dialpad sequence. Idempotency (provider_event_key) makes this safe.
  const sequence: Array<ValidatedDialpadCallEvent> = [];
  const baseEvent = { ...details, custom_data: null } as ValidatedDialpadCallEvent;
  if (progress.ringingAtMs) sequence.push({ ...baseEvent, state: "calling", event_timestamp: progress.ringingAtMs, date_connected: null, date_ended: null, duration: null });
  if (progress.connectedAtMs) sequence.push({ ...baseEvent, state: "connected", event_timestamp: progress.connectedAtMs, date_connected: progress.connectedAtMs, date_ended: null, duration: null });
  if (progress.endedAtMs) {
    sequence.push({
      ...baseEvent,
      state: "hangup",
      event_timestamp: progress.endedAtMs,
      date_connected: progress.connectedAtMs,
      date_ended: progress.endedAtMs,
      duration: progress.durationMs,
    });
  }
  for (const event of sequence) {
    await processDialpadEvent(event, { knownSessionId: session.id });
  }
}

// ---------------------------------------------------------------------------
// Webhook event processing
// ---------------------------------------------------------------------------

export interface ProcessEventResult {
  outcome: "processed" | "duplicate" | "unmatched" | "ignored";
  callSessionId?: string;
  statusApplied?: NormalizedCallStatus;
}

export async function processDialpadEvent(
  payload: ValidatedDialpadCallEvent,
  options: { knownSessionId?: string } = {},
): Promise<ProcessEventResult> {
  const supabase = getSupabaseAdmin();
  const eventKey = buildEventKey(payload);
  const payloadJson = JSON.stringify(payload);
  const payloadHash = createHash("sha256").update(payloadJson).digest("hex");
  const providerCallId = payload.call_id != null ? String(payload.call_id) : null;
  const state = payload.state ?? "unknown";
  const eventTimestampMs = payload.event_timestamp ?? payload.date_ended ?? payload.date_connected ?? payload.date_started ?? null;

  // Match to a call session before persisting so the audit row links up.
  const session = options.knownSessionId
    ? await db.callSession.findUnique({ where: { id: options.knownSessionId } })
    : await matchSession(payload, providerCallId);

  // Persist the raw event with idempotency. A unique-violation means the
  // event was already processed.
  const { error: insertError } = await supabase.from("call_events").insert({
    call_session_id: session?.id ?? null,
    event_type: "provider_call_event",
    event_status: state,
    event_state: state,
    provider: PROVIDER,
    provider_event_key: eventKey,
    provider_call_id: providerCallId,
    event_timestamp: msToIso(eventTimestampMs),
    payload: payload as Record<string, unknown>,
    payload_hash: payloadHash,
    processing_status: "processing",
  });
  if (insertError) {
    if (insertError.code === "23505") {
      dialpadLog("dialpad.webhook.duplicate", { provider_event_key: eventKey });
      return { outcome: "duplicate", callSessionId: session?.id };
    }
    throw new Error(`Failed to persist Dialpad event: ${insertError.message}`);
  }

  const finishEvent = async (status: "processed" | "unmatched" | "ignored" | "failed", errorMsg?: string) => {
    await supabase
      .from("call_events")
      .update({
        processing_status: status,
        processed_at: new Date().toISOString(),
        processing_error: errorMsg ?? null,
        call_session_id: session?.id ?? null,
      })
      .eq("provider", PROVIDER)
      .eq("provider_event_key", eventKey);
  };

  if (!session) {
    dialpadLog("dialpad.call.unmatched", { provider_call_id: providerCallId, state }, "warn");
    await finishEvent("unmatched");
    return { outcome: "unmatched" };
  }
  dialpadLog("dialpad.call.matched", { call_session_id: session.id, provider_call_id: providerCallId, state });

  // Post-call artifact signals (recording ready, transcript ready, recaps).
  if (isEnrichmentSignal(state)) {
    await handleEnrichmentSignal(session, payload, state);
    await finishEvent("processed");
    return { outcome: "processed", callSessionId: session.id };
  }

  const nextStatus = mapDialpadState(state, {
    isTransferred: payload.is_transferred,
    dateConnected: payload.date_connected,
  });

  const decision = decideTransition({
    currentStatus: (session.status ?? "unknown") as NormalizedCallStatus,
    currentEventAtMs: session.lastEventAt ? new Date(session.lastEventAt).getTime() : null,
    nextStatus,
    nextEventAtMs: eventTimestampMs,
  });

  const update: Record<string, unknown> = {
    lastEventAt: msToIso(eventTimestampMs) ?? new Date().toISOString(),
  };
  // Fill provider linkage/timestamps regardless of the state decision.
  if (providerCallId && !session.providerCallId) update.providerCallId = providerCallId;
  if (payload.master_call_id != null) update.providerMasterCallId = String(payload.master_call_id);
  if (payload.internal_number) update.internalNumber = payload.internal_number;
  if (payload.external_number && !session.externalNumber) update.externalNumber = payload.external_number;
  if (payload.date_rang && !session.ringingAt) update.ringingAt = msToIso(payload.date_rang);
  if (payload.date_connected && !session.connectedAt) update.connectedAt = msToIso(payload.date_connected);
  if (payload.date_ended) update.endedAt = msToIso(payload.date_ended);
  if (payload.duration != null) {
    update.durationMs = Math.round(payload.duration);
    update.durationSec = Math.round(payload.duration / 1000);
  }
  if (payload.was_recorded) update.recordingAvailable = true;

  if (decision.apply) {
    update.previousStatus = session.status ?? null;
    update.status = nextStatus;
    if (nextStatus === "unknown") {
      update.providerMetadata = { ...(session.providerMetadata ?? {}), last_unknown_state: state };
    }
  }

  await db.callSession.update({ where: { id: session.id }, data: update });

  // Terminal states queue post-call enrichment.
  const applied = decision.apply ? nextStatus : ((session.status ?? "unknown") as NormalizedCallStatus);
  if (decision.apply && isTerminalStatus(nextStatus)) {
    await scheduleEnrichment(session.id, providerCallId ?? session.providerCallId ?? null);
  }

  await finishEvent("processed");
  dialpadLog("dialpad.webhook.processed", {
    call_session_id: session.id,
    state,
    normalized: nextStatus,
    applied: decision.apply,
    reason: decision.reason,
  });
  return { outcome: "processed", callSessionId: session.id, statusApplied: applied };
}

/**
 * Matches an incoming provider event to a call session:
 * 1. custom_data.call_session_id (primary),
 * 2. provider call id (incl. master call id),
 * 3. cautious fallback: same external number, non-terminal Dialpad session
 *    created within the last 30 minutes.
 */
async function matchSession(payload: ValidatedDialpadCallEvent, providerCallId: string | null) {
  const custom = parseCustomData(payload.custom_data);
  if (custom?.call_session_id) {
    const byId = await db.callSession.findUnique({ where: { id: custom.call_session_id } });
    if (byId && byId.provider === PROVIDER) return byId;
  }
  if (providerCallId) {
    const byCallId = await db.callSession.findFirst({
      where: { provider: PROVIDER, providerCallId },
    });
    if (byCallId) return byCallId;
  }
  if (payload.master_call_id != null) {
    const byMaster = await db.callSession.findFirst({
      where: { provider: PROVIDER, providerCallId: String(payload.master_call_id) },
    });
    if (byMaster) return byMaster;
  }
  if (payload.external_number) {
    const candidate = await db.callSession.findFirst({
      where: {
        provider: PROVIDER,
        externalNumber: payload.external_number,
        status: { in: ["queued", "initiating", "ringing", "connected", "active", "held"] },
      },
      orderBy: { startedAt: "desc" },
    });
    if (candidate?.startedAt && Date.now() - new Date(candidate.startedAt).getTime() < FALLBACK_MATCH_WINDOW_MS) {
      return candidate;
    }
  }
  return null;
}

async function handleEnrichmentSignal(
  session: { id: string; providerCallId?: string | null },
  payload: ValidatedDialpadCallEvent,
  state: string,
) {
  const lowered = state.toLowerCase();
  if (lowered === "recording") {
    await db.callSession.update({
      where: { id: session.id },
      data: { recordingAvailable: true, recordingStatus: "uploaded" },
    }).catch(() => undefined);
    await upsertRecordingsFromDetails(session.id, session.providerCallId ?? null, payload);
    dialpadLog("dialpad.recording.available", { call_session_id: session.id });
    await scheduleEnrichment(session.id, session.providerCallId ?? null, ["recording"]);
  } else if (lowered === "call_transcription") {
    await db.callSession.update({
      where: { id: session.id },
      data: { transcriptStatus: "ready_at_provider" },
    }).catch(() => undefined);
    await scheduleEnrichment(session.id, session.providerCallId ?? null, ["transcript"]);
  } else if (lowered.startsWith("recap_") && payload.recap_summary) {
    await db.callSession.update({
      where: { id: session.id },
      data: {
        providerMetadata: { recap_summary: payload.recap_summary, recap_outcome: payload.recap_outcome ?? null },
      },
    }).catch(() => undefined);
  }
}

// ---------------------------------------------------------------------------
// Enrichment jobs
// ---------------------------------------------------------------------------

export type EnrichmentJobType = "call_details" | "transcript" | "recording";

export async function scheduleEnrichment(
  callSessionId: string,
  providerCallId: string | null,
  types: EnrichmentJobType[] = ["call_details", "transcript", "recording"],
) {
  const supabase = getSupabaseAdmin();
  for (const jobType of types) {
    const { error } = await supabase.from("dialpad_enrichment_jobs").insert({
      call_session_id: callSessionId,
      provider_call_id: providerCallId,
      job_type: jobType,
      status: "pending",
      run_after: new Date(Date.now() + enrichmentDelaySec(0) * 1000).toISOString(),
    });
    // 23505 = a live job for this (session, type) already exists.
    if (error && error.code !== "23505") {
      dialpadLog("dialpad.enrichment.failed", { call_session_id: callSessionId, job_type: jobType, error: error.message }, "error");
    }
  }
}

export interface EnrichmentRunReport {
  claimed: number;
  completed: number;
  retried: number;
  failed: number;
  details: Array<{ jobId: string; jobType: string; result: string }>;
}

/** Claims and runs due enrichment jobs. Called from the protected cron route. */
export async function runEnrichmentJobs(limit = 10): Promise<EnrichmentRunReport> {
  const supabase = getSupabaseAdmin();
  const report: EnrichmentRunReport = { claimed: 0, completed: 0, retried: 0, failed: 0, details: [] };

  const { data: dueJobs, error } = await supabase
    .from("dialpad_enrichment_jobs")
    .select("*")
    .eq("status", "pending")
    .lte("run_after", new Date().toISOString())
    .order("run_after", { ascending: true })
    .limit(limit);
  if (error) throw new Error(`Failed to list enrichment jobs: ${error.message}`);

  for (const job of dueJobs ?? []) {
    // Atomic claim: only one worker wins the pending -> processing update.
    const { data: claimed } = await supabase
      .from("dialpad_enrichment_jobs")
      .update({ status: "processing", locked_at: new Date().toISOString(), updated_at: new Date().toISOString() })
      .eq("id", job.id)
      .eq("status", "pending")
      .select()
      .maybeSingle();
    if (!claimed) continue;
    report.claimed += 1;
    dialpadLog("dialpad.enrichment.started", { job_id: job.id, job_type: job.job_type, call_session_id: job.call_session_id });

    try {
      await executeEnrichmentJob(claimed);
      await supabase
        .from("dialpad_enrichment_jobs")
        .update({ status: "completed", completed_at: new Date().toISOString(), updated_at: new Date().toISOString(), last_error: null })
        .eq("id", job.id);
      report.completed += 1;
      report.details.push({ jobId: job.id, jobType: job.job_type, result: "completed" });
      dialpadLog("dialpad.enrichment.completed", { job_id: job.id, job_type: job.job_type });
    } catch (err) {
      const normalized = toDialpadError(err);
      const attemptCount = (claimed.attempt_count ?? 0) + 1;
      const permanent =
        attemptCount >= ENRICHMENT_MAX_ATTEMPTS ||
        ["invalid_credentials", "forbidden", "invalid_request"].includes(normalized.code);
      // "not ready yet" outcomes retry on the schedule; hard failures stop.
      await supabase
        .from("dialpad_enrichment_jobs")
        .update({
          status: permanent ? "failed" : "pending",
          attempt_count: attemptCount,
          run_after: new Date(Date.now() + enrichmentDelaySec(attemptCount) * 1000).toISOString(),
          locked_at: null,
          last_error: `${normalized.code}: ${normalized.userMessage}`.slice(0, 500),
          updated_at: new Date().toISOString(),
        })
        .eq("id", job.id);
      if (permanent) {
        report.failed += 1;
        dialpadLog("dialpad.enrichment.failed", { job_id: job.id, job_type: job.job_type, code: normalized.code }, "error");
      } else {
        report.retried += 1;
      }
      report.details.push({ jobId: job.id, jobType: job.job_type, result: permanent ? "failed" : "retried" });
    }
  }
  return report;
}

async function executeEnrichmentJob(job: {
  id: string;
  call_session_id: string;
  provider_call_id: string | null;
  job_type: string;
}) {
  const config = getDialpadConfig();
  const session = await db.callSession.findUnique({ where: { id: job.call_session_id } });
  if (!session) throw new DialpadError("invalid_request", "Call session no longer exists.");
  const providerCallId = job.provider_call_id ?? session.providerCallId;
  if (!providerCallId) throw new DialpadError("invalid_request", "Call session has no provider call id.");

  if (config.mode === "mock") {
    await executeMockEnrichment(session, providerCallId, job.job_type);
    return;
  }

  if (job.job_type === "call_details") {
    const details = await dialpadClient.getCall(providerCallId);
    await applyCallDetails(session, details);
  } else if (job.job_type === "transcript") {
    let transcript;
    try {
      transcript = await dialpadClient.getTranscript(providerCallId);
    } catch (err) {
      const normalized = toDialpadError(err);
      if (normalized.code === "not_found") {
        // Transcript not generated yet — retry on schedule.
        throw new DialpadError("transcript_not_ready", "Transcript is not ready yet.", { cause: err });
      }
      throw normalized;
    }
    await saveTranscript(session.id, providerCallId, transcript.lines ?? []);
  } else if (job.job_type === "recording") {
    const details = await dialpadClient.getCall(providerCallId);
    await upsertRecordingsFromDetails(session.id, providerCallId, details as ValidatedDialpadCallEvent);
    if (!details.was_recorded) {
      await db.callSession.update({
        where: { id: session.id },
        data: { recordingStatus: "audio_unavailable" },
      }).catch(() => undefined);
    }
  }
}

async function executeMockEnrichment(
  session: { id: string; startedAt: Date | string; externalNumber?: string | null },
  providerCallId: string,
  jobType: string,
) {
  const startedAtMs = new Date(session.startedAt).getTime();
  const progress = computeMockProgress(startedAtMs, session.externalNumber ?? "+15555550100");
  const details = buildMockCallDetails({
    providerCallId,
    externalNumber: session.externalNumber ?? "+15555550100",
    internalNumber: "+15550001000",
    customData: null,
    startedAtMs,
  });

  if (jobType === "call_details") {
    await applyCallDetails(session as never, details);
  } else if (jobType === "transcript") {
    if (!progress.transcriptReady) {
      throw new DialpadError("transcript_not_ready", "Transcript is not ready yet (mock delay).");
    }
    const transcript = buildMockTranscript(providerCallId, progress.connectedAtMs ?? startedAtMs);
    await saveTranscript(session.id, providerCallId, transcript.lines ?? []);
  } else if (jobType === "recording") {
    if (!progress.recordingReady) {
      throw new DialpadError("recording_unavailable", "Recording is not ready yet (mock delay).");
    }
    await upsertRecordingsFromDetails(session.id, providerCallId, details as ValidatedDialpadCallEvent);
  }
}

async function applyCallDetails(session: { id: string }, details: DialpadCall) {
  const update: Record<string, unknown> = {
    providerMetadata: {
      state: details.state ?? null,
      mos_score: details.mos_score ?? null,
      labels: details.labels ?? [],
      recap_summary: details.recap_summary ?? null,
      recap_outcome: details.recap_outcome ?? null,
      is_transferred: details.is_transferred ?? false,
      total_duration_ms: details.total_duration ?? null,
    },
  };
  if (details.date_connected) update.connectedAt = msToIso(details.date_connected);
  if (details.date_ended) update.endedAt = msToIso(details.date_ended);
  if (details.duration != null) {
    update.durationMs = Math.round(details.duration);
    update.durationSec = Math.round(details.duration / 1000);
  }
  if (details.internal_number) update.internalNumber = details.internal_number;
  if (details.was_recorded) update.recordingAvailable = true;
  await db.callSession.update({ where: { id: session.id }, data: update });
}

async function saveTranscript(
  callSessionId: string,
  providerCallId: string,
  lines: NonNullable<Parameters<typeof normalizeTranscriptLines>[0]>,
) {
  const supabase = getSupabaseAdmin();
  const segments = normalizeTranscriptLines(lines);
  if (segments.length === 0) {
    await db.callSession.update({
      where: { id: callSessionId },
      data: { transcriptStatus: "unavailable" },
    });
    return;
  }
  // Replace-then-insert keeps re-runs idempotent for provider transcripts.
  await supabase
    .from("call_transcript_segments")
    .delete()
    .eq("call_session_id", callSessionId)
    .eq("provider", PROVIDER);
  const { error } = await supabase.from("call_transcript_segments").insert(
    segments.map((segment) => ({
      call_session_id: callSessionId,
      provider_call_id: providerCallId,
      sequence_num: segment.sequenceNum,
      speaker: segment.speakerLabel,
      speaker_role: segment.speakerRole,
      segment_type: segment.segmentType,
      text: segment.text,
      is_final: true,
      provider: PROVIDER,
      started_at: segment.startedAt,
      metadata: segment.providerMetadata,
    })),
  );
  if (error) throw new Error(`Failed to save transcript segments: ${error.message}`);
  await db.callSession.update({
    where: { id: callSessionId },
    data: { transcriptStatus: "stored", transcriptQuality: "provider" },
  });
  dialpadLog("dialpad.transcript.saved", { call_session_id: callSessionId, segments: segments.length });
}

async function upsertRecordingsFromDetails(
  callSessionId: string,
  providerCallId: string | null,
  payload: Pick<ValidatedDialpadCallEvent, "recording_details">,
) {
  const details = payload.recording_details ?? [];
  if (!details.length) return;
  const supabase = getSupabaseAdmin();
  const session = await db.callSession.findUnique({ where: { id: callSessionId } });
  for (const rec of details) {
    if (rec.id == null) continue;
    const row = {
      call_session_id: callSessionId,
      clinic_id: session?.clinicId ?? "unknown",
      admin_id: session?.adminId ?? null,
      provider: PROVIDER,
      provider_call_id: providerCallId,
      recording_provider_id: String(rec.id),
      provider_url: rec.url ?? null,
      recording_type: rec.recording_type ?? "callrecording",
      duration_ms: rec.duration ?? null,
      recording_status: "uploaded",
      consent_status: "provider_managed",
      available_at: msToIso(rec.start_time) ?? new Date().toISOString(),
      storage_path: null,
      file_type: "audio/mpeg",
      updated_at: new Date().toISOString(),
    };
    const { error } = await supabase
      .from("call_recordings")
      .upsert(row, { onConflict: "call_session_id,recording_provider_id" });
    if (error) {
      dialpadLog("dialpad.enrichment.failed", { call_session_id: callSessionId, step: "recording_upsert", error: error.message }, "warn");
    }
  }
  await db.callSession.update({
    where: { id: callSessionId },
    data: { recordingAvailable: true },
  }).catch(() => undefined);
}

// ---------------------------------------------------------------------------
// Reconciliation
// ---------------------------------------------------------------------------

export interface ReconcileReport {
  scanned: number;
  matchedExisting: number;
  repaired: number;
  inserted: number;
  skipped: number;
  errors: string[];
}

/**
 * Repairs missed webhooks by listing recently concluded Dialpad calls and
 * comparing them with local sessions. Requires a company-admin API key with
 * the `calls:list` scope; degrades gracefully when unavailable.
 */
export async function reconcileRecentCalls(lookbackMinutes = 120): Promise<ReconcileReport> {
  const config = getDialpadConfig();
  const report: ReconcileReport = { scanned: 0, matchedExisting: 0, repaired: 0, inserted: 0, skipped: 0, errors: [] };
  if (config.mode !== "live") {
    report.errors.push(`Reconciliation runs only in live mode (current: ${config.mode}).`);
    return report;
  }
  dialpadLog("dialpad.reconcile.started", { lookback_minutes: lookbackMinutes });

  let collection;
  try {
    collection = await dialpadClient.listCalls({
      startedAfterMs: Date.now() - lookbackMinutes * 60 * 1000,
      targetId: config.userId ? Number(config.userId) : undefined,
      targetType: config.userId ? "user" : undefined,
    });
  } catch (err) {
    const normalized = toDialpadError(err);
    report.errors.push(`Dialpad call list unavailable: ${normalized.userMessage}`);
    dialpadLog("dialpad.reconcile.failed", { code: normalized.code }, "warn");
    return report;
  }

  for (const call of collection.items ?? []) {
    report.scanned += 1;
    const providerCallId = call.call_id != null ? String(call.call_id) : null;
    if (!providerCallId) {
      report.skipped += 1;
      continue;
    }
    try {
      const existing = await matchSession(call as ValidatedDialpadCallEvent, providerCallId);
      if (existing) {
        report.matchedExisting += 1;
        const isIncomplete =
          !isTerminalStatus((existing.status ?? "unknown") as NormalizedCallStatus) || !existing.endedAt;
        if (isIncomplete && call.date_ended) {
          await processDialpadEvent(
            { ...(call as ValidatedDialpadCallEvent), state: call.state ?? "hangup" },
            { knownSessionId: existing.id },
          );
          report.repaired += 1;
        }
        continue;
      }
      // Only insert calls we can positively attribute to Novalyte via
      // custom_data. Phone number alone is never used as primary identity.
      const custom = parseCustomData(call.custom_data);
      if (!custom) {
        report.skipped += 1;
        continue;
      }
      const clinic = await db.clinic.findUnique({ where: { id: custom.clinic_id } });
      if (!clinic) {
        report.skipped += 1;
        continue;
      }
      const created = await db.callSession.create({
        data: {
          id: custom.call_session_id,
          clinicId: custom.clinic_id,
          contactId: custom.contact_id,
          adminId: custom.operator_user_id,
          startedAt: msToIso(call.date_started) ?? new Date().toISOString(),
          provider: PROVIDER,
          providerCallId,
          direction: call.direction ?? "outbound",
          status: "initiating",
          outcome: "not_started",
          externalNumber: call.external_number ?? null,
          callEnvironment: "live",
          providerCustomData: custom,
          metadata: JSON.stringify({ recovered_by: "reconciliation" }),
        },
      });
      await processDialpadEvent(call as ValidatedDialpadCallEvent, { knownSessionId: created.id });
      report.inserted += 1;
    } catch (err) {
      report.errors.push(`call ${providerCallId}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  dialpadLog("dialpad.reconcile.completed", {
    scanned: report.scanned,
    repaired: report.repaired,
    inserted: report.inserted,
  });
  return report;
}

// ---------------------------------------------------------------------------
// Diagnostics
// ---------------------------------------------------------------------------

export interface DialpadIntegrationStatus {
  enabled: boolean;
  mode: string;
  configured: boolean;
  configErrors: string[];
  apiConnection: "ok" | "failed" | "not_applicable" | "unchecked";
  apiConnectionError?: string;
  dialpadUserConfigured: boolean;
  dialpadUserDisplayName?: string;
  outboundCallerId?: string;
  webhookSecretConfigured: boolean;
  ctiEnabled: boolean;
  ctiProvisioned: boolean;
  lastWebhookAt: string | null;
  lastProviderError: string | null;
  pendingEnrichmentJobs: number;
}

export async function getIntegrationStatus(options: { checkConnection?: boolean } = {}): Promise<DialpadIntegrationStatus> {
  const config = getDialpadConfig();
  const supabase = getSupabaseAdmin();

  let lastWebhookAt: string | null = null;
  let lastProviderError: string | null = null;
  let pendingEnrichmentJobs = 0;
  try {
    const { data: lastEvent } = await supabase
      .from("call_events")
      .select("received_at")
      .eq("provider", PROVIDER)
      .order("received_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    lastWebhookAt = lastEvent?.received_at ?? null;

    const { data: lastFailure } = await supabase
      .from("dialpad_enrichment_jobs")
      .select("last_error, updated_at")
      .not("last_error", "is", null)
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    lastProviderError = lastFailure?.last_error ?? null;

    const { count } = await supabase
      .from("dialpad_enrichment_jobs")
      .select("*", { count: "exact", head: true })
      .eq("status", "pending");
    pendingEnrichmentJobs = count ?? 0;
  } catch {
    // Diagnostics never take the page down; tables may not exist pre-migration.
  }

  let apiConnection: DialpadIntegrationStatus["apiConnection"] = "unchecked";
  let apiConnectionError: string | undefined;
  let dialpadUserDisplayName: string | undefined;
  if (config.mode === "live" && options.checkConnection && config.apiKey) {
    const test = await dialpadClient.testConnection();
    apiConnection = test.ok ? "ok" : "failed";
    apiConnectionError = test.error;
    dialpadUserDisplayName = test.dialpadUser?.displayName;
  } else if (config.mode === "mock") {
    apiConnection = "not_applicable";
  }

  return {
    enabled: config.enabled,
    mode: config.mode,
    configured: config.configErrors.length === 0,
    configErrors: config.configErrors,
    apiConnection,
    apiConnectionError,
    dialpadUserConfigured: Boolean(config.userId),
    dialpadUserDisplayName,
    outboundCallerId: config.outboundCallerId,
    webhookSecretConfigured: Boolean(config.webhookSecret),
    ctiEnabled: config.ctiEnabled,
    ctiProvisioned: Boolean(config.ctiClientId),
    lastWebhookAt,
    lastProviderError,
    pendingEnrichmentJobs,
  };
}
