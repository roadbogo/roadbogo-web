import { apiRequest } from "@/lib/apiClient";
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
};
export type LoginResponse = { access_token: string; token_type: "Bearer"; user: ApiUser };

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
    lastLoginAt: user.last_login_at,
  };
}

export const authApi = {
  login: (email: string, password: string, rememberMe = false) => apiRequest<LoginResponse>("/auth/login", { method: "POST", auth: false, retryAuth: false, body: { email, password, remember_me: rememberMe } }),
  logout: () => apiRequest<null>("/auth/logout", { method: "POST", retryAuth: false }),
  refresh: () => apiRequest<{ access_token: string }>("/auth/refresh", { method: "POST", auth: false, retryAuth: false }),
  me: async () => (await apiRequest<UserResponse>("/auth/me")).user,
  updateMe: async (body: { user_name?: string; phone?: string | null }) => (await apiRequest<UserResponse>("/auth/me", { method: "PATCH", body })).user,
  requestPasswordReset: (email: string) => apiRequest<PasswordResetRequestResponse>("/auth/password-reset/request", { method: "POST", auth: false, retryAuth: false, body: { email } }),
  confirmPasswordReset: (token: string, newPassword: string, confirmation: string) => apiRequest<null>("/auth/password-reset/confirm", { method: "POST", auth: false, retryAuth: false, body: { token, new_password: newPassword, new_password_confirmation: confirmation } }),
};
