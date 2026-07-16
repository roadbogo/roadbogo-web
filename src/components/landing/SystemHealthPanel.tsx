"use client";

import { useEffect, useRef } from "react";
import type { SystemHealthStatus } from "@/types/systemHealth";

type Props = {
  open: boolean;
  status: SystemHealthStatus;
  api: boolean;
  database: boolean;
  checkedAt: string;
  isLoading: boolean;
  onRefresh: () => void;
  onClose: () => void;
};

export function SystemHealthPanel({ open, status, api, database, checkedAt, isLoading, onRefresh, onClose }: Props) {
  const closeButton = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLElement>(null);
  const previousFocus = useRef<HTMLElement | null>(null);
  const onCloseRef = useRef(onClose);
  useEffect(() => { onCloseRef.current = onClose; }, [onClose]);
  useEffect(() => {
    if (!open) return;
    previousFocus.current = document.activeElement as HTMLElement | null;
    closeButton.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") { onCloseRef.current(); return; }
      if (event.key !== "Tab") return;
      const focusable = panel.current?.querySelectorAll<HTMLElement>('button:not([disabled])');
      if (!focusable?.length) return;
      const first = focusable[0], last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("keydown", onKey); previousFocus.current?.focus(); };
  }, [open]);
  if (!open) return null;

  const rows = [
    { label: "API 서버", state: isLoading ? "확인 중" : api ? "정상" : "연결 안 됨", tone: isLoading ? "loading" : api ? "healthy" : "offline" },
    { label: "데이터베이스", state: isLoading ? "확인 중" : database ? "정상" : status === "degraded" ? "점검 필요" : "확인 불가", tone: isLoading ? "loading" : database ? "healthy" : status === "degraded" ? "degraded" : "offline" },
  ];
  const checkedLabel = isLoading ? "확인 중" : new Intl.DateTimeFormat("ko-KR", { hour: "2-digit", minute: "2-digit", second: "2-digit" }).format(new Date(checkedAt));

  return <div className="system-health-overlay" onMouseDown={event=>{if(event.target===event.currentTarget)onClose()}}>
    <section ref={panel} className="system-health-panel" role="dialog" aria-modal="true" aria-labelledby="system-health-title">
      <header><div><p>SYSTEM HEALTH</p><h2 id="system-health-title">도로보GO 서버 상태</h2></div><button ref={closeButton} type="button" onClick={onClose} aria-label="서버 상태 닫기">×</button></header>
      <div className="system-health-panel__rows">{rows.map(row=><div key={row.label}><span>{row.label}</span><strong className={`is-${row.tone}`}><i/>{row.state}</strong></div>)}<div><span>마지막 확인 시간</span><strong>{checkedLabel}</strong></div></div>
      <footer><button type="button" onClick={onRefresh} disabled={isLoading} aria-busy={isLoading}>{isLoading?"상태 확인 중":"다시 확인"}</button></footer>
    </section>
  </div>;
}
