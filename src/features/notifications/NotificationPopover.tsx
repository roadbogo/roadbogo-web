"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState, type FocusEvent, type KeyboardEvent, type PointerEvent } from "react";
import { useAuth } from "@/components/auth/AuthContext";
import { useNotifications } from "./NotificationContext";
import { resolveNotificationAudience } from "./notificationAudience";
import {
  compareNotificationPriority,
  formatExactKst,
  formatRelativeTime,
  formatUnreadCount,
  hasNewUnreadNotification,
  notificationPresentation,
  notificationStateCopy,
  severityLabels,
  sortNotificationQueue,
} from "./notificationDomain";
import { NotificationRow, NotificationTypeIcon } from "./NotificationRow";
import type { NotificationViewModel } from "./notificationTypes";
import styles from "./notifications.module.css";

const BellIcon = () => <span className={styles.bellIcon} aria-hidden="true"><svg viewBox="0 0 24 24"><g className={styles.bellBody}><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9" /></g><g className={styles.bellClapper}><path d="M10 21h4" /></g></svg></span>;
const CloseIcon = () => <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18" /></svg>;
type InboxTab = "action" | "updates";

export function NotificationPopover() {
  const{user}=useAuth();
  const { items, unreadCount, actionCount, loading, error, realtimeStatus, markRead, targetFor } = useNotifications();
  const audience=useMemo(()=>resolveNotificationAudience(user?.role),[user?.role]);
  const general=audience.general;
  const [open, setOpen] = useState(false);
  const [ringing, setRinging] = useState(false);
  const [tab, setTab] = useState<InboxTab>("action");
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLElement>(null);
  const pendingOpen = useRef(new Set<string>());
  const ringTimer = useRef<number | null>(null);
  const previousUnreadIds = useRef<Set<string>>(new Set());
  const pathname = usePathname();
  const router = useRouter();
  const actionItems = useMemo(() => items.filter(item => item.action_required).sort(compareNotificationPriority), [items]);
  const updates = useMemo(() => items.filter(item => !item.action_required).sort(compareNotificationPriority), [items]);
  const generalItems = useMemo(() => sortNotificationQueue(items, "all", "newest"), [items]);
  const priorityItem = actionItems[0] ?? null;
  const unreadIds = useMemo(() => items.filter(item => !item.read).map(item => item.public_id), [items]);

  useEffect(() => { setOpen(false); }, [pathname]);
  useEffect(()=>()=>{if(ringTimer.current!==null)window.clearTimeout(ringTimer.current)},[]);
  useEffect(() => {
    const closeForAccount = () => setOpen(false);
    window.addEventListener("roadbogo:account-open", closeForAccount);
    window.addEventListener("roadbogo:logout-open", closeForAccount);
    return () => {
      window.removeEventListener("roadbogo:account-open", closeForAccount);
      window.removeEventListener("roadbogo:logout-open", closeForAccount);
    };
  }, []);
  useEffect(() => {
    if (!open) return;
    window.dispatchEvent(new Event("roadbogo:notifications-open"));
    const onPointer = (event: MouseEvent) => { if (!rootRef.current?.contains(event.target as Node)) setOpen(false); };
    const onKey = (event: globalThis.KeyboardEvent) => {
      if (event.key === "Escape") { setOpen(false); triggerRef.current?.focus(); }
    };
    document.addEventListener("mousedown", onPointer);
    document.addEventListener("keydown", onKey);
    window.requestAnimationFrame(() => panelRef.current?.querySelector<HTMLElement>("a,button")?.focus());
    return () => { document.removeEventListener("mousedown", onPointer); document.removeEventListener("keydown", onKey); };
  }, [open]);

  const close = () => { setOpen(false); triggerRef.current?.focus(); };
  const openItem = async (item: NotificationViewModel) => {
    if (pendingOpen.current.has(item.public_id)) return;
    pendingOpen.current.add(item.public_id);
    const success = await markRead(item.public_id);
    if (!success) { pendingOpen.current.delete(item.public_id); return; }
    const target = targetFor(item);
    setOpen(false);
    if (target) router.push(target);
    pendingOpen.current.delete(item.public_id);
  };
  const onTabKey = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (!["ArrowLeft", "ArrowRight"].includes(event.key)) return;
    event.preventDefault();
    const next: InboxTab = tab === "action" ? "updates" : "action";
    setTab(next);
    window.requestAnimationFrame(() => document.getElementById(`notification-popover-tab-${next}`)?.focus());
  };
  const ringOnce=useCallback(()=>{
    if(unreadCount<=0||ringTimer.current!==null||window.matchMedia("(prefers-reduced-motion: reduce)").matches)return;
    setRinging(true);
    ringTimer.current=window.setTimeout(()=>{setRinging(false);ringTimer.current=null},650);
  },[unreadCount]);
  useEffect(()=>{
    if(loading)return;
    if(hasNewUnreadNotification(unreadIds,previousUnreadIds.current))ringOnce();
    previousUnreadIds.current=new Set(unreadIds);
  },[loading,ringOnce,unreadIds]);
  const onBellPointerEnter=(event:PointerEvent<HTMLButtonElement>)=>{
    if(event.pointerType==="mouse"&&window.matchMedia("(hover: hover) and (pointer: fine)").matches)ringOnce();
  };
  const onBellFocus=(event:FocusEvent<HTMLButtonElement>)=>{
    if(event.currentTarget.matches(":focus-visible"))ringOnce();
  };
  const badge = formatUnreadCount(unreadCount);
  const label = unreadCount ? `읽지 않은 알림 ${unreadCount}개` : "읽지 않은 알림 없음";

  return <div ref={rootRef} className={styles.popoverRoot}>
    <button ref={triggerRef} type="button" className={`header-bell ${styles.bell} ${unreadCount>0?styles.hasUnread:""} ${ringing?styles.ringing:""}`} aria-label={label} aria-expanded={open} aria-haspopup="dialog" aria-controls="notification-popover" onPointerEnter={onBellPointerEnter} onFocus={onBellFocus} onClick={() => setOpen(value => !value)}>
      <BellIcon />{unreadCount > 0 && <b aria-hidden="true">{badge}</b>}
    </button>
    {open && <><button type="button" className={styles.mobileBackdrop} aria-label={`${audience.pageTitle} 닫기`} onClick={close} />
      <section ref={panelRef} id="notification-popover" className={styles.popover} role="dialog" aria-modal="false" aria-labelledby="notification-popover-title">
        <header>
          <div><h2 id="notification-popover-title">{audience.pageTitle}</h2><p>{general?`읽지 않은 알림 ${unreadCount}건`:tab === "action" ? `처리가 필요한 업무 ${actionCount}건` : `읽지 않은 알림 ${unreadCount}건`}</p></div>
          <Link href="/notifications" onClick={() => setOpen(false)}>전체 보기</Link>
          <button type="button" className={styles.mobileClose} aria-label={`${audience.pageTitle} 닫기`} onClick={close}><CloseIcon /></button>
        </header>
        {audience.showOperationsControls&&<div className={styles.popoverTabs} role="tablist" aria-label="업무 알림 분류">
          <button id="notification-popover-tab-action" type="button" role="tab" aria-selected={tab === "action"} aria-controls="notification-popover-panel-action" tabIndex={tab === "action" ? 0 : -1} onClick={() => setTab("action")} onKeyDown={onTabKey}>처리 필요 <b>{actionCount}</b></button>
          <button id="notification-popover-tab-updates" type="button" role="tab" aria-selected={tab === "updates"} aria-controls="notification-popover-panel-updates" tabIndex={tab === "updates" ? 0 : -1} onClick={() => setTab("updates")} onKeyDown={onTabKey}>최근 업데이트</button>
        </div>}
        <div
          className={styles.popoverScroll}
          id={general ? "notification-popover-list" : `notification-popover-panel-${tab}`}
          {...(!general && { role: "tabpanel", "aria-labelledby": `notification-popover-tab-${tab}` })}
        >
          {loading ? <div className={styles.skeleton} aria-label="알림을 불러오는 중"><i /><i /><i /></div>
            : error ? <div className={styles.popoverEmpty}><strong>알림을 불러오지 못했습니다</strong><span>{error}</span></div>
              : items.length === 0 ? <div className={styles.popoverEmpty}><strong>{audience.emptyTitle}</strong><span>{general?audience.emptyDescription:"새로운 안내가 도착하면 이곳에서 확인할 수 있습니다"}</span></div>
                : general ? <section className={styles.popoverGroup}><h3>최신 알림</h3>{generalItems.slice(0, 6).map(item => <NotificationRow key={item.public_id} item={item} onOpen={openItem} compact showOperationsMetadata={false} />)}</section>
                : tab === "action" ? actionItems.length === 0
                  ? <div className={styles.popoverEmpty}><strong>현재 처리할 업무가 없습니다</strong><span>최근 업데이트에서 진행 상황을 확인할 수 있습니다</span></div>
                  : <>
                    {priorityItem && <PriorityNotification item={priorityItem} onOpen={openItem} />}
                    {actionItems.length > 1 && <section className={styles.popoverGroup}><h3>다음 처리 업무</h3>{actionItems.slice(1, 5).map(item => <NotificationRow key={item.public_id} item={item} onOpen={openItem} compact />)}</section>}
                  </>
                  : updates.length === 0
                    ? <div className={styles.popoverEmpty}><strong>아직 새로운 업데이트가 없습니다</strong></div>
                    : <section className={styles.popoverGroup}><h3>최근 업데이트</h3>{updates.slice(0, 6).map(item => <NotificationRow key={item.public_id} item={item} onOpen={openItem} compact />)}</section>}
        </div>
        <footer><i aria-hidden="true" /><span>{general?"알림 상태 확인 중":realtimeStatus === "connecting" ? "연결 중" : realtimeStatus === "recovering" ? "연결 복구 중" : "데모 알림 표시 중"}</span></footer>
      </section>
    </>}
  </div>;
}

