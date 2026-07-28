"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { LandingHeader } from "@/components/landing/LandingHeader";
import { incidentStatusLabel, riskLabel } from "@/features/control-dashboard/dashboardDomain";
import { directionLabel, objectCategoryLabel } from "@/features/control-dashboard/dashboardMapper";
import { createIncidentManagementRepository } from "./incidentManagementRepository";
import {
  formatDateRange, INCIDENT_PAGE_SIZE, incidentResultRange, isArchiveEligible, kstDateBoundaryToUtc, queryFromSearchParams,
  queryToSearchParams, sortOptions, statusForIncidentTab, utcBoundaryToKstDate, visibleIncidentPages,
} from "./incidentManagementDomain";
import type {
  IncidentListQuery, IncidentListResult, IncidentListTab, IncidentManagementItem, RiskFilter, StatusFilter,
} from "./incidentManagementTypes";
import "./incidentManagement.css";

const repository = createIncidentManagementRepository();
const statusOptions: { value: StatusFilter; label: string }[] = [
  { value: "ALL", label: "전체 상태" }, { value: "OPEN", label: "확인·담당 지정" },
  { value: "REVIEW", label: "관제 검토" }, { value: "DISPATCH", label: "출동·현장 조치" },
  { value: "DONE", label: "완료·종료" },
];
const riskOptions: { value: RiskFilter; label: string }[] = [
  { value: "ALL", label: "전체 위험도" }, { value: "CRITICAL", label: "긴급" },
  { value: "HIGH", label: "높음" }, { value: "MEDIUM", label: "보통" }, { value: "LOW", label: "낮음" },
];
const tabCopy: Record<IncidentListTab, { label: string; empty: string; description?: string }> = {
  active: { label: "운영 사건", empty: "현재 처리 중인 사건이 없습니다." },
  closed: { label: "종료 사건", empty: "종료된 사건이 없습니다." },
  archived: { label: "보관함", empty: "보관된 사건이 없습니다.", description: "종료 사건을 정리하면 이곳에서 확인하고 복원할 수 있습니다." },
};

function initialQuery() {
  return queryFromSearchParams(typeof window === "undefined" ? new URLSearchParams() : new URLSearchParams(window.location.search));
}
function dateParts(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return { date: "시각 정보 없음", time: "" };
  const parts = Object.fromEntries(new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul", year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", hour12: false,
  }).formatToParts(date).map(part => [part.type, part.value]));
  const currentYear = new Intl.DateTimeFormat("en", { timeZone: "Asia/Seoul", year: "numeric" }).format(new Date());
  return { date: `${parts.year === currentYear ? "" : `${parts.year}. `}${parts.month}. ${parts.day}`, time: `${parts.hour}:${parts.minute} KST` };
}
function DateCell({ value }: { value: string }) {
  const parts = dateParts(value);
  return <time className="incident-management-date" dateTime={value}><span>{parts.date}</span><small>{parts.time}</small></time>;
}
function DateRangeLabel({ from, to }: { from: string; to: string }) {
  const full = formatDateRange(from, to);
  if (!from || !to) return full;
  const compact = `${from.slice(5).replace("-", ".")} ~ ${to.slice(5).replace("-", ".")}`;
  return <><span className="date-range-full">{full}</span><span className="date-range-compact">{compact}</span></>;
}
function Icon({ name }: { name: "list" | "archive" | "restore" | "close" | "calendar" | "check" }) {
  const paths = {
    list: <><path d="M9 6h11M9 12h11M9 18h11"/><path d="m3.5 6 1 1 2-2M3.5 12l1 1 2-2M3.5 18l1 1 2-2"/></>,
    archive: <><path d="M4 7h16v13H4zM3 3h18v4H3z"/><path d="M9 11h6"/></>,
    restore: <><path d="M4 7h16v13H4zM3 3h18v4H3z"/><path d="M12 16v-5m0 0-2 2m2-2 2 2"/></>,
    close: <path d="m6 6 12 12M18 6 6 18"/>,
    calendar: <><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 10h18"/></>,
    check: <path d="m5 12 4 4L19 6"/>,
  };
  return <svg aria-hidden="true" viewBox="0 0 24 24">{paths[name]}</svg>;
}

