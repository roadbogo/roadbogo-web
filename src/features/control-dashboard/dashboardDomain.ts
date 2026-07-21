import type { DashboardCctv, DashboardDispatch, DashboardIncident, IncidentStatus, RiskGrade } from "./dashboardTypes";

export type KpiFilter = "unconfirmed" | "review" | "dispatch" | "closing" | null;
const kpiStatuses: Record<Exclude<KpiFilter, null>, IncidentStatus[]> = {
  unconfirmed: ["NEW"],
  review: ["ACKNOWLEDGED", "CLAIMED", "UNDER_REVIEW"],
  dispatch: ["DISPATCH_REQUESTED", "DISPATCHED", "ON_SCENE", "ACTION_IN_PROGRESS"],
  closing: ["ACTION_COMPLETED"],
};
export const activeStatuses: IncidentStatus[] = ["NEW","ACKNOWLEDGED","CLAIMED","UNDER_REVIEW","DISPATCH_REQUESTED","DISPATCHED","ON_SCENE","ACTION_IN_PROGRESS","ACTION_COMPLETED"];
export const incidentStatusLabel: Record<IncidentStatus, string> = {
  NEW:"미확인", ACKNOWLEDGED:"확인됨", CLAIMED:"선점됨", UNDER_REVIEW:"검토 중",
  DISPATCH_REQUESTED:"출동 배정 단계", DISPATCHED:"출동 중", ON_SCENE:"현장 도착",
  ACTION_IN_PROGRESS:"조치 중", ACTION_COMPLETED:"종료 대기", CLOSED:"종료", FALSE_POSITIVE:"오탐",
};
export const riskLabel: Record<RiskGrade, string> = { CRITICAL:"긴급", HIGH:"높음", MEDIUM:"보통", LOW:"낮음" };
export const nextActionLabel: Record<IncidentStatus, string> = {
  NEW:"사건 확인", ACKNOWLEDGED:"사건 선점", CLAIMED:"검토 시작", UNDER_REVIEW:"위험 판정",
  DISPATCH_REQUESTED:"출동 배정", DISPATCHED:"출동 상태 보기", ON_SCENE:"현장 상태 보기",
  ACTION_IN_PROGRESS:"조치 진행 보기", ACTION_COMPLETED:"관제 종료", CLOSED:"완료", FALSE_POSITIVE:"완료",
};
const permissionForStatus: Partial<Record<IncidentStatus,string>> = {
  NEW:"INCIDENT.CLAIM", ACKNOWLEDGED:"INCIDENT.CLAIM", CLAIMED:"INCIDENT.DECIDE",
  UNDER_REVIEW:"INCIDENT.DECIDE", DISPATCH_REQUESTED:"DISPATCH.ASSIGN", ACTION_COMPLETED:"INCIDENT.CLOSE",
};
export function countKpi(incidents: DashboardIncident[], filter: Exclude<KpiFilter,null>) {
  return incidents.filter(item => kpiStatuses[filter].includes(item.status)).length;
}
export function filterByKpi(incidents: DashboardIncident[], filter: KpiFilter) {
  return filter ? incidents.filter(item => kpiStatuses[filter].includes(item.status)) : incidents;
}
export function canUsePrimaryAction(incident: DashboardIncident, user: { publicId:string; apiPermissions:string[] }) {
  return resolvePrimaryActionAvailability(incident,user).allowed;
}
export function resolvePrimaryActionAvailability(incident:DashboardIncident,user:{publicId:string;apiPermissions:string[]}):{allowed:boolean;reason:string|null}{
  if (["CLOSED","FALSE_POSITIVE"].includes(incident.status)) return{allowed:false,reason:null};
  const required = permissionForStatus[incident.status];
  if (required && !user.apiPermissions.includes(required)) return{allowed:false,reason:incident.status==="UNDER_REVIEW"?"현재 계정에는 사건 판정 권한이 없습니다.":`현재 계정에는 ${required} 권한이 없습니다.`};
  if (incident.assigned_controller && incident.assigned_controller.public_id !== user.publicId && ["CLAIMED","UNDER_REVIEW"].includes(incident.status)) return{allowed:false,reason:incident.status==="UNDER_REVIEW"?"담당 관제자만 판정을 진행할 수 있습니다.":"담당 관제자만 이 업무를 진행할 수 있습니다."};
  if(!Number.isInteger(incident.version_no)||incident.version_no<0)return{allowed:false,reason:"사건 버전 정보가 올바르지 않습니다. 사건 상세에서 최신 상태를 확인해 주세요."};
  return{allowed:true,reason:null};
}
const priority: Record<RiskGrade,number> = { CRITICAL:0,HIGH:1,MEDIUM:2,LOW:3 };
const workflowPriority: Record<IncidentStatus,number> = {
  NEW:0,
  ACKNOWLEDGED:2,
  CLAIMED:2,
  UNDER_REVIEW:2,
  DISPATCH_REQUESTED:3,
  DISPATCHED:3,
  ON_SCENE:3,
  ACTION_IN_PROGRESS:3,
  ACTION_COMPLETED:4,
  CLOSED:6,
  FALSE_POSITIVE:6,
};
export function prioritizeIncidents(incidents: DashboardIncident[]) {
  return [...incidents].sort((a,b) => {
    const aUrgent = a.status === "NEW" && ["CRITICAL","HIGH"].includes(a.current_risk_grade) ? 0 : 1;
    const bUrgent = b.status === "NEW" && ["CRITICAL","HIGH"].includes(b.current_risk_grade) ? 0 : 1;
    if (aUrgent !== bUrgent) return aUrgent-bUrgent;
    const aReassign = !a.assigned_controller && ["ACKNOWLEDGED","CLAIMED","UNDER_REVIEW"].includes(a.status) ? 0 : 1;
    const bReassign = !b.assigned_controller && ["ACKNOWLEDGED","CLAIMED","UNDER_REVIEW"].includes(b.status) ? 0 : 1;
    if (aReassign !== bReassign) return aReassign-bReassign;
    if (workflowPriority[a.status] !== workflowPriority[b.status]) return workflowPriority[a.status]-workflowPriority[b.status];
    if (priority[a.current_risk_grade] !== priority[b.current_risk_grade]) return priority[a.current_risk_grade]-priority[b.current_risk_grade];
    const updatedDifference=Date.parse(a.updated_at)-Date.parse(b.updated_at);
    return updatedDifference || a.public_id.localeCompare(b.public_id);
  });
}
export function selectIncidentForCctv(incidents: DashboardIncident[], cctvPublicId: string) {
  return prioritizeIncidents(incidents.filter(item => item.cctv_public_id === cctvPublicId))[0] ?? null;
}
export function incidentStatusForDispatch(status: DashboardDispatch["status"]): IncidentStatus {
  if (["REQUESTED","REJECTED","CANCELLED"].includes(status)) return "DISPATCH_REQUESTED";
  if (["ACCEPTED","DEPARTED","EN_ROUTE"].includes(status)) return "DISPATCHED";
  if (status === "ARRIVED") return "ON_SCENE";
  if (status === "ACTION_IN_PROGRESS") return "ACTION_IN_PROGRESS";
  return "ACTION_COMPLETED";
}
export const dispatchStatusLabel:Record<DashboardDispatch["status"],string>={
 REQUESTED:"수락 대기",ACCEPTED:"수락 완료",DEPARTED:"출발",EN_ROUTE:"이동 중",ARRIVED:"현장 도착",
 ACTION_IN_PROGRESS:"조치 중",ACTION_COMPLETED:"조치 완료",REJECTED:"출동 거절",CANCELLED:"출동 취소",
};
export function isActiveDispatch(dispatch:DashboardDispatch|null){return Boolean(dispatch&&!(["REJECTED","CANCELLED"] as DashboardDispatch["status"][]).includes(dispatch.status))}
export function resolveDispatchPresentation(incident:DashboardIncident,dispatch:DashboardDispatch|null){
 const controller=incident.assigned_controller?.display_name??"미배정";
 const dispatchStage=["DISPATCH_REQUESTED","DISPATCHED","ON_SCENE","ACTION_IN_PROGRESS","ACTION_COMPLETED","CLOSED"].includes(incident.status);
 if(dispatch&&dispatchStage){
  const status=dispatchStatusLabel[dispatch.status];
  return{controller,responder:dispatch.responder_label||"미배정",status,active:isActiveDispatch(dispatch),hasDispatch:true,compact:`관제 ${controller} · 출동 ${dispatch.responder_label||"미배정"} · ${status}`};
 }
 const needsAssignment=incident.status==="DISPATCH_REQUESTED";
 return{controller,responder:"미배정",status:needsAssignment?"출동 배정 필요":"출동 전",active:false,hasDispatch:false,compact:`관제 ${controller} · ${needsAssignment?"출동 배정 필요":"출동 전"}`};
}
export function formatKst(iso:string) {
  return new Intl.DateTimeFormat("ko-KR",{timeZone:"Asia/Seoul",month:"2-digit",day:"2-digit",hour:"2-digit",minute:"2-digit",hour12:false}).format(new Date(iso));
}
export function formatCompactKst(iso:string) {
  const parts=Object.fromEntries(new Intl.DateTimeFormat("en-CA",{timeZone:"Asia/Seoul",month:"2-digit",day:"2-digit",hour:"2-digit",minute:"2-digit",hour12:false}).formatToParts(new Date(iso)).map(part=>[part.type,part.value]));
  return `${parts.month}.${parts.day} ${parts.hour}:${parts.minute}`;
}
export function relativeTime(iso:string, now=Date.now()) {
  const minutes=Math.max(0,Math.floor((now-Date.parse(iso))/60000));
  if(minutes<1)return "방금 전"; if(minutes<60)return `${minutes}분 전`;
  const hours=Math.floor(minutes/60); return hours<24?`${hours}시간 전`:`${Math.floor(hours/24)}일 전`;
}

