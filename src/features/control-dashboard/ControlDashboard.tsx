"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "@/components/auth/AuthContext";
import { LandingHeader } from "@/components/landing/LandingHeader";
import { CctvFocusModal } from "@/components/control/CctvFocusModal";
import { SelectedIncidentPanel } from "@/components/control/SelectedIncidentPanel";
import { createDashboardAdapter } from "./dashboardAdapterFactory";
import { beginDispatchLookup, completeDispatchLookup, createDashboardInitialState, failDispatchLookup, selectIncidentAfterDashboardLoad, type DashboardDispatchLookup } from "./dashboardInitialState";
import {
  activeStatuses, countKpi, filterByKpi, formatCompactKst, formatKst,
  filterDashboardRail, highRiskAlertKey, incidentStatusLabel, prioritizeIncidents, relativeTime, resolveDispatchPresentation,
  resolvePrimaryActionAvailability, resolveUrgentIncidentSelection, riskLabel, selectHighRiskAlert, selectIncidentForCctv, type DashboardRailFilter, type KpiFilter,
} from "./dashboardDomain";
import { directionLabel, mergeDashboardIncidentSelection, objectCategoryLabel, operationalStatusLabel } from "./dashboardMapper";
import type { DashboardCctv, DashboardIncident, DashboardSnapshot, DispatchLookupStatus } from "./dashboardTypes";
import { getDetectionVisualVariant } from "@/features/detection/detectionVisualVariant";
import "@/components/landing/landing.css";
import "./controlDashboard.css";
import "./dashboardEmptyState.css";
import "./dashboardReadability.css";
import "./dashboardWorkflow.css";

const adapter=createDashboardAdapter();
const initialState=createDashboardInitialState(adapter.mode);
const kpis:{key:Exclude<KpiFilter,null>;label:string}[]=[
  {key:"unconfirmed",label:"미확인"},{key:"review",label:"관제 처리 중"},
  {key:"dispatch",label:"출동·조치 중"},{key:"closing",label:"종료 대기"},
];
const railFilters:{key:DashboardRailFilter;label:string}[]=[
  {key:"high",label:"우선"},{key:"mine",label:"내 담당"},
  {key:"unassigned",label:"미배정"},{key:"closing",label:"종료 대기"},
];
const MaximizeIcon=()=> <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 3h6v6M21 3l-7 7M9 21H3v-6M3 21l7-7"/></svg>;

function Video({cctv,incident}:{cctv:DashboardCctv;incident?:DashboardIncident}){
  const state=cctv.video_state;
  const visualVariant=incident?getDetectionVisualVariant({objectCategory:incident.object_category,classCode:incident.class_code}):"default";
  return <div className={`command-cctv__video is-${state.toLowerCase()}`}>
    {state==="LOADING"&&<span className="command-cctv__skeleton"><strong>영상 연결 중</strong><small>잠시만 기다려 주세요.</small></span>}
    {state==="UNAVAILABLE"&&<span className="command-cctv__empty"><strong>{cctv.has_stream?"영상을 불러올 수 없습니다":"제공되는 영상이 없습니다"}</strong><small>{cctv.has_stream?"현재 CCTV 연결 상태를 확인해 주세요.":"CCTV 상태 정보는 계속 확인할 수 있습니다."}</small></span>}
    {state!=="LOADING"&&state!=="UNAVAILABLE"&&<><span className="command-cctv__road"/>{incident&&<span className="command-detection" data-visual-variant={visualVariant}><b>{incident.class_name??objectCategoryLabel[incident.object_category]}</b><small>AI {incident.representative_confidence===null?"신뢰도 없음":`${Math.round(incident.representative_confidence*100)}%`}</small></span>}</>}
    {cctv.fallback_used&&<em>마지막 정상 데이터 사용 중</em>}
  </div>;
}