export function ArchiveSuccessBar({count,onView,onDismiss}:{count:number;onView:()=>void;onDismiss:()=>void}) {
  const [paused,setPaused]=useState(false);
  useEffect(()=>{
    if(paused)return;
    const timer=window.setTimeout(onDismiss,5000);
    return()=>window.clearTimeout(timer);
  },[count,onDismiss,paused]);
  return <section
    className="archive-success"
    role="status"
    aria-live="polite"
    aria-atomic="true"
    onMouseEnter={()=>setPaused(true)}
    onMouseLeave={()=>setPaused(false)}
    onFocusCapture={()=>setPaused(true)}
    onBlurCapture={event=>{if(!event.currentTarget.contains(event.relatedTarget))setPaused(false)}}
  >
    <span className="archive-success__icon"><Icon name="check"/></span>
    <div><strong>보관함으로 이동 완료</strong><p>선택한 사건 {count}건이 보관함으로 이동되었습니다.</p></div>
    <button type="button" className="archive-success__view" aria-label="보관함 보기" onClick={onView}><span className="archive-success__view-desktop">보관함 보기</span><span className="archive-success__view-mobile" aria-hidden="true">보기</span></button>
    <button type="button" className="archive-success__close" aria-label="보관함 이동 완료 안내 닫기" onClick={onDismiss}><Icon name="close"/></button>
  </section>;
}

