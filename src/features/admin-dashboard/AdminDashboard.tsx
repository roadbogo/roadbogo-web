"use client";

import Link from "next/link";
import {useCallback,useEffect,useMemo,useRef,useState} from "react";
import {useAuth} from "@/components/auth/AuthContext";
import {createAdminDashboardAdapter} from "./adminDashboardAdapter";
import {createAdminConsoleViewModel,type AdminIssue} from "./adminConsoleViewModel";
import type {AdminDashboardSnapshot} from "./adminDashboardTypes";

type Styles=Record<string,string>;
const issuePresentation:Record<AdminIssue["key"],{level:string;location:string;detail:string}>={
  ROLE_UNASSIGNED:{level:"우선 확인",location:"역할 및 권한",detail:"운영 역할 지정 필요"},
  NO_LOGIN_HISTORY:{level:"사용 검토",location:"사용자 관리",detail:"실제 사용 여부 확인"},
  INACTIVE_ACCOUNT:{level:"상태 확인",location:"사용자 관리",detail:"현재 상태 확인"},
};
const issueAction:Record<AdminIssue["key"],string>={ROLE_UNASSIGNED:"역할 배정",NO_LOGIN_HISTORY:"계정 검토",INACTIVE_ACCOUNT:"계정 목록"};
const healthLabel=(status:string)=>status==="healthy"?"정상":status==="warning"?"일부 경고":status==="offline"?"연결 장애":"정보 없음";
const time=(value:string)=>new Intl.DateTimeFormat("ko-KR",{timeZone:"Asia/Seoul",hour:"2-digit",minute:"2-digit",hour12:false}).format(new Date(value));
const representative=(issue:AdminIssue)=>{const first=issue.affectedUsers[0]?.name??"대상 없음",remaining=issue.affectedUsers.length-1;return`${first}${remaining>0?` 외 ${remaining}명`:""}`};
const changeSentence=(detail:string)=>{const separator=detail.includes("→")?"→":detail.includes("->")?"->":null;if(!separator)return detail;const[before,...rest]=detail.split(separator);return`${before.trim()}에서 ${rest.join(separator).trim()}로 변경`};
const AuditIcon=()=> <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 3h9l4 4v14H6z"/><path d="M15 3v5h5M9 12h7M9 16h7"/></svg>;
const RefreshIcon=()=> <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 7v5h-5M4 17v-5h5"/><path d="M6.1 8A7 7 0 0 1 18 6l2 2M17.9 16A7 7 0 0 1 6 18l-2-2"/></svg>;
function Skeleton({styles,rows=3}:{styles:Styles;rows?:number}){return <div className={styles.skeleton} aria-hidden="true">{Array.from({length:rows},(_,index)=><i key={index}/>)}</div>}

