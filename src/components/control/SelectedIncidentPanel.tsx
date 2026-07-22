import Link from "next/link";
import { incidentDetailPath } from "@/features/incident-detail/incidentDetailRoute";
import { formatKst, incidentStatusLabel, resolveDispatchPresentation, riskLabel } from "@/features/control-dashboard/dashboardDomain";
import { directionLabel, objectCategoryLabel } from "@/features/control-dashboard/dashboardMapper";
import type { DashboardCctv, DashboardDispatch, DashboardIncident, DispatchLookupStatus } from "@/features/control-dashboard/dashboardTypes";

const work:Record<DashboardIncident["status"],{title:string;description:string;button:string|null}>={
 NEW:{title:"사건 확인",description:"신규 위험 사건을 확인 상태로 변경합니다",button:"사건 확인"},
 ACKNOWLEDGED:{title:"사건 선점",description:"이 사건의 담당 관제자로 선점합니다",button:"사건 선점"},
 CLAIMED:{title:"검토 시작",description:"탐지 근거를 확인하고 위험 여부 검토를 시작합니다",button:"검토 시작"},
 UNDER_REVIEW:{title:"위험 여부 판정",description:"탐지 근거를 검토한 뒤 사건 판정을 진행합니다",button:"사건 판정"},
 DISPATCH_REQUESTED:{title:"출동 담당자 배정",description:"출동 가능한 담당자를 선택해 요청합니다",button:"출동 배정"},
 DISPATCHED:{title:"출동 진행",description:"출동 진행 상태를 확인합니다",button:"진행 상태 확인"},
 ON_SCENE:{title:"현장 대응",description:"현장 도착 상태와 조치 내용을 확인합니다",button:"현장 상태 확인"},
 ACTION_IN_PROGRESS:{title:"현장 조치",description:"진행 중인 현장 조치 상태를 확인합니다",button:"조치 상태 확인"},
 ACTION_COMPLETED:{title:"종료 확인",description:"현장 조치 결과를 확인하고 사건을 종료합니다",button:"종료 확인"},
 CLOSED:{title:"처리 완료",description:"종료된 사건입니다",button:null},
 FALSE_POSITIVE:{title:"오탐 처리 완료",description:"오탐으로 종료된 사건입니다",button:null},
};

