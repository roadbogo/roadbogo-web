"use client";

import Link from "next/link";
import {useCallback,useEffect,useMemo,useRef,useState} from "react";
import {useAuth} from "@/components/auth/AuthContext";
import {createAdminDashboardAdapter} from "./adminDashboardAdapter";
import {createAdminConsoleViewModel,type AdminIssue} from "./adminConsoleViewModel";
import type {AdminDashboardSnapshot} from "./adminDashboardTypes";

type Styles=Record<string,string>;
type DetailTab="task"|"activity";
const issuePresentation:Record<AdminIssue["key"],{level:string;detail:string}>= {
  ROLE_UNASSIGNED:{level:"우선",detail:"운영 역할 지정 필요"},
  NO_LOGIN_HISTORY:{level:"검토",detail:"실제 사용 여부 확인"},
  INACTIVE_ACCOUNT:{level:"상태",detail:"비활성 사유 확인"},
};
const issueAction:Record<AdminIssue["key"],string>={ROLE_UNASSIGNED:"역할 배정",NO_LOGIN_HISTORY:"검토 대상 보기",INACTIVE_ACCOUNT:"비활성 계정 보기"};
const healthLabel=(status:string)=>status==="healthy"?"정상":status==="warning"?"일부 경고":status==="offline"?"연결 장애":"확인 불가";
const time=(value:string)=>new Intl.DateTimeFormat("ko-KR",{timeZone:"Asia/Seoul",hour:"2-digit",minute:"2-digit",hour12:false}).format(new Date(value));
const representative=(issue:AdminIssue)=>{const first=issue.affectedUsers[0]?.name??"대상 없음",remaining=issue.affectedUsers.length-1;return `${first}${remaining>0?` 외 ${remaining}명`:""}`};
const changeSentence=(detail:string)=>{const separator=detail.includes("→")?"→":detail.includes("->")?"->":null;if(!separator)return detail;const[before,...rest]=detail.split(separator);return `${before.trim()}에서 ${rest.join(separator).trim()}로 변경`};
type AdminIcon="audit"|"refresh"|"role"|"review"|"inactive"|"users";
const SvgIcon=({kind}:{kind:AdminIcon})=>{
  const paths={
    audit:<><path d="M6 3h9l4 4v14H6z"/><path d="M15 3v5h5M9 12h7M9 16h7"/></>,
    refresh:<><path d="M20 7v5h-5M4 17v-5h5"/><path d="M6.1 8A7 7 0 0 1 18 6l2 2M17.9 16A7 7 0 0 1 6 18l-2-2"/></>,
    role:<><path d="M12 3 4.5 6v5.4c0 4.6 3.1 8.1 7.5 9.6 4.4-1.5 7.5-5 7.5-9.6V6z"/><path d="M12 8v5M9.5 10.5h5"/></>,
    review:<><circle cx="10" cy="8" r="3"/><path d="M4 20v-2a6 6 0 0 1 9-5.2M17 14v6M14 17h6"/></>,
    inactive:<><circle cx="9" cy="8" r="3"/><path d="M3 20v-2a6 6 0 0 1 10-3.7M16 16l5 5M21 16l-5 5"/></>,
    users:<><circle cx="9" cy="8" r="3"/><circle cx="17" cy="9" r="2.5"/><path d="M3 20v-2a6 6 0 0 1 12 0v2M15 15a5 5 0 0 1 6 5"/></>,
  };
  return <svg viewBox="0 0 24 24" aria-hidden="true">{paths[kind]}</svg>;
};
const issueIcon=(key:AdminIssue["key"]):AdminIcon=>key==="ROLE_UNASSIGNED"?"role":key==="NO_LOGIN_HISTORY"?"review":"inactive";
const shortcutConfig:Record<AdminIssue["key"],Array<{label:string;href:string;permission:string;icon:AdminIcon}>>={
  ROLE_UNASSIGNED:[{label:"역할 및 권한",href:"/admin/roles",permission:"ROLE.MANAGE",icon:"role"},{label:"사용자 관리",href:"/admin/users",permission:"USER.READ_ALL",icon:"users"},{label:"감사 로그",href:"/admin/audit-logs",permission:"AUDIT.READ",icon:"audit"}],
  NO_LOGIN_HISTORY:[{label:"사용자 관리",href:"/admin/users",permission:"USER.READ_ALL",icon:"users"},{label:"감사 로그",href:"/admin/audit-logs",permission:"AUDIT.READ",icon:"audit"}],
  INACTIVE_ACCOUNT:[{label:"사용자 관리",href:"/admin/users",permission:"USER.READ_ALL",icon:"users"},{label:"감사 로그",href:"/admin/audit-logs",permission:"AUDIT.READ",icon:"audit"}],
};
function Skeleton({styles,rows=3}:{styles:Styles;rows?:number}){return <div className={styles.skeleton} aria-hidden="true">{Array.from({length:rows},(_,index)=><i key={index}/>)}</div>}
function MetricValue({styles,count,large=false}:{styles:Styles;count:number;large?:boolean}){return <strong className={large?`${styles.metricValue} ${styles.metricValueLarge}`:styles.metricValue} aria-label={`${count}명`}><span className={styles.metricNumber}>{count}</span><span className={styles.metricUnit} aria-hidden="true">명</span></strong>}

