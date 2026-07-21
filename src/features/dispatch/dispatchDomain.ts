import type { DispatchStatus } from "@/features/control-dashboard/dashboardTypes";
import type { DispatchListQuery } from "./dispatchTypes";

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
