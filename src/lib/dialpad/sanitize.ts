/**
 * Shapes a prospect_calls row for UI consumption. Strips provider internals,
 * custom data, and anything URL-bearing (recording URLs are only reachable
 * through the authenticated recording endpoint).
 */
export function sanitizeSession(session: Record<string, unknown>) {
  const s = session as Record<string, unknown> & { providerMetadata?: Record<string, unknown> };
  return {
    id: s.id,
    clinicId: s.clinicId,
    contactId: s.contactId,
    adminId: s.adminId,
    startedAt: s.startedAt,
    ringingAt: s.ringingAt,
    connectedAt: s.connectedAt,
    endedAt: s.endedAt,
    lastEventAt: s.lastEventAt,
    status: s.status,
    previousStatus: s.previousStatus,
    outcome: s.outcome,
    notes: s.notes,
    direction: s.direction,
    durationMs: s.durationMs,
    durationSec: s.durationSec,
    attemptNumber: s.attemptNumber,
    externalNumber: s.externalNumber,
    outboundCallerId: s.outboundCallerId,
    transcriptStatus: s.transcriptStatus,
    recordingAvailable: s.recordingAvailable,
    recordingStatus: s.recordingStatus,
    failureCode: s.failureCode,
    failureMessage: s.failureMessage,
    followUpRequired: s.followUpRequired,
    nextAction: s.nextAction,
    nextActionAt: s.nextActionAt,
    callEnvironment: s.callEnvironment,
    trainingReviewStatus: s.trainingReviewStatus,
    directoryPermissionStatus: s.directoryPermissionStatus,
    providerCallId: s.providerCallId,
    recapSummary:
      s.providerMetadata && typeof s.providerMetadata.recap_summary === "string"
        ? s.providerMetadata.recap_summary
        : null,
    mode: s.providerMetadata && typeof s.providerMetadata.mode === "string" ? s.providerMetadata.mode : null,
  };
}
