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
import { adminActionNotifications } from "./adminNotificationPresentation";
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
          <div><h2 id="notification-popover-title">{audience.pageTitle}</h2>{operations&&<p>{tab === "action" ? `처리가 필요한 업무 ${actionCount}건` : `읽지 않은 알림 ${unreadCount}건`}</p>}</div>
          <Link href="/notifications" onClick={() => setOpen(false)}>전체 알림 보기</Link>
          <button type="button" className={styles.mobileClose} aria-label={`${audience.pageTitle} 닫기`} onClick={close}><CloseIcon /></button>
        </header>
        {operations&&<div className={styles.popoverTabs} role="tablist" aria-label="업무 알림 분류">
          <button id="notification-popover-tab-action" type="button" role="tab" aria-selected={tab === "action"} aria-controls="notification-popover-panel-action" tabIndex={tab === "action" ? 0 : -1} onClick={() => setTab("action")} onKeyDown={onTabKey}>처리 필요 <b>{actionCount}</b></button>
          <button id="notification-popover-tab-updates" type="button" role="tab" aria-selected={tab === "updates"} aria-controls="notification-popover-panel-updates" tabIndex={tab === "updates" ? 0 : -1} onClick={() => setTab("updates")} onKeyDown={onTabKey}>최근 업데이트</button>
        </div>}
        <div className={styles.popoverScroll} id={!operations?"notification-popover-list":`notification-popover-panel-${tab}`} {...(operations&&{role:"tabpanel","aria-labelledby":`notification-popover-tab-${tab}`})}>
          {loading ? <div className={styles.skeleton} aria-label="알림을 불러오는 중"><i /><i /><i /></div>
            : error ? <div className={styles.popoverEmpty}><strong>알림을 불러오지 못했습니다</strong><span>{error}</span></div>
              : items.length === 0 ? <div className={styles.popoverEmpty}><strong>{audience.emptyTitle}</strong><span>{audience.emptyDescription}</span></div>
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

type AdminFilter="all"|"unread"|"urgent"|"account"|"system";
const adminFilters:{value:AdminFilter;label:string}[]=[{value:"all",label:"전체"},{value:"unread",label:"미확인"},{value:"urgent",label:"긴급"},{value:"account",label:"계정"},{value:"system",label:"시스템"}];

function SystemAdminNotificationPopover() {
  const { items, loading, error, refresh, markRead, targetFor } = useNotifications();
  const [open, setOpen] = useState(false);
  const [closing,setClosing]=useState(false);
  const [markingAll, setMarkingAll] = useState(false);
  const [filter,setFilter]=useState<AdminFilter>("all");
  const [ringing,setRinging]=useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLElement>(null);
  const listRef=useRef<HTMLDivElement>(null);
  const pending = useRef(new Set<string>());
  const ringTimer=useRef<number|null>(null);
  const closeTimer=useRef<number|null>(null);
  const router = useRouter();
  const pathname = usePathname();
  const actionItems = useMemo(() => adminActionNotifications(items), [items]);
  const unreadItems = useMemo(() => actionItems.filter(item => !item.read), [actionItems]);
  const unreadCount = unreadItems.length;
  const hasUrgent=actionItems.some(item=>!item.read&&(item.severity==="CRITICAL"||item.severity==="HIGH"));
  const filteredItems=useMemo(()=>actionItems.filter(item=>filter==="all"||filter==="unread"&&!item.read||filter==="urgent"&&["CRITICAL","HIGH"].includes(item.severity)||filter==="account"&&(item.admin_category==="ACCOUNT"||item.resource.resource_type==="ACCOUNT"||item.resource.resource_type==="ROLE")||filter==="system"&&(item.admin_category==="SYSTEM"||item.resource.resource_type==="SYSTEM")).slice(0,5),[actionItems,filter]);

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
  const changeFilter=(next:AdminFilter)=>{setFilter(next);if(listRef.current)listRef.current.scrollTop=0};
  const onFilterKey=(event:KeyboardEvent<HTMLButtonElement>,index:number)=>{
    if(!["ArrowLeft","ArrowRight","Home","End"].includes(event.key))return;
    event.preventDefault();const nextIndex=event.key==="Home"?0:event.key==="End"?adminFilters.length-1:(index+(event.key==="ArrowRight"?1:-1)+adminFilters.length)%adminFilters.length;
    changeFilter(adminFilters[nextIndex].value);requestAnimationFrame(()=>document.getElementById(`admin-alert-filter-${adminFilters[nextIndex].value}`)?.focus());
  };

  const confirmItem = async (item: NotificationViewModel) => {
    if (pending.current.has(item.public_id)) return;
    pending.current.add(item.public_id);
    const success = item.read || await markRead(item.public_id);
    pending.current.delete(item.public_id);
    if (!success) return;
    const target = targetFor(item);
    if (target) {
      setOpen(false);
      router.push(target);
    }
  };

  const confirmAll = async () => {
    if (!unreadItems.length || markingAll) return;
    setMarkingAll(true);
    for (const item of unreadItems) await markRead(item.public_id);
    setMarkingAll(false);
  };

  const badge = formatUnreadCount(unreadCount);
  const bellLabel = unreadCount ? `운영 알림 열기, 미확인 알림 ${unreadCount}개` : "운영 알림 열기, 미확인 알림 없음";

  return <div ref={rootRef} className={styles.popoverRoot}>
    <button ref={triggerRef} type="button" className={`header-bell ${styles.bell} ${styles.adminBell} ${unreadCount ? styles.hasUnread : ""} ${ringing?styles.ringing:""} ${hasUrgent?styles.hasUrgent:""}`} aria-label={bellLabel} aria-expanded={open} aria-haspopup="dialog" aria-controls="admin-notification-popover" onPointerEnter={event=>{if(event.pointerType==="mouse")ringOnce()}} onFocus={event=>{if(event.currentTarget.matches(":focus-visible"))ringOnce()}} onClick={() => {if(open)close();else{if(closeTimer.current!==null)window.clearTimeout(closeTimer.current);setClosing(false);setOpen(true)}}}>
      <BellIcon />{unreadCount > 0 && <b aria-hidden="true">{badge}</b>}
    </button>
    {(open||closing) && <>
      <button type="button" className={styles.mobileBackdrop} aria-label="운영 알림 닫기" onClick={close} />
      <section ref={panelRef} id="admin-notification-popover" data-state={closing?"closing":"open"} className={`${styles.popover} ${styles.adminResponder}`} role="dialog" aria-modal="false" aria-labelledby="admin-notification-title" onKeyDown={event=>{if(event.key!=="Tab")return;const nodes=panelRef.current?.querySelectorAll<HTMLElement>("button:not([disabled]),a[href]");if(!nodes?.length)return;const first=nodes[0],last=nodes[nodes.length-1];if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus()}else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus()}}}>
        <header className={styles.adminResponderHeader}>
          <div><span><h2 id="admin-notification-title">운영 알림</h2><b>미확인 {unreadCount}건</b></span><p>확인이 필요한 운영·보안 알림을 모았습니다.</p></div>
          <button type="button" className={styles.mobileClose} aria-label="운영 알림 닫기" onClick={close}><CloseIcon /></button>
        </header>
        <div className={styles.adminFilterTabs} role="tablist" aria-label="운영 알림 필터">{adminFilters.map((item,index)=><button id={`admin-alert-filter-${item.value}`} type="button" role="tab" aria-selected={filter===item.value} tabIndex={filter===item.value?0:-1} key={item.value} onClick={()=>changeFilter(item.value)} onKeyDown={event=>onFilterKey(event,index)}>{item.label}</button>)}</div>
        <div key={filter} ref={listRef} className={styles.adminResponderScroll} role="tabpanel" aria-label={`${adminFilters.find(item=>item.value===filter)?.label} 운영 알림`}>
          {loading && items.length === 0 ? <div className={styles.adminSkeleton} aria-label="관리 알림을 불러오는 중"><i /><i /><i /></div>
            : error && items.length === 0 ? <div className={styles.adminResponderEmpty} role="alert"><strong>운영 알림을 불러오지 못했습니다.</strong><p>잠시 후 다시 확인해 주세요.</p><button type="button" onClick={() => void refresh()}>다시 확인</button></div>
              : actionItems.length === 0 ? <div className={styles.adminResponderEmpty}><strong>새로운 운영 알림이 없습니다</strong><p>확인이 필요한 알림이 생기면 이곳에 표시됩니다.</p></div>
                : filteredItems.length===0?<div className={styles.adminResponderEmpty}><strong>선택한 조건에 해당하는 알림이 없습니다</strong><p>다른 필터에서 운영 알림을 확인해 주세요.</p></div>
                : <div className={styles.adminCompactList}>{filteredItems.map(item => <AdminCompactItem key={item.public_id} item={item} onConfirm={confirmItem} />)}</div>}
        </div>
        <footer className={styles.adminResponderFooter}>
          <button type="button" onClick={() => void confirmAll()} disabled={!unreadCount || markingAll}>{markingAll ? "처리 중…" : "모두 읽음"}</button>
          <Link href="/notifications" onClick={() => setOpen(false)}>전체 알림 보기 <span aria-hidden="true"><svg viewBox="0 0 24 24"><path d="m9 5 7 7-7 7"/></svg></span></Link>
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
  const severityLabel=item.severity==="CRITICAL"||item.severity==="HIGH"?"긴급":item.severity==="WARNING"?"주의":"정보";
  return <article className={`${styles.adminCompactItem} ${styles[`adminSeverity${item.severity}`]} ${!item.read ? styles.adminUnread : ""}`}>
    <button type="button" className={styles.adminInboxRow} aria-label={`${severityLabel} 알림, ${item.title}, ${formatRelativeTime(item.created_at)}${item.read?"":", 미확인"}`} onClick={() => void onConfirm(item)}>
      <span className={styles.adminSeverityIcon} role="img" aria-label={severityLabel}>
        <AdminNotificationTypeIcon item={item}/>
      </span>
      <span className={styles.adminInboxContent}>
        <span className={styles.adminInboxTitle}><strong>{item.title}</strong><time dateTime={item.created_at} title={formatExactKst(item.created_at)}>{formatRelativeTime(item.created_at)}</time>{!item.read&&<i aria-hidden="true"/>}</span>
        <span className={styles.adminInboxBody}>{item.body}</span>
        <span className={styles.adminInboxTarget}>{item.resource_label}<b aria-hidden="true"><svg viewBox="0 0 24 24"><path d="m9 5 7 7-7 7"/></svg></b></span>
      </span>
    </button>
  </article>;
}
