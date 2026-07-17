import { apiRequest, beginLoginAttempt, completeLogin, logoutWithRefreshRetry, refreshAccessToken } from "@/lib/apiClient";
import type { AuthUser, UserRole } from "@/types/auth";

export type ApiOrganization = { public_id: string; organization_name: string; organization_type: string };
export type ApiUser = {
  public_id: string;
  email: string;
  user_name: string;
  phone: string | null;
  account_status: string;
  organization: ApiOrganization | null;
  roles: UserRole[];
  permissions: string[];
  last_login_at: string | null;
  updated_at: string;
};
export type LoginResponse = { access_token: string; token_type: "Bearer"; expires_in: number; user: ApiUser };

export type UserResponse = { user: ApiUser };
export type PasswordResetRequestResponse = { accepted: boolean; debug_reset_url?: string };

export function toAuthUser(user: ApiUser): AuthUser {
  return {
    publicId: user.public_id,
    email: user.email,
    userName: user.user_name,
    phone: user.phone ?? undefined,
    accountStatus: user.account_status,
    organization: user.organization ? { publicId: user.organization.public_id, name: user.organization.organization_name, type: user.organization.organization_type } : null,
    roles: user.roles,
    permissions: user.permissions,
    lastLoginAt: user.last_login_at ?? null,
    updatedAt: user.updated_at,
  };
}

export const authApi = {
  login: async (email: string, password: string, rememberMe = false) => {
    const loginEpoch = beginLoginAttempt();
    const result = await apiRequest<LoginResponse>("/auth/login", { method: "POST", auth: false, retryAuth: false, body: { email, password, remember_me: rememberMe } });
    completeLogin(result.access_token, loginEpoch);
    return result;
  },
  logout: () => logoutWithRefreshRetry(),
  refresh: async () => ({ access_token: await refreshAccessToken() }),
  me: async (retryAuth = true) => (await apiRequest<UserResponse>("/auth/me", { retryAuth })).user,
  updateMe: async (body: { user_name?: string; phone?: string | null }) => (await apiRequest<UserResponse>("/auth/me", { method: "PATCH", body })).user,
  requestPasswordReset: (email: string) => apiRequest<PasswordResetRequestResponse>("/auth/password-reset/request", { method: "POST", auth: false, retryAuth: false, body: { email } }),
  confirmPasswordReset: (token: string, newPassword: string, confirmation: string) => apiRequest<null>("/auth/password-reset/confirm", { method: "POST", auth: false, retryAuth: false, body: { token, new_password: newPassword, new_password_confirmation: confirmation } }),
};
