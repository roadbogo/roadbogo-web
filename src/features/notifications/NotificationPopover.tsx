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
  notificationVisualToneLabels,
  resolveNotificationVisualTone,
  severityLabels,
  sortNotificationQueue,
  systemAdminQueue,
} from "./notificationDomain";
import { NotificationRow, NotificationTypeIcon } from "./NotificationRow";
import type { NotificationViewModel } from "./notificationTypes";
import styles from "./notifications.module.css";

const BellIcon = () => <span className={styles.bellIcon} aria-hidden="true"><svg viewBox="0 0 24 24"><g className={styles.bellBody}><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9" /></g><g className={styles.bellClapper}><path d="M10 21h4" /></g></svg><i className={styles.sparkleOne}>✦</i><i className={styles.sparkleTwo}>·</i></span>;
const CloseIcon = () => <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18" /></svg>;
type InboxTab = "action" | "updates";

export function NotificationPopover() {
  const { user } = useAuth();
  return user?.role === "SYSTEM_ADMIN" ? <SystemAdminNotificationPopover /> : <DefaultNotificationPopover />;
}

function DefaultNotificationPopover() {
  const{user}=useAuth();
  const { items, unreadCount, actionCount, loading, error, realtimeStatus, markRead, targetFor } = useNotifications();
  const audience=useMemo(()=>resolveNotificationAudience(user),[user]);
  const manager=user?.role==="CONTROL_MANAGER";
  const operations=audience.kind==="operations";
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
  const generalItems = useMemo(() => sortNotificationQueue(items, "newest"), [items]);
  const managerItems=useMemo(()=>[...items].sort((a,b)=>{
    const rank=(item:NotificationViewModel)=>{
      if(!item.read&&item.notification_type==="INCIDENT_CREATED"&&["HIGH","CRITICAL"].includes(item.severity))return 0;
      if(item.notification_type==="DISPATCH_REJECTED")return 1;
      if(item.notification_type==="INCIDENT_STATUS_CHANGED")return 2;
      if(item.notification_type==="ACTION_COMPLETED")return 3;
      return 4;
    };
    return rank(a)-rank(b)||Date.parse(b.created_at)-Date.parse(a.created_at);
  }).slice(0,5),[items]);
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
  const openItem = (item: NotificationViewModel) => {
    if (pendingOpen.current.has(item.public_id)) return;
    pendingOpen.current.add(item.public_id);
    const target = targetFor(item);
    setOpen(false);
    if (target) router.push(target);
    if (!item.read) {
      void markRead(item.public_id).finally(() => pendingOpen.current.delete(item.public_id));
    } else {
      pendingOpen.current.delete(item.public_id);
    }
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
          <div><h2 id="notification-popover-title">{audience.pageTitle}</h2>{manager?<p>확인이 필요한 사건과 출동 변동입니다.</p>:operations&&<p>{tab === "action" ? `처리가 필요한 업무 ${actionCount}건` : `읽지 않은 알림 ${unreadCount}건`}</p>}</div>
          <Link href="/notifications" onClick={() => setOpen(false)}>{manager?"모든 업무 알림 보기":"전체 알림 보기"}</Link>
          <button type="button" className={styles.mobileClose} aria-label={`${audience.pageTitle} 닫기`} onClick={close}><CloseIcon /></button>
        </header>
        {operations&&!manager&&<div className={styles.popoverTabs} role="tablist" aria-label="업무 알림 분류">
          <button id="notification-popover-tab-action" type="button" role="tab" aria-selected={tab === "action"} aria-controls="notification-popover-panel-action" tabIndex={tab === "action" ? 0 : -1} onClick={() => setTab("action")} onKeyDown={onTabKey}>처리 필요 <b>{actionCount}</b></button>
          <button id="notification-popover-tab-updates" type="button" role="tab" aria-selected={tab === "updates"} aria-controls="notification-popover-panel-updates" tabIndex={tab === "updates" ? 0 : -1} onClick={() => setTab("updates")} onKeyDown={onTabKey}>최근 업데이트</button>
        </div>}
        <div className={styles.popoverScroll} id={!operations?"notification-popover-list":`notification-popover-panel-${tab}`} {...(operations&&{role:"tabpanel","aria-labelledby":`notification-popover-tab-${tab}`})}>
          {loading ? <div className={styles.skeleton} aria-label="알림을 불러오는 중"><i /><i /><i /></div>
            : error ? <div className={styles.popoverEmpty}><strong>알림을 불러오지 못했습니다</strong><span>{error}</span></div>
              : items.length === 0 ? <div className={styles.popoverEmpty}><strong>{audience.emptyTitle}</strong><span>{audience.emptyDescription}</span></div>
                : manager?<section className={styles.popoverGroup}>{managerItems.map(item=><NotificationRow key={item.public_id} item={item} onOpen={openItem} compact />)}</section>
                : !operations?<section className={styles.popoverGroup}>{generalItems.slice(0,6).map(item=><NotificationRow key={item.public_id} item={item} onOpen={openItem} compact showOperationsMetadata={false}/>)}</section>
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
        {operations&&<footer><i aria-hidden="true" /><span>{realtimeStatus === "connecting" ? "연결 중" : realtimeStatus === "recovering" ? "연결 복구 중" : "데모 알림 표시 중"}</span></footer>}
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

function systemAdminPriorityRank(item:NotificationViewModel){
  if(item.read)return Number.POSITIVE_INFINITY;
  if(item.notification_type==="SYSTEM_STATUS"&&["HIGH","CRITICAL"].includes(item.severity))return 0;
  if(item.notification_type==="ACCOUNT_CHANGED"&&(["HIGH","CRITICAL"].includes(item.severity)||/접근|로그인|비활성|보안/.test(`${item.title} ${item.body}`)))return 1;
  if(item.notification_type==="ROLE_CHANGED")return 2;
  if(["URGENT","CAUTION"].includes(resolveNotificationVisualTone(item)))return 3;
  return Number.POSITIVE_INFINITY;
}

export function selectSystemAdminPopoverItems(items:NotificationViewModel[]){
  const indexed=items.map((item,index)=>({item,index}));
  const priority=indexed
    .filter(({item})=>Number.isFinite(systemAdminPriorityRank(item)))
    .sort((a,b)=>systemAdminPriorityRank(a.item)-systemAdminPriorityRank(b.item)||Date.parse(b.item.created_at)-Date.parse(a.item.created_at)||a.index-b.index)[0]?.item??null;
  const recent=indexed
    .filter(({item})=>item.public_id!==priority?.public_id)
    .sort((a,b)=>Number(a.item.read)-Number(b.item.read)||Date.parse(b.item.created_at)-Date.parse(a.item.created_at)||a.index-b.index)
    .slice(0,3)
    .map(({item})=>item);
  return {priority,recent};
}

function SystemAdminNotificationPopover() {
  const { items, unreadCount, loading, error, refresh, markRead, markAllRead, targetFor } = useNotifications();
  const [open, setOpen] = useState(false);
  const [closing,setClosing]=useState(false);
  const [markingAll,setMarkingAll]=useState(false);
  const [ringing,setRinging]=useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLElement>(null);
  const pending = useRef(new Set<string>());
  const ringTimer=useRef<number|null>(null);
  const closeTimer=useRef<number|null>(null);
  const router = useRouter();
  const pathname = usePathname();
  const adminItems = useMemo(() => sortNotificationQueue(items, "newest"), [items]);
  const adminFeed=useMemo(()=>selectSystemAdminPopoverItems(adminItems),[adminItems]);
  const hasUrgent=adminItems.some(item=>!item.read&&resolveNotificationVisualTone(item)==="URGENT");
  const highestUnreadTone=useMemo(()=>{
    const rank={URGENT:0,CAUTION:1,SECURITY:1,CHANGE:2,SUCCESS:3,INFO:4} as const;
    return adminItems.filter(item=>!item.read).map(resolveNotificationVisualTone).sort((a,b)=>rank[a]-rank[b])[0]??null;
  },[adminItems]);

  const close = useCallback(() => {
    setOpen(false);
    setClosing(true);
    if(closeTimer.current!==null)window.clearTimeout(closeTimer.current);
    closeTimer.current=window.setTimeout(()=>{setClosing(false);closeTimer.current=null;triggerRef.current?.focus()},150);
  }, []);

  useEffect(() => { setOpen(false);setClosing(false); }, [pathname]);
  useEffect(()=>()=>{if(ringTimer.current!==null)window.clearTimeout(ringTimer.current);if(closeTimer.current!==null)window.clearTimeout(closeTimer.current)},[]);
  useEffect(() => {
    if (!open) return;
    const outside = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) close();
    };
    const keyboard = (event: globalThis.KeyboardEvent) => {
      if (event.key === "Escape") close();
    };
    document.addEventListener("mousedown", outside);
    document.addEventListener("keydown", keyboard);
    window.requestAnimationFrame(() => panelRef.current?.querySelector<HTMLElement>("button,a")?.focus());
    return () => {
      document.removeEventListener("mousedown", outside);
      document.removeEventListener("keydown", keyboard);
    };
  }, [close, open]);

  const ringOnce=useCallback(()=>{
    if(ringTimer.current!==null||window.matchMedia("(prefers-reduced-motion: reduce)").matches)return;
    setRinging(true);ringTimer.current=window.setTimeout(()=>{setRinging(false);ringTimer.current=null},620);
  },[]);
  const confirmItem = (item: NotificationViewModel) => {
    if (pending.current.has(item.public_id)) return;
    pending.current.add(item.public_id);
    const target = item.admin_category
      ? `/notifications?${systemAdminQueue(item)==="change"?"tab=history&":""}notification=${encodeURIComponent(item.public_id)}`
      : targetFor(item)??`/notifications?notification=${encodeURIComponent(item.public_id)}`;
    if(closeTimer.current!==null)window.clearTimeout(closeTimer.current);
    setOpen(false);
    setClosing(false);
    router.push(target);
    if (!item.read) {
      void markRead(item.public_id).then(saved=>{if(!saved)return refresh()}).finally(() => pending.current.delete(item.public_id));
    } else {
      pending.current.delete(item.public_id);
    }
  };
  const confirmAll=async()=>{
    if(markingAll||unreadCount===0)return;
    setMarkingAll(true);
    try{await markAllRead()}finally{setMarkingAll(false)}
  };

  const badge = formatUnreadCount(unreadCount);
  const bellLabel = unreadCount ? `운영 알림 열기, 읽지 않음 ${unreadCount}개` : "운영 알림 열기, 읽지 않음 없음";

  return <div ref={rootRef} className={styles.popoverRoot}>
    <button ref={triggerRef} type="button" className={`header-bell ${styles.bell} ${styles.adminBell} ${unreadCount ? styles.hasUnread : ""} ${ringing?styles.ringing:""} ${hasUrgent?styles.hasUrgent:""} ${highestUnreadTone?styles[`adminBellTone${highestUnreadTone}`]:""}`} aria-label={bellLabel} aria-expanded={open} aria-haspopup="dialog" aria-controls="admin-notification-popover" onPointerEnter={event=>{if(event.pointerType==="mouse")ringOnce()}} onFocus={event=>{if(event.currentTarget.matches(":focus-visible"))ringOnce()}} onClick={() => {if(open)close();else{if(closeTimer.current!==null)window.clearTimeout(closeTimer.current);setClosing(false);setOpen(true)}}}>
      <BellIcon />{unreadCount > 0 && <b aria-hidden="true">{badge}</b>}
    </button>
    {(open||closing) && <>
      <button type="button" className={styles.mobileBackdrop} aria-label="운영 알림 닫기" onClick={close} />
      <section ref={panelRef} id="admin-notification-popover" data-state={closing?"closing":"open"} className={`${styles.popover} ${styles.adminResponder}`} role="dialog" aria-modal="false" aria-labelledby="admin-notification-title" onKeyDown={event=>{if(event.key!=="Tab")return;const nodes=panelRef.current?.querySelectorAll<HTMLElement>("button:not([disabled]),a[href]");if(!nodes?.length)return;const first=nodes[0],last=nodes[nodes.length-1];if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus()}else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus()}}}>
        <header className={styles.adminResponderHeader}>
          <div><span><h2 id="admin-notification-title">운영 알림</h2><b>미확인 {unreadCount}건</b><button type="button" disabled={unreadCount===0||markingAll} onClick={()=>void confirmAll()}>{markingAll?"처리 중":"모두 읽음"}</button></span><p>확인이 필요한 운영 및 보안 알림입니다.</p></div>
          <button type="button" className={styles.mobileClose} aria-label="운영 알림 닫기" onClick={close}><CloseIcon /></button>
        </header>
        <div className={styles.adminResponderScroll} aria-label="운영 알림 피드">
          {loading && items.length === 0 ? <div className={styles.adminSkeleton} aria-label="관리 알림을 불러오는 중"><i /><i /><i /></div>
            : error && items.length === 0 ? <div className={styles.adminResponderEmpty} role="alert"><strong>운영 알림을 불러오지 못했습니다.</strong><p>잠시 후 다시 확인해 주세요.</p><button type="button" onClick={() => void refresh()}>다시 확인</button></div>
              : adminItems.length === 0 ? <div className={styles.adminResponderEmpty}><strong>현재 확인이 필요한 운영 알림이 없습니다.</strong><p>새로운 운영·보안 변경이 발생하면 이곳에 표시됩니다.</p></div>
                : <div className={styles.adminPriorityFeed}>
                    {adminFeed.priority&&<section className={`${styles.adminFeedGroup} ${styles.adminPriorityFeedGroup}`}><h3><span aria-hidden="true">!</span> 우선 확인 <b>1건</b></h3><div className={styles.adminCompactList}><AdminCompactItem item={adminFeed.priority} onConfirm={confirmItem}/></div></section>}
                    {adminFeed.recent.length>0&&<section className={styles.adminFeedGroup}><h3>최근 알림</h3><div className={styles.adminCompactList}>{adminFeed.recent.map(item=><AdminCompactItem key={item.public_id} item={item} onConfirm={confirmItem}/>)}</div></section>}
                  </div>}
        </div>
        <footer className={styles.adminResponderFooter}>
          <Link href="/notifications" onClick={() => setOpen(false)}><span aria-hidden="true">☷</span> 모든 알림 보기</Link>
        </footer>
      </section>
    </>}
  </div>;
}

