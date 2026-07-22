import type { UserRole } from "@/types/auth";
import { authApi } from "@/lib/authApi";
import { ApiError } from "@/lib/apiClient";

export interface AccountWithdrawalAdapter {
  withdraw(currentPassword: string): Promise<null>;
}

export class ApiAccountWithdrawalAdapter implements AccountWithdrawalAdapter {
  withdraw(currentPassword: string) {
    return authApi.withdrawMe(currentPassword);
  }
}

export class MockAccountWithdrawalAdapter implements AccountWithdrawalAdapter {
  constructor(private readonly roles: UserRole[], private readonly delayMs = 250) {}

  async withdraw(currentPassword: string) {
    await new Promise(resolve => setTimeout(resolve, this.delayMs));
    if (this.roles.length !== 1 || this.roles[0] !== "GENERAL_USER") throw new ApiError("AUTH_WITHDRAWAL_NOT_ALLOWED", "Withdrawal is not allowed.", null, "mock-trace", 403);
    if (!currentPassword) throw new ApiError("COMMON_VALIDATION_ERROR", "Validation failed.", { current_password: "required" }, "mock-trace", 400);
    if (currentPassword === "mock-invalid-password") throw new ApiError("AUTH_CURRENT_PASSWORD_INVALID", "Current password is invalid.", null, "mock-trace", 401);
    if (currentPassword === "mock-session-expired") throw new ApiError("AUTH_SESSION_INVALID", "Session is invalid.", null, "mock-trace", 401);
    if (currentPassword === "mock-account-unavailable") throw new ApiError("AUTH_ACCOUNT_UNAVAILABLE", "Account is unavailable.", null, "mock-trace", 401);
    if (currentPassword === "mock-access-expired") throw new ApiError("AUTH_ACCESS_TOKEN_EXPIRED", "Access token expired.", null, "mock-trace", 401);
    if (currentPassword === "mock-validation-error") throw new ApiError("COMMON_VALIDATION_ERROR", "Validation failed.", { current_password: "invalid" }, "mock-trace", 400);
    if (currentPassword === "mock-server-error") throw new ApiError("COMMON_INTERNAL_SERVER_ERROR", "Server error.", null, "mock-trace", 500);
    return null;
  }
}

export function createAccountWithdrawalAdapter(roles: UserRole[]): AccountWithdrawalAdapter {
  return process.env.NODE_ENV === "development" && process.env.NEXT_PUBLIC_USE_MOCK === "true"
    ? new MockAccountWithdrawalAdapter(roles)
    : new ApiAccountWithdrawalAdapter();
}
