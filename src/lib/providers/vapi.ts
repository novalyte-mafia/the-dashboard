import "server-only";

const VAPI_URL = "https://api.vapi.ai";

function getVapiKey() {
  const key = process.env.VAPI_API_KEY?.trim();
  if (!key) throw new Error("VAPI_API_KEY is not configured.");
  return key;
}

export async function createVapiOutboundCall(input: { phoneNumber: string; assistantId: string; phoneNumberId: string; clinicName: string; clinicId: string }) {
  const response = await fetch(`${VAPI_URL}/call`, {
    method: "POST",
    headers: { Authorization: `Bearer ${getVapiKey()}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      assistantId: input.assistantId,
      phoneNumberId: input.phoneNumberId,
      customer: { number: input.phoneNumber },
      assistantOverrides: {
        variableValues: { clinicId: input.clinicId, clinicName: input.clinicName },
      },
    }),
    signal: AbortSignal.timeout(20000),
    cache: "no-store",
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(`Vapi rejected the call request (${response.status}).`);
  return payload;
}

export async function getVapiCall(callId: string) {
  const response = await fetch(`${VAPI_URL}/call/${encodeURIComponent(callId)}`, {
    headers: { Authorization: `Bearer ${getVapiKey()}` },
    signal: AbortSignal.timeout(15000),
    cache: "no-store",
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(`Vapi status request failed (${response.status}).`);
  return payload;
}
