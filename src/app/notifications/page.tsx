"use client";

import Link from "next/link";
import Image from "next/image";
import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { LandingHeader } from "@/components/landing/LandingHeader";
import { useAuth } from "@/components/auth/AuthContext";
import { useNotifications } from "@/features/notifications/NotificationContext";
import { NotificationRow, NotificationTypeIcon } from "@/features/notifications/NotificationRow";
import { resolveNotificationAudience } from "@/features/notifications/notificationAudience";
import {
  formatExactKst,
  formatRelativeTime,
  notificationNavigationLabel,
  notificationPresentation,
  sortNotificationQueue,
  notificationStateCopy,
  notificationTaskCopy,
  managerQueueGroup,
  managerTaskCopy,
  managerQueuePresentation,
  severityLabels,
  type ManagerQueueGroup,
  type NotificationSort,
} from "@/features/notifications/notificationDomain";
import type { NotificationSeverity, NotificationViewModel, SystemAdminNotificationCategory } from "@/features/notifications/notificationTypes";
import styles from "@/features/notifications/notifications.module.css";
import "@/components/landing/landing.css";

type View = "action" | "queue" | "all" | "unread";
type TypeFilter = "ALL" | "INCIDENT" | "DISPATCH" | "COMPLETED";
const controllerViews: View[] = ["action", "all", "unread"];
const managerViews: View[] = ["queue", "all"];
const severities = ["ALL", "INFO", "WARNING", "HIGH", "CRITICAL"] as const;
const typeFilters = ["ALL", "INCIDENT", "DISPATCH", "COMPLETED"] as const;
const sorts: NotificationSort[] = ["newest", "severity", "unread"];
const NOTIFICATION_PAGE_SIZE = 5;

const CloseIcon = () => <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18" /></svg>;

function EmptyState({ view, general, manager=false }: { view: View; general: boolean; manager?:boolean }) {
  const content = general
    ? ["새로운 알림이 없습니다", "계정과 서비스 관련 안내가 도착하면 이곳에서 확인할 수 있습니다."]
    : manager&&view==="queue"
      ? ["현재 관리가 필요한 업무가 없습니다.", "새로운 사건이나 주요 상태 변경이 발생하면 여기에 표시됩니다."]
      : manager&&view==="all"
        ? ["표시할 센터 알림이 없습니다.", "새로운 사건이나 주요 상태 변경이 발생하면 여기에 표시됩니다."]
    : view === "action"
      ? ["현재 처리할 업무가 없습니다", "전체 알림에서 최근 상태 변경을 확인할 수 있습니다."]
      : view === "unread"
        ? ["읽지 않은 알림이 없습니다", "모든 알림을 확인했습니다."]
        : ["새로운 업무 알림이 없습니다", "새로운 알림이 도착하면 이곳에서 확인할 수 있습니다."];
  return <div className={styles.empty}><span aria-hidden="true">✓</span><strong>{content[0]}</strong><p>{content[1]}</p></div>;
}

function NotificationPager({ total, page, onPage }: { total: number; page: number; onPage: (page: number) => void }) {
  const totalPages = Math.max(1, Math.ceil(total / NOTIFICATION_PAGE_SIZE));
  return <nav className={styles.queuePager} aria-label="알림 목록 탐색">
    <span aria-live="polite">총 {total}건 · {page + 1} / {totalPages}</span>
    <div><button type="button" disabled={page === 0} onClick={() => onPage(0)}>최근 알림</button><button type="button" disabled={page >= totalPages - 1} onClick={() => onPage(page + 1)}>이전 알림</button></div>
  </nav>;
}

