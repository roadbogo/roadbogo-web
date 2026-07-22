import { describe, expect, it } from "vitest";
import { MockAccountWithdrawalAdapter } from "./accountWithdrawal";

describe("MockAccountWithdrawalAdapter", () => {
  it("supports success and planned failure codes", async () => {
    const adapter = new MockAccountWithdrawalAdapter(["GENERAL_USER"], 0);
    await expect(adapter.withdraw("valid-test-value")).resolves.toBeNull();
    await expect(adapter.withdraw("mock-invalid-password")).rejects.toMatchObject({ code: "AUTH_CURRENT_PASSWORD_INVALID" });
    await expect(adapter.withdraw("mock-session-expired")).rejects.toMatchObject({ code: "AUTH_SESSION_INVALID" });
    await expect(adapter.withdraw("mock-account-unavailable")).rejects.toMatchObject({ code: "AUTH_ACCOUNT_UNAVAILABLE" });
    await expect(adapter.withdraw("mock-access-expired")).rejects.toMatchObject({ code: "AUTH_ACCESS_TOKEN_EXPIRED" });
    await expect(adapter.withdraw("mock-validation-error")).rejects.toMatchObject({ code: "COMMON_VALIDATION_ERROR" });
    await expect(adapter.withdraw("mock-server-error")).rejects.toMatchObject({ code: "COMMON_INTERNAL_SERVER_ERROR" });
  });
  it("rejects non-general and mixed-role accounts", async () => {
    await expect(new MockAccountWithdrawalAdapter(["CONTROLLER"], 0).withdraw("value")).rejects.toMatchObject({ code: "AUTH_WITHDRAWAL_NOT_ALLOWED" });
    await expect(new MockAccountWithdrawalAdapter(["GENERAL_USER", "CONTROLLER"], 0).withdraw("value")).rejects.toMatchObject({ code: "AUTH_WITHDRAWAL_NOT_ALLOWED" });
  });
});
