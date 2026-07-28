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
  const refreshedForOpen = useRef(false);
  const onRefreshRef = useRef(onRefresh);
  const onCloseRef = useRef(onClose);
  useEffect(() => { onRefreshRef.current = onRefresh; }, [onRefresh]);
  useEffect(() => { onCloseRef.current = onClose; }, [onClose]);
  useEffect(() => {
    if (!open) { refreshedForOpen.current = false; return; }
    if (refreshedForOpen.current) return;
    refreshedForOpen.current = true;
    onRefreshRef.current();
  }, [open]);
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
    { label: "API 서버", state: isLoading ? "확인 중" : api ? "정상" : "연결 오류", tone: isLoading ? "loading" : api ? "healthy" : "offline", error: !isLoading && !api ? "API 서버 상태를 확인할 수 없습니다." : null },
    { label: "데이터베이스", state: isLoading ? "확인 중" : database ? "정상" : status === "degraded" ? "점검 필요" : "연결 오류", tone: isLoading ? "loading" : database ? "healthy" : status === "degraded" ? "degraded" : "offline", error: !isLoading && !database ? "데이터베이스 상태를 확인할 수 없습니다." : null },
  ];
  const validCheckedAt = checkedAt && !Number.isNaN(Date.parse(checkedAt));
  const checkedLabel = isLoading
    ? "서버 상태를 확인하고 있습니다"
    : validCheckedAt
      ? `마지막 확인 ${new Intl.DateTimeFormat("ko-KR", { hour: "2-digit", minute: "2-digit", second: "2-digit" }).format(new Date(checkedAt))}`
      : "상태 확인 전";

  return <div className="system-health-overlay" onMouseDown={event=>{if(event.target===event.currentTarget)onClose()}}>
    <section ref={panel} className="system-health-panel" role="dialog" aria-modal="true" aria-labelledby="system-health-title">
      <header>
        <div className="system-health-panel__heading"><p>SYSTEM HEALTH</p><h2 id="system-health-title">도로보GO 서버 상태</h2><span>{checkedLabel}</span></div>
        <div className="system-health-panel__actions">
          <button className="system-health-panel__icon-button system-health-panel__refresh-icon" type="button" onClick={onRefresh} disabled={isLoading} aria-label="서버 상태 새로고침" aria-busy={isLoading} title="서버 상태 새로고침" data-tooltip="서버 상태 새로고침">
            <svg className={isLoading ? "is-spinning" : undefined} viewBox="0 0 24 24" aria-hidden="true"><path d="M21 12a9 9 0 0 0-15.5-6.2L3 9"/><path d="M3 3v6h6"/><path d="M3 12a9 9 0 0 0 15.5 6.2L21 15"/><path d="M21 21v-6h-6"/></svg>
          </button>
          <button ref={closeButton} className="system-health-panel__icon-button system-health-panel__close" type="button" onClick={onClose} aria-label="서버 상태 닫기">×</button>
        </div>
      </header>
      <div className="system-health-panel__rows" aria-live="polite">{rows.map(row=><div className="system-health-panel__row" key={row.label}>
        <div className={`system-health-panel__row-main is-${row.tone}`}><span>{row.label}</span><i aria-hidden="true"/><strong>{row.state}</strong></div>
        {row.error&&<div className="system-health-panel__row-error"><small>{row.error}</small><button type="button" onClick={onRefresh} disabled={isLoading}>재시도</button></div>}
      </div>)}</div>
    </section>
  </div>;
}
