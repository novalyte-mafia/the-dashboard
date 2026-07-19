import "server-only";
import { z } from "zod";

/**
 * Dialpad integration configuration.
 *
 * Modes:
 * - disabled: all Dialpad features hidden/inert.
 * - mock:     local development + automated tests. Never contacts Dialpad,
 *             never dials real numbers.
 * - live:     real Dialpad API. Fails closed when credentials are missing.
 *
 * Mode is NEVER inferred from NODE_ENV.
 */

const modeSchema = z.enum(["disabled", "mock", "live"]);
const boolString = z
  .string()
  .optional()
  .transform((v) => v?.trim().toLowerCase() === "true");

const envSchema = z.object({
  DIALPAD_MODE: z
    .string()
    .optional()
    .transform((v) => (v?.trim() || "disabled").toLowerCase())
    .pipe(modeSchema),
  DIALPAD_INTEGRATION_ENABLED: boolString,
  DIALPAD_API_BASE_URL: z
    .string()
    .optional()
    .transform((v) => (v?.trim() || "https://dialpad.com/api/v2").replace(/\/+$/, "")),
  DIALPAD_API_KEY: z.string().optional().transform((v) => v?.trim() || undefined),
  DIALPAD_USER_ID: z.string().optional().transform((v) => v?.trim() || undefined),
  DIALPAD_OUTBOUND_CALLER_ID: z.string().optional().transform((v) => v?.trim() || undefined),
  DIALPAD_WEBHOOK_SECRET: z.string().optional().transform((v) => v?.trim() || undefined),
  DIALPAD_CTI_ENABLED: boolString,
  DIALPAD_CTI_CLIENT_ID: z.string().optional().transform((v) => v?.trim() || undefined),
  NEXT_PUBLIC_APP_URL: z.string().optional().transform((v) => v?.trim() || undefined),
  CRON_SECRET: z.string().optional().transform((v) => v?.trim() || undefined),
});

export type DialpadMode = z.infer<typeof modeSchema>;

export interface DialpadConfig {
  mode: DialpadMode;
  /** True when the integration should be active (enabled flag + mode != disabled). */
  enabled: boolean;
  apiBaseUrl: string;
  apiKey?: string;
  userId?: string;
  outboundCallerId?: string;
  webhookSecret?: string;
  ctiEnabled: boolean;
  ctiClientId?: string;
  appUrl?: string;
  cronSecret?: string;
  /** Non-empty when live mode is selected but required credentials are missing. */
  configErrors: string[];
}

let cached: DialpadConfig | undefined;

export function getDialpadConfig(): DialpadConfig {
  if (cached) return cached;

  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    // Environment values are all optional strings; this only fires on an
    // invalid DIALPAD_MODE value. Fail closed to disabled.
    cached = {
      mode: "disabled",
      enabled: false,
      apiBaseUrl: "https://dialpad.com/api/v2",
      ctiEnabled: false,
      configErrors: [`Invalid DIALPAD_MODE value; expected disabled|mock|live.`],
    };
    return cached;
  }

  const env = parsed.data;
  const enabled = env.DIALPAD_INTEGRATION_ENABLED && env.DIALPAD_MODE !== "disabled";

  const configErrors: string[] = [];
  if (enabled && env.DIALPAD_MODE === "live") {
    if (!env.DIALPAD_API_KEY) configErrors.push("DIALPAD_API_KEY is not configured.");
    if (!env.DIALPAD_USER_ID) configErrors.push("DIALPAD_USER_ID is not configured.");
    if (!env.DIALPAD_WEBHOOK_SECRET) configErrors.push("DIALPAD_WEBHOOK_SECRET is not configured.");
  }

  cached = {
    mode: enabled ? env.DIALPAD_MODE : "disabled",
    enabled,
    apiBaseUrl: env.DIALPAD_API_BASE_URL,
    apiKey: env.DIALPAD_API_KEY,
    userId: env.DIALPAD_USER_ID,
    outboundCallerId: env.DIALPAD_OUTBOUND_CALLER_ID,
    webhookSecret: env.DIALPAD_WEBHOOK_SECRET,
    ctiEnabled: env.DIALPAD_CTI_ENABLED && Boolean(env.DIALPAD_CTI_CLIENT_ID),
    ctiClientId: env.DIALPAD_CTI_CLIENT_ID,
    appUrl: env.NEXT_PUBLIC_APP_URL,
    cronSecret: env.CRON_SECRET,
    configErrors,
  };
  return cached;
}

/** Test-only helper: clears the memoized config so env changes take effect. */
export function __resetDialpadConfigForTests() {
  cached = undefined;
}

/** Validates the parsing logic against an arbitrary env object (unit tests). */
export function parseDialpadEnv(env: Record<string, string | undefined>) {
  return envSchema.safeParse(env);
}
