import { afterEach, describe, expect, it } from "vitest";
import { __resetDialpadConfigForTests, getDialpadConfig, parseDialpadEnv } from "../env";

const KEYS = [
  "DIALPAD_MODE",
  "DIALPAD_INTEGRATION_ENABLED",
  "DIALPAD_API_BASE_URL",
  "DIALPAD_API_KEY",
  "DIALPAD_USER_ID",
  "DIALPAD_OUTBOUND_CALLER_ID",
  "DIALPAD_WEBHOOK_SECRET",
  "DIALPAD_CTI_ENABLED",
  "DIALPAD_CTI_CLIENT_ID",
];

function withEnv(env: Record<string, string>, fn: () => void) {
  const saved: Record<string, string | undefined> = {};
  for (const key of KEYS) {
    saved[key] = process.env[key];
    delete process.env[key];
  }
  Object.assign(process.env, env);
  __resetDialpadConfigForTests();
  try {
    fn();
  } finally {
    for (const key of KEYS) {
      if (saved[key] === undefined) delete process.env[key];
      else process.env[key] = saved[key];
    }
    __resetDialpadConfigForTests();
  }
}

afterEach(() => __resetDialpadConfigForTests());

describe("dialpad env validation", () => {
  it("defaults to disabled with no env", () => {
    withEnv({}, () => {
      const config = getDialpadConfig();
      expect(config.mode).toBe("disabled");
      expect(config.enabled).toBe(false);
    });
  });

  it("requires the integration flag even if mode is set", () => {
    withEnv({ DIALPAD_MODE: "mock" }, () => {
      expect(getDialpadConfig().enabled).toBe(false);
    });
  });

  it("enables mock mode without credentials", () => {
    withEnv({ DIALPAD_MODE: "mock", DIALPAD_INTEGRATION_ENABLED: "true" }, () => {
      const config = getDialpadConfig();
      expect(config.enabled).toBe(true);
      expect(config.mode).toBe("mock");
      expect(config.configErrors).toEqual([]);
    });
  });

  it("fails closed in live mode when credentials are missing", () => {
    withEnv({ DIALPAD_MODE: "live", DIALPAD_INTEGRATION_ENABLED: "true" }, () => {
      const config = getDialpadConfig();
      expect(config.enabled).toBe(true);
      expect(config.configErrors.length).toBeGreaterThan(0);
      expect(config.configErrors.join(" ")).toContain("DIALPAD_API_KEY");
      expect(config.configErrors.join(" ")).toContain("DIALPAD_WEBHOOK_SECRET");
    });
  });

  it("accepts complete live configuration", () => {
    withEnv(
      {
        DIALPAD_MODE: "live",
        DIALPAD_INTEGRATION_ENABLED: "true",
        DIALPAD_API_KEY: "test-key",
        DIALPAD_USER_ID: "12345",
        DIALPAD_WEBHOOK_SECRET: "test-secret",
      },
      () => {
        const config = getDialpadConfig();
        expect(config.configErrors).toEqual([]);
        expect(config.apiBaseUrl).toBe("https://dialpad.com/api/v2");
      },
    );
  });

  it("rejects an invalid mode value", () => {
    const parsed = parseDialpadEnv({ DIALPAD_MODE: "production" });
    expect(parsed.success).toBe(false);
  });

  it("CTI stays off without a client id", () => {
    withEnv(
      { DIALPAD_MODE: "mock", DIALPAD_INTEGRATION_ENABLED: "true", DIALPAD_CTI_ENABLED: "true" },
      () => {
        expect(getDialpadConfig().ctiEnabled).toBe(false);
      },
    );
  });
});