export function AdminDashboard({classNames:styles}:{classNames:Styles}){
  const{user}=useAuth(),permissions=new Set(user?.apiPermissions??[]);
  const adapter=useMemo(()=>createAdminDashboardAdapter(),[]);
  const[data,setData]=useState<AdminDashboardSnapshot|null>(null),[loading,setLoading]=useState(true),[failed,setFailed]=useState(false),[announcement,setAnnouncement]=useState("관리 현황을 확인하고 있습니다.");
  const inFlight=useRef(false),abort=useRef<AbortController|null>(null);
  const load=useCallback(async()=>{if(inFlight.current)return;inFlight.current=true;setLoading(true);setFailed(false);setAnnouncement("관리 현황을 갱신하고 있습니다.");abort.current?.abort();const next=new AbortController();abort.current=next;try{const snapshot=await adapter.load(next.signal);setData(snapshot);setAnnouncement(`관리 현황을 ${time(snapshot.generatedAt)}에 갱신했습니다.`)}catch(error){if(!(error instanceof DOMException&&error.name==="AbortError")){setFailed(true);setAnnouncement("관리 현황을 갱신하지 못했습니다.")}}finally{inFlight.current=false;setLoading(false)}},[adapter]);
  useEffect(()=>{const timer=setTimeout(()=>void load(),0);return()=>{clearTimeout(timer);abort.current?.abort()}},[load]);
  const view=useMemo(()=>data?createAdminConsoleViewModel(data):null,[data]),summary=view?.accountSummary,overall=view?.health.overall;

  return <main className={styles.page} aria-busy={loading}>
    <header className={styles.heading}>
      <div className={styles.headingCopy}><h1>관리 콘솔</h1><p>계정과 권한 운영에서 확인이 필요한 작업을 관리합니다.</p></div>
      <div className={styles.headingActions}>
        <span className={styles.connection} data-status={overall}><i/><span><b>{overall==="healthy"?"전체 서비스 정상":overall==="warning"?"일부 서비스 경고":overall==="offline"?"서비스 연결 장애":"상태 확인 중"}</b>{view&&<small>마지막 확인 {time(view.checkedAt)} KST</small>}</span></span>
        <button type="button" className={styles.refreshAction} onClick={()=>void load()} disabled={loading}><RefreshIcon/>{loading?"갱신 중":"새로고침"}</button>
      </div>
    </header>
    {failed&&!data&&<div className={styles.error} role="alert">관리 현황을 불러오지 못했습니다. <button type="button" onClick={()=>void load()}>다시 확인</button></div>}

    <section className={styles.operationSummary} aria-label="운영 요약">
      {!summary?<Skeleton styles={styles} rows={1}/>:<>
        <Link href="/admin/users?view=attention" data-tone="warning"><span>확인 필요</span><b>{summary.attentionCount}건</b><small>우선 검토</small></Link>
        <Link href="/admin/users?account_status=ACTIVE" data-tone="active"><span>활성 계정</span><b>{summary.activeUsers} / {summary.totalUsers}명</b><small>운영 중</small></Link>
        <Link href="/admin/users?view=inactive" data-tone="neutral"><span>비활성 계정</span><b>{summary.inactiveUsers}명</b><small>상태 확인</small></Link>
        <Link href="/admin/audit-logs?range=today" data-tone="change"><span>오늘 변경</span><b>{summary.todayChangeCount}건</b><small>최근 활동</small></Link>
      </>}
    </section>

    <div className={styles.workspaceGrid}>
      <section className={styles.queue} aria-labelledby="queue-title">
        <header><div><h2 id="queue-title">우선 처리</h2><p>확인이 필요한 계정과 권한 업무를 바로 처리합니다.</p></div><b>{summary?.attentionCount??0}건</b></header>
        {!view?<Skeleton styles={styles}/>:view.issues.length===0?<div className={styles.empty}><strong>현재 처리할 관리 항목이 없습니다.</strong></div>:<div className={styles.taskList}>{view.issues.map(issue=>issue.target&&<article key={issue.key} data-kind={issue.key}>
          <div className={styles.taskMeta}><span className={styles.taskState}>{issuePresentation[issue.key].level}</span><b>{issue.affectedUsers.length}명</b></div>
          <div className={styles.taskCopy}><h3>{issue.title}</h3><p>{representative(issue)} · {issuePresentation[issue.key].detail}</p></div>
          <footer><span><small>담당 영역</small>{issuePresentation[issue.key].location}</span><Link href={issue.target.href}>{issueAction[issue.key]}<i aria-hidden="true">→</i></Link></footer>
        </article>)}</div>}
      </section>

      <section className={styles.activities} aria-labelledby="activities-title">
        <header><div><h2 id="activities-title">최근 활동</h2><p>최근 계정과 역할 변경 기록입니다.</p></div>{permissions.has("AUDIT.READ")&&<Link href="/admin/audit-logs"><AuditIcon/><span>전체 감사 로그 보기</span><i aria-hidden="true">→</i></Link>}</header>
        {!view?<Skeleton styles={styles}/>:view.recentChanges.length?<ol className={styles.activityList}>{view.recentChanges.map(change=><li key={change.id} data-action={change.action}><i aria-hidden="true"/><div><span><strong>{change.action}</strong><time dateTime={change.occurredAt}>{time(change.occurredAt)}</time></span><b>{change.target}</b><p>{changeSentence(change.detail)}</p><small>실행자 · {change.actor??"정보 없음"}</small></div></li>)}</ol>:<div className={styles.empty}>아직 기록된 관리자 활동이 없습니다.</div>}
        {view&&<section className={styles.systemStatus} aria-labelledby="system-status-title"><header><h3 id="system-status-title">운영 상태</h3></header><dl><div><dt>전체 서비스</dt><dd data-status={view.health.overall}>{healthLabel(view.health.overall)}</dd></div><div><dt>API 연결</dt><dd data-status={view.health.api}>{healthLabel(view.health.api)}</dd></div><div><dt>데이터베이스</dt><dd data-status={view.health.database}>{healthLabel(view.health.database)}</dd></div><div><dt>마지막 확인</dt><dd>{time(view.checkedAt)}</dd></div></dl></section>}
      </section>
    </div>
    <span className={styles.liveRegion} role="status" aria-live="polite">{announcement}</span>
  </main>;
}