function NotificationDetail({ item, onNavigate, onClose, mobile, manager=false }: {
  item: NotificationViewModel | null;
  onNavigate: (item: NotificationViewModel) => void;
  onClose: () => void;
  mobile: boolean;
  manager?:boolean;
}) {
  const [evidenceOpen, setEvidenceOpen] = useState(false);
  const [bodyExpanded, setBodyExpanded] = useState(false);
  const [detailsExpanded, setDetailsExpanded] = useState(false);
  const detailScrollRef = useRef<HTMLDivElement>(null);
  const evidenceTriggerRef = useRef<HTMLButtonElement>(null);
  const evidenceDialogRef = useRef<HTMLElement>(null);
  const evidenceCloseRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    setEvidenceOpen(false);
    setBodyExpanded(false);
    setDetailsExpanded(false);
    if (detailScrollRef.current) detailScrollRef.current.scrollTop = 0;
  }, [item?.public_id]);
  useEffect(() => { if (!evidenceOpen) return; const overflow = document.body.style.overflow; const returnFocus = evidenceTriggerRef.current; document.body.style.overflow = "hidden"; evidenceCloseRef.current?.focus(); const key = (event: KeyboardEvent) => { if (event.key === "Escape") { event.preventDefault(); setEvidenceOpen(false); return; } if (event.key !== "Tab") return; const focusable = evidenceDialogRef.current?.querySelectorAll<HTMLElement>('button:not([disabled]),a[href],[tabindex]:not([tabindex="-1"])'); if (!focusable?.length) return; const first = focusable[0], last = focusable[focusable.length - 1]; if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); } else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); } }; window.addEventListener("keydown", key); return () => { document.body.style.overflow = overflow; window.removeEventListener("keydown", key); returnFocus?.focus(); }; }, [evidenceOpen]);
  if (!item) return <aside className={styles.detailPanel}><div className={styles.detailEmpty}><strong>알림을 선택해 주세요</strong><p>목록에서 확인할 알림을 선택하면 업무 내용을 볼 수 있습니다.</p></div></aside>;
  const presentation = notificationPresentation[item.notification_type];
  const actionLabel = notificationNavigationLabel(item);
  const taskCopy=manager?managerTaskCopy(item)??notificationTaskCopy(item):notificationTaskCopy(item);
  const facts = [
    { label: item.resource.resource_type === "INCIDENT" ? "사건번호" : "출동번호", value: item.resource_label },
    item.evidence ? { label: "CCTV", value: item.evidence.camera } : null,
    item.evidence ? { label: "발생 위치", value: item.evidence.location } : null,
    { label: item.notification_type === "ACTION_COMPLETED" ? "완료 시각" : "탐지 시각", value: formatRelativeTime(item.created_at), dateTime: item.created_at },
  ].filter((fact): fact is { label: string; value: string; dateTime?: string } => Boolean(fact?.value));
  return <aside className={`${styles.detailPanel} ${mobile ? styles.mobileDetail : ""}`} aria-labelledby="notification-detail-title">
    {mobile && <header className={styles.mobileDetailHeader}><strong>{manager?"관리 상세":"업무 상세"}</strong><button type="button" onClick={onClose} aria-label={`${manager?"관리":"업무"} 상세 닫기`}><CloseIcon /></button></header>}
    <header className={styles.detailHeader}>
      <p className={styles.detailEyebrow}>{manager?"관리 상세":"업무 상세"}</p>
      <div className={styles.detailTitle}>
        <span className={`${styles.typeIcon} ${styles[`severity${item.severity}`]}`}><NotificationTypeIcon kind={presentation.icon} /></span>
        <div><div className={styles.detailTitleLine}><h2 id="notification-detail-title">{presentation.label}</h2><time dateTime={item.created_at} title={formatExactKst(item.created_at)}>{formatRelativeTime(item.created_at)}</time></div><p><b>{severityLabels[item.severity]}</b><span>·</span><strong className={styles.taskState}>{notificationStateCopy(item)}</strong></p></div>
      </div>
    </header>
    <div ref={detailScrollRef} className={styles.detailScroll}>
      <div className={styles.detailBodyBlock}><p id="notification-detail-body" className={`${styles.detailBody} ${bodyExpanded ? styles.detailBodyExpanded : ""}`}>{item.body}</p>
        {item.body.length > 65 && <button type="button" className={styles.detailTextToggle} aria-expanded={bodyExpanded} aria-controls="notification-detail-body" onClick={() => setBodyExpanded(value => !value)}>{bodyExpanded ? "내용 접기" : "내용 더보기"}</button>}
      </div>
      <section className={styles.detailTask}><span>지금 할 일</span><p>{taskCopy}</p></section>
      <dl className={`${styles.detailFacts} ${styles.detailFactsPrimary}`}>{facts.map(fact=><div key={fact.label}><dt>{fact.label}</dt><dd>{fact.dateTime?<time dateTime={fact.dateTime}>{fact.value}</time>:fact.value}</dd></div>)}</dl>
      <button type="button" className={styles.detailDisclosure} aria-expanded={detailsExpanded} aria-controls="notification-additional-details" onClick={() => setDetailsExpanded(value => !value)}>{detailsExpanded ? "상세 정보 접기" : "상세 정보 보기"}</button>
      <div id="notification-additional-details" className={styles.detailAdditional} hidden={!detailsExpanded}>
        <dl className={styles.detailFacts}>
          <div><dt>알림 유형</dt><dd>{presentation.label}</dd></div>
          <div><dt>수신 시각</dt><dd><time dateTime={item.delivered_at}>{formatExactKst(item.delivered_at)}</time></dd></div>
          {item.read_at&&<div><dt>읽음 시각</dt><dd><time dateTime={item.read_at}>{formatExactKst(item.read_at)}</time></dd></div>}
          <div><dt>관련 대상</dt><dd>{item.resource.resource_type === "INCIDENT" ? "사건" : "출동"}</dd></div>
        </dl>
      {item.evidence && <figure className={styles.evidence}>
        <figcaption><strong>AI 탐지 근거</strong><span>{item.evidence.objectLabel} · AI 신뢰도 {item.evidence.confidence}%</span></figcaption>
        <div className={styles.evidenceImage}>
          <Image src={item.evidence.imagePath} alt={`${item.evidence.camera} ${item.evidence.objectLabel} 탐지 근거`} fill sizes="(max-width: 767px) 100vw, 520px" />
          <span>{item.evidence.objectLabel} · {item.evidence.confidence}%</span>
          <button ref={evidenceTriggerRef} type="button" onClick={() => setEvidenceOpen(true)}>확대 보기</button>
        </div>
      </figure>}
      </div>
    </div>
    {actionLabel && item.target_path && <footer className={styles.detailAction}><button type="button" onClick={() => onNavigate(item)}>{item.resource.resource_type === "INCIDENT" ? "사건 열기" : actionLabel}</button></footer>}
    {evidenceOpen && item.evidence && <div className={styles.evidenceDialogBackdrop} role="presentation" onMouseDown={event => event.target === event.currentTarget && setEvidenceOpen(false)}><section ref={evidenceDialogRef} className={styles.evidenceDialog} role="dialog" aria-modal="true" aria-labelledby="evidence-dialog-title"><header><div><strong id="evidence-dialog-title">AI 탐지 근거</strong><span>{item.evidence.objectLabel} · AI 신뢰도 {item.evidence.confidence}%</span></div><button ref={evidenceCloseRef} type="button" onClick={() => setEvidenceOpen(false)} aria-label="AI 탐지 근거 확대 닫기"><CloseIcon /></button></header><div><Image src={item.evidence.imagePath} alt={`${item.evidence.camera} ${item.evidence.objectLabel} 확대 탐지 근거`} fill sizes="95vw" /></div></section></div>}
  </aside>;
}

