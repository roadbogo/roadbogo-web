"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useAuth } from "./AuthContext";
import { useLogout } from "./LogoutProvider";
import { getRoleLabel } from "@/lib/auth/roleLabels";
import { MYPAGE_HREF } from "@/lib/paths";
import { UserAvatar } from "./UserAvatar";
import styles from "./accountMenu.module.css";

const MoreHorizontalIcon = () => <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="5" cy="12" r="1.4" /><circle cx="12" cy="12" r="1.4" /><circle cx="19" cy="12" r="1.4" /></svg>;

export function AccountMenu({ compact = false }: { compact?: boolean }) {
  const { user } = useAuth();
  const { isLoggingOut, requestLogout } = useLogout();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    const closeForNotifications = () => setOpen(false);
    window.addEventListener("roadbogo:notifications-open", closeForNotifications);
    window.addEventListener("roadbogo:logout-open", closeForNotifications);
    return () => {
      window.removeEventListener("roadbogo:notifications-open", closeForNotifications);
      window.removeEventListener("roadbogo:logout-open", closeForNotifications);
    };
  }, []);
  useEffect(() => {
    if (!open) return;
    window.dispatchEvent(new Event("roadbogo:account-open"));
    const onPointer = (event: MouseEvent) => { if (!rootRef.current?.contains(event.target as Node)) setOpen(false); };
    const onKey = (event: KeyboardEvent) => { if (event.key === "Escape") { setOpen(false); triggerRef.current?.focus(); } };
    document.addEventListener("mousedown", onPointer);
    document.addEventListener("keydown", onKey);
    const previous = document.body.style.overflow;
    if (window.matchMedia("(max-width: 767px)").matches) document.body.style.overflow = "hidden";
    window.requestAnimationFrame(() => rootRef.current?.querySelector<HTMLElement>('[role="menu"] a, [role="menu"] button')?.focus());
    return () => { document.removeEventListener("mousedown", onPointer); document.removeEventListener("keydown", onKey); document.body.style.overflow = previous; };
  }, [open]);
  if (!user) return null;
  const role = getRoleLabel(user.role);
  const close = () => setOpen(false);
  return <div ref={rootRef} className={styles.root}>
    <button ref={triggerRef} type="button" className={`${styles.trigger} ${compact ? styles.compact : ""}`} aria-label={`${user.name} 계정 메뉴`} aria-expanded={open} aria-haspopup="menu" aria-controls="account-menu-panel" onClick={() => setOpen(value => !value)}>
      <UserAvatar className={styles.avatar} />
      <span className={styles.identity}><strong>{user.name}</strong><small>{role}</small></span>
      <span className={styles.more} aria-hidden="true"><MoreHorizontalIcon /></span>
    </button>
    {open && <><button type="button" className={styles.backdrop} aria-label="계정 메뉴 닫기" onClick={close} /><div id="account-menu-panel" className={styles.panel} role="menu" aria-label="계정 메뉴">
      <div className={styles.handle} aria-hidden="true" />
      <header><UserAvatar className={styles.panelAvatar} /><div><strong>{user.name}</strong><span>{role}</span>{user.organization?.name && <small>{user.organization.name}</small>}</div></header>
      <div className={styles.divider} />
      <Link href={MYPAGE_HREF} role="menuitem" onClick={close}>마이페이지</Link>
      <div className={styles.divider} />
      <button type="button" role="menuitem" className={styles.logout} disabled={isLoggingOut} onClick={() => { close(); requestLogout(triggerRef.current); }}>로그아웃</button>
    </div></>}
  </div>;
}
