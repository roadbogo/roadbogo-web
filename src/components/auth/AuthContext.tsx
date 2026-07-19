"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import type { AppPermission, AppRole } from "@/components/navigation/navigationConfig";
import type { AuthUser, UserRole } from "@/types/auth";
import { clearClientAuth } from "@/lib/auth/authStorage";
import { isAbortError, refreshAccessToken, resetAuthSession } from "@/lib/apiClient";
import { authApi, toAuthUser } from "@/lib/authApi";
import { mapApiPermissionsToUiPermissions, mapApiRolesToUiAccess, normalizeApiRoles } from "@/lib/auth/accessMapping";
import { getPrimaryRole } from "@/lib/auth/roleRedirect";

export interface AuthenticatedUser { publicId?: string; name: string; role: UserRole; roles: UserRole[]; email: string; phone?: string; accountStatus?: string; organization?: AuthUser["organization"]; lastLoginAt?: string | null; updatedAt?: string; apiPermissions: string[]; uiRoles: AppRole[]; uiPermissions: AppPermission[]; }
interface AuthValue { user: AuthenticatedUser | null; ready: boolean; clearAuth: () => void; updateUser: (user: AuthenticatedUser) => void; setAuthenticatedUser: (user: AuthUser) => void; }

function toAuthenticatedUser(user:AuthUser):AuthenticatedUser{
  const roles=normalizeApiRoles(user.roles);
  const roleAccess=mapApiRolesToUiAccess(roles);
  const permissionAccess=mapApiPermissionsToUiPermissions(user.permissions);
  return{publicId:user.publicId,name:user.userName,role:getPrimaryRole(roles),roles,email:user.email,phone:user.phone,accountStatus:user.accountStatus,organization:user.organization,lastLoginAt:user.lastLoginAt,updatedAt:user.updatedAt,apiPermissions:[...user.permissions],uiRoles:roleAccess.uiRoles,uiPermissions:[...new Set([...roleAccess.uiPermissions,...permissionAccess])]};
}
const AuthContext = createContext<AuthValue | null>(null);

export function handleAuthRestoreError(error: unknown, active: boolean, clearUser: () => void) {
  if (!active || isAbortError(error)) return;
  resetAuthSession();
  clearUser();
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthenticatedUser | null>(null);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    let active=true;
    const restore=async()=>{try{clearClientAuth();await refreshAccessToken();const apiUser=await authApi.me(false);const restored=toAuthUser(apiUser);if(active)setUser(toAuthenticatedUser(restored))}catch(error){handleAuthRestoreError(error,active,()=>setUser(null))}finally{if(active)setReady(true)}};
    void restore();
    const expire=()=>{setUser(null);setReady(true)};window.addEventListener("roadbogo:auth-expired",expire);return()=>{active=false;window.removeEventListener("roadbogo:auth-expired",expire)};
  }, []);
  const value = useMemo<AuthValue>(() => ({
    user, ready,
    clearAuth: () => { clearClientAuth(); setUser(null); },
    updateUser: (next) => setUser(next),
    setAuthenticatedUser: (next) => setUser(toAuthenticatedUser(next)),
  }), [user, ready]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error("useAuth must be used inside AuthProvider");
  return value;
}
