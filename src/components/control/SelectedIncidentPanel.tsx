import Link from "next/link";
import { incidentDetailPath } from "@/features/incident-detail/incidentDetailRoute";
import { incidentStatusLabel, resolveDispatchPresentation, riskLabel } from "@/features/control-dashboard/dashboardDomain";
import { directionLabel, objectCategoryLabel } from "@/features/control-dashboard/dashboardMapper";
import type { DashboardCctv, DashboardDispatch, DashboardIncident } from "@/features/control-dashboard/dashboardTypes";

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

interface Props{incident:DashboardIncident|null;cctv:DashboardCctv|null;dispatch:DashboardDispatch|null;canAct:boolean;blockedReason?:string|null;className?:string}
export function SelectedIncidentPanel({incident,cctv,dispatch,canAct,blockedReason,className=""}:Props){
 if(!incident)return <section className={`selected-incident-panel ${className}`} aria-label="선택 사건"><header><h2>선택 사건</h2></header><div className="selected-incident-panel__empty"><strong>선택된 사건이 없습니다</strong><p>우선 처리 사건을 선택하면 현재 상태와 다음 업무를 확인할 수 있습니다.</p></div></section>;
 const next=work[incident.status];
 const dispatchView=resolveDispatchPresentation(incident,dispatch);
 const waitingForResponder=incident.status==="DISPATCH_REQUESTED"&&dispatchView.active;
 const displayedWork=waitingForResponder?{title:"출동 담당자 응답 대기",description:"출동 요청을 전달했습니다. 담당자의 수락을 기다리고 있습니다.",button:null}:next;
 return <section className={`selected-incident-panel ${className}`} aria-label="선택 사건">
  <header><h2>선택 사건</h2></header>
  <div className="selected-incident-panel__identity"><strong>{incident.incident_no}</strong><span><b className={`risk-${incident.current_risk_grade.toLowerCase()}`}>{riskLabel[incident.current_risk_grade]}</b><b>{incidentStatusLabel[incident.status]}</b></span><p>{incident.class_name??objectCategoryLabel[incident.object_category]}</p><small>{cctv?.cctv_name??"CCTV 정보 없음"} · {cctv?`${cctv.road.road_name} · ${cctv.road_section.section_name} · ${directionLabel[cctv.direction_code]}`:"위치 정보 없음"}</small></div>
  <dl className="selected-incident-panel__assignment"><div><dt>담당 관제자</dt><dd>{dispatchView.controller}</dd></div><div><dt>출동 담당자</dt><dd>{dispatchView.responder}</dd></div>{dispatchView.hasDispatch&&<div><dt>출동 상태</dt><dd>{dispatchView.status}</dd></div>}</dl>
  <div className="selected-incident-panel__work"><span>다음 업무</span><strong>{displayedWork.title}</strong><p>{waitingForResponder?displayedWork.description:blockedReason??displayedWork.description}</p>{displayedWork.button&&canAct&&<Link className="command-primary" href={incidentDetailPath(incident.public_id)}>{displayedWork.button}</Link>}</div>
  <Link className="selected-incident-panel__detail" href={incidentDetailPath(incident.public_id)}>사건 상세 보기</Link>
 </section>;
}