export type IncidentStepState="done"|"current"|"waiting"|"skipped";
export interface IncidentStep{label:string;state:IncidentStepState;stateLabel:string}
const compactStepLabels=["사건 접수","사건 확인","담당 지정","위험 판정","출동 진행","현장 조치","종료 확인"];
const currentStepByStatus:Record<IncidentStatus,number>={NEW:0,ACKNOWLEDGED:1,CLAIMED:2,UNDER_REVIEW:3,DISPATCH_REQUESTED:4,DISPATCHED:4,ON_SCENE:4,ACTION_IN_PROGRESS:5,ACTION_COMPLETED:6,CLOSED:6,FALSE_POSITIVE:6};
export function resolveIncidentSteps(status:IncidentStatus):IncidentStep[]{
 const current=currentStepByStatus[status];
 return compactStepLabels.map((label,index)=>{
  if(status==="FALSE_POSITIVE"&&(index===4||index===5))return{label,state:"skipped",stateLabel:"해당 없음"};
  if(status==="CLOSED"||status==="FALSE_POSITIVE")return{label,state:"done",stateLabel:index===6?"처리 완료":"완료"};
  if(index<current)return{label,state:"done",stateLabel:"완료"};
  if(index===current)return{label,state:"current",stateLabel:"현재"};
  return{label,state:"waiting",stateLabel:"대기"};
 });
}