interface Props{incident:DashboardIncident|null;cctv:DashboardCctv|null;dispatch:DashboardDispatch|null;dispatchLookupStatus?:DispatchLookupStatus;canAct:boolean;blockedReason?:string|null;showIncidentMetadata?:boolean;className?:string}
export function SelectedIncidentPanel({incident,cctv,dispatch,dispatchLookupStatus="ready",canAct,blockedReason,showIncidentMetadata=false,className=""}:Props){
 const panelTitle=showIncidentMetadata?"연결 사건 상세":"현재 사건";
 if(!incident)return <section className={`selected-incident-panel ${className}`} aria-label={panelTitle}><header><h2>{panelTitle}</h2></header><div className="selected-incident-panel__empty"><strong>현재 확인할 사건이 없습니다</strong><p>사건 목록에서 사건을 선택하면 현재 상태와 다음 업무를 확인할 수 있습니다.</p></div></section>;
 const next=work[incident.status];
 const dispatchView=resolveDispatchPresentation(incident,dispatch);
 const dispatchUnknown=incident.status==="DISPATCH_REQUESTED"&&dispatchLookupStatus!=="ready";
 const waitingForResponder=incident.status==="DISPATCH_REQUESTED"&&dispatchLookupStatus==="ready"&&dispatchView.active;
 const displayedWork=dispatchUnknown?{title:dispatchLookupStatus==="loading"?"출동 상태 확인 중":"출동 상태 확인 실패",description:dispatchLookupStatus==="loading"?"선택 사건의 활성 출동 정보를 확인하고 있습니다.":"최신 출동 정보를 확인하지 못했습니다. 다시 조회한 뒤 배정해 주세요.",button:null}:waitingForResponder?{title:"출동 담당자 응답 대기",description:"출동 요청을 전달했습니다. 담당자의 수락을 기다리고 있습니다.",button:null}:next;
 return <section className={`selected-incident-panel ${className}`} aria-label={panelTitle}>
  <header><h2>{panelTitle}</h2></header>
  <div className="selected-incident-panel__identity"><strong>{incident.incident_no}</strong><span><b className={`risk-${incident.current_risk_grade.toLowerCase()}`}>{riskLabel[incident.current_risk_grade]}</b><b>{incidentStatusLabel[incident.status]}</b></span><p>{incident.class_name??objectCategoryLabel[incident.object_category]}</p><small>{cctv?.cctv_name??"CCTV 정보 없음"} · {cctv?`${cctv.road.road_name} · ${cctv.road_section.section_name} · ${directionLabel[cctv.direction_code]}`:"위치 정보 없음"}</small></div>
  {showIncidentMetadata&&<h3 className="selected-incident-panel__response-title">대응 현황</h3>}
  <dl className="selected-incident-panel__assignment"><div><dt>담당 관제자</dt><dd>{dispatchView.controller}</dd></div>{showIncidentMetadata?(dispatchUnknown?<div><dt>출동 현황</dt><dd>{dispatchLookupStatus==="loading"?"확인 중":"확인 실패"}</dd></div>:dispatchView.hasDispatch?<><div><dt>출동 담당자</dt><dd>{dispatchView.responder}</dd></div><div><dt>출동 상태</dt><dd>{dispatchView.status}</dd></div>{dispatch&&<div><dt>최근 상태 변경</dt><dd><time dateTime={dispatch.updated_at}>{formatKst(dispatch.updated_at)} KST</time></dd></div>}</>:<div><dt>출동 현황</dt><dd>{incident.status==="DISPATCH_REQUESTED"?"담당자 배정 필요":"출동 요청 전"}</dd></div>):<><div><dt>출동 담당자</dt><dd>{dispatchUnknown?(dispatchLookupStatus==="loading"?"확인 중":"확인 실패"):dispatchView.responder}</dd></div>{dispatchView.hasDispatch&&<div><dt>출동 상태</dt><dd>{dispatchView.status}</dd></div>}</>}{showIncidentMetadata&&<><div><dt>발생 시각</dt><dd><time dateTime={incident.created_at}>{formatKst(incident.created_at)} KST</time></dd></div><div><dt>현재 상태</dt><dd>{incidentStatusLabel[incident.status]}</dd></div></>}</dl>
  <div className="selected-incident-panel__work"><span><svg aria-hidden="true" viewBox="0 0 20 20"><path d="M10 2.5a7.5 7.5 0 1 0 0 15 7.5 7.5 0 0 0 0-15Zm3.2 5.4-3.8 4.2-2.2-2"/></svg>{showIncidentMetadata?"다음 작업":"다음 업무"}</span>{incident.status!=="NEW"&&<strong>{displayedWork.title}</strong>}<p>{waitingForResponder||dispatchUnknown?displayedWork.description:blockedReason??displayedWork.description}</p></div>
  <footer className="selected-incident-panel__actions">{displayedWork.button&&canAct&&!dispatchUnknown&&<Link className="command-primary selected-incident-panel__primary" href={incidentDetailPath(incident.public_id)}>{incident.status==="NEW"?<><svg aria-hidden="true" viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="m8 12 2.5 2.5L16 9"/></svg><span>{displayedWork.button}</span></>:displayedWork.button}</Link>}<Link className="selected-incident-panel__detail" href={incidentDetailPath(incident.public_id)}><svg aria-hidden="true" viewBox="0 0 24 24"><path d="M6 3h9l3 3v15H6zM9 11h6M9 15h6"/></svg><span>사건 상세 보기</span></Link></footer>
 </section>;
}
