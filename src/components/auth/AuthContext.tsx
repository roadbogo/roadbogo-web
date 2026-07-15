"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import type { AppPermission, AppRole } from "@/components/navigation/navigationConfig";
import type { AuthUser, UserRole } from "@/types/auth";
import { clearClientAuth, readStoredAuthUser } from "@/lib/auth/authStorage";

export interface DemoUser { name: string; role: string; email: string; roles?: AppRole[]; permissions?: AppPermission[]; }
interface AuthValue { user: DemoUser | null; ready: boolean; login: () => void; logout: () => void; updateUser: (user: DemoUser) => void; setAuthenticatedUser: (user: AuthUser) => void; }

const demoUser: DemoUser = {
  name: "관리자", role: "관제 관리자", email: "admin@roadbogo.demo",
  roles: ["CONTROL_OPERATOR"],
  permissions: ["control:view","cctv:view","incidents:view","dispatch:manage","alerts:view","profile:view"],
};
const permissionMap:Record<UserRole,{appRoles:AppRole[];permissions:AppPermission[]}>= {
  SYSTEM_ADMIN:{appRoles:["SYSTEM_ADMIN"],permissions:["users:manage","roles:manage","system:view","audit:view","alerts:view","profile:view"]},
  CONTROL_MANAGER:{appRoles:["CONTROL_OPERATOR"],permissions:["control:view","cctv:view","incidents:view","dispatch:manage","alerts:view","profile:view"]},
  CONTROLLER:{appRoles:["CONTROL_OPERATOR"],permissions:["control:view","cctv:view","incidents:view","dispatch:manage","alerts:view","profile:view"]},
  RESPONDER:{appRoles:["FIELD_RESPONDER"],permissions:["dispatch:assigned","field:update","alerts:view","profile:view"]},
  GENERAL_USER:{appRoles:[],permissions:["profile:view"]},
};
const validUserRoles=new Set<UserRole>(["SYSTEM_ADMIN","CONTROL_MANAGER","CONTROLLER","RESPONDER","GENERAL_USER"]);
function toDemoUser(user:AuthUser):DemoUser{
  const roles=user.roles.filter(role=>validUserRoles.has(role));
  const access=roles.reduce((result,role)=>({appRoles:[...new Set([...result.appRoles,...permissionMap[role].appRoles])],permissions:[...new Set([...result.permissions,...permissionMap[role].permissions])]}),{appRoles:[] as AppRole[],permissions:[] as AppPermission[]});
  return{name:user.userName,role:roles[0]??"GENERAL_USER",email:user.email,roles:access.appRoles,permissions:access.permissions};
}
const AuthContext = createContext<AuthValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<DemoUser | null>(null);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    try { const stored=readStoredAuthUser();if(stored)setUser(toDemoUser(stored));else if(localStorage.getItem("roadbogo-demo-auth") === "true")setUser(demoUser); } finally { setReady(true); }
    const expire=()=>{setUser(null);setReady(true)};window.addEventListener("roadbogo:auth-expired",expire);return()=>window.removeEventListener("roadbogo:auth-expired",expire);
  }, []);
  const value = useMemo<AuthValue>(() => ({
    user, ready,
    login: () => { localStorage.setItem("roadbogo-demo-auth", "true"); setUser(demoUser); },
    logout: () => { clearClientAuth(); setUser(null); },
    updateUser: (next) => setUser(next),
    setAuthenticatedUser: (next) => setUser(toDemoUser(next)),
  }), [user, ready]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error("useAuth must be used inside AuthProvider");
  return value;
}
