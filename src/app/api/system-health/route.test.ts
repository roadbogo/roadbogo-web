import { describe, expect, it } from "vitest";
import { isHealthyResponse } from "./route";

describe("system health response", () => {
  it("accepts the current API envelope", () => {
    expect(isHealthyResponse({ success: true, data: { status: "UP" } })).toBe(true);
  });

  it("keeps the legacy response compatible and rejects unhealthy data", () => {
    expect(isHealthyResponse({ status: "ok" })).toBe(true);
    expect(isHealthyResponse({ success: true, data: { status: "DOWN" } })).toBe(false);
  });
});
