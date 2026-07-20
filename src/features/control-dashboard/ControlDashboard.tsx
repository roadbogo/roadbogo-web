"use client";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "@/components/auth/AuthContext";
import { LandingHeader } from "@/components/landing/LandingHeader";
import { CctvFocusModal } from "@/components/control/CctvFocusModal";
import { createMockDashboardSnapshot, MockDashboardAdapter } from "./mockDashboardAdapter";
import { canUsePrimaryAction, countKpi, filterByKpi, formatKst, incidentStatusLabel, nextActionLabel, prioritizeIncidents, relativeTime, riskLabel, selectIncidentForCctv, activeStatuses, type KpiFilter } from "./dashboardDomain";
import type { DashboardCctv, DashboardIncident, DashboardSnapshot, IncidentStatus } from "./dashboardTypes";
import "@/components/landing/landing.css";
import "./controlDashboard.css";

const adapter=new MockDashboardAdapter();
const initialSnapshot=createMockDashboardSnapshot();
const kpis:{key:Exclude<KpiFilter,null>;label:string}[]=[{key:"unconfirmed",label:"미확인 사건"},{key:"review",label:"관제 검토 중"},{key:"dispatch",label:"출동 진행"},{key:"closing",label:"종료 대기"}];
const steps:{statuses:IncidentStatus[];label:string}[]=[
  {statuses:["NEW"],label:"AI 위험 후보"},{statuses:["NEW"],label:"사건 생성"},{statuses:["ACKNOWLEDGED","CLAIMED"],label:"관제 확인"},
  {statuses:["UNDER_REVIEW"],label:"검토·판정"},{statuses:["DISPATCH_REQUESTED","DISPATCHED"],label:"출동 배정"},
  {statuses:["ON_SCENE","ACTION_IN_PROGRESS","ACTION_COMPLETED"],label:"현장 조치"},{statuses:["CLOSED","FALSE_POSITIVE"],label:"관제 종료"},
];
const statusRank:Record<IncidentStatus,number>={NEW:1,ACKNOWLEDGED:2,CLAIMED:2,UNDER_REVIEW:3,DISPATCH_REQUESTED:4,DISPATCHED:4,ON_SCENE:5,ACTION_IN_PROGRESS:5,ACTION_COMPLETED:5,CLOSED:6,FALSE_POSITIVE:6};
type RailFilter="urgent"|"mine"|"closing";
const ExpandIcon=()=> <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 3H3v5M16 3h5v5M8 21H3v-5M16 21h5v-5"/></svg>;
function Video({cctv,incident}:{cctv:DashboardCctv;incident?:DashboardIncident}){
  const state=cctv.video_state;
  return <div className={`command-cctv__video is-${state.toLowerCase()}`}>
    {state==="LOADING"&&<span className="command-cctv__skeleton">영상 불러오는 중</span>}
    {state==="UNAVAILABLE"&&<span className="command-cctv__empty">{cctv.has_stream?"영상 연결을 확인해 주세요":"제공되는 영상이 없습니다"}</span>}
    {state!=="LOADING"&&state!=="UNAVAILABLE"&&<><span className="command-cctv__road"/>{incident&&<span className="command-detection"><b>{incident.object_category}</b><small>{Math.round(incident.representative_confidence*100)}%</small></span>}</>}
    {cctv.fallback_used&&<em>마지막 정상 데이터 사용 중</em>}
  </div>
}
export function ControlDashboard(){
  const{user}=useAuth(); const[data,setData]=useState<DashboardSnapshot|null>(initialSnapshot); const[error,setError]=useState("");
  const[selectedIncident,setSelectedIncident]=useState<string|null>("incident-0013"); const[standaloneCctv,setStandaloneCctv]=useState<string|null>(null);
  const[filter,setFilter]=useState<KpiFilter>(null); const[focusCctv,setFocusCctv]=useState<string|null>(null); const[alerted,setAlerted]=useState<Set<string>>(new Set());
  const[mobileBrief,setMobileBrief]=useState(false); const[focusSource,setFocusSource]=useState<HTMLElement|null>(null); const[railFilter,setRailFilter]=useState<RailFilter>("urgent");
  const load=useCallback(()=>{setError("");void adapter.load().then(snapshot=>{setData(snapshot);const first=prioritizeIncidents(snapshot.incidents.filter(i=>activeStatuses.includes(i.status)))[0];setSelectedIncident(current=>snapshot.incidents.some(item=>item.public_id===current)?current:first?.public_id??null);const urgent=snapshot.incidents.filter(i=>i.status==="NEW"&&["HIGH","CRITICAL"].includes(i.current_risk_grade));setAlerted(current=>{const next=new Set(current);urgent.forEach(item=>next.add(item.public_id));return next})}).catch(()=>setError("관제 데이터를 불러오지 못했습니다."))},[]);
  useEffect(load,[load]);
  const activeIncidents=useMemo(()=>data?.incidents.filter(i=>activeStatuses.includes(i.status))??[],[data]);
  const incident=data?.incidents.find(item=>item.public_id===selectedIncident)??null;
  const selectedCctv=incident?.cctv_public_id??standaloneCctv;
  const cctv=data?.cctvs.find(item=>item.public_id===selectedCctv)??null;
  const rail=useMemo(()=>{let items=filterByKpi(activeIncidents,filter);if(railFilter==="urgent")items=items.filter(item=>["CRITICAL","HIGH"].includes(item.current_risk_grade));if(railFilter==="mine")items=items.filter(item=>item.assigned_controller?.public_id===user?.publicId);if(railFilter==="closing")items=items.filter(item=>item.status==="ACTION_COMPLETED");return prioritizeIncidents(items)},[activeIncidents,filter,railFilter,user?.publicId]);
  const chooseIncident=(item:DashboardIncident)=>{setSelectedIncident(item.public_id);setStandaloneCctv(null);setMobileBrief(true)};
  const chooseCctv=(item:DashboardCctv)=>{const candidate=selectIncidentForCctv(activeIncidents,item.public_id);setSelectedIncident(candidate?.public_id??null);setStandaloneCctv(candidate?null:item.public_id);setMobileBrief(false)};
  const permissions=user?.apiPermissions??[];
  const canAct=incident&&user?canUsePrimaryAction(incident,{publicId:user.publicId??"",apiPermissions:permissions,organizationPublicId:user.organization?.publicId}):false;
  if(!data&&!error)return <><LandingHeader showSections={false}/><main className="command-loading" role="status">실시간 관제 데이터를 준비하고 있습니다.</main></>;
  if(error)return <><LandingHeader showSections={false}/><main className="command-loading"><p>{error}</p><button onClick={load}>다시 시도</button></main></>;
  if(!data)return null;
  const normal=data.cctvs.filter(item=>item.operational_status==="NORMAL").length;
  const urgentVisible=activeIncidents.some(i=>i.status==="NEW"&&["HIGH","CRITICAL"].includes(i.current_risk_grade)&&alerted.has(i.public_id));
  return <div className="command-page"><LandingHeader showSections={false}/><main className="command-shell">
    <section className="command-summary"><header className="command-heading"><div><span>CONTROL COMMAND</span><h1>관제 대시보드</h1><p>위험 사건을 선택하고 탐지 근거와 다음 업무를 한 흐름에서 확인합니다.</p></div><div className="command-sync"><span><i/> 실시간 API 미연결 · 데모 데이터</span><small>데이터 기준 시각 {formatKst(data.fetched_at)} KST</small></div></header>
      <div className="command-kpis" aria-label="업무 상태 필터">{kpis.map(item=><button key={item.key} type="button" className={filter===item.key?"is-active":""} aria-pressed={filter===item.key} onClick={()=>setFilter(value=>value===item.key?null:item.key)}><span>{item.label}</span><strong>{countKpi(activeIncidents,item.key)}</strong><i/></button>)}</div>
      {urgentVisible&&<div className="command-alert" role="status"><strong>긴급 사건 발생</strong><span>우선 대응 사건 목록에서 새로운 고위험 사건을 확인해 주세요.</span><button onClick={()=>setAlerted(new Set())}>알림 확인</button></div>}
    </section>
    <div className="command-workspace">
      <section className="command-wall"><header><div><span>LIVE CCTV WALL</span><h2>실시간 CCTV</h2></div><p>{data.cctvs.length}개 표시 · 정상 {normal} · 지연 {data.cctvs.filter(i=>i.operational_status==="DELAYED").length} · 장애 {data.cctvs.filter(i=>i.operational_status==="FAILED").length}</p></header>
        <div className="command-mobile-cctv-tabs" aria-label="CCTV 선택">{data.cctvs.map(item=><button key={item.public_id} className={selectedCctv===item.public_id?"is-active":""} onClick={()=>chooseCctv(item)}>{item.cctv_name}</button>)}</div>
        <div className="command-cctv-grid">{data.cctvs.map(item=>{const linked=prioritizeIncidents(activeIncidents.filter(i=>i.cctv_public_id===item.public_id))[0];const selected=item.public_id===selectedCctv;return <article key={item.public_id} className={`command-cctv ${selected?"is-selected":""}`} aria-current={selected?"true":undefined} onClick={()=>chooseCctv(item)} onDoubleClick={event=>{if(item.has_stream){setFocusSource(event.currentTarget);setFocusCctv(item.public_id)}}} tabIndex={0} onKeyDown={event=>{if(event.key==="Enter"||event.key===" "){event.preventDefault();chooseCctv(item)}}}><div className="command-cctv__top"><div><strong>{item.cctv_name}</strong><span className={`device-${item.operational_status.toLowerCase()}`}>{item.operational_status==="NORMAL"?"정상":item.operational_status==="DELAYED"?"지연":"장애"}</span>{selected&&<em>선택됨</em>}</div><span>{item.source_type}</span></div><div className="command-cctv__viewport"><Video cctv={item} incident={linked}/><button className="command-cctv__focus" type="button" disabled={!item.has_stream} aria-label={`${item.cctv_name} 집중 관제 열기`} onClick={event=>{event.stopPropagation();setFocusSource(event.currentTarget);setFocusCctv(item.public_id)}}><ExpandIcon/></button></div><footer><div><strong>{item.road.road_name}</strong><span>{item.road_section.section_name} · {item.direction_code}</span></div></footer>{linked?<div className="command-cctv__incident"><span>{linked.incident_no}</span><b>{incidentStatusLabel[linked.status]}</b></div>:<div className="command-cctv__incident is-empty"><span>진행 사건 없음</span><b>대기</b></div>}</article>})}</div>
      </section>
      <aside className={`command-rail ${mobileBrief?"show-brief":""}`}><section className="command-incident-workspace"><div className="command-priority"><header><div><span>INCIDENT RAIL</span><h2>우선 대응 사건</h2></div><button type="button" onClick={()=>{setFilter(null);setRailFilter("urgent")}}>필터 초기화</button></header>
          <div className="command-rail-tabs" role="tablist" aria-label="사건 분류">{([{key:"urgent",label:"긴급"},{key:"mine",label:"내 담당"},{key:"closing",label:"종료 대기"}] as {key:RailFilter;label:string}[]).map(tab=><button key={tab.key} type="button" role="tab" aria-selected={railFilter===tab.key} onClick={()=>setRailFilter(tab.key)}>{tab.label}</button>)}</div>
          {rail.length?<div className="command-incident-list">{rail.map(item=><button type="button" key={item.public_id} className={selectedIncident===item.public_id?"is-active":""} aria-pressed={selectedIncident===item.public_id} onClick={()=>chooseIncident(item)}><i className={`risk-${item.current_risk_grade.toLowerCase()}`}/><span><small>{riskLabel[item.current_risk_grade]} · {incidentStatusLabel[item.status]}</small><strong>{item.incident_no}</strong><em>{item.object_category} · {data.cctvs.find(c=>c.public_id===item.cctv_public_id)?.cctv_name} · {item.assigned_controller?.display_name??"미배정"}</em></span><time title={formatKst(item.created_at)}>{relativeTime(item.created_at)}</time></button>)}</div>:<p className="command-empty">선택한 분류에 해당하는 사건이 없습니다.</p>}
        </div><div className="command-rail-divider"/>
        <section className="command-brief"><button className="command-brief__back" onClick={()=>setMobileBrief(false)}>사건 목록으로</button><header><span>SELECTED INCIDENT</span><h2>선택 사건 브리핑</h2></header>{incident?<><div className="command-brief__identity"><div><strong>{incident.incident_no}</strong><p>{incident.object_category} · <span className={`risk-${incident.current_risk_grade.toLowerCase()}`}>{riskLabel[incident.current_risk_grade]}</span></p></div><span>{incidentStatusLabel[incident.status]}</span></div><p className="command-brief__location">{cctv?.cctv_name??"CCTV 정보 없음"}<br/>{cctv?`${cctv.road.road_name} · ${cctv.road_section.section_name} · ${cctv.direction_code}`:"도로 정보 없음"}</p><dl><div><dt>신뢰도</dt><dd>{Math.round(incident.representative_confidence*100)}%</dd></div><div><dt>지속시간</dt><dd>{(incident.duration_ms/1000).toFixed(1)}초</dd></div><div><dt>반복 탐지</dt><dd>{incident.detection_count}회</dd></div><div><dt>AI 위험 점수</dt><dd>{incident.current_risk_score}</dd></div><div><dt>담당 관제자</dt><dd>{incident.assigned_controller?.display_name??"미배정"}</dd></div></dl><p className="command-ai-note">AI는 위험 후보를 제시했습니다. 최종 위험 여부와 출동 필요성은 관제자가 판단합니다.</p><div className="command-brief__actions">{canAct?<Link className="command-primary" href={`/control/incidents/${incident.public_id}`}>{nextActionLabel[incident.status]}</Link>:<><button className="command-primary" disabled>{nextActionLabel[incident.status]}</button><p>{incident.assigned_controller?"다른 관제자가 처리 중이거나 현재 권한으로 수행할 수 없습니다.":"현재 상태에 필요한 관제 권한이 없습니다."}</p></>}<Link className="command-secondary" href={`/control/incidents/${incident.public_id}`}>사건 상세 보기</Link></div></>:<p className="command-empty">CCTV 또는 사건을 선택하면 브리핑을 확인할 수 있습니다.</p>}</section></section>
      </aside>
    </div>
    <section className="command-flow"><header><div><span>RESPONSE FLOW</span><h2>선택 사건 통합 대응</h2></div>{incident&&<small>{incident.incident_no} · 갱신 {formatKst(incident.updated_at)} KST</small>}</header>{incident?<div className="command-flow__body"><div className="command-flow__steps">{steps.map((step,index)=>{const current=statusRank[incident.status],state=index<current?"done":index===current?"current":"waiting";return <div key={step.label} className={`is-${state}`}><i>{state==="done"?"✓":index+1}</i><strong>{step.label}</strong><span>{state==="done"?"완료":state==="current"?"현재 단계":"대기"}</span></div>})}</div><div className="command-flow__action"><span>지금 가능한 업무</span>{canAct?<Link href={`/control/incidents/${incident.public_id}`}>{nextActionLabel[incident.status]}</Link>:<strong>사건 상세에서 권한과 담당 상태를 확인해 주세요.</strong>}</div></div>:<p className="command-empty">CCTV 또는 사건을 선택하면 대응 흐름을 확인할 수 있습니다.</p>}{incident&&data.dispatches.find(d=>d.incident_public_id===incident.public_id)&&<p className="command-dispatch-flow">출동 요청 → 수락 → 출발 → 이동 중 → 현장 도착 → 조치 중 → 조치 완료 <b>· 관제 최종 종료 대기</b></p>}</section>
  </main><CctvFocusModal open={Boolean(focusCctv)} cctv={data.cctvs.find(item=>item.public_id===focusCctv)??null} relatedIncidents={activeIncidents.filter(item=>item.cctv_public_id===focusCctv)} returnFocus={focusSource} onClose={()=>setFocusCctv(null)} onOpenIncident={publicId=>{const next=data.incidents.find(item=>item.public_id===publicId);if(next)chooseIncident(next);setFocusCctv(null)}}/></div>
}
