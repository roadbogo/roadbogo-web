import Link from "next/link";
import { incidentDetailPath } from "@/features/incident-detail/incidentDetailRoute";
import { formatKst, incidentStatusLabel, resolveDispatchPresentation, riskLabel } from "@/features/control-dashboard/dashboardDomain";
import { directionLabel, objectCategoryLabel } from "@/features/control-dashboard/dashboardMapper";
import type { DashboardCctv, DashboardDispatch, DashboardIncident, DispatchLookupStatus } from "@/features/control-dashboard/dashboardTypes";

const work:Record<DashboardIncident["status"],{description:string;actionButton:string;viewButton:string}>={
 NEW:{description:"사건 상세에서 확인과 후속 업무를 진행합니다",actionButton:"사건 처리하기",viewButton:"사건 내용 보기"},
 ACKNOWLEDGED:{description:"사건 상세에서 담당 지정과 후속 업무를 진행합니다",actionButton:"사건 처리하기",viewButton:"사건 내용 보기"},
 CLAIMED:{description:"사건 상세에서 근거를 검토하고 후속 업무를 진행합니다",actionButton:"사건 처리하기",viewButton:"사건 내용 보기"},
 UNDER_REVIEW:{description:"사건 상세에서 위험 판단과 후속 업무를 진행합니다",actionButton:"사건 처리하기",viewButton:"사건 내용 보기"},
 DISPATCH_REQUESTED:{description:"사건 상세에서 출동 요청과 진행 내용을 확인합니다",actionButton:"사건 처리하기",viewButton:"진행 내용 보기"},
 DISPATCHED:{description:"사건 상세에서 출동 진행 내용을 확인합니다",actionButton:"진행 내용 보기",viewButton:"진행 내용 보기"},
 ON_SCENE:{description:"사건 상세에서 현장 도착과 조치 내용을 확인합니다",actionButton:"현장 상태 보기",viewButton:"현장 상태 보기"},
 ACTION_IN_PROGRESS:{description:"사건 상세에서 진행 중인 현장 조치를 확인합니다",actionButton:"조치 상태 보기",viewButton:"조치 상태 보기"},
 ACTION_COMPLETED:{description:"사건 상세에서 완료된 조치와 처리 기록을 확인합니다",actionButton:"사건 기록 보기",viewButton:"사건 기록 보기"},
 CLOSED:{description:"종료된 사건의 처리 기록을 확인합니다",actionButton:"사건 기록 보기",viewButton:"사건 기록 보기"},
 FALSE_POSITIVE:{description:"오탐으로 종료된 사건의 처리 기록을 확인합니다",actionButton:"사건 기록 보기",viewButton:"사건 기록 보기"},
};

interface Props{incident:DashboardIncident|null;cctv:DashboardCctv|null;dispatch:DashboardDispatch|null;dispatchLookupStatus?:DispatchLookupStatus;canAct:boolean;blockedReason?:string|null;showIncidentMetadata?:boolean;className?:string}
export function SelectedIncidentPanel({incident,cctv,dispatch,dispatchLookupStatus="ready",canAct,blockedReason,showIncidentMetadata=false,className=""}:Props){
 const panelTitle=showIncidentMetadata?"연결 사건 상세":"현재 사건";
 if(!incident)return <section className={`selected-incident-panel ${className}`} aria-label={panelTitle}><header><h2>{panelTitle}</h2></header><div className="selected-incident-panel__empty"><strong>현재 확인할 사건이 없습니다</strong><p>사건 목록에서 사건을 선택하면 현재 상태와 다음 업무를 확인할 수 있습니다.</p></div></section>;
 const next=work[incident.status];
 const dispatchView=resolveDispatchPresentation(incident,dispatch);
 const dispatchUnknown=incident.status==="DISPATCH_REQUESTED"&&dispatchLookupStatus!=="ready";
 const waitingForResponder=incident.status==="DISPATCH_REQUESTED"&&dispatchLookupStatus==="ready"&&dispatchView.active;
 const isRecordOnly=incident.status==="CLOSED"||incident.status==="FALSE_POSITIVE";
 const description=dispatchUnknown?(dispatchLookupStatus==="loading"?"선택 사건의 출동 정보를 확인하고 있습니다.":"최신 출동 정보를 확인하지 못했습니다. 사건 상세에서 다시 확인해 주세요."):waitingForResponder?"출동 요청이 전달되었습니다. 담당자의 응답을 기다리고 있습니다.":!canAct&&blockedReason&&!isRecordOnly?blockedReason:next.description;
 const button=canAct?next.actionButton:next.viewButton;
 return <section className={`selected-incident-panel ${className}`} aria-label={panelTitle}>
  <header><h2>{panelTitle}</h2></header>
  <div className="selected-incident-panel__identity"><strong>{incident.incident_no}</strong><span><b className={`risk-${incident.current_risk_grade.toLowerCase()}`}>{riskLabel[incident.current_risk_grade]}</b><b>{incidentStatusLabel[incident.status]}</b></span><p>{incident.class_name??objectCategoryLabel[incident.object_category]}</p><small>{cctv?.cctv_name??"CCTV 정보 없음"} · {cctv?`${cctv.road.road_name} · ${cctv.road_section.section_name} · ${directionLabel[cctv.direction_code]}`:"위치 정보 없음"}</small></div>
  {showIncidentMetadata&&<h3 className="selected-incident-panel__response-title">대응 현황</h3>}
  <dl className="selected-incident-panel__assignment"><div><dt>담당 관제자</dt><dd>{dispatchView.controller}</dd></div>{showIncidentMetadata?(dispatchUnknown?<div><dt>출동 현황</dt><dd>{dispatchLookupStatus==="loading"?"확인 중":"확인 실패"}</dd></div>:dispatchView.hasDispatch?<><div><dt>출동 담당자</dt><dd>{dispatchView.responder}</dd></div><div><dt>출동 상태</dt><dd>{dispatchView.status}</dd></div>{dispatch&&<div><dt>최근 상태 변경</dt><dd><time dateTime={dispatch.updated_at}>{formatKst(dispatch.updated_at)} KST</time></dd></div>}</>:<div><dt>출동 현황</dt><dd>{incident.status==="DISPATCH_REQUESTED"?"담당자 배정 필요":"출동 요청 전"}</dd></div>):<><div><dt>출동 담당자</dt><dd>{dispatchUnknown?(dispatchLookupStatus==="loading"?"확인 중":"확인 실패"):dispatchView.responder}</dd></div>{dispatchView.hasDispatch&&<div><dt>출동 상태</dt><dd>{dispatchView.status}</dd></div>}</>}{showIncidentMetadata&&<><div><dt>발생 시각</dt><dd><time dateTime={incident.created_at}>{formatKst(incident.created_at)} KST</time></dd></div><div><dt>현재 상태</dt><dd>{incidentStatusLabel[incident.status]}</dd></div></>}</dl>
  <div className="selected-incident-panel__work"><span><svg aria-hidden="true" viewBox="0 0 20 20"><path d="M10 2.5a7.5 7.5 0 1 0 0 15 7.5 7.5 0 0 0 0-15Zm3.2 5.4-3.8 4.2-2.2-2"/></svg>{showIncidentMetadata?"다음 작업":"다음 업무"}</span><p>{description}</p></div>
  <footer className="selected-incident-panel__actions"><Link className="command-primary selected-incident-panel__primary" href={incidentDetailPath(incident.public_id)}><span>{button}</span></Link></footer>
 </section>;
}
