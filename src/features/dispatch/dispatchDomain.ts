import type { DispatchStatus } from "@/features/control-dashboard/dashboardTypes";
import type { DispatchItem,DispatchListQuery } from "./dispatchTypes";

export type DispatchProgressAction="depart"|"markEnRoute"|"arrive"|"startAction";
export const dispatchProgressAction:Record<DispatchProgressAction,{from:DispatchStatus;to:DispatchStatus;label:string;title:string;description:string;confirmTitle:string;confirmDescription:string}>={
  depart:{from:"ACCEPTED",to:"DEPARTED",label:"출발 등록",title:"출동 준비가 완료되었습니다.",description:"현장으로 출발할 때 출발 상태를 등록해 주세요.",confirmTitle:"출발 상태를 등록할까요?",confirmDescription:"출발 등록 후에는 이전 상태로 되돌릴 수 없습니다."},
  markEnRoute:{from:"DEPARTED",to:"EN_ROUTE",label:"이동 중 등록",title:"출발이 등록되었습니다.",description:"사건 현장으로 이동을 시작하면 이동 중 상태를 등록해 주세요.",confirmTitle:"이동 중 상태를 등록할까요?",confirmDescription:"사건 현장으로 이동을 시작한 경우에만 등록해 주세요."},
  arrive:{from:"EN_ROUTE",to:"ARRIVED",label:"현장 도착 등록",title:"사건 현장으로 이동 중입니다.",description:"현장에 도착한 뒤 도착 상태를 등록해 주세요.",confirmTitle:"현장 도착을 등록할까요?",confirmDescription:"실제로 사건 현장에 도착한 뒤 등록해 주세요."},
  startAction:{from:"ARRIVED",to:"ACTION_IN_PROGRESS",label:"조치 시작",title:"현장 도착이 등록되었습니다.",description:"현장 상황을 확인하고 조치를 시작해 주세요.",confirmTitle:"현장 조치를 시작할까요?",confirmDescription:"등록 후 다음 단계에서 조치 결과와 현장 사진을 작성하게 됩니다."},
};
const progressActions=Object.entries(dispatchProgressAction) as [DispatchProgressAction,(typeof dispatchProgressAction)[DispatchProgressAction]][];
export const dispatchProgressStatuses:DispatchStatus[]=["ACCEPTED","DEPARTED","EN_ROUTE","ARRIVED","ACTION_IN_PROGRESS"];
export function getNextDispatchAction(status:DispatchStatus):DispatchProgressAction|null{return progressActions.find(([,value])=>value.from===status)?.[0]??null}
export function canExecuteDispatchAction(status:DispatchStatus,versionNo:number,permissions:string[],busy=false){return Boolean(getNextDispatchAction(status))&&permissions.includes("DISPATCH.UPDATE_OWN")&&Number.isInteger(versionNo)&&versionNo>=0&&!busy}
export function dispatchProgressIndex(status:DispatchStatus){if(status==="ACTION_COMPLETED")return dispatchProgressStatuses.length;return dispatchProgressStatuses.indexOf(status)}

export const dispatchStatusCopy: Record<DispatchStatus, string> = {
  REQUESTED: "응답 대기", ACCEPTED: "수락 완료", REJECTED: "출동 거절", DEPARTED: "출발",
  EN_ROUTE: "이동 중", ARRIVED: "현장 도착", ACTION_IN_PROGRESS: "조치 중",
  ACTION_COMPLETED: "조치 완료", CANCELLED: "출동 취소",
};
export function buildDispatchListQuery(query: DispatchListQuery = {}) {
  const params = new URLSearchParams({ page: String(query.page ?? 1), size: String(query.size ?? 20), active_only: String(query.activeOnly ?? true) });
  if (query.status) params.set("status", query.status);
  return params.toString();
}
export function validateRejectionReason(value: string) {
  const normalized = value.trim();
  if (!normalized) return "거절 사유를 입력해 주세요.";
  if (normalized.length > 1000) return "거절 사유는 1000자 이하로 입력해 주세요.";
  return null;
}
export function canRespondToDispatch(status: DispatchStatus, versionNo: number, permissions: string[], busy = false) {
  return permissions.includes("DISPATCH.UPDATE_OWN") && status === "REQUESTED" && Number.isInteger(versionNo) && versionNo >= 0 && !busy;
}
export function formatDispatchKst(value: string) {
  return new Intl.DateTimeFormat("ko-KR", { timeZone: "Asia/Seoul", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date(value));
}
export const activeDispatchStatuses: DispatchStatus[] = ["REQUESTED", "ACCEPTED", "DEPARTED", "EN_ROUTE", "ARRIVED", "ACTION_IN_PROGRESS"];
export const representativeDispatchStatuses:DispatchStatus[]=["ACCEPTED","DEPARTED","EN_ROUTE","ARRIVED","ACTION_IN_PROGRESS"];
export const terminalDispatchStatuses:DispatchStatus[]=["ACTION_COMPLETED","REJECTED","CANCELLED"];
const workPriority:Partial<Record<DispatchStatus,number>>={REQUESTED:0,ACTION_IN_PROGRESS:1,ARRIVED:2,EN_ROUTE:3,DEPARTED:4,ACCEPTED:5};
export function sortDispatchWork<T extends DispatchItem>(items:T[]):T[]{return [...items].sort((a,b)=>(workPriority[a.status]??99)-(workPriority[b.status]??99)||Date.parse(b.acceptedAt??b.requestedAt)-Date.parse(a.acceptedAt??a.requestedAt))}