export function ControlDashboard(){
  const{user}=useAuth();
  const[data,setData]=useState<DashboardSnapshot|null>(initialState.data);
  const[error,setError]=useState("");
  const[loading,setLoading]=useState(initialState.loading);
  const[selectedIncident,setSelectedIncident]=useState<string|null>(initialState.selectedIncident);
  const[dispatchLookup,setDispatchLookup]=useState<DashboardDispatchLookup>(beginDispatchLookup(null));
  const[standaloneCctv,setStandaloneCctv]=useState<string|null>(null);
  const[kpiFilter,setKpiFilter]=useState<KpiFilter>(null);
  const[railFilter,setRailFilter]=useState<DashboardRailFilter>("high");
  const[query,setQuery]=useState("");
  const[focusCctv,setFocusCctv]=useState<string|null>(null);
  const[focusSource,setFocusSource]=useState<HTMLElement|null>(null);
  const[dismissedAlerts,setDismissedAlerts]=useState<Set<string>>(new Set());
  const[selectionFeedback,setSelectionFeedback]=useState<{message:string;error:boolean}|null>(null);
  const[highlightedIncident,setHighlightedIncident]=useState<string|null>(null);
  const[mobileBrief,setMobileBrief]=useState(false);
  const cctvRefs=useRef(new Map<string,HTMLElement>());
  const incidentRefs=useRef(new Map<string,HTMLButtonElement>());
  const pendingReveal=useRef<{incidentId:string;cctvId:string}|null>(null);
  const highlightTimer=useRef<ReturnType<typeof setTimeout>|null>(null);
  const dispatchLookupSequence=useRef(0);

  const load=useCallback(()=>{setLoading(true);setError("");void adapter.load().then(snapshot=>{
    setData(snapshot);
    setSelectedIncident(current=>selectIncidentAfterDashboardLoad(snapshot,current));
  }).catch(()=>setError("관제 데이터를 불러오지 못했습니다.")).finally(()=>setLoading(false))},[]);
  useEffect(load,[load]);

  const activeIncidents=useMemo(()=>data?.incidents.filter(item=>activeStatuses.includes(item.status))??[],[data]);
  const incident=data?.incidents.find(item=>item.public_id===selectedIncident)??null;
  const selectedCctv=incident?.cctv_public_id??standaloneCctv;
  const cctv=data?.cctvs.find(item=>item.public_id===selectedCctv)??null;
  const mockDispatch=incident?data?.dispatches.find(item=>item.incident_public_id===incident.public_id)??null:null;
  const dispatchLookupStatus:DispatchLookupStatus=adapter.mode==="mock"?"ready":dispatchLookup.incidentId===incident?.public_id?dispatchLookup.status:"idle";
  const dispatch=adapter.mode==="mock"?mockDispatch:dispatchLookupStatus==="ready"?dispatchLookup.dispatch:null;

  useEffect(()=>{
    if(adapter.mode==="mock")return;
    const publicId=incident?.public_id;
    const sequence=++dispatchLookupSequence.current;
    if(!publicId){setDispatchLookup(beginDispatchLookup(null));return}
    setDispatchLookup(beginDispatchLookup(publicId));
    void adapter.loadIncidentSelection(publicId).then(selection=>{
      if(sequence!==dispatchLookupSequence.current)return;
      if(!selection){setDispatchLookup(current=>failDispatchLookup(current,publicId));return}
      setData(current=>current?{...current,incidents:current.incidents.map(item=>item.public_id===publicId?mergeDashboardIncidentSelection(item,selection.incident):item)}:current);
      setDispatchLookup(current=>completeDispatchLookup(current,publicId,selection.dispatch));
    }).catch(()=>{if(sequence===dispatchLookupSequence.current)setDispatchLookup(current=>failDispatchLookup(current,publicId))});
  },[incident?.public_id]);

  const rail=useMemo(()=>{
    return filterDashboardRail(filterByKpi(activeIncidents,kpiFilter),data?.cctvs??[],railFilter,query,user?.publicId);
  },[activeIncidents,data?.cctvs,kpiFilter,query,railFilter,user?.publicId]);
  const railCounts=useMemo(()=>Object.fromEntries(railFilters.map(tab=>[
    tab.key,
    filterDashboardRail(filterByKpi(activeIncidents,kpiFilter),data?.cctvs??[],tab.key,query,user?.publicId).length,
  ])) as Record<DashboardRailFilter,number>,[activeIncidents,data?.cctvs,kpiFilter,query,user?.publicId]);
  const searchableIncidentCount=useMemo(()=>filterDashboardRail(filterByKpi(activeIncidents,kpiFilter),data?.cctvs??[],railFilter,"",user?.publicId).length,[activeIncidents,data?.cctvs,kpiFilter,railFilter,user?.publicId]);
  const showSearch=searchableIncidentCount>=6||query.trim().length>0;

  const highRiskAlert=useMemo(()=>selectHighRiskAlert(activeIncidents,dismissedAlerts),[activeIncidents,dismissedAlerts]);

  useEffect(()=>{
    const target=pendingReveal.current;
    if(!target||selectedIncident!==target.incidentId||!rail.some(item=>item.public_id===target.incidentId))return;
    const frame=requestAnimationFrame(()=>{
      const row=incidentRefs.current.get(target.incidentId);
      row?.scrollIntoView({block:"nearest",behavior:"smooth"});
      cctvRefs.current.get(target.cctvId)?.scrollIntoView({block:"nearest",inline:"nearest",behavior:"smooth"});
      row?.focus({preventScroll:true});
      pendingReveal.current=null;
    });
    return()=>cancelAnimationFrame(frame);
  },[rail,selectedIncident]);
  useEffect(()=>{if(!selectionFeedback)return;const timer=setTimeout(()=>setSelectionFeedback(null),2500);return()=>clearTimeout(timer)},[selectionFeedback]);
  useEffect(()=>()=>{if(highlightTimer.current)clearTimeout(highlightTimer.current)},[]);

  const reveal=useCallback((incidentId:string|null,cctvId:string|null)=>requestAnimationFrame(()=>{
    if(cctvId)cctvRefs.current.get(cctvId)?.scrollIntoView({block:"nearest",inline:"nearest",behavior:"smooth"});
    if(incidentId)incidentRefs.current.get(incidentId)?.scrollIntoView({block:"nearest",behavior:"smooth"});
  }),[]);
  const chooseIncident=useCallback((item:DashboardIncident)=>{setSelectedIncident(item.public_id);setStandaloneCctv(null);setMobileBrief(true);reveal(item.public_id,item.cctv_public_id)},[reveal]);
  const chooseCctv=useCallback((item:DashboardCctv)=>{const candidate=selectIncidentForCctv(activeIncidents,item.public_id);setSelectedIncident(candidate?.public_id??null);setStandaloneCctv(candidate?null:item.public_id);setMobileBrief(false);reveal(candidate?.public_id??null,item.public_id)},[activeIncidents,reveal]);
  const closeFocusModal=useCallback(()=>setFocusCctv(null),[]);
  const selectFocusCctv=useCallback((publicId:string)=>{const next=data?.cctvs.find(item=>item.public_id===publicId);if(next){setFocusCctv(publicId);chooseCctv(next)}},[chooseCctv,data?.cctvs]);
  const selectFocusIncident=useCallback((publicId:string)=>{const next=data?.incidents.find(item=>item.public_id===publicId);if(next)chooseIncident(next)},[chooseIncident,data?.incidents]);
  const permissions=user?.apiPermissions??[];
  const baseActionAvailability=incident&&user
    ?resolvePrimaryActionAvailability(incident,{publicId:user.publicId??"",apiPermissions:permissions})
    :{allowed:false,reason:incident?"로그인한 관제자 정보를 확인할 수 없습니다.":null};
  const dispatchStateBlocksAssignment=adapter.mode==="api"&&incident?.status==="DISPATCH_REQUESTED"&&(dispatchLookupStatus!=="ready"||Boolean(dispatch));
  const actionAvailability=dispatchStateBlocksAssignment?{allowed:false,reason:dispatchLookupStatus==="loading"?"활성 출동 상태를 확인하고 있습니다.":dispatchLookupStatus==="error"?"활성 출동 상태를 확인하지 못했습니다.":"이미 활성 출동이 있어 담당자 응답을 기다리고 있습니다."}:baseActionAvailability;
  const canAct=actionAvailability.allowed;

  const openUrgentIncident=()=>{
    if(!highRiskAlert)return;
    const selection=data?resolveUrgentIncidentSelection(data.incidents,data.cctvs,highRiskAlert.public_id):null;
    if(!selection){setSelectionFeedback({message:"긴급 사건 정보를 불러오지 못했습니다",error:true});return}
    const{incident:target,cctv:targetCctv}=selection;
    const visibleWithQuery=filterDashboardRail([target],[targetCctv],"high",query,user?.publicId).some(item=>item.public_id===target.public_id);
    if(!visibleWithQuery)setQuery("");
    if(kpiFilter&&!filterByKpi([target],kpiFilter).length)setKpiFilter(null);
    setRailFilter("high");
    setSelectedIncident(target.public_id);
    setStandaloneCctv(null);
    setMobileBrief(true);
    pendingReveal.current={incidentId:target.public_id,cctvId:targetCctv.public_id};
    setHighlightedIncident(null);
    requestAnimationFrame(()=>setHighlightedIncident(target.public_id));
    if(highlightTimer.current)clearTimeout(highlightTimer.current);
    highlightTimer.current=setTimeout(()=>setHighlightedIncident(null),1400);
    setSelectionFeedback({message:"긴급 사건을 선택했습니다",error:false});
  };

  if(!data&&!error)return <><LandingHeader showSections={false}/><main className="command-loading" role="status">관제 현황을 불러오는 중입니다.</main></>;
  if(error)return <><LandingHeader showSections={false}/><main className="command-loading" role="alert"><p>{error}</p><button onClick={load}>다시 시도</button></main></>;
  if(!data)return null;
  const normal=data.cctvs.filter(item=>item.operational_status==="NORMAL").length;
  const delayed=data.cctvs.filter(item=>item.operational_status==="DELAYED").length;
  const fault=data.cctvs.filter(item=>item.operational_status==="FAULT").length;
  const alertCctv=highRiskAlert?data.cctvs.find(item=>item.public_id===highRiskAlert.cctv_public_id)??null:null;

  return <div className="command-page"><LandingHeader showSections={false}/><main className="command-shell command-shell--workflow">
    <section className="command-summary command-summary--workflow">
      <header className="command-heading"><div><span>CONTROL COMMAND</span><h1>관제 대시보드</h1><p>위험 후보를 확인하고 사건 판단부터 현장 대응까지 한 화면에서 이어서 처리합니다</p></div></header>
      <div className="command-kpis" aria-label="주요 사건 현황">{kpis.map(item=><button key={item.key} type="button" className={kpiFilter===item.key?"is-active":""} aria-pressed={kpiFilter===item.key} onClick={()=>setKpiFilter(value=>value===item.key?null:item.key)}><span>{item.label}</span><strong>{countKpi(activeIncidents,item.key)}</strong><i/></button>)}</div>
      <div className="command-system-bar" aria-label="CCTV 시스템 상태"><strong>CCTV 전체 {data.cctvs.length}</strong><span>정상 {normal}</span><span>지연 {delayed}</span><span>장애 {fault}</span><span>데이터 유형 {data.source==="mock"?"시연 데이터":"운영 데이터"}</span><time>최근 갱신 {formatKst(data.fetched_at)} KST</time><em>{loading?"재연결 중":"실시간 연결 끊김 · 조회 데이터 사용 중"}</em></div>
      {highRiskAlert&&<div className="command-alert command-alert--incident" role="status"><div><strong>{riskLabel[highRiskAlert.current_risk_grade]} 위험 · {highRiskAlert.class_name??objectCategoryLabel[highRiskAlert.object_category]}</strong><span>{alertCctv?.cctv_name??"CCTV 정보 없음"} · {alertCctv?`${alertCctv.road.road_name} ${alertCctv.road_section.section_name} ${directionLabel[alertCctv.direction_code]}`:"위치 정보 없음"} · {relativeTime(highRiskAlert.created_at)}</span></div><button type="button" onClick={openUrgentIncident}>긴급 사건 보기</button><button type="button" aria-label={`${highRiskAlert.incident_no} 알림 닫기`} onClick={()=>setDismissedAlerts(current=>new Set(current).add(highRiskAlertKey(highRiskAlert)))}>알림 닫기</button></div>}
      {selectionFeedback&&<p className={selectionFeedback.error?"command-selection-feedback is-error":"sr-only"} role="status">{selectionFeedback.message}</p>}
    </section>

    <div className="command-workspace command-workspace--workflow">
      <section className="command-wall command-wall--workflow"><header><div><span>CCTV MONITORING</span><h2>CCTV 감시</h2></div><p>선택한 CCTV와 연결 사건을 함께 확인합니다.</p></header>
        <div className="command-mobile-cctv-tabs" aria-label="CCTV 선택">{data.cctvs.map(item=><button key={item.public_id} className={selectedCctv===item.public_id?"is-active":""} onClick={()=>chooseCctv(item)}>{item.cctv_name}</button>)}</div>
        {data.cctvs.length?<div className="command-cctv-grid command-cctv-grid--workflow">{data.cctvs.map(item=>{const linked=prioritizeIncidents(activeIncidents.filter(candidate=>candidate.cctv_public_id===item.public_id))[0];const selected=item.public_id===selectedCctv;return <article ref={node=>{if(node)cctvRefs.current.set(item.public_id,node);else cctvRefs.current.delete(item.public_id)}} key={item.public_id} className={`command-cctv ${selected?"is-selected":""}`} aria-current={selected?"true":undefined} onClick={()=>chooseCctv(item)} onDoubleClick={event=>{if(item.has_stream){setFocusSource(event.currentTarget);setFocusCctv(item.public_id)}}} tabIndex={0} onKeyDown={event=>{if(event.key==="Enter"||event.key===" "){event.preventDefault();chooseCctv(item)}}}>
          <div className="command-cctv__top"><div><strong>{item.cctv_name}</strong><span className={`device-${item.operational_status.toLowerCase()}`}>{operationalStatusLabel[item.operational_status]}</span>{selected&&<em>선택 관제 중</em>}</div><span>{item.source_type} · {item.stream_type??"영상 정보 확인"}</span></div>
          <div className="command-cctv__viewport"><Video cctv={item} incident={linked}/><div className="command-focus-control" data-tooltip={item.has_stream?"집중 관제":"영상 없음"}><button className="command-cctv__focus" type="button" disabled={!item.has_stream} aria-label={`${item.cctv_name} 집중 관제`} onClick={event=>{event.stopPropagation();chooseCctv(item);setFocusSource(event.currentTarget);setFocusCctv(item.public_id)}}><MaximizeIcon/></button></div></div>
          <footer><div><strong>{item.road.road_name}</strong><span>{item.road_section.section_name} · {directionLabel[item.direction_code]}</span></div></footer>
          {linked?<div className="command-cctv__incident"><span>{linked.incident_no}</span><b>{incidentStatusLabel[linked.status]}</b></div>:<div className="command-cctv__incident is-empty"><span>연결 사건 없음</span></div>}
        </article>})}</div>:<div className="command-cctv-empty" role="status"><strong>표시할 CCTV가 없습니다.</strong><p>등록된 CCTV가 생기면 이 영역에 관제 카드가 표시됩니다.</p></div>}
      </section>

      <aside className={`command-rail command-rail--workflow ${mobileBrief?"show-brief":""}`}>
        <section className="command-operations-panel">
          <div className="command-priority command-priority--workflow"><header><div><span>PRIORITY INCIDENTS</span><h2>사건 목록</h2></div></header>
            <div className="command-rail-tabs" role="tablist" aria-label="사건 빠른 필터">{railFilters.map(tab=><button key={tab.key} type="button" role="tab" aria-selected={railFilter===tab.key} onClick={()=>setRailFilter(tab.key)}><span>{tab.label}</span><b>{railCounts[tab.key]}</b></button>)}</div>
            {showSearch&&<label className="command-incident-search"><span className="sr-only">사건 검색</span><input value={query} onChange={event=>setQuery(event.target.value)} placeholder="사건 번호 또는 CCTV 검색"/></label>}
          </div>
            {rail.length?<div className="command-incident-list command-incident-list--workflow" role="listbox" aria-label="사건 목록">{rail.map(item=>{const linked=data.cctvs.find(candidate=>candidate.public_id===item.cctv_public_id);const itemDispatch=data.dispatches.find(candidate=>candidate.incident_public_id===item.public_id)??null;const dispatchView=resolveDispatchPresentation(item,itemDispatch);const selected=selectedIncident===item.public_id;return <button ref={node=>{if(node)incidentRefs.current.set(item.public_id,node);else incidentRefs.current.delete(item.public_id)}} type="button" role="option" key={item.public_id} className={`${selected?"is-active":""} ${highlightedIncident===item.public_id?"is-revealed":""}`} aria-selected={selected} onClick={()=>chooseIncident(item)}><i className={`risk-${item.current_risk_grade.toLowerCase()}`}/><span><span className="command-incident-card__badges"><b>{riskLabel[item.current_risk_grade]}</b><b>{incidentStatusLabel[item.status]}</b></span><strong>{item.incident_no}{selected&&<span className="sr-only"> 선택됨</span>}</strong><em className="command-incident-card__object">{item.class_name??"분류 정보 없음"}</em><em>{linked?.cctv_name??"CCTV 정보 없음"} · {linked?`${linked.road.road_name} · ${linked.road_section.section_name} · ${directionLabel[linked.direction_code]}`:"위치 정보 없음"}</em><span className="command-incident-card__assignment">{dispatchView.compact}</span></span><time dateTime={item.created_at} title={`${formatKst(item.created_at)} KST`}><span className="command-time-exact">{formatCompactKst(item.created_at)}</span><span className="command-time-relative">{relativeTime(item.created_at)}</span></time></button>})}</div>:<p className="command-empty command-incident-list--workflow">조건에 맞는 사건이 없습니다.</p>}
          <div className="command-panel-footer"><button className="command-brief__back" onClick={()=>setMobileBrief(false)}>사건 목록으로</button><SelectedIncidentPanel incident={incident} cctv={cctv} dispatch={dispatch} dispatchLookupStatus={dispatchLookupStatus} canAct={Boolean(canAct)} blockedReason={actionAvailability.reason} className="command-brief--workflow"/></div>
        </section>
      </aside>
    </div>
  </main><CctvFocusModal open={Boolean(focusCctv)} cctv={data.cctvs.find(item=>item.public_id===focusCctv)??null} cctvs={data.cctvs} incidents={activeIncidents} relatedIncidents={prioritizeIncidents(activeIncidents.filter(item=>item.cctv_public_id===focusCctv))} selectedIncident={incident} selectedDispatch={dispatch} dispatchLookupStatus={dispatchLookupStatus} canAct={Boolean(canAct)} blockedReason={actionAvailability.reason} returnFocus={focusSource} onClose={closeFocusModal} onSelectCctv={selectFocusCctv} onSelectIncident={selectFocusIncident}/></div>;
}
