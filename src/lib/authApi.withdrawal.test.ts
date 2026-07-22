import { beforeEach, describe, expect, it, vi } from "vitest";

const { apiRequest } = vi.hoisted(() => ({ apiRequest: vi.fn() }));
vi.mock("@/lib/apiClient", () => ({ apiRequest, beginLoginAttempt: vi.fn(), completeLogin: vi.fn(), logoutWithRefreshRetry: vi.fn(), refreshAccessToken: vi.fn() }));

import { authApi } from "./authApi";

describe("authApi.withdrawMe", () => {
  beforeEach(() => apiRequest.mockReset().mockResolvedValue(null));
  it("uses the shared API client with only current_password", async () => {
    await authApi.withdrawMe("test-password-value");
    expect(apiRequest).toHaveBeenCalledWith("/auth/me/withdraw", { method: "POST", body: { current_password: "test-password-value" } });
    expect(Object.keys(apiRequest.mock.calls[0][1].body)).toEqual(["current_password"]);
  });
});