export function IncidentManagementPage() {
  const [query, setQuery] = useState<IncidentListQuery>(initialQuery);
  const [result, setResult] = useState<IncidentListResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [management, setManagement] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [dateOpen, setDateOpen] = useState(false);
  const [dateDraft, setDateDraft] = useState({ from: utcBoundaryToKstDate(query.from), to: utcBoundaryToKstDate(query.to) });
  const [dateError, setDateError] = useState("");
  const [dialog, setDialog] = useState<"archive" | "restore" | null>(null);
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [toast, setToast] = useState("");
  const [archiveSuccess,setArchiveSuccess]=useState<number|null>(null);
  const headerCheckbox = useRef<HTMLInputElement>(null);
  const dateTriggerRef = useRef<HTMLButtonElement>(null);
  const datePopoverRef = useRef<HTMLDivElement>(null);
  const dateCloseRef = useRef<HTMLButtonElement>(null);
  const tableRef = useRef<HTMLDivElement>(null);
  const requestSequence = useRef(0);
  const historyMode = useRef<"push"|"replace">("replace");
  const tabPages = useRef<Record<IncidentListTab,number>>({
    active:query.tab==="active"?query.page:1,
    closed:query.tab==="closed"?query.page:1,
    archived:query.tab==="archived"?query.page:1,
  });

  const load = useCallback(async (next: IncidentListQuery) => {
    const sequence=++requestSequence.current;
    setLoading(true); setError("");
    try {
      const response=await repository.list(next);
      if(sequence!==requestSequence.current)return;
      const lastPage=Math.max(1,response.totalPages);
      if(next.page>lastPage){
        tabPages.current[next.tab]=lastPage;
        historyMode.current="replace";
        setQuery(current=>current.tab===next.tab?{...current,page:lastPage}:current);
        return;
      }
      setResult(response);
    }
    catch (caught) { if(sequence===requestSequence.current)setError(caught instanceof Error ? caught.message : "사건 목록을 불러오지 못했습니다."); }
    finally { if(sequence===requestSequence.current)setLoading(false); }
  }, []);
  useEffect(() => { void load(query); }, [load, query]);
  useEffect(() => {
    const sync = () => { const next = queryFromSearchParams(new URLSearchParams(window.location.search)); tabPages.current[next.tab]=next.page; setQuery(next); setSelected(new Set()); setManagement(false); setArchiveSuccess(null); };
    window.addEventListener("popstate", sync); return () => window.removeEventListener("popstate", sync);
  }, []);
  useEffect(() => {
    const params = queryToSearchParams(query);
    const next = `${window.location.pathname}${params.size ? `?${params}` : ""}`;
    if (`${window.location.pathname}${window.location.search}` !== next) window.history[historyMode.current==="push"?"pushState":"replaceState"](null, "", next);
    historyMode.current="replace";
  }, [query]);

  const updateQuery = (patch: Partial<IncidentListQuery>, options?:{pageNavigation?:boolean}) => {
    historyMode.current=options?.pageNavigation?"push":"replace";
    if(!options?.pageNavigation)tabPages.current={active:1,closed:1,archived:1};
    setQuery(current => {
      const next={ ...current, ...patch, page: patch.page ?? 1, size:INCIDENT_PAGE_SIZE };
      next.status=statusForIncidentTab(next.tab,next.status);
      tabPages.current[next.tab]=next.page;
      return next;
    });
    setSelected(new Set());
  };
  const items = useMemo(() => result?.items ?? [], [result?.items]);
  const selectable = useMemo(() => items.filter(item => query.tab === "archived" || isArchiveEligible(item)), [items, query.tab]);
  const allSelected = selectable.length > 0 && selectable.every(item => selected.has(item.public_id));
  const someSelected = selectable.some(item => selected.has(item.public_id)) && !allSelected;
  useEffect(() => { if (headerCheckbox.current) headerCheckbox.current.indeterminate = someSelected; }, [someSelected]);
  const sortLabel = sortOptions.find(option => option.value === query.sort)?.label ?? "우선순위순";
  const pageNumbers=useMemo(()=>visibleIncidentPages(query.page,result?.totalPages??0),[query.page,result?.totalPages]);
  const resultRange=result?incidentResultRange(query.page,result.size,result.totalElements):"0건";
  const returnTo=useMemo(()=>{
    const params=queryToSearchParams(query);
    return `/control/incidents${params.size?`?${params}`:""}`;
  },[query]);

  const changeTab = (tab: IncidentListTab) => {
    historyMode.current="push";
    setQuery(current=>{tabPages.current[current.tab]=current.page;return{...current,tab,status:statusForIncidentTab(tab,current.status),page:tabPages.current[tab],size:INCIDENT_PAGE_SIZE}});
    setManagement(false); setSelected(new Set()); setArchiveSuccess(null);
  };
  const changePage=(page:number)=>{
    if(loading||page===query.page)return;
    updateQuery({page},{pageNavigation:true});
    window.requestAnimationFrame(()=>tableRef.current?.scrollIntoView({block:"start"}));
  };
  const exitManagement = () => { setManagement(false); setSelected(new Set()); setArchiveSuccess(null); };
  const enterManagement = () => { setArchiveSuccess(null); setSelected(new Set()); setManagement(true); };
  const toggleOne = (id: string) => setSelected(current => {
    const next = new Set(current); if (next.has(id)) next.delete(id); else next.add(id); return next;
  });
  const togglePage = () => setSelected(allSelected ? new Set() : new Set(selectable.map(item => item.public_id)));
  const appliedDate = useMemo(
    () => ({ from: utcBoundaryToKstDate(query.from), to: utcBoundaryToKstDate(query.to) }),
    [query.from, query.to],
  );
  const dateInvalid = !dateDraft.from || !dateDraft.to || dateDraft.from > dateDraft.to;
  const dateRangeError = dateDraft.from && dateDraft.to && dateDraft.from > dateDraft.to
    ? "시작일은 종료일보다 늦을 수 없습니다."
    : "";
  const getPresetRange = useCallback((days: number) => {
    const parts = Object.fromEntries(new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Seoul", year: "numeric", month: "2-digit", day: "2-digit",
    }).formatToParts(new Date()).map(part => [part.type, part.value]));
    const end = `${parts.year}-${parts.month}-${parts.day}`;
    const startDate = new Date(`${end}T12:00:00+09:00`);
    startDate.setUTCDate(startDate.getUTCDate() - (days - 1));
    const startParts = Object.fromEntries(new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Seoul", year: "numeric", month: "2-digit", day: "2-digit",
    }).formatToParts(startDate).map(part => [part.type, part.value]));
    return { from: `${startParts.year}-${startParts.month}-${startParts.day}`, to: end };
  }, []);
  const selectedPreset = [1, 7, 30].find(days => {
    const range = getPresetRange(days);
    return range.from === dateDraft.from && range.to === dateDraft.to;
  });
  const closeDatePopover = useCallback(() => {
    setDateDraft(appliedDate);
    setDateError("");
    setDateOpen(false);
    window.requestAnimationFrame(() => dateTriggerRef.current?.focus());
  }, [appliedDate]);
  const openDatePopover = () => {
    setDateDraft(appliedDate);
    setDateError("");
    setDateOpen(true);
  };
  useEffect(() => {
    if (!dateOpen) return;
    window.requestAnimationFrame(() => dateCloseRef.current?.focus());
    const onPointerDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (!datePopoverRef.current?.contains(target) && !dateTriggerRef.current?.contains(target)) closeDatePopover();
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        closeDatePopover();
        return;
      }
      if (event.key !== "Tab" || !datePopoverRef.current) return;
      const focusable = [...datePopoverRef.current.querySelectorAll<HTMLElement>("button:not(:disabled), input:not(:disabled)")];
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [closeDatePopover, dateOpen]);
  const applyDate = () => {
    if (dateInvalid) { setDateError(dateRangeError); return; }
    setDateError(""); setDateOpen(false);
    updateQuery({
      from: dateDraft.from ? kstDateBoundaryToUtc(dateDraft.from) : undefined,
      to: dateDraft.to ? kstDateBoundaryToUtc(dateDraft.to, true) : undefined,
    });
    window.requestAnimationFrame(() => dateTriggerRef.current?.focus());
  };
  const presetDate = (days: number) => {
    setDateDraft(getPresetRange(days)); setDateError("");
  };
  const clearAppliedDate = () => {
    if (!query.from && !query.to) return;
    setDateDraft({ from: "", to: "" });
    setDateError("");
    setDateOpen(false);
    updateQuery({ from: undefined, to: undefined });
    window.requestAnimationFrame(() => dateTriggerRef.current?.focus());
  };
  const resetFilters = () => {
    setDateDraft({ from: "", to: "" }); setDateError("");
    updateQuery({ keyword: "", status: "ALL", risk: "ALL", from: undefined, to: undefined, sort: "priority,desc" });
  };
  const submitBulk = async () => {
    if (!dialog || !selected.size || submitting) return;
    setSubmitting(true); setError("");
    try {
      if (dialog === "archive") await repository.archive([...selected], reason.trim() || undefined);
      else await repository.restore([...selected]);
      const count = selected.size;
      if(dialog==="archive"){
        setArchiveSuccess(count);
        setSelected(new Set());
      }else{
        setToast(`사건 ${count}건을 종료 사건 목록으로 복원했습니다.`);
        exitManagement();
      }
      setDialog(null); setReason("");
      const nextPage = items.length === count && query.page > 1 ? query.page - 1 : query.page;
      const next = { ...query, page: nextPage }; tabPages.current[query.tab]=nextPage; historyMode.current="replace"; setQuery(next);
    } catch (caught) { setError(caught instanceof Error ? caught.message : "요청을 처리하지 못했습니다."); }
    finally { setSubmitting(false); }
  };

  return <div className="incident-management-page"><LandingHeader showSections={false}/><main className="incident-management-shell">
    <header className="incident-management-heading"><div><span>INCIDENT MANAGEMENT</span><h1>사건 관리</h1><p>전체 사건의 상태와 담당자, 위험도를 조회하고 상세 처리 화면으로 이동합니다.</p></div><button type="button" disabled={loading} onClick={() => void load(query)}>{loading ? "새로고침 중" : "목록 새로고침"}</button></header>
    <section className="incident-management-summary" aria-label="사건 요약">
      <article><span>조회 결과</span><strong>{result?.totalElements ?? 0}</strong></article>
      <article><span>운영 사건</span><strong>{result?.counts.active ?? "—"}</strong></article>
      <article><span>종료 사건</span><strong>{result?.counts.closed ?? "—"}</strong></article>
      <article><span>보관 사건</span><strong>{result?.counts.archived ?? "—"}</strong></article>
    </section>
    <section className="incident-management-list">
      <header className="incident-list-toolbar"><div><h2>{query.tab === "archived" ? "보관함" : "사건 목록"}</h2><span>총 {result?.totalElements ?? 0}건 · {sortLabel}</span>{query.tab === "archived" && <p>운영 목록에서 정리된 종료 사건입니다. 사건 기록은 삭제되지 않았으며 다시 복원할 수 있습니다.</p>}</div>
        <button type="button" className="management-toggle" onClick={() => management ? exitManagement() : enterManagement()}>
          <Icon name={management ? "close" : "list"}/>{management ? "관리 종료" : "목록 관리"}
        </button>
      </header>
      <div className="incident-management-filters">
        <label className="incident-search"><span>사건 검색</span><input value={query.keyword} onChange={event => updateQuery({ keyword: event.target.value })} placeholder="사건 번호 또는 탐지 객체"/></label>
        <label><span>처리 상태</span><select value={query.status} disabled={query.tab!=="active"} title={query.tab!=="active"?"종료·보관 목록은 전체 상태로 조회합니다.":undefined} onChange={event => updateQuery({ status: event.target.value as StatusFilter })}>{statusOptions.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
        <label><span>위험도</span><select value={query.risk} onChange={event => updateQuery({ risk: event.target.value as RiskFilter })}>{riskOptions.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
        <div className="date-filter"><span>발생 기간</span><button ref={dateTriggerRef} type="button" aria-expanded={dateOpen} aria-haspopup="dialog" onClick={() => dateOpen ? closeDatePopover() : openDatePopover()}><Icon name="calendar"/><DateRangeLabel from={appliedDate.from} to={appliedDate.to}/></button>
          {dateOpen && <div ref={datePopoverRef} className="date-popover" role="dialog" aria-modal="true" aria-labelledby="date-popover-title" aria-describedby="date-popover-description">
            <div className="date-popover-heading"><strong id="date-popover-title">발생 기간</strong><button ref={dateCloseRef} type="button" className="date-popover-close" aria-label="발생 기간 필터 닫기" onClick={closeDatePopover}><Icon name="close"/></button></div>
            <p id="date-popover-description" className="date-popover-description">목록에서 조회할 사건의 발생 기간을 선택하세요.</p>
            <div className="date-presets"><button type="button" aria-pressed={selectedPreset === 1} onClick={() => presetDate(1)}>오늘</button><button type="button" aria-pressed={selectedPreset === 7} onClick={() => presetDate(7)}>최근 7일</button><button type="button" aria-pressed={selectedPreset === 30} onClick={() => presetDate(30)}>최근 30일</button></div>
            <div className="date-fields"><label><span>시작일</span><input type="date" value={dateDraft.from} onChange={event => { setDateDraft(current => ({ ...current, from: event.target.value })); setDateError(""); }}/></label><label><span>종료일</span><input type="date" value={dateDraft.to} onChange={event => { setDateDraft(current => ({ ...current, to: event.target.value })); setDateError(""); }}/></label></div>
            {(dateRangeError || dateError) && <p className="date-popover-error" role="alert">{dateRangeError || dateError}</p>}
            <footer><button type="button" className="date-clear" disabled={!query.from && !query.to} onClick={clearAppliedDate}>기간 해제</button><div><button type="button" className="date-cancel" onClick={closeDatePopover}>취소</button><button type="button" className="date-submit" disabled={dateInvalid} onClick={applyDate}>조회</button></div></footer>
          </div>}
        </div>
        <label><span>정렬</span><select value={query.sort} onChange={event => updateQuery({ sort: event.target.value as IncidentListQuery["sort"] })}>{sortOptions.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
        <button className="filter-reset" type="button" onClick={resetFilters}>초기화</button>
      </div>
      <nav className="incident-tabs" aria-label="사건 분류">{(["active", "closed", "archived"] as const).map(tab => {
        if (tab === "archived" && !repository.capabilities.supportsArchivedIncidentList) return null;
        const count = result?.counts[tab];
        return <button type="button" key={tab} aria-current={query.tab === tab ? "page" : undefined} onClick={() => changeTab(tab)}>{tabCopy[tab].label}{count === undefined ? "" : ` ${count}`}</button>;
      })}</nav>
      {management && archiveSuccess!==null ? <ArchiveSuccessBar count={archiveSuccess} onDismiss={()=>setArchiveSuccess(null)} onView={()=>changeTab("archived")}/> : management && <><div className="bulk-toolbar" aria-live="polite"><strong>{selected.size}건 선택됨</strong><button type="button" disabled={!selectable.length} title={!selectable.length?"현재 페이지에 선택 가능한 사건이 없습니다":undefined} onClick={togglePage}>현재 페이지 전체 선택</button><button type="button" disabled={!selected.size} onClick={() => setSelected(new Set())}>선택 해제</button>{query.tab === "archived"
        ? <button type="button" disabled={!selected.size || !repository.capabilities.supportsBulkIncidentRestore} onClick={() => setDialog("restore")}><Icon name="restore"/>{selected.size}건 복원</button>
        : <button type="button" disabled={!selected.size || !repository.capabilities.supportsBulkIncidentArchive} onClick={() => setDialog("archive")}><Icon name="archive"/>{selected.size?`${selected.size}건 보관`:"보관함으로 이동"}</button>}<button type="button" onClick={exitManagement}><Icon name="close"/>관리 종료</button></div>
        {query.tab!=="archived"&&<div className="bulk-guidance">{selectable.length?<p>종료된 사건만 보관함으로 이동할 수 있습니다.</p>:<><p>현재 목록에는 보관할 수 있는 사건이 없습니다.</p><span>종료된 사건은 ‘종료 사건’ 탭에서 확인하세요.</span></>}</div>}</>}
      {!repository.capabilities.supportsBulkIncidentArchive && management && <p className="capability-notice">사건 보관 기능은 백엔드 연동 후 사용할 수 있습니다.</p>}
      {error && <div className="incident-management-state" role="alert"><p>{error}</p><button type="button" onClick={() => void load(query)}>다시 시도</button></div>}
      {!error && loading && !result ? <div className="incident-management-state" role="status">사건 목록을 불러오는 중입니다.</div>
      : !error && items.length ? <div ref={tableRef} className={`incident-management-table ${management ? "is-managing" : ""}`} role="table" aria-label="사건 관리 목록" aria-busy={loading}>
        <div className="incident-management-row is-header" role="row">{management && <span><input ref={headerCheckbox} type="checkbox" checked={allSelected} onChange={togglePage} aria-label="현재 페이지의 선택 가능한 사건 전체 선택"/></span>}<span>사건·객체</span><span>CCTV·위치</span><span>위험도</span><span>처리 상태</span><span>담당 관제자</span><span>발생 시각</span><span>{query.tab === "archived" ? "보관 시각" : "최근 업데이트"}</span><span/></div>
        {items.map(item => <IncidentRow key={item.public_id} item={item} archived={query.tab === "archived"} management={management} selected={selected.has(item.public_id)} onToggle={() => toggleOne(item.public_id)} returnTo={returnTo}/>)}
      </div> : !error && !loading && <div className="incident-management-state" role="status"><strong>{query.keyword || query.status !== "ALL" || query.risk !== "ALL" || query.from ? "선택한 조건에 해당하는 사건이 없습니다." : tabCopy[query.tab].empty}</strong>{tabCopy[query.tab].description && <p>{tabCopy[query.tab].description}</p>}</div>}
      {result && <nav className="incident-pagination" aria-label="사건 목록 페이지" aria-busy={loading}>
        <span className="incident-pagination__range" aria-live="polite">{resultRange}</span>
        <div>
          <button type="button" disabled={loading||query.page<=1} onClick={()=>changePage(query.page-1)}>이전</button>
          <span className="incident-pagination__pages">{pageNumbers.map(page=><button type="button" key={page} aria-label={`페이지 ${page}로 이동`} aria-current={page===query.page?"page":undefined} disabled={loading} onClick={()=>changePage(page)}>{page}</button>)}</span>
          <span className="incident-pagination__mobile" aria-current="page">{query.page} / {Math.max(1,result.totalPages)}</span>
          <button type="button" disabled={loading||query.page>=Math.max(1,result.totalPages)} onClick={()=>changePage(query.page+1)}>다음</button>
        </div>
      </nav>}
    </section>
  </main>
  {toast && <div className="incident-toast" role="status">{toast}<button type="button" onClick={() => setToast("")}>닫기</button></div>}
  {dialog && <div className="incident-dialog-backdrop" onMouseDown={event => { if (event.target === event.currentTarget && !submitting) setDialog(null); }}><section className="incident-dialog" role="dialog" aria-modal="true" aria-labelledby="incident-dialog-title">
    <h2 id="incident-dialog-title">선택한 사건 {selected.size}건을 {dialog === "archive" ? "보관함으로 이동할까요?" : "종료 사건 목록으로 복원할까요?"}</h2>
    <p>{dialog === "archive" ? "보관된 사건은 일반 사건 목록에서 제외됩니다. 사건 기록과 처리 이력은 삭제되지 않으며 보관함에서 다시 복원할 수 있습니다." : "복원 후 해당 사건은 종료 사건 목록에서 다시 조회할 수 있습니다."}</p>
    <strong>{items.find(item => selected.has(item.public_id))?.incident_no}{selected.size > 1 ? ` 외 ${selected.size - 1}건` : ""}</strong>
    {dialog === "archive" && <label><span>보관 사유 (선택)</span><textarea value={reason} onChange={event => setReason(event.target.value)} placeholder="보관 사유를 입력하세요"/></label>}
    <footer><button type="button" disabled={submitting} onClick={() => setDialog(null)}>취소</button><button type="button" disabled={submitting} onClick={() => void submitBulk()}>{submitting ? "처리 중" : dialog === "archive" ? "보관함으로 이동" : "선택 사건 복원"}</button></footer>
  </section></div>}</div>;
}

export function IncidentRow({ item, archived, management, selected, onToggle, returnTo }: { item: IncidentManagementItem; archived: boolean; management: boolean; selected: boolean; onToggle: () => void; returnTo?:string }) {
  const eligible = archived || isArchiveEligible(item);
  return <article className="incident-management-row" role="row" data-selected={selected || undefined}>
    {management && <div className="incident-checkbox" data-label="선택" title={!eligible?"사건 종료 후 보관할 수 있습니다":undefined}><input type="checkbox" checked={selected} disabled={!eligible} onChange={onToggle} aria-label={`${item.incident_no} 선택`} aria-describedby={!eligible ? `${item.public_id}-archive-disabled` : undefined}/>{!eligible && <span id={`${item.public_id}-archive-disabled`} className="incident-management-sr-only">진행 중인 사건은 종료 후 보관할 수 있습니다.</span>}</div>}
    <div data-label="사건·객체"><strong>{item.incident_no}</strong><small>{item.class_name ?? objectCategoryLabel[item.object_category]}</small></div>
    <div data-label="CCTV·위치"><strong>{item.cctv_name}</strong><small>{item.road_name} · {item.road_section_name} · {directionLabel[item.direction_code]}</small></div>
    <div data-label="위험도"><span className="incident-management-badge" data-risk={item.current_risk_grade}>{riskLabel[item.current_risk_grade]} · {item.current_risk_score}</span></div>
    <div data-label="처리 상태"><span className="incident-management-status">{incidentStatusLabel[item.status]}</span></div>
    <div data-label="담당 관제자"><strong>{item.assigned_controller?.display_name ?? "미지정"}</strong></div>
    <div data-label="발생 시각"><DateCell value={item.first_detected_at}/></div>
    <div data-label={archived ? "보관 시각" : "최근 업데이트"}>{archived && item.archived_at ? <><DateCell value={item.archived_at}/><small>{item.archived_by}</small></> : <DateCell value={item.updated_at}/>}</div>
    <div className="incident-management-action"><Link href={`/control/incidents/${item.public_id}${returnTo?`?return_to=${encodeURIComponent(returnTo)}`:""}`}>상세 보기</Link></div>
  </article>;
}