export type DashboardRailFilter="high"|"mine"|"unassigned"|"closing";
export function filterDashboardRail(incidents:DashboardIncident[],cctvs:DashboardCctv[],filter:DashboardRailFilter,query:string,userPublicId?:string){
 let items=incidents;
 if(filter==="high")items=items.filter(item=>["CRITICAL","HIGH"].includes(item.current_risk_grade));
 if(filter==="mine")items=items.filter(item=>item.assigned_controller?.public_id===userPublicId);
 if(filter==="unassigned")items=items.filter(item=>!item.assigned_controller);
 if(filter==="closing")items=items.filter(item=>item.status==="ACTION_COMPLETED");
 const keyword=query.trim().toLocaleLowerCase("ko-KR");
 if(keyword)items=items.filter(item=>{const cctv=cctvs.find(candidate=>candidate.public_id===item.cctv_public_id);return item.incident_no.toLocaleLowerCase("ko-KR").includes(keyword)||Boolean(cctv?.cctv_name.toLocaleLowerCase("ko-KR").includes(keyword))});
 return prioritizeIncidents(items);
}
export function highRiskAlertKey(incident:Pick<DashboardIncident,"public_id"|"version_no">){return `${incident.public_id}:${incident.version_no}`}
export function selectHighRiskAlert(incidents:DashboardIncident[],dismissed:Set<string>){return prioritizeIncidents(incidents.filter(item=>item.status==="NEW"&&["CRITICAL","HIGH"].includes(item.current_risk_grade)&&!dismissed.has(highRiskAlertKey(item))))[0]??null}
export function resolveUrgentIncidentSelection(incidents:DashboardIncident[],cctvs:DashboardCctv[],incidentPublicId:string){
 const incident=incidents.find(item=>item.public_id===incidentPublicId);
 if(!incident)return null;
 const cctv=cctvs.find(item=>item.public_id===incident.cctv_public_id);
 return cctv?{incident,cctv}:null;
}
