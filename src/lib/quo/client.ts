import "server-only";
import { getQuoConfig } from "./env";

export class QuoApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly body?: unknown,
  ) {
    super(message);
    this.name = "QuoApiError";
  }
}

export interface QuoPhoneNumber {
  id: string;
  number: string;
  formattedNumber?: string;
  name?: string | null;
  users?: Array<{ id: string; email?: string; firstName?: string; lastName?: string; role?: string }>;
}

export interface QuoCall {
  id: string;
  phoneNumberId?: string;
  direction?: "incoming" | "outgoing";
  status?: string;
  participants?: string[];
  duration?: number | null;
  answeredAt?: string | null;
  completedAt?: string | null;
  createdAt?: string;
  updatedAt?: string;
  [key: string]: unknown;
}

async function quoFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const config = getQuoConfig();
  if (!config.apiKey) throw new QuoApiError("QUO_API_KEY is not configured", 503);

  const res = await fetch(`${config.apiBaseUrl}${path}`, {
    ...init,
    headers: {
      Authorization: config.apiKey,
      Accept: "application/json",
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
    cache: "no-store",
  });

  const text = await res.text();
  let body: unknown = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = text;
  }

  if (!res.ok) {
    const message =
      body && typeof body === "object" && "message" in body && typeof (body as { message: unknown }).message === "string"
        ? (body as { message: string }).message
        : `Quo API ${res.status}`;
    throw new QuoApiError(message, res.status, body);
  }

  return body as T;
}

export async function listQuoPhoneNumbers(): Promise<QuoPhoneNumber[]> {
  const data = await quoFetch<{ data: QuoPhoneNumber[] }>("/v1/phone-numbers");
  return data.data ?? [];
}

export async function listQuoCalls(params: {
  phoneNumberId: string;
  participants: string[];
  maxResults?: number;
  createdAfter?: string;
}): Promise<QuoCall[]> {
  const qs = new URLSearchParams();
  qs.set("phoneNumberId", params.phoneNumberId);
  for (const p of params.participants) qs.append("participants[]", p);
  if (params.maxResults) qs.set("maxResults", String(params.maxResults));
  if (params.createdAfter) qs.set("createdAfter", params.createdAfter);
  const data = await quoFetch<{ data: QuoCall[] }>(`/v1/calls?${qs.toString()}`);
  return data.data ?? [];
}

export async function getQuoCall(callId: string): Promise<QuoCall> {
  const data = await quoFetch<{ data: QuoCall }>(`/v1/calls/${encodeURIComponent(callId)}`);
  return data.data;
}

export interface QuoCallSummary {
  callId: string;
  status: string;
  summary: string[] | null;
  nextSteps: string[] | null;
  jobs?: unknown;
}

export interface QuoTranscriptDialogue {
  content: string;
  start: number;
  end: number;
  identifier?: string | null;
  userId?: string | null;
}

export interface QuoCallTranscript {
  callId: string;
  status: string;
  duration?: number;
  createdAt?: string;
  dialogue: QuoTranscriptDialogue[] | null;
}

export interface QuoCallRecording {
  id: string;
  duration: number | null;
  startTime: string | null;
  status: string | null;
  type: string | null;
  url: string | null;
}

export async function getQuoCallSummary(callId: string): Promise<QuoCallSummary | null> {
  try {
    const data = await quoFetch<{ data: QuoCallSummary }>(
      `/v1/call-summaries/${encodeURIComponent(callId)}`,
    );
    return data.data;
  } catch (err) {
    if (err instanceof QuoApiError && (err.status === 404 || err.status === 403)) return null;
    throw err;
  }
}

export async function getQuoCallTranscript(callId: string): Promise<QuoCallTranscript | null> {
  try {
    const data = await quoFetch<{ data: QuoCallTranscript }>(
      `/v1/call-transcripts/${encodeURIComponent(callId)}`,
    );
    return data.data;
  } catch (err) {
    if (err instanceof QuoApiError && (err.status === 404 || err.status === 403)) return null;
    throw err;
  }
}

export async function getQuoCallRecordings(callId: string): Promise<QuoCallRecording[]> {
  try {
    const data = await quoFetch<{ data: QuoCallRecording[] }>(
      `/v1/call-recordings/${encodeURIComponent(callId)}`,
    );
    return data.data ?? [];
  } catch (err) {
    if (err instanceof QuoApiError && (err.status === 404 || err.status === 403)) return [];
    throw err;
  }
}

export async function createQuoCallWebhook(input: {
  url: string;
  events: Array<"call.completed" | "call.ringing" | "call.recording.completed">;
  resourceIds?: string[] | ["*"];
  label?: string;
}): Promise<{ id: string; key?: string; url: string }> {
  const data = await quoFetch<{ data: { id: string; key?: string; url: string } }>("/v1/webhooks/calls", {
    method: "POST",
    body: JSON.stringify({
      url: input.url,
      events: input.events,
      resourceIds: input.resourceIds ?? ["*"],
      label: input.label ?? "Novalyte dashboard",
      status: "enabled",
    }),
  });
  return data.data;
}

/** Resolve workspace number id + E.164 from env or live API. */
export async function resolveQuoCaller(): Promise<{
  phoneNumberId: string | null;
  fromNumber: string | null;
  name: string | null;
}> {
  const config = getQuoConfig();
  if (config.phoneNumberId && config.fromNumber) {
    return { phoneNumberId: config.phoneNumberId, fromNumber: config.fromNumber, name: null };
  }

  const numbers = await listQuoPhoneNumbers();
  const preferred =
    (config.phoneNumberId && numbers.find((n) => n.id === config.phoneNumberId)) ||
    (config.fromNumber && numbers.find((n) => n.number === config.fromNumber)) ||
    numbers[0] ||
    null;

  return {
    phoneNumberId: preferred?.id ?? config.phoneNumberId ?? null,
    fromNumber: preferred?.number ?? config.fromNumber ?? null,
    name: preferred?.name ?? null,
  };
}
