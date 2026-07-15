"use client";

import { useEffect, useRef, useState } from "react";
import { useSystemHealth } from "@/hooks/useSystemHealth";
import styles from "@/app/login/login.module.css";

export function LoginSystemHealth() {
  const health = useSystemHealth();
  const [open, setOpen] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (event: MouseEvent) => { if (!wrap.current?.contains(event.target as Node)) setOpen(false); };
    const key = (event: KeyboardEvent) => { if (event.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", close); document.addEventListener("keydown", key);
    return () => { document.removeEventListener("mousedown", close); document.removeEventListener("keydown", key); };
  }, [open]);
  const tone = health.isLoading ? "loading" : health.status;
  const label = health.isLoading ? "상태 확인 중" : health.status === "healthy" ? "운영 서버 정상" : health.status === "degraded" ? "일부 기능 점검 중" : "시스템 연결 확인 필요";
  const state = (value: boolean, degraded = false) => health.isLoading ? "확인 중" : value ? "정상" : degraded ? "점검 필요" : "연결 안 됨";
  const checked = health.isLoading ? "확인 중" : new Intl.DateTimeFormat("ko-KR", { hour: "2-digit", minute: "2-digit", second: "2-digit" }).format(new Date(health.checkedAt));
  return <div ref={wrap} className={styles.healthWrap}>
    <button type="button" className={`${styles.healthBadge} ${styles[`health_${tone}`]}`} onClick={() => setOpen(value => !value)} aria-expanded={open} aria-controls="login-health-popover"><i/>{label}<span aria-hidden="true">ⓘ</span></button>
    {open && <section id="login-health-popover" className={styles.healthPopover} aria-label="운영 시스템 상태 상세">
      <div><span>API 서버</span><strong>{state(health.api)}</strong></div>
      <div><span>데이터베이스</span><strong>{state(health.database, health.status === "degraded")}</strong></div>
      <div><span>마지막 확인</span><strong>{checked}</strong></div>
      <button type="button" onClick={() => void health.refresh()} disabled={health.isLoading}>{health.isLoading ? "확인 중" : "상태 새로고침"}</button>
    </section>}
  </div>;
}
