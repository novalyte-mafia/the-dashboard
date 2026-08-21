/**
 * Novalyte Admin — Application Configuration
 *
 * Central configuration that controls data mode and feature flags.
 * When mockMode is true, the app loads structured mock data through
 * the repository layer. When false, repositories will call real
 * backend services (Supabase / APIs) — to be wired by Codex.
 */
export type DataMode = "live" | "demo" | "hybrid";

const dataMode = "live" as DataMode;

export const appConfig = {
  /** Production clinic and outreach data only. Demo/hybrid fixtures are not loaded. */
  dataMode,
  mockMode: dataMode === "demo",
  liveClinics: dataMode !== "demo",
  /** Workforce Command Center always reads live Supabase unless demo mode is explicit. */
  liveWorkforce: dataMode !== "demo",
  demoOperations: dataMode !== "live",
  hybridMode: dataMode === "hybrid",

  /** Brand */
  brand: {
    name: "Novalyte Admin",
    product: "Revenue Command Center",
    founder: {
      firstName: "Jamil",
      lastName: "Yakasai",
      initials: "JY",
      email: "founder@novalyte.io",
      role: "Founder",
    },
  },

  /** Calling window defaults (local clinic time) */
  callingHours: { start: 8, end: 20 },

  /** Pagination defaults */
  defaultPageSize: 25,

  /** Feature flags for modules not yet backend-connected */
  features: {
    callConsoleLiveAudio: false, // External dialer is used until a telephony provider is configured.
    aiCallCopilot: false,        // Release 2: realtime AI
    liveTranscripts: false,      // Release 2
  },

  /** Authentication is always required for the private dashboard. */
  authEnabled: true,
} as const;

export type AppConfig = typeof appConfig;
