"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { LandingHeader } from "@/components/landing/LandingHeader";
import { NotificationTypeIcon } from "./NotificationRow";
import { useNotifications } from "./NotificationContext";
import {
  formatExactKst,
  formatRelativeTime,
  notificationPresentation,
  notificationVisualToneLabels,
  resolveNotificationVisualTone,
  systemAdminQueue,
} from "./notificationDomain";
import type { NotificationViewModel, NotificationVisualTone } from "./notificationTypes";
import styles from "./SystemAdminNotificationCenter.module.css";

type Tab = "pending" | "history";
type Filter = "ALL" | "URGENT" | "SECURITY" | "CHANGE";
const filters: { value: Filter; label: string; icon: "all" | NotificationVisualTone }[] = [
  { value: "ALL", label: "전체", icon: "all" },
  { value: "URGENT", label: "즉시 확인", icon: "URGENT" },
  { value: "SECURITY", label: "보안", icon: "SECURITY" },
  { value: "CHANGE", label: "권한 변경", icon: "CHANGE" },
];
function actionFor(item:NotificationViewModel){
  if(resolveNotificationVisualTone(item)==="SUCCESS"||item.severity==="INFO"&&item.notification_type==="SYSTEM_STATUS")return null;
  if(item.resource.resource_type==="SYSTEM"){
    if(/인증/.test(`${item.title} ${item.resource_label}`))return{label:"인증 서비스 상태 보기",href:"/admin",guidance:"인증 서비스의 현재 연결 상태와 최근 오류 기록을 확인해 주세요."};
    if(/알림|전달|전송/.test(`${item.title} ${item.body}`))return{label:"알림 전송 상태 보기",href:"/admin",guidance:"알림 전송 상태와 최근 지연 기록을 확인해 주세요."};
  }
  if(item.resource.resource_type==="ACCOUNT")return{label:"대상 계정 확인",href:"/admin/users",guidance:"대상 계정의 현재 상태와 최근 접근 기록을 확인해 주세요."};
  if(item.resource.resource_type==="ROLE")return{label:"권한 변경 내역 보기",href:"/admin/roles",guidance:"변경된 역할과 권한 범위가 적절한지 확인해 주세요."};
  if(item.resource.resource_type==="AUDIT")return{label:"변경 기록 보기",href:"/admin/audit-logs",guidance:"관련 감사 기록과 변경 내용을 확인해 주세요."};
  return null;
}

const MoreIcon = () => <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/></svg>;
const RefreshIcon = () => <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 7v5h-5M4 17v-5h5"/><path d="M18 10a7 7 0 0 0-12-3L4 9M6 14a7 7 0 0 0 12 3l2-2"/></svg>;
const BackIcon = () => <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m15 18-6-6 6-6"/></svg>;
const FilterIcon = ({ kind }: { kind: "all" | NotificationVisualTone }) => kind === "all"
  ? <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 8h14M5 12h14M5 16h9"/></svg>
  : kind === "URGENT"
    ? <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 4 3 20h18L12 4Z"/><path d="M12 9v5M12 17h.01"/></svg>
    : kind === "SECURITY"
      ? <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3 5 6v5c0 4.5 2.8 8 7 10 4.2-2 7-5.5 7-10V6l-7-3Z"/><path d="M12 8v5M12 16h.01"/></svg>
      : <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3 5 6v5c0 4.5 2.8 8 7 10 4.2-2 7-5.5 7-10V6l-7-3Z"/><path d="m9 12 2 2 4-4"/></svg>;

function itemMatchesFilter(item: NotificationViewModel, filter: Filter) {
  if (filter === "ALL") return true;
  const tone = resolveNotificationVisualTone(item);
  if (filter === "URGENT") return tone === "URGENT" || tone === "CAUTION";
  if (filter === "SECURITY") return tone === "SECURITY";
  return tone === "CHANGE";
}