function AdminNotificationTypeIcon({item}:{item:NotificationViewModel}){
  if(item.notification_type==="ACCOUNT_CHANGED")return <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="9" cy="8" r="4"/><path d="M2.5 20a7 7 0 0 1 10.5-6M16 15l5 5M21 15l-5 5"/></svg>;
  if(item.notification_type==="ROLE_CHANGED")return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3 5 6v5c0 4.6 2.8 8.1 7 10 4.2-1.9 7-5.4 7-10V6l-7-3Z"/><path d="m9 12 2 2 4-4"/></svg>;
  if(item.notification_type==="SYSTEM_STATUS")return <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="4" y="4" width="16" height="6" rx="2"/><rect x="4" y="14" width="16" height="6" rx="2"/><path d="M8 7h.01M8 17h.01"/></svg>;
  return <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7.5h.01"/></svg>;
}

function AdminCompactItem({ item, onConfirm }: { item: NotificationViewModel; onConfirm: (item: NotificationViewModel) => void }) {
  const visualTone=resolveNotificationVisualTone(item);
  const toneLabel=notificationVisualToneLabels[visualTone];
  return <article data-tone={visualTone} className={`${styles.adminCompactItem} ${!item.read ? styles.adminUnread : ""}`}>
    <button type="button" className={styles.adminInboxRow} aria-label={`${toneLabel} 알림, ${item.title}, ${formatRelativeTime(item.created_at)}${item.read?"":", 읽지 않음"}`} onClick={() => void onConfirm(item)}>
      <span className={styles.adminSeverityIcon} role="img" aria-label={toneLabel}>
        <AdminNotificationTypeIcon item={item}/>
      </span>
      <span className={styles.adminInboxContent}>
        <span className={styles.adminInboxTitle}><strong>{item.title}</strong><time dateTime={item.created_at} title={formatExactKst(item.created_at)}>{formatRelativeTime(item.created_at)}</time>{!item.read&&<i aria-hidden="true"/>}</span>
        <span className={styles.adminInboxBody}>{item.body}</span>
        <span className={styles.adminInboxTarget}><span><em>{toneLabel}</em>{item.resource_label}</span><b aria-hidden="true"><svg viewBox="0 0 24 24"><path d="m9 5 7 7-7 7"/></svg></b></span>
      </span>
    </button>
  </article>;
}
