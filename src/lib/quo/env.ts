import "server-only";

/**
 * Quo (formerly OpenPhone) integration.
 *
 * Quo's public API cannot place outbound calls. Supported paths:
 * - Click-to-call: open Quo desktop/mobile via tel: / openphone:// deep link
 * - Call history sync + webhooks for auto-logging
 * - SMS (future)
 */

export interface QuoConfig {
  enabled: boolean;
  configured: boolean;
  apiKey?: string;
  apiBaseUrl: string;
  phoneNumberId?: string;
  fromNumber?: string;
  webhookSecret?: string;
  appUrl?: string;
  configErrors: string[];
}

export function getQuoConfig(): QuoConfig {
  const apiKey = process.env.QUO_API_KEY?.trim() || undefined;
  const phoneNumberId = process.env.QUO_PHONE_NUMBER_ID?.trim() || undefined;
  const fromNumber = process.env.QUO_FROM_NUMBER?.trim() || undefined;
  const webhookSecret = process.env.QUO_WEBHOOK_SECRET?.trim() || undefined;
  const appUrl = process.env.NEXT_PUBLIC_APP_URL?.trim() || undefined;
  const apiBaseUrl = (process.env.QUO_API_BASE_URL?.trim() || "https://api.quo.com").replace(/\/+$/, "");
  const enabled = (process.env.QUO_INTEGRATION_ENABLED ?? "true").trim().toLowerCase() !== "false";

  const configErrors: string[] = [];
  if (enabled && !apiKey) configErrors.push("QUO_API_KEY missing");

  return {
    enabled,
    configured: enabled && Boolean(apiKey),
    apiKey,
    apiBaseUrl,
    phoneNumberId,
    fromNumber,
    webhookSecret,
    appUrl,
    configErrors,
  };
}
