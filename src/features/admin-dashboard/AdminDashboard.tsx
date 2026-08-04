"use client";

import Link from "next/link";
import {type KeyboardEvent as ReactKeyboardEvent,useCallback,useEffect,useMemo,useRef,useState} from "react";
import {useAuth} from "@/components/auth/AuthContext";
import {createAdminDashboardAdapter} from "./adminDashboardAdapter";
import {createAdminConsoleViewModel,type AdminIssue} from "./adminConsoleViewModel";
import type {AdminDashboardSnapshot} from "./adminDashboardTypes";

type Styles=Record<string,string>;
type IssueKey=AdminIssue["key"];
type PanelTab="detail"|"activity";

const issuePresentation:Record<IssueKey,{state:string;area:string;icon:"shield"|"search"|"inactive";action:string}>={
  ROLE_UNASSIGNED:{state:"우선",area:"역할 및 권한",icon:"shield",action:"역할 배정"},
  NO_LOGIN_HISTORY:{state:"검토",area:"사용자 관리",icon:"search",action:"검토 대상 보기"},
  INACTIVE_ACCOUNT:{state:"상태",area:"사용자 관리",icon:"inactive",action:"비활성 계정 보기"},
};

function WorkIcon({name}:{name:"attention"|"shield"|"search"|"inactive"|"audit"}){
  const path=name==="attention"?<><circle cx="12" cy="12" r="9"/><path d="M12 7v6m0 4h.01"/></>
    :name==="shield"?<><path d="M12 3 5 6v5c0 4.6 2.8 8 7 10 4.2-2 7-5.4 7-10V6z"/><path d="M12 8v6m-3-3h6"/></>
    :name==="search"?<><circle cx="10" cy="9" r="4"/><path d="M3.5 19c.8-3.2 3-5 6.5-5 1.7 0 3.1.4 4.2 1.3M16 16l4 4m-1-5a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z"/></>
    :name==="inactive"?<><circle cx="9" cy="8" r="4"/><path d="M2.5 20c.7-4 2.9-6 6.5-6 1.8 0 3.2.5 4.3 1.5M16 16l5 5m0-5-5 5"/></>
    :<><path d="M6 3h9l4 4v14H6z"/><path d="M15 3v5h5M9 12h7M9 16h7"/></>;
  return <svg data-icon={name} viewBox="0 0 24 24" aria-hidden="true">{path}</svg>;
}
const RefreshIcon=()=> <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 7v5h-5M4 17v-5h5"/><path d="M6.1 8A7 7 0 0 1 18 6l2 2M17.9 16A7 7 0 0 1 6 18l-2-2"/></svg>;
const healthLabel=(status:string)=>status==="healthy"?"정상":status==="warning"?"일부 경고":status==="offline"?"연결 장애":"정보 없음";
const time=(value:string)=>new Intl.DateTimeFormat("ko-KR",{timeZone:"Asia/Seoul",hour:"2-digit",minute:"2-digit",hour12:false}).format(new Date(value));
const representative=(issue:AdminIssue)=>{const first=issue.affectedUsers[0]?.name??"대상 없음",remaining=issue.affectedUsers.length-1;return`${first}${remaining>0?` 외 ${remaining}명`:""}`};
const changeSentence=(detail:string)=>{const separator=detail.includes("→")?"→":detail.includes("->")?"->":null;if(!separator)return detail;const[before,...rest]=detail.split(separator);return`${before.trim()}에서 ${rest.join(separator).trim()}로 변경`};
function Skeleton({styles,rows=3}:{styles:Styles;rows?:number}){return <div className={styles.skeleton} aria-hidden="true">{Array.from({length:rows},(_,index)=><i key={index}/>)}</div>}

