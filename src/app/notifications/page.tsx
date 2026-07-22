"use client";

import Link from "next/link";
import Image from "next/image";
import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { LandingHeader } from "@/components/landing/LandingHeader";
import { useAuth } from "@/components/auth/AuthContext";
import { useNotifications } from "@/features/notifications/NotificationContext";
import { NotificationTypeIcon } from "@/features/notifications/NotificationRow";
import {
  formatExactKst,
  formatRelativeTime,
  notificationNavigationLabel,
  notificationPresentation,
  sortNotificationQueue,
  notificationStateCopy,
  notificationTaskCopy,
  severityLabels,
} from "@/features/notifications/notificationDomain";
import type { NotificationSeverity, NotificationViewModel } from "@/features/notifications/notificationTypes";
import { resolveNotificationAudience, type NotificationAudienceView } from "@/features/notifications/notificationAudience";
import styles from "@/features/notifications/notifications.module.css";
import "@/components/landing/landing.css";

type View = NotificationAudienceView;
type Sort = "newest" | "oldest";
type TypeFilter = "ALL" | "INCIDENT" | "DISPATCH" | "COMPLETED";
const severities = ["ALL", "INFO", "WARNING", "HIGH", "CRITICAL"] as const;
const typeFilters = ["ALL", "INCIDENT", "DISPATCH", "COMPLETED"] as const;
const sorts: Sort[] = ["newest", "oldest"];

const CloseIcon = () => <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18" /></svg>;

function EmptyState({ view, general }: { view: View; general: boolean }) {
  const audience=resolveNotificationAudience(general?"GENERAL_USER":"CONTROLLER");
  const content = general
    ? [audience.emptyTitle, audience.emptyDescription]
    : view === "action"
      ? ["현재 처리할 업무가 없습니다", "전체 알림에서 최근 상태 변경을 확인할 수 있습니다."]
      : view === "unread"
        ? ["읽지 않은 알림이 없습니다", "모든 알림을 확인했습니다."]
        : ["새로운 업무 알림이 없습니다", "새로운 알림이 도착하면 이곳에서 확인할 수 있습니다."];
  return <div className={styles.empty}><span aria-hidden="true">✓</span><strong>{content[0]}</strong><p>{content[1]}</p></div>;
}

