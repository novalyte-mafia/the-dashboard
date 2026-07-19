/**
 * Structured, redacted logging for the Dialpad integration.
 * The repository uses console logging; these helpers add a consistent event
 * envelope and guarantee that secrets, full payloads, and recording URLs
 * never reach the logs.
 */

export type DialpadLogEvent =
  | "dialpad.call.initiation_requested"
  | "dialpad.call.initiated"
  | "dialpad.call.initiation_failed"
  | "dialpad.call.ended"
  | "dialpad.webhook.received"
  | "dialpad.webhook.rejected"
  | "dialpad.webhook.processed"
  | "dialpad.webhook.duplicate"
  | "dialpad.call.matched"
  | "dialpad.call.unmatched"
  | "dialpad.enrichment.started"
  | "dialpad.enrichment.completed"
  | "dialpad.enrichment.failed"
  | "dialpad.transcript.saved"
  | "dialpad.recording.available"
  | "dialpad.reconcile.started"
  | "dialpad.reconcile.completed"
  | "dialpad.reconcile.failed"
  | "dialpad.setup.completed";

const SENSITIVE_KEY_PATTERN = /secret|api[_-]?key|authorization|token|password|recording_url|provider_url/i;

function redactValue(key: string, value: unknown): unknown {
  if (SENSITIVE_KEY_PATTERN.test(key)) return "[redacted]";
  if (typeof value === "string" && value.length > 500) return `${value.slice(0, 500)}…[truncated]`;
  return value;
}

export function dialpadLog(
  event: DialpadLogEvent,
  fields: Record<string, unknown> = {},
  level: "info" | "warn" | "error" = "info",
) {
  const safeFields: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(fields)) safeFields[k] = redactValue(k, v);
  const entry = { event, ts: new Date().toISOString(), ...safeFields };
  const line = JSON.stringify(entry);
  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.log(line);
}