function PriorityNotification({ item, onOpen }: { item: NotificationViewModel; onOpen: (item: NotificationViewModel) => void }) {
  const presentation = notificationPresentation[item.notification_type];
  const actionLabel = item.target_path === "/dispatch" ? "출동 보기" : "사건 보기";
  return <section className={styles.priorityGroup}>
    <h3>우선 확인</h3>
    <article className={`${styles.priorityCard} ${styles[`tone${presentation.tone}`]}`}>
      <div className={styles.priorityContent}>
        <span className={styles.priorityTop}><b>{severityLabels[item.severity]} · {presentation.label}</b><time dateTime={item.created_at} title={formatExactKst(item.created_at)}>{formatRelativeTime(item.created_at)}</time></span>
        <span className={styles.priorityLead}><span className={`${styles.typeIcon} ${styles[`severity${item.severity}`]}`}><NotificationTypeIcon kind={presentation.icon} /></span><strong>{item.title}</strong></span>
        <span className={styles.priorityBody}>{item.body}</span>
        <span className={styles.priorityMeta}>{item.resource_label} · {notificationStateCopy(item)}</span>
      </div>
      <div className={styles.priorityAction}><button type="button" onClick={() => onOpen(item)} aria-label={`${item.title} ${actionLabel}`}>{actionLabel}</button></div>
    </article>
  </section>;
}