export function SystemAdminNotificationCenter() {
  const { items, unreadCount, loading, error, refresh, markRead, markAllRead } = useNotifications();
  const params = useSearchParams();
  const router = useRouter();
  const tab: Tab = params.get("tab") === "history" || params.get("mode") === "history" ? "history" : "pending";
  const requestedFilter = params.get("type") as Filter | null;
  const filter: Filter = filters.some(item => item.value === requestedFilter) ? requestedFilter! : "ALL";
  const requestedId = params.get("notification") ?? params.get("selected");
  const [refreshing, setRefreshing] = useState(false);
  const [markingAll, setMarkingAll] = useState(false);
  const [lastRefresh, setLastRefresh] = useState(() => new Date());
  const [refreshError, setRefreshError] = useState<string | null>(null);
  const selectedTrigger = useRef<HTMLButtonElement | null>(null);
  const pendingReads=useRef(new Set<string>());

  const setQuery = useCallback((updates: Record<string, string | null>, push = true) => {
    const next = new URLSearchParams(params.toString());
    next.delete("mode");
    next.delete("selected");
    Object.entries(updates).forEach(([key, value]) => value && value !== "pending" && value !== "ALL" ? next.set(key, value) : next.delete(key));
    const target = `/notifications${next.size ? `?${next}` : ""}`;
    if (push) router.push(target, { scroll: false }); else router.replace(target, { scroll: false });
  }, [params, router]);

  const pendingItems = useMemo(() => items
    .filter(item => systemAdminQueue(item) !== "change")
    .sort((a, b) => {
      const queueRank = (item: NotificationViewModel) => systemAdminQueue(item) === "immediate" ? 0 : 1;
      return queueRank(a) - queueRank(b) || Date.parse(b.created_at) - Date.parse(a.created_at);
    }), [items]);
  const historyItems = useMemo(() => items
    .filter(item => systemAdminQueue(item) === "change")
    .sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at)), [items]);
  const source = tab === "pending" ? pendingItems : historyItems;
  const visible = useMemo(() => source.filter(item => itemMatchesFilter(item, filter)), [filter, source]);
  const counts = useMemo(() => Object.fromEntries(filters.map(option => [option.value, source.filter(item => itemMatchesFilter(item, option.value)).length])) as Record<Filter, number>, [source]);
  const selected = requestedId ? visible.find(item => item.public_id === requestedId) ?? null : null;

  useEffect(() => {
    if (loading || error || visible.length === 0 || selected) return;
    setQuery({ tab, type: filter, notification: visible[0].public_id }, false);
  }, [error, filter, loading, selected, setQuery, tab, visible]);
  useEffect(() => {
    if (!requestedId || selected) return;
    setQuery({ notification: visible[0]?.public_id ?? null }, false);
  }, [requestedId, selected, setQuery, visible]);
  useEffect(() => {
    if (!requestedId) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || window.innerWidth > 768) return;
      event.preventDefault();
      setQuery({ notification: null });
      window.requestAnimationFrame(() => selectedTrigger.current?.focus());
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [requestedId, setQuery]);
  useEffect(()=>{
    if(!selected||selected.read||pendingReads.current.has(selected.public_id))return;
    pendingReads.current.add(selected.public_id);
    void markRead(selected.public_id).finally(()=>pendingReads.current.delete(selected.public_id));
  },[markRead,selected]);

  const selectItem = (item: NotificationViewModel, trigger: HTMLButtonElement) => {
    selectedTrigger.current = trigger;
    setQuery({ notification: item.public_id });
  };
  const closeMobileDetail = () => {
    setQuery({ notification: null });
    window.requestAnimationFrame(() => selectedTrigger.current?.focus());
  };
  const doRefresh = async () => {
    if (refreshing) return;
    setRefreshing(true);
    setRefreshError(null);
    try {
      await refresh();
      setLastRefresh(new Date());
    } catch {
      setRefreshError("새로고침하지 못했습니다. 기존 알림은 그대로 유지됩니다.");
    } finally {
      setRefreshing(false);
    }
  };
  const readAll = async () => {
    if (markingAll || unreadCount === 0) return;
    setMarkingAll(true);
    try { await markAllRead(); } finally { setMarkingAll(false); }
  };
  const clearFilter = () => setQuery({ type: null, notification: source[0]?.public_id ?? null });

  return <div className={styles.page}>
    <LandingHeader showSections={false}/>
    <main className={styles.workspace}>
      <header className={styles.pageHeader}>
        <div className={styles.heading}><h1>운영 알림</h1><p>운영·보안·권한 변경 사항을 확인하고 필요한 조치를 진행합니다.</p></div>
        <div className={styles.headerTools}>
          {process.env.NODE_ENV === "development" && <span className={styles.mockBadge}>Mock</span>}
          <time dateTime={lastRefresh.toISOString()}>마지막 갱신 {lastRefresh.toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit", hour12: false })}</time>
          <button type="button" className={styles.refreshButton} disabled={refreshing} aria-busy={refreshing} onClick={() => void doRefresh()}><RefreshIcon/>{refreshing ? "갱신 중" : "새로고침"}</button>
          <button type="button" className={styles.moreButton} aria-label="운영 알림 추가 메뉴"><MoreIcon/></button>
        </div>
      </header>
      {refreshError && <p className={styles.refreshError} role="status">{refreshError}</p>}

      <div className={styles.controls}>
        <div className={styles.segments} role="tablist" aria-label="운영 알림 보기">
          <button type="button" role="tab" aria-selected={tab === "pending"} onClick={() => setQuery({ tab: null, type: null, notification: null })}>확인할 알림 <b>{pendingItems.length}</b></button>
          <button type="button" role="tab" aria-selected={tab === "history"} onClick={() => setQuery({ tab: "history", type: null, notification: null })}>변경 기록 <b>{historyItems.length}</b></button>
        </div>
        <div className={styles.filterBar}>
          <div className={styles.filters} aria-label="알림 유형 필터">
            {filters.map(option => <button key={option.value} type="button" aria-pressed={filter === option.value} data-filter-tone={option.icon} onClick={() => setQuery({ type: option.value, notification: null })}><FilterIcon kind={option.icon}/><span>{option.label}</span><b>{counts[option.value]}</b></button>)}
          </div>
          <button type="button" className={styles.readAllButton} disabled={unreadCount === 0 || markingAll} onClick={() => void readAll()}>{markingAll ? "처리 중" : "모두 읽음"}</button>
        </div>
      </div>

      <section className={styles.notificationWorkspace} aria-label="운영 알림 작업 공간">
        <section className={styles.queuePanel} aria-labelledby="notification-queue-title">
          <header><div><h2 id="notification-queue-title">확인할 알림</h2><p>우선순위가 높은 알림부터 표시됩니다.</p></div><b>{visible.length}건</b></header>
          <div className={styles.queueScroll}>
            {loading ? <QueueSkeleton/>
              : error ? <WorkspaceError message={error} onRetry={doRefresh}/>
                : visible.length === 0 ? <QueueEmpty filtered={source.length > 0} onReset={clearFilter}/>
                  : <ul className={styles.queueList} role="listbox" aria-label="운영 알림 대기열">{visible.map(item => <QueueItem key={item.public_id} item={item} selected={selected?.public_id === item.public_id} onSelect={selectItem}/>)}</ul>}
          </div>
        </section>
        <DetailPanel item={selected} loading={loading} onClose={closeMobileDetail}/>
      </section>
      {selected && <button type="button" className={styles.mobileBackdrop} aria-label="알림 상세 닫기" onClick={closeMobileDetail}/>}
    </main>
  </div>;
}