function GeneralNotificationInbox(){
  const{items,unreadCount,loading,error,refresh,markRead,markAllRead,targetFor}=useNotifications();
  const router=useRouter();
  const[unreadOnly,setUnreadOnly]=useState(false);
  const[page,setPage]=useState(0);
  const visible=useMemo(()=>sortNotificationQueue(unreadOnly?items.filter(item=>!item.read):items,"newest"),[items,unreadOnly]);
  const pageItems=visible.slice(page*NOTIFICATION_PAGE_SIZE,(page+1)*NOTIFICATION_PAGE_SIZE);
  useEffect(()=>{if(page>Math.max(0,Math.ceil(visible.length/NOTIFICATION_PAGE_SIZE)-1))setPage(0)},[page,visible.length]);
  const changeView=(next:boolean)=>{setUnreadOnly(next);setPage(0)};
  const openItem=async(item:NotificationViewModel)=>{const read=await markRead(item.public_id);if(!read)return;const target=targetFor(item);if(target)router.push(target)};
  return <div className={styles.page}><LandingHeader showSections={false}/><main className={`${styles.workspace} ${styles.generalWorkspace}`}><nav className={styles.breadcrumb} aria-label="현재 위치"><Link href="/">홈</Link><span>/</span><span>알림</span></nav><div className={styles.heading}><div><h1>알림</h1><p>계정과 서비스 관련 안내를 확인할 수 있습니다</p></div><div className={styles.headingActions}><span>읽지 않음 <b>{unreadCount}</b></span><button type="button" onClick={()=>void markAllRead()} disabled={unreadCount===0}>모두 읽음</button></div></div><section className={styles.generalInbox}><header><div className={styles.segmentedTabs} role="tablist" aria-label="알림 보기"><button type="button" role="tab" aria-selected={!unreadOnly} onClick={()=>changeView(false)}>전체 알림 <b>{items.length}</b></button><button type="button" role="tab" aria-selected={unreadOnly} onClick={()=>changeView(true)}>새 알림 <b>{unreadCount}</b></button></div></header><div className={styles.generalList}>{loading?<div className={styles.queueSkeleton} aria-label="알림을 불러오는 중"><i/><i/><i/></div>:error?<div className={styles.error}><strong>알림을 불러오지 못했습니다</strong><p>{error}</p><button type="button" onClick={()=>void refresh()}>다시 시도</button></div>:visible.length===0?<EmptyState view={unreadOnly?"unread":"all"} general/>:<div>{pageItems.map(item=><NotificationRow key={item.public_id} item={item} onOpen={openItem} showOperationsMetadata={false}/>)}</div>}</div>{visible.length>5&&<NotificationPager total={visible.length} page={page} onPage={setPage}/>}</section></main></div>;
}

