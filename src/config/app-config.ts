/**
 * Novalyte Admin — Application Configuration
 *
 * Central configuration that controls data mode and feature flags.
 * When mockMode is true, the app loads structured mock data through
 * the repository layer. When false, repositories will call real
 * backend services (Supabase / APIs) — to be wired by Codex.
 */
export const appConfig = {
  /** When true, all repositories return mock data. Switch to false once backend services are connected. */
  mockMode: true,

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
    callConsoleLiveAudio: false, // Release 2: live telephony
    aiCallCopilot: false,        // Release 2: realtime AI
    liveTranscripts: false,      // Release 2
  },

  /** Whether the login screen is active. When false, the first active admin is auto-loaded. */
  authEnabled: false,
} as const;

export type AppConfig = typeof appConfig;
