import { describe, expect, it } from "vitest";
import { enrichmentDelaySec } from "../service";

describe("enrichment retry schedule", () => {
  it("follows the documented schedule then backs off exponentially with a cap", () => {
    expect(enrichmentDelaySec(0)).toBe(10);
    expect(enrichmentDelaySec(1)).toBe(30);
    expect(enrichmentDelaySec(2)).toBe(90);
    expect(enrichmentDelaySec(3)).toBe(180);
    expect(enrichmentDelaySec(4)).toBe(300);
    expect(enrichmentDelaySec(5)).toBe(600);
    expect(enrichmentDelaySec(6)).toBe(1200);
    expect(enrichmentDelaySec(7)).toBe(2400);
    expect(enrichmentDelaySec(8)).toBe(3600);
    expect(enrichmentDelaySec(20)).toBe(3600); // capped
  });
});
