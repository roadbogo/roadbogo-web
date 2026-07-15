"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";

export interface DemoUser { name: string; role: string; email: string; }
interface AuthValue { user: DemoUser | null; ready: boolean; login: () => void; logout: () => void; updateUser: (user: DemoUser) => void; }

const demoUser: DemoUser = { name: "관리자", role: "관제 관리자", email: "admin@roadbogo.demo" };
const AuthContext = createContext<AuthValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<DemoUser | null>(null);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    try { if (localStorage.getItem("roadbogo-demo-auth") === "true") setUser(demoUser); } finally { setReady(true); }
  }, []);
  const value = useMemo<AuthValue>(() => ({
    user, ready,
    login: () => { localStorage.setItem("roadbogo-demo-auth", "true"); setUser(demoUser); },
    logout: () => { localStorage.removeItem("roadbogo-demo-auth"); setUser(null); },
    updateUser: (next) => setUser(next),
  }), [user, ready]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error("useAuth must be used inside AuthProvider");
  return value;
}
