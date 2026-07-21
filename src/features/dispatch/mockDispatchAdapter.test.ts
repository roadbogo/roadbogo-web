import { describe, expect, it } from "vitest";
import { MockDispatchAdapter } from "./mockDispatchAdapter";

describe("MockDispatchAdapter", () => {
  it("keeps the demo flow separate and updates versions", async () => {
    const adapter = new MockDispatchAdapter(); const page = await adapter.list({ activeOnly: false });
    expect(page.items.length).toBeGreaterThan(0);
    const requested = page.items.find((item) => item.status === "REQUESTED")!;
    const result = await adapter.accept(requested.publicId, requested.versionNo, crypto.randomUUID());
    expect(result.ok).toBe(true); if (result.ok) { expect(result.detail.status).toBe("ACCEPTED"); expect(result.detail.versionNo).toBe(requested.versionNo + 1); }
  });
});
