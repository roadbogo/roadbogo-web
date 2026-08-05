"use client";

import Link from "next/link";
import {useCallback,useEffect,useMemo,useState} from "react";
import {useAuth} from "@/components/auth/AuthContext";
import {formatRiskGrade} from "@/features/control-dashboard/dashboardDomain";
import {createDispatchAdapter} from "./dispatchAdapterFactory";
import {dispatchProgressIndex,dispatchStatusCopy,formatDispatchKst,getNextDispatchAction,dispatchProgressAction,representativeDispatchStatuses,sortDispatchWork,terminalDispatchStatuses} from "./dispatchDomain";
import type {DispatchDetail,DispatchItem} from "./dispatchTypes";
import "./dispatchHub.css";

const adapter=createDispatchAdapter();
export type DispatchHubView="home"|"requested"|"active"|"history";
export const normalizeDispatchHubView=(value?:string):DispatchHubView=>value==="requested"||value==="active"||value==="history"?value:"home";
const stepLabels=["요청","수락","출발","이동 중","도착","현장 조치","완료"];
const icon=(kind:"refresh"|"route"|"search"|"history"|"inbox"|"message"|"current")=><svg viewBox="0 0 24 24" aria-hidden="true">{kind==="refresh"?<><path d="M20 7v5h-5M4 17v-5h5"/><path d="M6 8a7 7 0 0 1 12-2l2 2M18 16a7 7 0 0 1-12 2l-2-2"/></>:kind==="route"?<><circle cx="6" cy="18" r="2"/><circle cx="18" cy="6" r="2"/><path d="M8 18h3a3 3 0 0 0 3-3V9a3 3 0 0 1 3-3"/></>:kind==="search"?<><path d="M6 3h9l4 4v14H6zM15 3v5h5"/><circle cx="11" cy="13" r="3"/><path d="m13.2 15.2 2.3 2.3"/></>:kind==="inbox"?<><path d="M4 5h16l2 9v5H2v-5z"/><path d="M2 14h6l2 3h4l2-3h6"/></>:kind==="message"?<><path d="M4 5h16v11H8l-4 3z"/><path d="M8 9h8M8 12h5"/></>:kind==="current"?<><path d="m5 3 14 8-6 2-2 6z"/><path d="m13 13 4 4"/></>:<><path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5M12 7v5l3 2"/></>}</svg>;
const fallback=(item:DispatchItem):DispatchDetail=>({...item,rejectionReason:null,departedAt:null,enRouteAt:null,arrivedAt:null,actionStartedAt:null,actionCompletedAt:null,cancelledAt:null,previousDispatchPublicId:null});
const currentTime=(detail:DispatchDetail)=>detail.actionStartedAt??detail.arrivedAt??detail.enRouteAt??detail.departedAt??detail.acceptedAt??detail.requestedAt;
const nextWork=(detail:DispatchDetail)=>detail.status==="REQUESTED"?"요청 확인":detail.status==="ACTION_IN_PROGRESS"?"현장 조치 등록":getNextDispatchAction(detail.status)?dispatchProgressAction[getNextDispatchAction(detail.status)!].label:detail.status==="ACTION_COMPLETED"?"관제 확인 대기":"상세 확인";
const routeSection=(value:string)=>value.replace(/\s*(?:→|>|›)\s*/g," — ");
function Risk({grade}:{grade:string}){return <span className="dispatch-risk" data-risk={grade}>{formatRiskGrade(grade)}</span>}
function Status({status}:{status:DispatchDetail["status"]}){return <span className="dispatch-status" data-status={status}>{dispatchStatusCopy[status]}</span>}
function Skeleton({rows=2}:{rows?:number}){return <div className="dispatch-hub-skeleton" aria-hidden="true">{Array.from({length:rows},(_,index)=><i key={index}/>)}</div>}

const headingCopy:Record<DispatchHubView,{title:string;description:string}>={home:{title:"내 출동",description:"배정된 출동 요청과 현장 대응 업무를 관리합니다."},requested:{title:"신규 요청",description:"응답이 필요한 출동 요청을 확인합니다."},active:{title:"진행 중인 출동",description:"현재 출동 단계와 다음 현장 업무를 확인합니다."},history:{title:"완료 이력",description:"조치 완료·거절·취소된 출동 기록을 확인합니다."}};
export function DispatchHub({initialView}:{initialView?:string}={}){
  const{user}=useAuth();
  const view=normalizeDispatchHubView(initialView);
  const[items,setItems]=useState<DispatchDetail[]>([]),[loading,setLoading]=useState(true),[error,setError]=useState(""),[partial,setPartial]=useState(false),[checkedAt,setCheckedAt]=useState("");
  const load=useCallback(async()=>{setLoading(true);setError("");setPartial(false);try{const page=await adapter.list({page:1,size:50,activeOnly:false});const details=await Promise.all(page.items.map(async item=>{try{return await adapter.detail(item.publicId)??fallback(item)}catch{setPartial(true);return fallback(item)}}));setItems(details);setCheckedAt(new Date().toISOString())}catch{setError("출동 정보를 불러오지 못했습니다.")}finally{setLoading(false)}},[]);
  useEffect(()=>{void load()},[load]);
  const sorted=useMemo(()=>sortDispatchWork(items),[items]);
  const active=sorted.find(item=>representativeDispatchStatuses.includes(item.status))??null;
  const requests=sorted.filter(item=>item.status==="REQUESTED");
  const completed=[...items].filter(item=>terminalDispatchStatuses.includes(item.status)).sort((a,b)=>Date.parse(currentTime(b))-Date.parse(currentTime(a)));
  const canUpdate=user?.apiPermissions.includes("DISPATCH.UPDATE_OWN")??false;
  const copy=headingCopy[view];
  const initialLoading=loading&&items.length===0;
  return <div className="dispatch-hub-page"><main className="dispatch-hub-shell">
    <header className="dispatch-hub-heading"><div><h1>{copy.title}</h1><p>{copy.description}</p></div><div><span data-active={Boolean(active)}><i/>{active?"현장 대응 중":"출동 가능"}</span>{checkedAt&&<small>최근 갱신 {formatDispatchKst(checkedAt).split(" ").at(-1)}</small>}<em>{adapter.mode==="mock"?"시연 데이터":"운영 데이터"}</em><button type="button" onClick={()=>void load()} disabled={loading}>{icon("refresh")}{loading?"갱신 중":"새로고침"}</button></div></header>
    {partial&&<p className="dispatch-hub-notice" role="status">일부 상세 정보를 확인하지 못했지만 확인 가능한 출동은 계속 표시합니다.</p>}
    {error&&items.length>0&&<p className="dispatch-hub-notice" role="alert">{error} 기존 출동 정보를 계속 표시합니다.</p>}
    {initialLoading?<div className="dispatch-hub-grid"><Skeleton rows={5}/><Skeleton rows={3}/></div>:error&&items.length===0?<div className="dispatch-hub-error" role="alert"><strong>{error}</strong><button onClick={()=>void load()}>다시 확인</button></div>:items.length===0?<div className="dispatch-hub-empty"><strong>아직 배정된 출동 기록이 없습니다.</strong></div>:view==="history"?<HistoryList items={completed}/>:view==="requested"?<RequestList requests={requests} canUpdate={canUpdate} prominent/>:view==="active"?(active?<div className="dispatch-hub-grid no-active"><CurrentDispatch detail={active}/></div>:<div className="dispatch-hub-empty current-empty"><strong>현재 진행 중인 현장 대응이 없습니다.</strong></div>):<>
        <div className={active?"dispatch-hub-grid":"dispatch-hub-grid no-active"}>
          {active?<CurrentDispatch detail={active}/>:<div className="dispatch-hub-empty current-empty"><strong>현재 진행 중인 현장 대응이 없습니다.</strong></div>}
          {requests.length>0?<RequestList requests={requests} canUpdate={canUpdate} prominent={!active}/>:<div className="dispatch-hub-empty current-empty"><strong>응답이 필요한 새 출동 요청이 없습니다.</strong></div>}
        </div>
      </>}
  </main></div>;
}

function CurrentDispatch({detail}:{detail:DispatchDetail}){const current=Math.max(1,dispatchProgressIndex(detail.status)+1),href=detail.status==="ACTION_IN_PROGRESS"?`/dispatch/${encodeURIComponent(detail.publicId)}/action`:`/dispatch/${encodeURIComponent(detail.publicId)}`;return <article className="dispatch-current" aria-labelledby="current-dispatch-title"><header><div className="dispatch-panel-title"><span>{icon("current")}</span><div><h2 id="current-dispatch-title">현재 현장 대응</h2><p>{dispatchStatusCopy[detail.status]}인 출동 업무</p></div></div><div className="dispatch-current-state"><Status status={detail.status}/><small>다음 업무</small><strong>{nextWork(detail)}</strong></div></header><div className="dispatch-current-main"><div className="dispatch-location"><span>{icon("route")}</span><div><strong>{detail.incident.roadName}</strong><h3>{routeSection(detail.incident.roadSectionName)}</h3></div></div><p className="dispatch-object">{detail.incident.objectCategory} · {detail.incident.cctvName} <Risk grade={detail.incident.riskGrade}/></p><small>{detail.incident.incidentNo}</small>{detail.requestMessage&&<blockquote><span>{icon("message")}</span><div><b>관제 요청</b>{detail.requestMessage}</div></blockquote>}<p className="dispatch-times">요청 {formatDispatchKst(detail.requestedAt)} KST{currentTime(detail)!==detail.requestedAt&&` · 현재 단계 ${formatDispatchKst(currentTime(detail))} KST`}</p></div><ol className="dispatch-hub-progress" aria-label="출동 진행 단계">{stepLabels.map((label,index)=>{const state=index<current?"complete":index===current?"current":"pending";return <li key={label} data-state={state} aria-label={`${label}, ${state==="complete"?"완료":state==="current"?"현재 단계":"예정"}`} aria-current={state==="current"?"step":undefined}><i aria-hidden="true">{state==="complete"?"✓":state==="current"?icon("current"):null}</i><span>{label}</span></li>})}</ol><footer><div><small>다음 업무</small><strong>{nextWork(detail)}</strong></div><Link href={href}>{icon("route")}{detail.status==="ACTION_IN_PROGRESS"?"현장 조치 등록":"업무 계속하기"}</Link></footer></article>}
function RequestList({requests,canUpdate,prominent}:{requests:DispatchDetail[];canUpdate:boolean;prominent:boolean}){return <section className={prominent?"dispatch-requests prominent":"dispatch-requests"} aria-labelledby="requests-title"><header><div className="dispatch-panel-title"><span>{icon("inbox")}</span><div><h2 id="requests-title">새 요청</h2><p>응답을 기다리는 출동 요청입니다.</p></div></div><b><span>{requests.length}</span>건</b></header><div>{requests.map(item=><article key={item.publicId}><span><Status status={item.status}/><Risk grade={item.incident.riskGrade}/></span><strong>{item.incident.incidentNo}</strong><p>{item.incident.objectCategory} · {item.incident.roadName}</p><small>{routeSection(item.incident.roadSectionName)}<br/>요청 {formatDispatchKst(item.requestedAt)} KST</small>{canUpdate&&<Link href={`/dispatch/${encodeURIComponent(item.publicId)}`}>{icon("search")}요청 검토</Link>}</article>)}</div></section>}
function CompletedRow({item}:{item:DispatchDetail}){const completed=item.status==="ACTION_COMPLETED",href=completed?`/dispatch/${encodeURIComponent(item.publicId)}/action`:`/dispatch/${encodeURIComponent(item.publicId)}`;return <article><Status status={item.status}/><div><strong>{item.incident.incidentNo}</strong><span>{item.incident.objectCategory} · {item.incident.roadName} · {item.incident.roadSectionName}</span></div><time>{formatDispatchKst(currentTime(item))} KST</time><Link href={href}>{completed?"조치 결과 보기":"출동 상세 보기"}</Link></article>}
function HistoryList({items}:{items:DispatchDetail[]}){return <section className="dispatch-history" aria-labelledby="history-title"><header><div className="dispatch-panel-title"><span>{icon("history")}</span><div><h2 id="history-title">출동 이력</h2><p>완료·거절·취소된 출동 업무입니다.</p></div></div></header>{items.length?<div>{items.map(item=><CompletedRow key={item.publicId} item={item}/>)}</div>:<div className="dispatch-hub-empty"><strong>아직 배정된 출동 기록이 없습니다.</strong></div>}</section>}