function QueueItem({ item, selected, onSelect }: { item: NotificationViewModel; selected: boolean; onSelect: (item: NotificationViewModel, trigger: HTMLButtonElement) => void }) {
  const tone = resolveNotificationVisualTone(item);
  const presentation = notificationPresentation[item.notification_type];
  return <li role="option" aria-selected={selected} data-tone={tone} className={`${styles.queueItem} ${!item.read ? styles.unread : styles.read} ${selected ? styles.selected : ""}`}>
    <button type="button" aria-current={selected ? "true" : undefined} onClick={event => onSelect(item, event.currentTarget)}>
      <span className={styles.typeIcon}><NotificationTypeIcon kind={presentation.icon}/></span>
      <span className={styles.itemCopy}>
        <span className={styles.itemTitle}><strong>{item.title}</strong><span><time dateTime={item.created_at} title={formatExactKst(item.created_at)}>{formatRelativeTime(item.created_at)}</time>{!item.read && <i aria-hidden="true"/>}</span></span>
        <span className={styles.itemBody}>{item.body}</span>
        <span className={styles.itemMeta}><b>{notificationVisualToneLabels[tone]}</b><span>{item.resource_label}</span></span>
        <span className={styles.srOnly}>{item.read ? "읽음" : "미확인"}</span>
      </span>
    </button>
  </li>;
}

