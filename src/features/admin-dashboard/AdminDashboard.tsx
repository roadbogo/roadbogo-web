"use client";
import Link from "next/link";
import {useCallback,useEffect,useMemo,useRef,useState} from "react";
import {useAuth} from "@/components/auth/AuthContext";
import {createAdminDashboardAdapter} from "./adminDashboardAdapter";
import {createAdminConsoleViewModel,type AdminIssue} from "./adminConsoleViewModel";
import type {AdminDashboardSnapshot} from "./adminDashboardTypes";
import hubStyles from "./AdminManagementHub.module.css";

type Styles=Record<string,string>;
const issuePresentation:Record<AdminIssue["key"],{level:string;action:string}>={ROLE_UNASSIGNED:{level:"우선",action:"역할 설정"},NO_LOGIN_HISTORY:{level:"검토",action:"계정 확인"},INACTIVE_ACCOUNT:{level:"조회",action:"비활성 계정 보기"}};
const time=(value:string)=>new Intl.DateTimeFormat("ko-KR",{timeZone:"Asia/Seoul",hour:"2-digit",minute:"2-digit",hour12:false}).format(new Date(value));
function Skeleton({styles,rows=3}:{styles:Styles;rows?:number}){return <div className={styles.skeleton} aria-hidden="true">{Array.from({length:rows},(_,index)=><i key={index}/>)}</div>}
function representative(issue:AdminIssue){const first=issue.affectedUsers[0]?.name??"대상 없음",remaining=issue.affectedUsers.length-1;return `${first}${remaining>0?` 외 ${remaining}명`:""}`}
export function AdminDashboard({classNames}:{classNames:Styles}){
 const styles={...classNames,...hubStyles};
 const{user}=useAuth(),permissions=new Set(user?.apiPermissions??[]);
 const adapter=useMemo(()=>createAdminDashboardAdapter(),[]),[data,setData]=useState<AdminDashboardSnapshot|null>(null),[loading,setLoading]=useState(true),[failed,setFailed]=useState(false);
 const inFlight=useRef(false),abort=useRef<AbortController|null>(null),tasksRef=useRef<HTMLElement>(null);
 const load=useCallback(async()=>{if(inFlight.current)return;inFlight.current=true;setLoading(true);setFailed(false);abort.current?.abort();const next=new AbortController();abort.current=next;try{setData(await adapter.load(next.signal))}catch(error){if(!(error instanceof DOMException&&error.name==="AbortError"))setFailed(true)}finally{inFlight.current=false;setLoading(false)}},[adapter]);
 useEffect(()=>{const timer=setTimeout(()=>void load(),0);return()=>{clearTimeout(timer);abort.current?.abort()}},[load]);
 const view=useMemo(()=>data?createAdminConsoleViewModel(data):null,[data]),overall=view?.health.overall,summary=view?.accountSummary;
 const focusTasks=()=>{tasksRef.current?.scrollIntoView({behavior:"smooth",block:"start"});window.setTimeout(()=>tasksRef.current?.focus({preventScroll:true}),350)};
 return <main className={styles.page} aria-busy={loading}>
  <header className={styles.heading}><div><h1>관리 콘솔</h1><p>계정과 권한 운영에서 지금 확인할 작업을 관리합니다.</p></div><div className={styles.headingTools}><div className={styles.connection}><span data-status={overall}><i/>{overall==="healthy"?"연결 정상":overall==="warning"?"일부 경고":overall==="offline"?"연결 장애":"확인 불가"}</span><time dateTime={view?.checkedAt}>{view?`최근 갱신 ${time(view.checkedAt)} KST`:"상태 확인 중"}</time></div><div className={styles.headingActions}><button type="button" className={styles.refreshAction} onClick={()=>void load()} disabled={loading}>{loading?"갱신 중…":"새로고침"}</button>{summary&&<button type="button" className={styles.reviewAction} onClick={focusTasks}>{summary.attentionCount?`검토 항목 ${summary.attentionCount}`:"검토 항목 없음"}</button>}{permissions.has("USER.WRITE")&&<Link href="/admin/users/new" className={styles.primaryAction}>운영 계정 추가</Link>}</div></div></header>
  {failed&&!data&&<div className={styles.error} role="alert">관리 현황을 불러오지 못했습니다. <button onClick={()=>void load()}>다시 확인</button></div>}
  <section className={styles.briefing} aria-label="관리 요약">{summary?<dl><div><dt>전체 사용자</dt><dd>{summary.totalUsers}</dd></div><div><dt>활성 계정</dt><dd>{summary.activeUsers}</dd></div><div className={styles.attentionMetric}><dt>검토 필요</dt><dd>{summary.attentionCount}</dd><details><summary aria-label="검토 필요 구성 보기">구성 보기</summary><div>{view?.issues.map(issue=><span key={issue.key}>{issue.title}<b>{issue.affectedUsers.length}</b></span>)}</div></details></div><div><dt>오늘 변경</dt><dd>{summary.todayChangeCount}</dd></div></dl>:<Skeleton styles={styles} rows={2}/>}</section>
  <div className={styles.mainGrid}>
   <section ref={tasksRef} tabIndex={-1} className={styles.tasks} aria-labelledby="tasks-title"><header><h2 id="tasks-title">지금 처리할 작업</h2><p>계정과 권한 운영에서 우선 확인할 항목입니다.</p></header>{!view?<Skeleton styles={styles}/>:view.issues.length===0?<div className={styles.empty}><strong>현재 확인이 필요한 관리 작업이 없습니다.</strong><p>최근 변경과 전체 운영 현황은 아래에서 확인할 수 있습니다.</p></div>:<div className={styles.taskList}>{view.issues.map(issue=>{const present=issuePresentation[issue.key];return <article key={issue.key} data-kind={issue.key}><span>{present.level}</span><div><h3>{issue.title}</h3><p>{representative(issue)} · {issue.description}</p></div><b>{issue.affectedUsers.length}명</b>{issue.target&&<Link href={issue.target.href} aria-label={`${issue.title}, ${present.action}`}>{present.action}</Link>}</article>})}</div>}</section>
   <aside className={styles.coverage} aria-labelledby="coverage-title"><header><h2 id="coverage-title">역할 구성 현황</h2><p>활성·비활성 운영 계정을 포함한 역할 연결 기준입니다.</p></header>{!view?<Skeleton styles={styles}/>:view.roleCoverage.length?<><dl>{view.roleCoverage.map(item=><div key={item.roleCode}><dt>{item.roleName}</dt><dd>{item.assignedUserCount}명</dd></div>)}<div data-unassigned><dt>역할 미지정</dt><dd>{summary?.usersWithoutRoles??0}명</dd></div><div data-multiple><dt>복수 역할</dt><dd>{summary?.multipleRoleUsers??0}명</dd></div></dl><small>복수 역할 사용자는 역할별 인원에 중복 집계될 수 있습니다.<br/>역할 구성은 `역할·권한` 화면에서 관리합니다.</small></>:<div className={styles.empty}>역할 구성 정보를 준비하고 있습니다.</div>}</aside>
  </div>
  <section className={styles.activities} aria-labelledby="activities-title"><header><div><h2 id="activities-title">최근 관리자 활동</h2><p>최근 계정·역할 변경 내역입니다.</p></div></header>{!view?<Skeleton styles={styles}/>:view.recentChanges.length?<div className={styles.activityTable}><table><thead><tr><th>시각</th><th>처리자</th><th>작업</th><th>대상</th><th>결과</th><th>변경 내용</th></tr></thead><tbody>{view.recentChanges.map(change=><tr key={change.id}><td data-label="시각"><time dateTime={change.occurredAt}>{time(change.occurredAt)} KST</time></td><td data-label="처리자"><small>{change.actor??"정보 없음"}</small></td><td data-label="작업"><strong>{change.action}</strong></td><td data-label="대상"><b title={change.target}>{change.target}</b></td><td data-label="결과"><em>기록됨</em></td><td data-label="변경 내용"><span>{change.detail}</span></td></tr>)}</tbody></table></div>:<div className={styles.empty}>아직 기록된 관리자 활동이 없습니다.</div>}</section>
  <span className={styles.liveRegion} role="status" aria-live="polite">{loading?"관리 현황을 확인하고 있습니다.":view?`마지막 업데이트 ${time(view.checkedAt)}`:""}</span>
 </main>
}
