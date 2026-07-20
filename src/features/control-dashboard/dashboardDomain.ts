import type { DashboardDispatch, DashboardIncident, IncidentStatus, RiskGrade } from "./dashboardTypes";

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
  DISPATCH_REQUESTED:"출동 요청", DISPATCHED:"출동 중", ON_SCENE:"현장 도착",
  ACTION_IN_PROGRESS:"조치 중", ACTION_COMPLETED:"종료 대기", CLOSED:"종료", FALSE_POSITIVE:"오탐",
};
export const riskLabel: Record<RiskGrade, string> = { CRITICAL:"긴급", HIGH:"높음", MEDIUM:"보통", LOW:"낮음" };
export const nextActionLabel: Record<IncidentStatus, string> = {
  NEW:"사건 확인", ACKNOWLEDGED:"사건 선점", CLAIMED:"검토 시작", UNDER_REVIEW:"위험 판정",
  DISPATCH_REQUESTED:"출동 배정", DISPATCHED:"출동 상태 보기", ON_SCENE:"현장 상태 보기",
  ACTION_IN_PROGRESS:"조치 진행 보기", ACTION_COMPLETED:"관제 종료", CLOSED:"완료", FALSE_POSITIVE:"완료",
};
const permissionForStatus: Partial<Record<IncidentStatus,string>> = {
  NEW:"INCIDENT.READ_ALL", ACKNOWLEDGED:"INCIDENT.CLAIM", CLAIMED:"INCIDENT.DECIDE",
  UNDER_REVIEW:"INCIDENT.DECIDE", DISPATCH_REQUESTED:"DISPATCH.ASSIGN", ACTION_COMPLETED:"INCIDENT.CLOSE",
};
export function countKpi(incidents: DashboardIncident[], filter: Exclude<KpiFilter,null>) {
  return incidents.filter(item => kpiStatuses[filter].includes(item.status)).length;
}
export function filterByKpi(incidents: DashboardIncident[], filter: KpiFilter) {
  return filter ? incidents.filter(item => kpiStatuses[filter].includes(item.status)) : incidents;
}
export function canUsePrimaryAction(incident: DashboardIncident, user: { publicId:string; apiPermissions:string[]; organizationPublicId?:string|null }) {
  if (["CLOSED","FALSE_POSITIVE"].includes(incident.status)) return false;
  const required = permissionForStatus[incident.status];
  if (required && !user.apiPermissions.includes(required)) return false;
  if (user.organizationPublicId && user.organizationPublicId !== incident.organization_public_id) return false;
  if (incident.assigned_controller && incident.assigned_controller.public_id !== user.publicId && ["CLAIMED","UNDER_REVIEW"].includes(incident.status)) return false;
  return incident.version_no > 0;
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
export function formatKst(iso:string) {
  return new Intl.DateTimeFormat("ko-KR",{timeZone:"Asia/Seoul",month:"2-digit",day:"2-digit",hour:"2-digit",minute:"2-digit",hour12:false}).format(new Date(iso));
}
export function relativeTime(iso:string, now=Date.now()) {
  const minutes=Math.max(0,Math.floor((now-Date.parse(iso))/60000));
  if(minutes<1)return "방금 전"; if(minutes<60)return `${minutes}분 전`;
  const hours=Math.floor(minutes/60); return hours<24?`${hours}시간 전`:`${Math.floor(hours/24)}일 전`;
}
