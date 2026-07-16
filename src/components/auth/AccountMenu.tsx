"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useAuth } from "./AuthContext";
import { useLogout } from "./LogoutProvider";
import { getRoleLabel } from "@/lib/auth/roleLabels";
import { MYPAGE_HREF } from "@/lib/paths";
import styles from "./accountMenu.module.css";

export function AccountMenu({ compact = false }: { compact?: boolean }) {
  const { user } = useAuth();
  const { isLoggingOut, requestLogout } = useLogout();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!open) return;
    const onPointer = (event: MouseEvent) => { if (!rootRef.current?.contains(event.target as Node)) setOpen(false); };
    const onKey = (event: KeyboardEvent) => { if (event.key === "Escape") { setOpen(false); triggerRef.current?.focus(); } };
    document.addEventListener("mousedown", onPointer);
    document.addEventListener("keydown", onKey);
    const previous = document.body.style.overflow;
    if (window.matchMedia("(max-width: 767px)").matches) document.body.style.overflow = "hidden";
    return () => { document.removeEventListener("mousedown", onPointer); document.removeEventListener("keydown", onKey); document.body.style.overflow = previous; };
  }, [open]);
  if (!user) return null;
  const role = getRoleLabel(user.role);
  const close = () => setOpen(false);
  return <div ref={rootRef} className={styles.root}>
    <button ref={triggerRef} type="button" className={`${styles.trigger} ${compact ? styles.compact : ""}`} aria-label={`${user.name} 계정 메뉴`} aria-expanded={open} aria-haspopup="menu" onClick={() => setOpen(value => !value)}>
      <b aria-hidden="true">{user.name.slice(0, 1)}</b><span><strong>{user.name}</strong><small>{role}</small></span><i aria-hidden="true">⌄</i>
    </button>
    {open && <><button type="button" className={styles.backdrop} aria-label="계정 메뉴 닫기" onClick={close} /><div className={styles.panel} role="menu" aria-label="계정 메뉴">
      <div className={styles.handle} aria-hidden="true" />
      <header><b>{user.name.slice(0, 1)}</b><div><strong>{user.name}</strong><span>{role}</span><small>{user.organization?.name ?? "소속 기관 없음"}</small></div></header>
      <div className={styles.divider} />
      <Link href={MYPAGE_HREF} role="menuitem" onClick={close}>마이페이지</Link>
      <div className={styles.divider} />
      <button type="button" role="menuitem" className={styles.logout} disabled={isLoggingOut} onClick={(event) => { close(); requestLogout(event.currentTarget); }}>로그아웃</button>
    </div></>}
  </div>;
}