export function AdminDashboard({classNames:styles}:{classNames:Styles}){
  const{user}=useAuth(),permissions=new Set(user?.apiPermissions??[]);
  const adapter=useMemo(()=>createAdminDashboardAdapter(),[]);
  const[data,setData]=useState<AdminDashboardSnapshot|null>(null),[loading,setLoading]=useState(true),[failed,setFailed]=useState(false),[announcement,setAnnouncement]=useState("관리 현황을 확인하고 있습니다."),[selectedIssueKey,setSelectedIssueKey]=useState<AdminIssue["key"]|null>(null),[detailTab,setDetailTab]=useState<DetailTab>("task");
  const inFlight=useRef(false),abort=useRef<AbortController|null>(null);
  const load=useCallback(async()=>{if(inFlight.current)return;inFlight.current=true;setLoading(true);setFailed(false);setAnnouncement("관리 현황을 갱신하고 있습니다.");abort.current?.abort();const next=new AbortController();abort.current=next;try{const snapshot=await adapter.load(next.signal);setData(snapshot);setAnnouncement(snapshot.systemHealth.status==="unavailable"||snapshot.partialErrors.length?"관리 현황 일부를 확인하지 못했습니다.":`관리 현황을 ${time(snapshot.generatedAt)}에 갱신했습니다.`)}catch(error){if(!(error instanceof DOMException&&error.name==="AbortError")){setFailed(true);setAnnouncement("관리 현황을 갱신하지 못했습니다.")}}finally{inFlight.current=false;setLoading(false)}},[adapter]);
  useEffect(()=>{const timer=setTimeout(()=>void load(),0);return()=>{clearTimeout(timer);abort.current?.abort()}},[load]);
  const view=useMemo(()=>data?createAdminConsoleViewModel(data):null,[data]),summary=view?.accountSummary,overall=view?.health.overall;
  const selectedIssue=view?.issues.find(issue=>issue.key===selectedIssueKey)??view?.issues[0]??null;
  useEffect(()=>{if(!view)return;const next=view.issues.some(issue=>issue.key===selectedIssueKey)?selectedIssueKey:view.issues[0]?.key??null;if(next!==selectedIssueKey)setSelectedIssueKey(next)},[view,selectedIssueKey]);
  const recentActivities=view?.recentChanges.slice(0,3)??[];

  return <main className={styles.page} aria-busy={loading}>
    <header className={styles.heading}>
      <div className={styles.headingCopy}><h1>관리 콘솔</h1><p>계정과 권한 운영에서 확인이 필요한 작업을 관리합니다.</p></div>
      <div className={styles.headingActions}><span className={styles.connection} data-status={overall}><i/><span><b>{overall==="healthy"?"전체 서비스 정상":overall==="warning"?"일부 서비스 경고":overall==="offline"?"서비스 연결 장애":overall==="unavailable"?"상태 확인 불가":"상태 확인 중"}</b>{view&&<small>마지막 확인 {time(view.checkedAt)} KST</small>}</span></span><button type="button" className={styles.refreshAction} onClick={()=>void load()} disabled={loading}><SvgIcon kind="refresh"/>{loading?"갱신 중":"새로고침"}</button></div>
    </header>
    {failed&&!data&&<div className={styles.error} role="alert">관리 현황을 불러오지 못했습니다. <button type="button" onClick={()=>void load()}>다시 확인</button></div>}
    {data&&data.partialErrors.length>0&&<div className={styles.error} role="alert">{data.systemHealth.status==="unavailable"?"운영 상태를 확인하지 못했습니다.":"일부 관리 정보를 확인하지 못했습니다."}</div>}

    <section className={styles.operationSummary} aria-labelledby="account-overview-title">
      {loading&&!summary?<Skeleton styles={styles} rows={1}/>:!summary?<div className={styles.summaryUnavailable}><strong>운영 요약을 표시할 수 없습니다.</strong><p>계정 데이터 연결 후 운영 지표가 표시됩니다.</p></div>:<>
        <Link href="/admin/users?view=attention" className={styles.primaryMetric} data-tone="warning"><span className={styles.metricIcon}><SvgIcon kind="role"/></span><span className={styles.metricCopy}><b id="account-overview-title">확인 대상</b><small>현재 확인이 필요한 전체 계정</small><MetricValue styles={styles} count={summary.attentionCount} large/></span></Link>
        <div className={styles.riskMetrics}><header><h2>검토 유형</h2><p>계정 중복 포함</p></header><div><Link href="/admin/roles?view=unassigned" data-tone="warning"><span className={styles.metricIcon}><SvgIcon kind="role"/></span><span className={styles.metricCopy}><b>역할 미배정</b><small>운영 역할 지정 필요</small><MetricValue styles={styles} count={summary.usersWithoutRoles}/></span></Link><Link href="/admin/users?view=attention&issue=never-logged-in" data-tone="active"><span className={styles.metricIcon}><SvgIcon kind="review"/></span><span className={styles.metricCopy}><b>사용 검토</b><small>실제 사용 여부 확인</small><MetricValue styles={styles} count={view.issues.find(issue=>issue.key==="NO_LOGIN_HISTORY")?.affectedUsers.length??0}/></span></Link><Link href="/admin/users?view=inactive" data-tone="neutral"><span className={styles.metricIcon}><SvgIcon kind="inactive"/></span><span className={styles.metricCopy}><b>비활성 상태</b><small>비활성 사유 확인</small><MetricValue styles={styles} count={summary.inactiveUsers}/></span></Link></div></div>
      </>}
    </section>

    <section className={styles.workbench} aria-label="관리 업무 작업 공간">
      <section className={styles.queue} aria-labelledby="queue-title"><header><div><h2 id="queue-title">관리 작업</h2><p>확인이 필요한 계정과 권한 업무입니다.</p></div><b>{view?.issues.length??0}개 업무 유형</b></header>
        {!view?<Skeleton styles={styles}/>:view.issues.length===0?<div className={styles.empty}><strong>현재 확인할 관리 작업이 없습니다.</strong><p>계정과 권한 운영 상태가 정상입니다.</p></div>:<div className={styles.taskList}>{view.issues.map(issue=><button key={issue.key} type="button" className={styles.taskSelect} data-kind={issue.key} aria-pressed={selectedIssue?.key===issue.key} onClick={()=>{setSelectedIssueKey(issue.key);setDetailTab("task")}}><span className={styles.taskIcon}><SvgIcon kind={issueIcon(issue.key)}/></span><span className={styles.taskCopy}><span className={styles.taskMeta}><span className={styles.taskState}>{issuePresentation[issue.key].level}</span><MetricValue styles={styles} count={issue.affectedUsers.length}/></span><strong>{issue.title}</strong><small>{representative(issue)} · {issuePresentation[issue.key].detail}</small></span></button>)}</div>}
      </section>

      <section className={styles.detailPanel} aria-label="관리 작업 정보">
        {view&&<div className={styles.statusStrip} data-status={view.health.overall}><span><i/>전체 서비스 {healthLabel(view.health.overall)}</span><small>API {healthLabel(view.health.api)} · 데이터베이스 {healthLabel(view.health.database)} · 마지막 확인 {time(view.checkedAt)} KST</small></div>}
        <div className={styles.detailTabs} role="tablist" aria-label="관리 작업 정보 보기"><button id="task-tab" type="button" role="tab" aria-selected={detailTab==="task"} aria-controls="task-panel" onClick={()=>setDetailTab("task")}>작업 상세</button><button id="activity-tab" type="button" role="tab" aria-selected={detailTab==="activity"} aria-controls="activity-panel" onClick={()=>setDetailTab("activity")}>최근 관리 활동</button></div>
        {detailTab==="task"&&selectedIssue&&<ContextShortcuts issue={selectedIssue} permissions={permissions} styles={styles}/>}
        {detailTab==="task"?<div id="task-panel" className={styles.tabPanel} role="tabpanel" aria-labelledby="task-tab">{!view?<Skeleton styles={styles}/>:!selectedIssue?<div className={styles.empty}><strong>처리할 작업이 없습니다.</strong><p>새로운 관리 항목이 발생하면 이곳에서 상세 내용을 확인할 수 있습니다.</p></div>:<div className={styles.taskDetail} data-kind={selectedIssue.key}><header><span className={styles.taskIcon} data-kind={selectedIssue.key}><SvgIcon kind={issueIcon(selectedIssue.key)}/></span><div><span className={styles.taskState}>{issuePresentation[selectedIssue.key].level}</span><h3>{selectedIssue.title}</h3><p>{selectedIssue.description}</p></div><MetricValue styles={styles} count={selectedIssue.affectedUsers.length}/></header><section><h4>영향 계정</h4><ul className={styles.accountList}>{selectedIssue.affectedUsers.slice(0,5).map((account,index)=><li key={account.publicId||`${selectedIssue.key}-${index}`}><div><strong>{account.name}</strong><span>{account.email||"이메일 정보 없음"}</span></div><div><span>{account.organization||"소속 없음"}</span><small>{account.context}</small></div><em data-status={account.accountStatus}>{account.accountStatus==="ACTIVE"?"활성":"비활성"}</em></li>)}</ul>{selectedIssue.affectedUsers.length>5&&<p className={styles.moreAccounts}>외 {selectedIssue.affectedUsers.length-5}명의 영향 계정이 있습니다.</p>}</section><section className={styles.recommendation}><h4>권장 조치</h4><p>{selectedIssue.recommendedAction}</p>{selectedIssue.target&&<Link href={selectedIssue.target.href}>{issueAction[selectedIssue.key]}</Link>}</section></div>}</div>:<div id="activity-panel" className={styles.tabPanel} role="tabpanel" aria-labelledby="activity-tab">{!view?<Skeleton styles={styles}/>:recentActivities.length?<><ol className={styles.activityList}>{recentActivities.map(change=><li key={change.id} data-action={change.action}><i aria-hidden="true"/><div><span><strong>{change.action}</strong><time dateTime={change.occurredAt}>{time(change.occurredAt)}</time></span><b>{change.target}</b><p>{changeSentence(change.detail)}</p><small>관리자 · {change.actor??"정보 없음"}</small></div></li>)}</ol>{permissions.has("AUDIT.READ")&&<footer className={styles.activityFooter}><Link href="/admin/audit-logs"><SvgIcon kind="audit"/>전체 감사 로그</Link></footer>}</>:<div className={styles.empty}>아직 기록된 관리자 활동이 없습니다.</div>}</div>}
      </section>
    </section>
    <span className={styles.liveRegion} role="status" aria-live="polite">{announcement}</span>
  </main>;
}

function ContextShortcuts({issue,permissions,styles}:{issue:AdminIssue;permissions:Set<string>;styles:Styles}){
  const links=shortcutConfig[issue.key].filter(link=>permissions.has(link.permission));
  if(!links.length)return null;
  return <nav className={styles.contextShortcuts} aria-label="관련 화면 바로가기" data-kind={issue.key}><strong>관련 화면 바로가기</strong><div>{links.map((link,index)=><Link key={link.href} href={link.href} data-primary={index===0||undefined} aria-label={`${link.label}${index===0?" · 주 작업":""}`}><SvgIcon kind={link.icon}/><span>{link.label}</span>{index===0&&<small>주 작업</small>}</Link>)}</div></nav>
}