export function AdminDashboard({classNames:styles}:{classNames:Styles}){
  const{user}=useAuth(),permissions=new Set(user?.apiPermissions??[]);
  const adapter=useMemo(()=>createAdminDashboardAdapter(),[]);
  const[data,setData]=useState<AdminDashboardSnapshot|null>(null),[loading,setLoading]=useState(true),[failed,setFailed]=useState(false),[announcement,setAnnouncement]=useState("관리 현황을 확인하고 있습니다.");
  const[selectedKey,setSelectedKey]=useState<IssueKey|null>(null),[panelTab,setPanelTab]=useState<PanelTab>("detail");
  const inFlight=useRef(false),abort=useRef<AbortController|null>(null);
  const tabRefs=useRef<Record<PanelTab,HTMLButtonElement|null>>({detail:null,activity:null});
  const load=useCallback(async()=>{if(inFlight.current)return;inFlight.current=true;setLoading(true);setFailed(false);setAnnouncement("관리 현황을 갱신하고 있습니다.");abort.current?.abort();const next=new AbortController();abort.current=next;try{const snapshot=await adapter.load(next.signal);setData(snapshot);setAnnouncement(snapshot.systemHealth.status==="unavailable"||snapshot.partialErrors.length?"관리 현황 일부를 확인하지 못했습니다.":`관리 현황을 ${time(snapshot.generatedAt)}에 갱신했습니다.`)}catch(error){if(!(error instanceof DOMException&&error.name==="AbortError")){setFailed(true);setAnnouncement("관리 현황을 갱신하지 못했습니다.")}}finally{inFlight.current=false;setLoading(false)}},[adapter]);
  useEffect(()=>{const timer=setTimeout(()=>void load(),0);return()=>{clearTimeout(timer);abort.current?.abort()}},[load]);
  const view=useMemo(()=>data?createAdminConsoleViewModel(data):null,[data]),summary=view?.accountSummary,overall=view?.health.overall;
  const usersAvailable=Boolean(data&&data.users!==null);
  const selectedIssue=view?.issues.find(issue=>issue.key===selectedKey)??view?.issues[0]??null;
  useEffect(()=>{if(!view)return;setSelectedKey(current=>current&&view.issues.some(issue=>issue.key===current)?current:view.issues[0]?.key??null)},[view]);
  const issueCount=(key:IssueKey)=>view?.issues.find(issue=>issue.key===key)?.affectedUsers.length??0;
  const handleTabKeyDown=(event:ReactKeyboardEvent<HTMLButtonElement>,current:PanelTab)=>{const order:PanelTab[]=["detail","activity"],index=order.indexOf(current);let next:PanelTab|null=null;if(event.key==="ArrowLeft")next=order[(index-1+order.length)%order.length];if(event.key==="ArrowRight")next=order[(index+1)%order.length];if(event.key==="Home")next=order[0];if(event.key==="End")next=order[order.length-1];if(!next)return;event.preventDefault();setPanelTab(next);tabRefs.current[next]?.focus()};

  return <main className={styles.page} aria-busy={loading}>
    <header className={styles.heading}>
      <div className={styles.headingCopy}><h1>관리 콘솔</h1><p>계정과 권한 운영에서 확인이 필요한 작업을 관리합니다.</p></div>
      <div className={styles.headingActions}>
        <span className={styles.connection} data-status={overall}><i/><span><b>{overall==="healthy"?"전체 서비스 정상":overall==="warning"?"일부 서비스 경고":overall==="offline"?"서비스 연결 장애":overall==="unavailable"?"상태 확인 불가":"상태 확인 중"}</b>{view&&<small>API {healthLabel(view.health.api)} · DB {healthLabel(view.health.database)} · 마지막 확인 {time(view.checkedAt)} KST</small>}</span></span>
        <button type="button" className={styles.refreshAction} onClick={()=>void load()} disabled={loading}><RefreshIcon/>{loading?"갱신 중":"새로고침"}</button>
      </div>
    </header>
    {failed&&!data&&<div className={styles.error} role="alert">관리 현황을 불러오지 못했습니다. <button type="button" onClick={()=>void load()}>다시 확인</button></div>}
    {data&&data.partialErrors.length>0&&<div className={styles.error} role="alert">{data.systemHealth.status==="unavailable"?"운영 상태를 확인하지 못했습니다.":"일부 관리 정보를 확인하지 못했습니다."}</div>}

    <section className={styles.operationSummary} aria-label="업무 중심 운영 요약">
      {loading&&(!summary||!usersAvailable)?<Skeleton styles={styles} rows={1}/>:!summary||!usersAvailable?<div className={styles.summaryUnavailable}><strong>운영 요약을 표시할 수 없습니다.</strong><p>계정 데이터 연결 후 운영 지표가 표시됩니다.</p></div>:<>
        <div data-tone="attention"><WorkIcon name="attention"/><span>확인 대상</span><b>{summary.attentionCount}명</b></div>
        <div data-tone="role"><WorkIcon name="shield"/><span>역할 미배정</span><b>{issueCount("ROLE_UNASSIGNED")}명</b></div>
        <div data-tone="review"><WorkIcon name="search"/><span>사용 검토</span><b>{issueCount("NO_LOGIN_HISTORY")}명</b></div>
        <div data-tone="inactive"><WorkIcon name="inactive"/><span>비활성 상태</span><b>{issueCount("INACTIVE_ACCOUNT")}명</b></div>
      </>}
    </section>

    <div className={styles.workspaceGrid}>
      <section className={styles.queue} aria-labelledby="queue-title">
        <header><div><h2 id="queue-title">관리 작업</h2><p>확인이 필요한 계정과 권한 업무입니다.</p></div>{view&&usersAvailable&&<b>{view.issues.length}개 업무 유형</b>}</header>
        {!view?<Skeleton styles={styles}/>:!usersAvailable?<div className={styles.empty}><strong>계정 데이터를 확인할 수 없습니다.</strong><p>데이터 연결 상태를 확인한 후 다시 시도해 주세요.</p></div>:view.issues.length===0?<div className={styles.empty}><strong>현재 확인할 관리 작업이 없습니다.</strong><p>계정과 권한 운영 상태가 정상입니다.</p></div>:<div className={styles.taskList}>{view.issues.map(issue=>{const presentation=issuePresentation[issue.key],selected=selectedIssue?.key===issue.key;return <button type="button" key={issue.key} data-kind={issue.key} aria-pressed={selected} onClick={()=>{setSelectedKey(issue.key);setPanelTab("detail")}}>
          <span className={styles.taskIcon}><WorkIcon name={presentation.icon}/></span>
          <span className={styles.taskContent}><span><em>{presentation.state}</em><strong>{issue.title}</strong></span><small>{representative(issue)} · {presentation.area}</small><p>{issue.description}</p></span>
          <b>{issue.affectedUsers.length}명</b>
        </button>})}</div>}
      </section>

      <section className={styles.inspector} aria-label="관리 작업 검토">
        <nav className={styles.panelTabs} aria-label="관리 작업 패널" role="tablist"><button ref={node=>{tabRefs.current.detail=node}} id="admin-task-detail-tab" type="button" aria-controls="admin-task-detail-panel" aria-selected={panelTab==="detail"} role="tab" tabIndex={panelTab==="detail"?0:-1} onClick={()=>setPanelTab("detail")} onKeyDown={event=>handleTabKeyDown(event,"detail")}>작업 상세</button><button ref={node=>{tabRefs.current.activity=node}} id="admin-activity-tab" type="button" aria-controls="admin-activity-panel" aria-selected={panelTab==="activity"} role="tab" tabIndex={panelTab==="activity"?0:-1} onClick={()=>setPanelTab("activity")} onKeyDown={event=>handleTabKeyDown(event,"activity")}>최근 관리 활동</button></nav>
        {!view?<Skeleton styles={styles}/>:panelTab==="activity"?<div id="admin-activity-panel" className={styles.activityPanel} role="tabpanel" aria-labelledby="admin-activity-tab">
          {view.recentChanges.length?<ol className={styles.activityList}>{view.recentChanges.map(change=><li key={change.id} data-action={change.action}><i aria-hidden="true"/><div><span><strong>{change.action}</strong><time dateTime={change.occurredAt}>{time(change.occurredAt)}</time></span><b>{change.target}</b><p>{changeSentence(change.detail)}</p><small>실행자 · {change.actor??"정보 없음"}</small></div></li>)}</ol>:<div className={styles.empty}>아직 기록된 관리자 활동이 없습니다.</div>}
          {permissions.has("AUDIT.READ")&&<footer className={styles.auditActions}><Link href="/admin/audit-logs?range=today"><WorkIcon name="audit"/>오늘 변경</Link><Link href="/admin/audit-logs"><WorkIcon name="audit"/>전체 감사 로그</Link></footer>}
        </div>:!usersAvailable?<div id="admin-task-detail-panel" className={styles.emptyDetail} role="tabpanel" aria-labelledby="admin-task-detail-tab"><strong>계정 데이터를 확인할 수 없습니다.</strong><p>데이터 연결 상태를 확인한 후 다시 시도해 주세요.</p></div>:selectedIssue?<div id="admin-task-detail-panel" className={styles.issueDetail} role="tabpanel" aria-labelledby="admin-task-detail-tab" aria-live="polite" data-kind={selectedIssue.key}>
          <header><span className={styles.detailIcon}><WorkIcon name={issuePresentation[selectedIssue.key].icon}/></span><div><h2>{selectedIssue.title}</h2><p>{issuePresentation[selectedIssue.key].state} 확인 · 영향 계정 {selectedIssue.affectedUsers.length}명</p></div></header>
          <section><h3>문제 설명</h3><p>{selectedIssue.description}</p></section>
          <section><h3>영향 계정</h3><ul className={styles.affectedUsers}>{selectedIssue.affectedUsers.slice(0,5).map(account=><li key={account.publicId}><div><strong>{account.name}</strong><span>{account.accountStatus==="ACTIVE"?"활성":"비활성"}</span></div><a href={`mailto:${account.email}`}>{account.email}</a><p>{account.organization}</p><small>{account.context}</small></li>)}</ul>{selectedIssue.affectedUsers.length>5&&<p className={styles.remainingUsers}>외 {selectedIssue.affectedUsers.length-5}명의 영향 계정이 있습니다.</p>}</section>
          <section className={styles.recommendation}><h3>권장 조치</h3><p>{selectedIssue.recommendedAction}</p></section>
          {selectedIssue.target&&<footer><Link href={selectedIssue.target.href}><WorkIcon name={issuePresentation[selectedIssue.key].icon}/>{issuePresentation[selectedIssue.key].action}</Link></footer>}
        </div>:<div id="admin-task-detail-panel" className={styles.emptyDetail} role="tabpanel" aria-labelledby="admin-task-detail-tab"><strong>처리할 작업이 없습니다.</strong><p>새로운 관리 항목이 발생하면 이곳에서 상세 내용을 확인할 수 있습니다.</p></div>}
      </section>
    </div>
    <span className={styles.liveRegion} role="status" aria-live="polite">{announcement}</span>
  </main>;
}
