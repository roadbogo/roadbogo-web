import { apiRequest } from "@/lib/apiClient";
import type { AuthUser, UserRole } from "@/types/auth";

export type ApiUser = { public_id: string; email: string; user_name: string; roles: UserRole[]; permissions: string[] };
export type LoginResponse = { access_token: string; token_type: "Bearer"; user: ApiUser };

export function toAuthUser(user: ApiUser): AuthUser {
  return { email: user.email, userName: user.user_name, roles: user.roles };
}

export const authApi = {
  login: (email: string, password: string, rememberMe = false) => apiRequest<LoginResponse>("/auth/login", { method: "POST", auth: false, retryAuth: false, body: { email, password, remember_me: rememberMe } }),
  logout: () => apiRequest<null>("/auth/logout", { method: "POST", retryAuth: false }),
  refresh: () => apiRequest<{ access_token: string }>("/auth/refresh", { method: "POST", auth: false, retryAuth: false }),
  me: () => apiRequest<ApiUser>("/auth/me"),
  updateMe: (body: Record<string, unknown>) => apiRequest<ApiUser>("/auth/me", { method: "PATCH", body }),
};