function NotificationDetail({ item, onNavigate, onClose, mobile, general }: {
  item: NotificationViewModel | null;
  onNavigate: (item: NotificationViewModel) => void;
  onClose: () => void;
  mobile: boolean;
  general: boolean;
}) {
  const audience=resolveNotificationAudience(general?"GENERAL_USER":"CONTROLLER");
  const [evidenceOpen, setEvidenceOpen] = useState(false);
  const evidenceTriggerRef = useRef<HTMLButtonElement>(null);
  const evidenceDialogRef = useRef<HTMLElement>(null);
  const evidenceCloseRef = useRef<HTMLButtonElement>(null);
  useEffect(() => setEvidenceOpen(false), [item?.public_id]);
  useEffect(() => { if (!evidenceOpen) return; const overflow = document.body.style.overflow; const returnFocus = evidenceTriggerRef.current; document.body.style.overflow = "hidden"; evidenceCloseRef.current?.focus(); const key = (event: KeyboardEvent) => { if (event.key === "Escape") { event.preventDefault(); setEvidenceOpen(false); return; } if (event.key !== "Tab") return; const focusable = evidenceDialogRef.current?.querySelectorAll<HTMLElement>('button:not([disabled]),a[href],[tabindex]:not([tabindex="-1"])'); if (!focusable?.length) return; const first = focusable[0], last = focusable[focusable.length - 1]; if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); } else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); } }; window.addEventListener("keydown", key); return () => { document.body.style.overflow = overflow; window.removeEventListener("keydown", key); returnFocus?.focus(); }; }, [evidenceOpen]);
  if (!item) return <aside className={styles.detailPanel}>{general&&<p className={styles.detailEyebrow}>{audience.detailTitle}</p>}<div className={styles.detailEmpty}><strong>선택된 알림이 없습니다</strong><p>{audience.detailEmptyDescription}</p></div></aside>;
  const presentation = notificationPresentation[item.notification_type];
  const actionLabel = notificationNavigationLabel(item);
  return <aside className={`${styles.detailPanel} ${mobile ? styles.mobileDetail : ""}`} aria-labelledby="notification-detail-title">
    {mobile && <header className={styles.mobileDetailHeader}><strong>{audience.detailTitle}</strong><button type="button" onClick={onClose} aria-label={`${audience.detailTitle} 닫기`}><CloseIcon /></button></header>}
    <header className={styles.detailHeader}>
      <p className={styles.detailEyebrow}>{audience.detailTitle}</p>
      <div className={`${styles.detailTitle} ${general ? styles.detailTitleGeneral : ""}`}>
        {!general && <span className={`${styles.typeIcon} ${styles[`severity${item.severity}`]}`}><NotificationTypeIcon kind={presentation.icon} /></span>}
        <div><h2 id="notification-detail-title">{general ? item.title : presentation.label}</h2><p>{!general && <><b>{severityLabels[item.severity]}</b><span>·</span><strong className={styles.taskState}>{notificationStateCopy(item)}</strong><span>·</span></>}<span className={styles.readLabel}>{item.read ? "읽음" : "읽지 않음"}</span><span>·</span><time dateTime={item.created_at} title={formatExactKst(item.created_at)}>{formatRelativeTime(item.created_at)}</time></p></div>
      </div>
      <p className={styles.detailBody}>{item.body}</p>
    </header>
    {audience.showOperationsControls&&<div className={styles.detailScroll}>
      <section className={styles.detailTask}><span>다음 처리</span><p>{notificationTaskCopy(item)}</p></section>
      <h3 className={styles.detailSectionTitle}>사건 정보</h3>
      <dl className={`${styles.detailFacts} ${styles.detailFactsPrimary}`}>
        <div><dt>관련 {item.resource.resource_type === "INCIDENT" ? "사건" : "출동"}</dt><dd>{item.resource_label}</dd></div>
        {item.evidence && <><div><dt>CCTV</dt><dd>{item.evidence.camera}</dd></div><div><dt>위치</dt><dd>{item.evidence.location}</dd></div></>}
        <div><dt>발생 시간</dt><dd><time dateTime={item.created_at}>{formatExactKst(item.created_at)}</time></dd></div>
      </dl>
      {item.evidence && <figure className={styles.evidence}>
        <figcaption><strong>AI 탐지 근거</strong><span>{item.evidence.objectLabel} · AI 신뢰도 {item.evidence.confidence}%</span></figcaption>
        <div className={styles.evidenceImage}>
          <Image src={item.evidence.imagePath} alt={`${item.evidence.camera} ${item.evidence.objectLabel} 탐지 근거`} fill sizes="(max-width: 767px) 100vw, 520px" />
          <span>{item.evidence.objectLabel} · {item.evidence.confidence}%</span>
          <button ref={evidenceTriggerRef} type="button" onClick={() => setEvidenceOpen(true)}>확대 보기</button>
        </div>
      </figure>}
    </div>}
    {audience.showOperationsControls&&actionLabel && item.target_path && <footer className={styles.detailAction}><button type="button" onClick={() => onNavigate(item)}>{item.resource.resource_type === "INCIDENT" ? "사건 열기" : actionLabel}</button></footer>}
    {evidenceOpen && item.evidence && <div className={styles.evidenceDialogBackdrop} role="presentation" onMouseDown={event => event.target === event.currentTarget && setEvidenceOpen(false)}><section ref={evidenceDialogRef} className={styles.evidenceDialog} role="dialog" aria-modal="true" aria-labelledby="evidence-dialog-title"><header><div><strong id="evidence-dialog-title">AI 탐지 근거</strong><span>{item.evidence.objectLabel} · AI 신뢰도 {item.evidence.confidence}%</span></div><button ref={evidenceCloseRef} type="button" onClick={() => setEvidenceOpen(false)} aria-label="AI 탐지 근거 확대 닫기"><CloseIcon /></button></header><div><Image src={item.evidence.imagePath} alt={`${item.evidence.camera} ${item.evidence.objectLabel} 확대 탐지 근거`} fill sizes="95vw" /></div></section></div>}
  </aside>;
}