type AdminView="all"|"system"|"account"|"unread";
type AdminType="ALL"|SystemAdminNotificationCategory;
const adminViews:AdminView[]=["all","system","account","unread"];
const adminTypes:AdminType[]=["ALL","SYSTEM","ACCOUNT","ROLE","AUDIT"];
const adminViewLabels:Record<AdminView,string>={all:"전체 알림",system:"시스템 상태",account:"계정·권한",unread:"읽지 않음"};
const adminTypeLabels:Record<AdminType,string>={ALL:"전체",SYSTEM:"시스템 상태",ACCOUNT:"계정",ROLE:"역할·권한",AUDIT:"감사 기록"};

function SystemAdminNotificationInbox(){
  const{items,unreadCount,loading,error,refresh,markRead,markAllRead}=useNotifications();
  const params=useSearchParams();
  const router=useRouter();
  const requestedView=params.get("tab") as AdminView|null;
  const requestedType=params.get("type") as AdminType|null;
  const requestedSeverity=params.get("severity") as NotificationSeverity|"ALL"|null;
  const requestedSort=params.get("sort") as NotificationSort|null;
  const view=requestedView&&adminViews.includes(requestedView)?requestedView:"all";
  const type=requestedType&&adminTypes.includes(requestedType)?requestedType:"ALL";
  const severity=requestedSeverity&&severities.includes(requestedSeverity)?requestedSeverity:"ALL";
  const sort=requestedSort&&sorts.includes(requestedSort)?requestedSort:"newest";
  const selectedId=params.get("selected");
  const page=Math.max(0,Number(params.get("page")??0)||0);
  const replaceQuery=useCallback((updates:Record<string,string|null>)=>{
    const next=new URLSearchParams(params.toString());
    Object.entries(updates).forEach(([key,value])=>value&&value!=="ALL"&&value!=="newest"&&value!=="0"?next.set(key,value):next.delete(key));
    const query=next.toString();
    router.replace(query?`/notifications?${query}`:"/notifications",{scroll:false});
  },[params,router]);
  const filtered=useMemo(()=>sortNotificationQueue(items.filter(item=>{
    const category=item.admin_category;
    const matchesView=view==="all"||view==="unread"&&!item.read||view==="system"&&category==="SYSTEM"||view==="account"&&(category==="ACCOUNT"||category==="ROLE");
    return matchesView&&(type==="ALL"||category===type)&&(severity==="ALL"||item.severity===severity);
  }),sort),[items,severity,sort,type,view]);
  const totalPages=Math.max(1,Math.ceil(filtered.length/NOTIFICATION_PAGE_SIZE));
  const safePage=Math.min(page,totalPages-1);
  const pageItems=filtered.slice(safePage*NOTIFICATION_PAGE_SIZE,(safePage+1)*NOTIFICATION_PAGE_SIZE);
  const selected=selectedId?items.find(item=>item.public_id===selectedId)??null:null;
  const selectItem=async(item:NotificationViewModel)=>{
    replaceQuery({selected:item.public_id});
    await markRead(item.public_id);
  };
  const change=(updates:Record<string,string|null>)=>replaceQuery({...updates,page:null,selected:null});
  return <div className={styles.page}>
    <LandingHeader showSections={false}/>
    <main className={`${styles.workspace} ${styles.adminWorkspace}`}>
      <nav className={styles.breadcrumb} aria-label="현재 위치"><Link href="/">홈</Link><span>/</span><span>운영 알림</span></nav>
      <div className={styles.heading}><div><h1>운영 알림</h1><p>시스템 운영과 계정·권한 변경 사항을 확인합니다.</p></div><div className={styles.headingActions}><span>읽지 않음 <b>{unreadCount}</b></span><button type="button" aria-label="모든 운영 알림 읽음 처리" onClick={()=>void markAllRead()} disabled={unreadCount===0}>모두 읽음</button></div></div>
      <section className={styles.inboxShell}>
        <header className={styles.inboxHeader}>
          <div className={styles.queueHeader}><div><h2>운영 알림 목록</h2><p>시스템 상태와 계정·권한 변경 기록을 시간순으로 확인합니다.</p></div></div>
          <div className={styles.queueTools}>
            <div className={styles.segmentedTabs} role="tablist" aria-label="운영 알림 보기">
              {adminViews.map(tab=><button key={tab} type="button" role="tab" aria-selected={view===tab} tabIndex={view===tab?0:-1} onClick={()=>change({tab:tab==="all"?null:tab})}>{adminViewLabels[tab]} <b>{tab==="all"?items.length:tab==="unread"?unreadCount:items.filter(item=>tab==="system"?item.admin_category==="SYSTEM":["ACCOUNT","ROLE"].includes(item.admin_category??"")).length}</b></button>)}
            </div>
            <div className={styles.filters}>
              <label><span>중요도</span><select value={severity} onChange={event=>change({severity:event.target.value})}><option value="ALL">전체</option><option value="CRITICAL">긴급</option><option value="HIGH">높음</option><option value="WARNING">주의</option><option value="INFO">일반</option></select></label>
              <label><span>유형</span><select value={type} onChange={event=>change({type:event.target.value})}>{adminTypes.map(value=><option key={value} value={value}>{adminTypeLabels[value]}</option>)}</select></label>
              <label className={styles.sortControl}><span>정렬</span><select aria-label="운영 알림 정렬" value={sort} onChange={event=>change({sort:event.target.value})}><option value="newest">최신순</option><option value="severity">긴급도순</option><option value="unread">미열람순</option></select></label>
            </div>
          </div>
        </header>
        <div className={styles.inboxBody}>
          <div className={styles.queuePanel}><div id="admin-notification-list" className={styles.queueList} role="tabpanel">
            {loading?<div className={styles.queueSkeleton} aria-label="운영 알림을 불러오는 중"><i/><i/><i/><i/></div>:error?<div className={styles.error}><strong>운영 알림을 불러오지 못했습니다</strong><p>{error}</p><button type="button" onClick={()=>void refresh()}>다시 시도</button></div>:filtered.length===0?<div className={styles.empty}><strong>조건에 맞는 운영 알림이 없습니다</strong><p>필터를 변경해 다른 운영 기록을 확인해 주세요.</p></div>:<><ul className={styles.queueItems}>{pageItems.map(item=>{const presentation=notificationPresentation[item.notification_type];const isSelected=selected?.public_id===item.public_id;return <li key={item.public_id}><button type="button" className={`${styles.queueItem} ${isSelected?styles.queueItemSelected:""} ${!item.read?styles.queueItemUnread:""}`} aria-pressed={isSelected} onClick={()=>void selectItem(item)}><span className={styles.readState} aria-hidden="true"/><span className={`${styles.typeIcon} ${styles[`severity${item.severity}`]}`}><NotificationTypeIcon kind={presentation.icon}/></span><span className={styles.queueCopy}><span className={styles.queueTitle}><strong>{item.title}</strong><time dateTime={item.created_at}>{formatRelativeTime(item.created_at)}</time></span><span className={styles.queueBody}>{item.body}</span><span className={styles.queueMeta}><b>{severityLabels[item.severity]}</b><span>{adminTypeLabels[item.admin_category??"AUDIT"]}</span><span>{item.resource_label}</span><em>{item.read?"읽음":"읽지 않음"}</em></span></span></button></li>})}</ul>{filtered.length>NOTIFICATION_PAGE_SIZE&&<NotificationPager total={filtered.length} page={safePage} onPage={next=>replaceQuery({page:String(next),selected:null})}/>}</>}
          </div></div>
          <aside className={styles.detailPanel} aria-label="운영 알림 상세">{selected?<><header className={styles.detailHeader}><p className={styles.detailEyebrow}>운영 기록 상세</p><div className={styles.detailTitle}><span className={`${styles.typeIcon} ${styles[`severity${selected.severity}`]}`}><NotificationTypeIcon kind={notificationPresentation[selected.notification_type].icon}/></span><div><div className={styles.detailTitleLine}><h2>{selected.title}</h2><time dateTime={selected.created_at}>{formatRelativeTime(selected.created_at)}</time></div><p><b>{severityLabels[selected.severity]}</b><span>·</span><strong>{adminTypeLabels[selected.admin_category??"AUDIT"]}</strong></p></div></div></header><div className={styles.detailScroll}><div className={styles.detailBodyBlock}><p className={styles.detailBody}>{selected.body}</p></div><dl className={`${styles.detailFacts} ${styles.detailFactsPrimary}`}><div><dt>대상</dt><dd>{selected.resource_label}</dd></div><div><dt>유형</dt><dd>{adminTypeLabels[selected.admin_category??"AUDIT"]}</dd></div><div><dt>수신 시각</dt><dd><time dateTime={selected.delivered_at}>{formatExactKst(selected.delivered_at)}</time></dd></div><div><dt>상태</dt><dd>{selected.read?"읽음":"읽지 않음"}</dd></div></dl></div></>:<div className={styles.detailEmpty}><strong>운영 알림을 선택해 주세요</strong><p>목록에서 알림을 선택하면 시스템·계정 운영 기록을 확인할 수 있습니다.</p></div>}</aside>
        </div>
      </section>
    </main>
  </div>;
}

