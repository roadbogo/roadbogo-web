// @vitest-environment jsdom

import { beforeEach, describe, expect, it } from "vitest";
import { consumeWithdrawalNotice } from "./withdrawalNotice";

describe("consumeWithdrawalNotice", () => {
  beforeEach(() => window.history.replaceState(null, "", "/login?reason=withdrawn"));
  it("consumes the completion reason so refresh does not repeat the notice", () => {
    expect(consumeWithdrawalNotice()).toBe(true);
    expect(window.location.search).toBe("");
    expect(consumeWithdrawalNotice()).toBe(false);
  });
});