function NotificationInbox() {
  const { user } = useAuth();
  const { items, unreadCount, actionCount, loading, error, refresh, markRead, markAllRead, targetFor, realtimeStatus } = useNotifications();
  const params = useSearchParams();
  const router = useRouter();
  const audience=useMemo(()=>resolveNotificationAudience(user?.role),[user?.role]);
  const general=audience.general;
  const requested = params.get("tab") as View | null;
  const defaultView: View = user?.role === "SYSTEM_ADMIN" || general ? "all" : "action";
  const [view, setView] = useState<View>(requested && audience.views.includes(requested) ? requested : defaultView);
  const requestedSeverity = params.get("severity") as NotificationSeverity | "ALL" | null;
  const requestedType = params.get("type") as TypeFilter | null;
  const requestedSort = params.get("sort") as Sort | null;
  const [severity, setSeverity] = useState<NotificationSeverity | "ALL">(requestedSeverity && severities.includes(requestedSeverity) ? requestedSeverity : "ALL");
  const [type, setType] = useState<TypeFilter>(requestedType && typeFilters.includes(requestedType) ? requestedType : "ALL");
  const [sort, setSort] = useState<Sort>(requestedSort && sorts.includes(requestedSort) ? requestedSort : "newest");
  const [selectedId, setSelectedId] = useState<string | null>(params.get("selected"));
  const [mobileDetailOpen, setMobileDetailOpen] = useState(Boolean(params.get("selected")));

  useEffect(() => {
    if(requested&&audience.views.includes(requested))setView(requested);
    else if(!audience.views.includes(view))setView(defaultView);
  }, [audience.views,defaultView,requested,view]);
  useEffect(() => {
    setSeverity(requestedSeverity && severities.includes(requestedSeverity) ? requestedSeverity : "ALL");
    setType(requestedType && typeFilters.includes(requestedType) ? requestedType : "ALL");
    setSort(requestedSort && sorts.includes(requestedSort) ? requestedSort : "newest");
    setSelectedId(params.get("selected"));
  }, [params, requestedSeverity, requestedSort, requestedType]);

  const replaceQuery = useCallback((updates: Record<string, string | null>) => {
    const next = new URLSearchParams(params.toString());
    Object.entries(updates).forEach(([key, value]) => value && value !== "ALL" && value !== "newest" ? next.set(key, value) : next.delete(key));
    const query = next.toString();
    router.replace(query ? `/notifications?${query}` : "/notifications", { scroll: false });
  }, [params, router]);
  const closeMobileDetail = useCallback(() => {
    setMobileDetailOpen(false);
    setSelectedId(null);
    replaceQuery({ selected: null });
  }, [replaceQuery]);
  const filtered = useMemo(() => {
    const byView = view === "action" ? items.filter(item => item.action_required) : view === "unread" ? items.filter(item => !item.read) : items;
    const matching = byView
      .filter(item => general||severity === "ALL" || item.severity === severity)
      .filter(item => general||type === "ALL"
        || type === "INCIDENT" && item.resource.resource_type === "INCIDENT" && item.notification_type !== "ACTION_COMPLETED"
        || type === "DISPATCH" && item.resource.resource_type === "DISPATCH"
        || type === "COMPLETED" && item.notification_type === "ACTION_COMPLETED");
    return sortNotificationQueue(matching, view, general?"newest":sort);
  }, [general,items, severity, sort, type, view]);
  const selected = useMemo(() => items.find(item => item.public_id === selectedId) ?? filtered[0] ?? null, [filtered, items, selectedId]);

  useEffect(() => {
    if (loading) return;
    if (selectedId && !items.some(item => item.public_id === selectedId)) {
      closeMobileDetail();
    } else if (selectedId && !filtered.some(item => item.public_id === selectedId)) {
      if (mobileDetailOpen) closeMobileDetail();
      else {
        setSelectedId(filtered[0]?.public_id ?? null);
        replaceQuery({ selected: filtered[0]?.public_id ?? null });
      }
    }
  }, [closeMobileDetail, filtered, items, loading, mobileDetailOpen, replaceQuery, selectedId]);
  useEffect(() => {
    if (!mobileDetailOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeMobileDetail();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [closeMobileDetail, mobileDetailOpen]);

  const selectView = (next: View) => {
    setView(next);
    setMobileDetailOpen(false);
    replaceQuery({ tab: next === defaultView ? null : next, selected: null });
  };
  const onTabKey = (event: React.KeyboardEvent<HTMLButtonElement>) => {
    if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
    event.preventDefault();
    const index = audience.views.indexOf(view);
    const next = event.key === "Home" ? audience.views[0] : event.key === "End" ? audience.views.at(-1)! : audience.views[(index + (event.key === "ArrowRight" ? 1 : audience.views.length-1)) % audience.views.length];
    selectView(next);
    window.requestAnimationFrame(() => document.getElementById(`notification-tab-${next}`)?.focus());
  };
  const selectItem = async (item: NotificationViewModel) => {
    setSelectedId(item.public_id);
    setMobileDetailOpen(true);
    replaceQuery({ selected: item.public_id });
    await markRead(item.public_id);
  };
  const navigate = (item: NotificationViewModel) => {
    const target = targetFor(item);
    if (target) router.push(target);
  };
  return <div className={styles.page}>
    <LandingHeader showSections={false} />
    <main className={styles.workspace}>
      <nav className={styles.breadcrumb} aria-label="현재 위치"><Link href="/">홈</Link><span>/</span><span>{audience.breadcrumb}</span></nav>
      <div className={styles.heading}><div><h1>{audience.pageTitle}</h1><p>{audience.pageDescription}</p></div><div className={styles.headingActions}><span>읽지 않음 <b>{unreadCount}</b></span><button type="button" onClick={() => void markAllRead()} disabled={unreadCount === 0}>모두 읽음</button></div></div>
      <section className={styles.inboxShell}>
        <header className={styles.inboxHeader}>
          <div className={styles.queueHeader}><div><h2>{audience.listTitle}</h2><p>{audience.listDescription??(realtimeStatus === "unavailable" ? "시연 알림 표시 중" : "알림 상태 확인 중")}</p></div></div>
          <div className={styles.queueTools}>
            <div className={styles.segmentedTabs} role="tablist" aria-label={general ? "알림 보기" : "업무 알림 보기"}>
              {audience.views.map(tab => <button key={tab} id={`notification-tab-${tab}`} type="button" role="tab" aria-selected={view === tab} aria-controls="notification-queue" tabIndex={view === tab ? 0 : -1} onClick={() => selectView(tab)} onKeyDown={onTabKey}>{tab === "action" ? "처리 필요" : tab === "all" ? "전체 알림" : "읽지 않음"} <b>{tab === "action" ? actionCount : tab === "all" ? items.length : unreadCount}</b></button>)}
            </div>
            {audience.showOperationsControls&&<div className={styles.filters}>
              <label><span>중요도</span><select value={severity} onChange={event => { const value = event.target.value as NotificationSeverity | "ALL"; setSeverity(value); replaceQuery({ severity: value }); }}><option value="ALL">전체</option><option value="CRITICAL">긴급</option><option value="HIGH">높음</option><option value="WARNING">주의</option><option value="INFO">일반</option></select></label>
              <label><span>유형</span><select value={type} onChange={event => { const value = event.target.value as TypeFilter; setType(value); replaceQuery({ type: value }); }}><option value="ALL">전체</option><option value="INCIDENT">사건</option><option value="DISPATCH">출동</option><option value="COMPLETED">조치 완료</option></select></label>
              {view === "action"
                ? <div className={styles.fixedSort}><span>정렬</span><strong>우선순위순</strong></div>
                : <label><span>정렬</span><select value={sort} onChange={event => { const value = event.target.value as Sort; setSort(value); replaceQuery({ sort: value }); }}><option value="newest">최신순</option><option value="oldest">오래된순</option></select></label>}
            </div>}
          </div>
        </header>
        <div className={styles.inboxBody}>
          <div className={styles.queuePanel}>
            <div id="notification-queue" className={styles.queueList} role="tabpanel" aria-labelledby={`notification-tab-${view}`}>
            {loading ? <div className={styles.queueSkeleton} aria-label="알림을 불러오는 중"><i /><i /><i /><i /></div>
              : error ? <div className={styles.error}><strong>알림을 불러오지 못했습니다</strong><p>{error}</p><button type="button" onClick={() => void refresh()}>다시 시도</button></div>
                : filtered.length === 0 ? <EmptyState view={view} general={Boolean(general)} />
                  : <ul className={styles.queueItems}>{filtered.map(item => {
                    const presentation = notificationPresentation[item.notification_type];
                    const isSelected = selected?.public_id === item.public_id;
                    return <li key={item.public_id}><button type="button" className={`${styles.queueItem} ${general ? styles.queueItemGeneral : ""} ${isSelected ? styles.queueItemSelected : ""} ${!item.read ? styles.queueItemUnread : ""}`} aria-pressed={isSelected} onClick={() => void selectItem(item)}>
                      <span className={styles.readState} aria-hidden="true" />
                      {!general && <span className={`${styles.typeIcon} ${styles[`severity${item.severity}`]}`}><NotificationTypeIcon kind={presentation.icon} /></span>}
                      <span className={styles.queueCopy}><span className={styles.queueTitle}><strong>{item.title}</strong><time dateTime={item.created_at} title={formatExactKst(item.created_at)}>{formatRelativeTime(item.created_at)}</time></span><span className={styles.queueBody}>{item.body}</span><span className={styles.queueMeta}>{general ? <em>{item.read ? "읽음" : "읽지 않음"}</em> : <><b>{severityLabels[item.severity]}</b><span>{item.resource_label}</span><strong>{notificationStateCopy(item)}</strong><em>{item.read ? "읽음" : "읽지 않음"}</em></>}</span><span className={styles.srState}>{item.read ? "읽음" : "읽지 않음"}</span></span>
                    </button></li>;
                  })}</ul>}
            </div>
          </div>
          <NotificationDetail item={selected} onNavigate={navigate} onClose={closeMobileDetail} mobile={mobileDetailOpen} general={general} />
        </div>
        {mobileDetailOpen && <button type="button" className={styles.detailBackdrop} aria-label="알림 상세 닫기" onClick={closeMobileDetail} />}
      </section>
    </main>
  </div>;
}

export default function NotificationsPage() {
  return <Suspense><NotificationInbox /></Suspense>;
}
