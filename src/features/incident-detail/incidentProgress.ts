import type { IncidentStatus } from "@/features/control-dashboard/dashboardTypes";

export type ProgressState = "done" | "current" | "pending" | "skipped";
export const progressStateLabel: Record<ProgressState, string> = { done: "완료", current: "현재", pending: "대기", skipped: "해당 없음" };
export interface IncidentProgressPresentation { states: ProgressState[]; currentLabel: string }

export const progressByStatus:Record<IncidentStatus,IncidentProgressPresentation>={
  NEW:{states:["done","done","current","pending","pending","pending"],currentLabel:"관제 확인 대기"},
  ACKNOWLEDGED:{states:["done","done","current","pending","pending","pending"],currentLabel:"내 담당 지정 대기"},
  CLAIMED:{states:["done","done","current","pending","pending","pending"],currentLabel:"검토 시작 대기"},
  UNDER_REVIEW:{states:["done","done","current","pending","pending","pending"],currentLabel:"위험 판정 진행"},
  DISPATCH_REQUESTED:{states:["done","done","done","current","pending","pending"],currentLabel:"출동 배정·응답 대기"},
  DISPATCHED:{states:["done","done","done","current","pending","pending"],currentLabel:"출동 진행"},
  ON_SCENE:{states:["done","done","done","done","current","pending"],currentLabel:"현장 도착"},
  ACTION_IN_PROGRESS:{states:["done","done","done","done","current","pending"],currentLabel:"현장 조치 진행"},
  ACTION_COMPLETED:{states:["done","done","done","done","done","current"],currentLabel:"관제 종료 대기"},
  CLOSED:{states:["done","done","done","done","done","done"],currentLabel:"사건 종료"},
  FALSE_POSITIVE:{states:["done","done","done","skipped","skipped","done"],currentLabel:"오탐 처리 완료"},
};

export function getIncidentProgressPresentation(status:IncidentStatus):IncidentProgressPresentation{return progressByStatus[status]}