function DetailPanel({ item, loading, onClose }: { item: NotificationViewModel | null; loading: boolean; onClose: () => void }) {
  const detailRef = useRef<HTMLElement>(null);
  useEffect(() => {
    if (!item || window.innerWidth > 768) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    detailRef.current?.focus();
    const trapFocus = (event: KeyboardEvent) => {
      if (event.key !== "Tab") return;
      const focusable = detailRef.current?.querySelectorAll<HTMLElement>('button:not([disabled]),a[href],[tabindex]:not([tabindex="-1"])');
      if (!focusable?.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    window.addEventListener("keydown", trapFocus);
    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener("keydown", trapFocus);
    };
  }, [item]);
  if (loading) return <aside className={styles.detailPanel}><DetailSkeleton/></aside>;
  if (!item) return <aside className={styles.detailPanel}><div className={styles.detailEmpty}><span aria-hidden="true"><FilterIcon kind="all"/></span><strong>확인할 알림을 선택해 주세요.</strong><p>왼쪽 목록에서 알림을 선택하면 상세 내용과 관련 조치를 확인할 수 있습니다.</p></div></aside>;
  const tone = resolveNotificationVisualTone(item);
  const presentation = notificationPresentation[item.notification_type];
  const action = actionFor(item);
  const supportingCopy=/인증 서비스 연결 장애/.test(item.title)?"운영 상태와 최근 오류 기록을 확인해 주세요.":null;
  return <aside ref={detailRef} tabIndex={-1} data-tone={tone} className={styles.detailPanel} aria-labelledby="selected-notification-title">
    <header className={styles.mobileDetailHeader}><button type="button" onClick={onClose}><BackIcon/> 알림 목록</button></header>
    <div className={styles.detailScroll}>
      <header className={styles.detailHeader}>
        <span className={styles.detailIcon}><NotificationTypeIcon kind={presentation.icon}/></span>
        <div><h2 id="selected-notification-title">{item.title}</h2><p className={styles.detailMeta}><b>{notificationVisualToneLabels[tone]}</b><span>{item.resource_label}</span><span>{formatRelativeTime(item.created_at)}</span><span>{item.read ? "읽음" : "미확인"}</span></p></div>
      </header>
      <div className={styles.detailBody}><p>{item.body}</p>{supportingCopy&&<p>{supportingCopy}</p>}</div>
      <dl className={styles.detailFacts}>
        <div><dt>관련 대상</dt><dd>{item.resource_label}</dd></div>
        <div><dt>발생 유형</dt><dd>{presentation.label}</dd></div>
        <div><dt>알림 상태</dt><dd>{item.read ? "읽음" : "미확인"}</dd></div>
        <div><dt>발생 시각</dt><dd><time dateTime={item.created_at}>{formatExactKst(item.created_at)}</time></dd></div>
      </dl>
      {action&&<section className={styles.recommendedAction}><h3>권장 조치</h3><p>{action.guidance}</p><Link href={action.href}>{action.label}</Link></section>}
    </div>
  </aside>;
}

function QueueEmpty({ filtered, onReset }: { filtered: boolean; onReset: () => void }) {
  return <div className={styles.empty}><span aria-hidden="true"><FilterIcon kind="all"/></span><strong>{filtered ? "선택한 조건에 맞는 알림이 없습니다." : "확인할 알림이 없습니다."}</strong><p>{filtered ? "필터를 초기화하고 전체 알림을 확인해 주세요." : "새로운 운영 알림이 도착하면 이곳에 표시됩니다."}</p>{filtered && <button type="button" onClick={onReset}>필터 초기화</button>}</div>;
}
function WorkspaceError({ message, onRetry }: { message: string; onRetry: () => Promise<void> }) {
  return <div className={styles.empty} role="alert"><strong>운영 알림을 불러오지 못했습니다.</strong><p>{message}</p><button type="button" onClick={() => void onRetry()}>다시 시도</button></div>;
}
function QueueSkeleton() {
  return <div className={styles.queueSkeleton} aria-label="알림을 불러오는 중"><i/><i/><i/><i/></div>;
}
function DetailSkeleton() {
  return <div className={styles.detailSkeleton} aria-label="알림 상세를 불러오는 중"><i/><i/><i/><i/></div>;
}