function OperationsNotificationInbox() {
  const { user } = useAuth();
  const { items, unreadCount, actionCount, loading, error, refresh, markRead, markAllRead, targetFor } = useNotifications();
  const params = useSearchParams();
  const router = useRouter();
  const manager=user?.role==="CONTROL_MANAGER";
  const roleViews=manager?managerViews:controllerViews;
  const requested = params.get("tab") as View | null;
  const defaultView: View = manager?"queue":user?.role === "SYSTEM_ADMIN" ? "all" : "action";
  const requestedView=requested==="unread"&&manager?"unread":requested&&roleViews.includes(requested)?requested:null;
  const [view, setView] = useState<View>(requestedView??defaultView);
  const requestedSeverity = params.get("severity") as NotificationSeverity | "ALL" | null;
  const requestedType = params.get("type") as TypeFilter | null;
  const requestedSort = params.get("sort") as NotificationSort | null;
  const [severity, setSeverity] = useState<NotificationSeverity | "ALL">(requestedSeverity && severities.includes(requestedSeverity) ? requestedSeverity : "ALL");
  const [type, setType] = useState<TypeFilter>(requestedType && typeFilters.includes(requestedType) ? requestedType : "ALL");
  const [sort, setSort] = useState<NotificationSort>(requestedSort && sorts.includes(requestedSort) ? requestedSort : "severity");
  const [selectedId, setSelectedId] = useState<string | null>(params.get("selected"));
  const [mobileDetailOpen, setMobileDetailOpen] = useState(Boolean(params.get("selected")));
  const [page, setPage] = useState(0);
  const [frozenListIds, setFrozenListIds] = useState<string[] | null>(null);
  const [pendingNewCount, setPendingNewCount] = useState(0);
  const previousItemIds = useRef<Set<string> | null>(null);
  const queueListRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setView(requestedView??defaultView);
  }, [defaultView,requestedView]);
  useEffect(() => {
    setSeverity(requestedSeverity && severities.includes(requestedSeverity) ? requestedSeverity : "ALL");
    setType(requestedType && typeFilters.includes(requestedType) ? requestedType : "ALL");
    setSort(requestedSort && sorts.includes(requestedSort) ? requestedSort : "severity");
    setSelectedId(params.get("selected"));
  }, [params, requestedSeverity, requestedSort, requestedType]);

  const replaceQuery = useCallback((updates: Record<string, string | null>) => {
    const next = new URLSearchParams(params.toString());
    Object.entries(updates).forEach(([key, value]) => value && value !== "ALL" && value !== "severity" ? next.set(key, value) : next.delete(key));
    const query = next.toString();
    router.replace(query ? `/notifications?${query}` : "/notifications", { scroll: false });
  }, [params, router]);
  const closeMobileDetail = useCallback(() => {
    setMobileDetailOpen(false);
    setSelectedId(null);
    replaceQuery({ selected: null });
  }, [replaceQuery]);
  const matchesCurrentFilters=useCallback((item:NotificationViewModel)=>{
    const matchesView=view==="queue"?managerQueueGroup(item)!==null:view==="action"?item.action_required:view==="unread"?!item.read:true;
    const matchesSeverity=severity==="ALL"||item.severity===severity;
    const matchesType=type==="ALL"
      ||type==="INCIDENT"&&item.resource.resource_type==="INCIDENT"&&item.notification_type!=="ACTION_COMPLETED"
      ||type==="DISPATCH"&&item.resource.resource_type==="DISPATCH"
      ||type==="COMPLETED"&&item.notification_type==="ACTION_COMPLETED";
    return matchesView&&matchesSeverity&&matchesType;
  },[severity,type,view]);
  const filtered=useMemo(()=>sortNotificationQueue(items.filter(matchesCurrentFilters),sort),[items,matchesCurrentFilters,sort]);
  const managerGroups=useMemo(()=>manager?(["immediate","action","complete"] as ManagerQueueGroup[]).map(group=>({group,items:filtered.filter(item=>managerQueueGroup(item)===group)})).filter(entry=>entry.items.length):[],[filtered,manager]);
  const historicalListIds=useMemo(()=>{
    if(page===0||!frozenListIds)return null;
    const byId=new Map(items.map(item=>[item.public_id,item]));
    return frozenListIds.filter(id=>{
      const item=byId.get(id);
      return Boolean(item&&matchesCurrentFilters(item));
    });
  },[frozenListIds,items,matchesCurrentFilters,page]);
  const listTotal=historicalListIds?.length??filtered.length;
  const pageItems = useMemo(() => {
    if (!historicalListIds) return filtered.slice(0, NOTIFICATION_PAGE_SIZE);
    const byId = new Map(items.map(item => [item.public_id, item]));
    return historicalListIds
      .slice(page * NOTIFICATION_PAGE_SIZE, (page + 1) * NOTIFICATION_PAGE_SIZE)
      .map(id => byId.get(id))
      .filter((item): item is NotificationViewModel => Boolean(item));
  }, [filtered, historicalListIds, items, page]);
  const selected = useMemo(() => selectedId ? items.find(item => item.public_id === selectedId) ?? null : null, [items, selectedId]);

  useEffect(() => {
    const currentIds = new Set(items.map(item => item.public_id));
    const previous = previousItemIds.current;
    if (previous && page > 0) {
      const arrived = items.filter(item => !previous.has(item.public_id) && matchesCurrentFilters(item)).length;
      if (arrived) setPendingNewCount(count => count + arrived);
    }
    previousItemIds.current = currentIds;
  }, [items, matchesCurrentFilters, page]);

  useEffect(() => {
    if (loading) return;
    if (selectedId && !items.some(item => item.public_id === selectedId)) {
      closeMobileDetail();
    }
  }, [closeMobileDetail, items, loading, selectedId]);
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
    setPage(0);
    setFrozenListIds(null);
    setPendingNewCount(0);
    setSelectedId(null);
    setMobileDetailOpen(false);
    replaceQuery({ tab: next === defaultView ? null : next, selected: null });
  };
  const resetListPosition = () => {
    setPage(0);
    setFrozenListIds(null);
    setPendingNewCount(0);
    setSelectedId(null);
    setMobileDetailOpen(false);
    if (queueListRef.current) queueListRef.current.scrollTop = 0;
  };
  const changePage = (nextPage: number) => {
    const snapshotIds=frozenListIds??filtered.map(item=>item.public_id);
    const total=historicalListIds?.length??filtered.length;
    const next = Math.max(0, Math.min(nextPage, Math.max(0, Math.ceil(total / NOTIFICATION_PAGE_SIZE) - 1)));
    setPage(next);
    setFrozenListIds(next === 0 ? null : snapshotIds);
    if (next === 0) setPendingNewCount(0);
    setSelectedId(null);
    setMobileDetailOpen(false);
    replaceQuery({ selected: null });
    if (queueListRef.current) queueListRef.current.scrollTop = 0;
  };
  useEffect(() => {
    if (page <= Math.max(0, Math.ceil(listTotal / NOTIFICATION_PAGE_SIZE) - 1)) return;
    setPage(0);
    setFrozenListIds(null);
    setPendingNewCount(0);
    if (queueListRef.current) queueListRef.current.scrollTop = 0;
  }, [listTotal, page]);
  const onTabKey = (event: React.KeyboardEvent<HTMLButtonElement>) => {
    if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
    event.preventDefault();
    const selectedTopView=manager&&view==="unread"?"all":view;
    const index = roleViews.indexOf(selectedTopView);
    const next = event.key === "Home" ? roleViews[0] : event.key === "End" ? roleViews.at(-1)! : roleViews[(index + (event.key === "ArrowRight" ? 1 : roleViews.length-1)) % roleViews.length];
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
      <nav className={styles.breadcrumb} aria-label="현재 위치"><Link href="/">홈</Link><span>/</span><span>{manager?"관제센터 알림":"업무 알림"}</span></nav>
      <div className={styles.heading}><div><h1>{manager?"관제센터 알림":"업무 알림"}</h1><p>{manager?"센터 전체 사건에서 확인이 필요한 관리 업무와 주요 상태 변경을 확인합니다.":"내 담당 사건과 즉시 처리해야 할 상태 변경을 확인합니다."}</p></div><div className={styles.headingActions}><span>읽지 않음 <b>{unreadCount}</b></span><button type="button" aria-label={manager?"모든 센터 알림 읽음 처리":"모든 업무 알림 읽음 처리"} onClick={() => void markAllRead()} disabled={unreadCount === 0}>모두 읽음</button></div></div>
      <section className={styles.inboxShell}>
        <header className={styles.inboxHeader}>
          <div className={styles.queueHeader}><div><h2>{manager?(view==="queue"?"관리 대기열":"센터 알림"):"알림 목록"}</h2><p>사건과 출동 관련 업무 알림을 확인합니다.</p></div></div>
          <div className={styles.queueTools}>
            <div className={styles.segmentedTabs} role="tablist" aria-label={manager?"관제센터 알림 보기":"업무 알림 보기"}>
              {roleViews.map(tab => {const selectedTab=view===tab||(manager&&tab==="all"&&view==="unread");const label=tab==="queue"?"관리 대기열":tab==="action"?"내 처리 업무":tab==="unread"?"새 알림":manager?"센터 알림":"전체 알림";const count=tab==="queue"?items.filter(item=>managerQueueGroup(item)!==null).length:tab==="action"?actionCount:tab==="unread"?unreadCount:items.length;return <button key={tab} id={`notification-tab-${tab}`} type="button" role="tab" aria-selected={selectedTab} aria-controls="notification-queue" tabIndex={selectedTab ? 0 : -1} onClick={() => selectView(tab)} onKeyDown={onTabKey}>{label} <b>{count}</b></button>})}
            </div>
            {manager&&view!=="queue"&&<div className={styles.centerFilters} aria-label="센터 알림 읽음 필터"><button type="button" aria-pressed={view==="all"} onClick={()=>selectView("all")}>전체</button><button type="button" aria-pressed={view==="unread"} onClick={()=>selectView("unread")}>새 알림 <b>{unreadCount}</b></button></div>}
            <div className={styles.filters}>
              <label><span>중요도</span><select value={severity} onChange={event => { const value = event.target.value as NotificationSeverity | "ALL"; setSeverity(value); resetListPosition(); replaceQuery({ severity: value, selected:null }); }}><option value="ALL">전체</option><option value="CRITICAL">긴급</option><option value="HIGH">주의</option><option value="WARNING">주의</option><option value="INFO">일반</option></select></label>
              <label><span>유형</span><select value={type} onChange={event => { const value = event.target.value as TypeFilter; setType(value); resetListPosition(); replaceQuery({ type: value, selected:null }); }}><option value="ALL">전체</option><option value="INCIDENT">사건</option><option value="DISPATCH">출동</option><option value="COMPLETED">조치 완료</option></select></label>
              <label className={styles.sortControl}><span>정렬</span><select aria-label="알림 정렬" value={sort} onChange={event => { const value = event.target.value as NotificationSort; setSort(value); resetListPosition(); replaceQuery({ sort: value, selected:null }); }}><option value="newest">최신순</option><option value="severity">긴급도순</option><option value="unread">미열람순</option></select></label>
            </div>
          </div>
        </header>
        <div className={styles.inboxBody}>
          <div className={styles.queuePanel}>
            <div ref={queueListRef} id="notification-queue" className={styles.queueList} role="tabpanel" aria-labelledby={`notification-tab-${manager&&view==="unread"?"all":view}`}>
            {pendingNewCount>0&&page>0&&<button type="button" className={styles.newNotificationsNotice} onClick={()=>changePage(0)}>새 알림 {pendingNewCount}건이 도착했습니다.</button>}
            {loading ? <div className={styles.queueSkeleton} aria-label="알림을 불러오는 중"><i /><i /><i /><i /></div>
              : error ? <div className={styles.error}><strong>알림을 불러오지 못했습니다</strong><p>{error}</p><button type="button" onClick={() => void refresh()}>다시 시도</button></div>
                : filtered.length === 0 ? <EmptyState view={view} general={false} manager={manager} />
                  : <>{manager&&view==="queue"&&<div className={styles.managerSummary} aria-label="관리 대기열 요약">{managerGroups.map(({group,items:groupItems})=><div key={group} data-group={group}><span>{managerQueuePresentation[group].label}</span><b aria-label={`${managerQueuePresentation[group].label} ${groupItems.length}건`}>{groupItems.length}</b></div>)}</div>}<ul className={styles.queueItems}>{pageItems.map(item => {
                    const presentation = notificationPresentation[item.notification_type];
                    const isSelected = selected?.public_id === item.public_id;
                    return <li key={item.public_id}><button type="button" className={`${styles.queueItem} ${isSelected ? styles.queueItemSelected : ""} ${!item.read ? styles.queueItemUnread : ""}`} aria-pressed={isSelected} onClick={() => void selectItem(item)}>
                      <span className={styles.readState} aria-hidden="true" />
                      <span className={`${styles.typeIcon} ${styles[`severity${item.severity}`]}`}><NotificationTypeIcon kind={presentation.icon} /></span>
                      <span className={styles.queueCopy}><span className={styles.queueTitle}><strong>{item.title}</strong><time dateTime={item.created_at} title={formatExactKst(item.created_at)}>{formatRelativeTime(item.created_at)}</time></span><span className={styles.queueBody}>{item.body}</span><span className={styles.queueMeta}>{manager&&view==="queue"&&managerQueueGroup(item)&&<b data-manager-group={managerQueueGroup(item)!}>{managerQueuePresentation[managerQueueGroup(item)!].label}</b>}<b>{severityLabels[item.severity]}</b><span>{item.resource_label}</span><strong>{notificationStateCopy(item)}</strong><em>{item.read ? "읽음" : "읽지 않음"}</em></span><span className={styles.srState}>{item.read ? "읽음" : "읽지 않음"}</span></span>
                    </button></li>;
                  })}</ul>{listTotal>5&&<NotificationPager total={listTotal} page={page} onPage={changePage}/>}</>}
            </div>
          </div>
          <NotificationDetail item={selected} onNavigate={navigate} onClose={closeMobileDetail} mobile={mobileDetailOpen} manager={manager} />
        </div>
        {mobileDetailOpen && <button type="button" className={styles.detailBackdrop} aria-label="알림 상세 닫기" onClick={closeMobileDetail} />}
      </section>
    </main>
  </div>;
}

export default function NotificationsPage() {
  return <Suspense><NotificationAudienceInbox /></Suspense>;
}

function NotificationAudienceInbox(){
  const{user}=useAuth();
  const audience=resolveNotificationAudience(user);
  return audience.systemAdmin?<SystemAdminNotificationInbox/>:audience.general?<GeneralNotificationInbox/>:<OperationsNotificationInbox/>;
}
