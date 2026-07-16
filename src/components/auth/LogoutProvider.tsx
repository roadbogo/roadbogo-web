"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { authApi } from "@/lib/authApi";
import { cancelPendingAuthRequests } from "@/lib/apiClient";
import { useAuth } from "./AuthContext";
import styles from "./logout.module.css";

type LogoutValue = { isLoggingOut: boolean; requestLogout: (trigger?: HTMLElement | null) => void };
const LogoutContext = createContext<LogoutValue | null>(null);

export function LogoutProvider({ children }: { children: React.ReactNode }) {
  const { clearAuth } = useAuth();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const triggerRef = useRef<HTMLElement | null>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const runningRef = useRef(false);

  const close = useCallback(() => {
    if (runningRef.current) return;
    setOpen(false);
    window.requestAnimationFrame(() => triggerRef.current?.focus());
  }, []);
  const requestLogout = useCallback((trigger?: HTMLElement | null) => {
    if (runningRef.current) return;
    triggerRef.current = trigger ?? document.activeElement as HTMLElement | null;
    setOpen(true);
  }, []);
  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (event: KeyboardEvent) => { if (event.key === "Escape") close(); };
    document.addEventListener("keydown", onKey);
    window.requestAnimationFrame(() => cancelRef.current?.focus());
    return () => { document.body.style.overflow = previous; document.removeEventListener("keydown", onKey); };
  }, [close, open]);
  const confirm = async () => {
    if (runningRef.current) return;
    runningRef.current = true;
    setIsLoggingOut(true);
    try { await authApi.logout(); }
    catch { if (process.env.NODE_ENV === "development") console.warn("Logout request failed; client session was cleared."); }
    finally {
      cancelPendingAuthRequests();
      clearAuth();
      setOpen(false);
      setIsLoggingOut(false);
      runningRef.current = false;
      router.replace("/login");
    }
  };
  return <LogoutContext.Provider value={{ isLoggingOut, requestLogout }}>
    {children}
    {open && <div className={styles.backdrop} onMouseDown={(event) => { if (event.target === event.currentTarget) close(); }}>
      <section className={styles.modal} role="dialog" aria-modal="true" aria-labelledby="logout-title" aria-describedby="logout-description">
        <div className={styles.icon} aria-hidden="true">↪</div>
        <h2 id="logout-title">로그아웃하시겠습니까?</h2>
        <p id="logout-description">현재 계정의 로그인 세션이 종료되며 로그인 화면으로 이동합니다.</p>
        <div className={styles.actions}>
          <button ref={cancelRef} type="button" onClick={close} disabled={isLoggingOut}>취소</button>
          <button type="button" className={styles.confirm} onClick={() => void confirm()} disabled={isLoggingOut}>{isLoggingOut ? <><span className={styles.spinner} />로그아웃 중</> : "로그아웃"}</button>
        </div>
      </section>
    </div>}
  </LogoutContext.Provider>;
}

export function useLogout() {
  const value = useContext(LogoutContext);
  if (!value) throw new Error("useLogout must be used inside LogoutProvider");
  return value;
}
