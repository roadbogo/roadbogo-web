"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { authApi } from "@/lib/authApi";
import { finishLogoutSession } from "@/lib/apiClient";
import { useAuth } from "./AuthContext";
import { clearPostLoginRoutingState } from "@/lib/auth/postLoginRouting";
import styles from "./logout.module.css";

type LogoutValue = { isLoggingOut: boolean; requestLogout: (trigger?: HTMLElement | null) => void };
const LogoutContext = createContext<LogoutValue | null>(null);
const LogOutIcon = () => <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M10 17l5-5-5-5M15 12H3M14 3h5a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-5"/></svg>;
const CloseIcon = () => <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18"/></svg>;

export function LogoutProvider({ children }: { children: React.ReactNode }) {
  const { clearAuth } = useAuth();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const triggerRef = useRef<HTMLElement | null>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const modalRef = useRef<HTMLElement>(null);
  const runningRef = useRef(false);

  const close = useCallback(() => {
    if (runningRef.current) return;
    setOpen(false);
    window.requestAnimationFrame(() => triggerRef.current?.focus());
  }, []);
  const requestLogout = useCallback((trigger?: HTMLElement | null) => {
    if (runningRef.current) return;
    triggerRef.current = trigger ?? document.activeElement as HTMLElement | null;
    window.dispatchEvent(new Event("roadbogo:logout-open"));
    setOpen(true);
  }, []);
  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") { event.preventDefault(); close(); return; }
      if (event.key !== "Tab") return;
      const focusable = Array.from(modalRef.current?.querySelectorAll<HTMLElement>("button:not(:disabled), a[href], [tabindex]:not([tabindex='-1'])") ?? []);
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable.at(-1);
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
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
      clearPostLoginRoutingState();
      finishLogoutSession();
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
      <section ref={modalRef} className={styles.modal} role="dialog" aria-modal="true" aria-labelledby="logout-title" aria-describedby="logout-description" aria-busy={isLoggingOut}>
        <header><div className={styles.icon}><LogOutIcon /></div><button type="button" className={styles.close} aria-label="로그아웃 창 닫기" onClick={close} disabled={isLoggingOut}><CloseIcon /></button></header>
        <h2 id="logout-title">로그아웃할까요?</h2>
        <p id="logout-description">현재 로그인 세션을 종료하고 로그인 화면으로 이동합니다</p>
        <div className={styles.actions}>
          <button ref={cancelRef} type="button" onClick={close} disabled={isLoggingOut}>취소</button>
          <button type="button" className={styles.confirm} onClick={() => void confirm()} disabled={isLoggingOut}>{isLoggingOut ? <><span className={styles.spinner} />로그아웃 중…</> : "로그아웃"}</button>
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
