import type { IncidentStatus } from "@/features/control-dashboard/dashboardTypes";
import type { IncidentDetailRecord, IncidentHistory } from "./incidentDetailTypes";

export type IncidentWorkStageId =
  | "acknowledge"
  | "claim"
  | "review"
  | "decision"
  | "dispatch"
  | "field"
  | "close";
export type IncidentWorkStageState = "done" | "current" | "pending" | "skipped";

export interface IncidentWorkStage {
  id: IncidentWorkStageId;
  label: string;
  actionLabel: string;
  state: IncidentWorkStageState;
  history: IncidentHistory | null;
}

const stageDefinitions: Array<{
  id: IncidentWorkStageId;
  label: string;
  actionLabel: string;
  historyTerms: string[];
}> = [
  { id: "acknowledge", label: "사건 확인", actionLabel: "사건 확인", historyTerms: ["사건 확인"] },
  { id: "claim", label: "담당 지정", actionLabel: "담당 관제자 지정", historyTerms: ["담당 지정", "사건 선점"] },
  { id: "review", label: "검토", actionLabel: "사건 검토", historyTerms: ["검토 시작"] },
  { id: "decision", label: "판정", actionLabel: "위험 여부 판정", historyTerms: ["위험 판정", "오탐", "출동 불필요"] },
  { id: "dispatch", label: "출동", actionLabel: "출동 담당자 배정", historyTerms: ["출동 요청", "출동 배정"] },
  { id: "field", label: "현장 조치", actionLabel: "현장 조치 확인", historyTerms: ["현장 도착", "현장 조치", "조치 완료"] },
  { id: "close", label: "종료", actionLabel: "사건 종료", historyTerms: ["사건 종료", "최종 종료"] },
];

const statesByStatus: Record<IncidentStatus, IncidentWorkStageState[]> = {
  NEW: ["current", "pending", "pending", "pending", "pending", "pending", "pending"],
  ACKNOWLEDGED: ["done", "current", "pending", "pending", "pending", "pending", "pending"],
  CLAIMED: ["done", "done", "current", "pending", "pending", "pending", "pending"],
  UNDER_REVIEW: ["done", "done", "done", "current", "pending", "pending", "pending"],
  DISPATCH_REQUESTED: ["done", "done", "done", "done", "current", "pending", "pending"],
  DISPATCHED: ["done", "done", "done", "done", "current", "pending", "pending"],
  ON_SCENE: ["done", "done", "done", "done", "done", "current", "pending"],
  ACTION_IN_PROGRESS: ["done", "done", "done", "done", "done", "current", "pending"],
  ACTION_COMPLETED: ["done", "done", "done", "done", "done", "done", "current"],
  CLOSED: ["done", "done", "done", "done", "done", "done", "done"],
  FALSE_POSITIVE: ["done", "done", "done", "done", "skipped", "skipped", "done"],
};

function findStageHistory(record: IncidentDetailRecord, terms: string[]) {
  return [...record.histories]
    .filter((item) => terms.some((term) => `${item.event_type} ${item.label}`.includes(term)))
    .sort((a, b) => Date.parse(b.occurred_at) - Date.parse(a.occurred_at))[0] ?? null;
}

export function getIncidentWorkStages(record: IncidentDetailRecord): IncidentWorkStage[] {
  const states = [...statesByStatus[record.incident.status]];
  const noDispatchDecision =
    record.incident.status === "FALSE_POSITIVE" ||
    record.decision?.result === "NO_DISPATCH_REQUIRED" ||
    record.decision?.result === "NO_DISPATCH";
  if (record.incident.status === "CLOSED" && noDispatchDecision && !record.dispatch) {
    states[4] = "skipped";
    states[5] = "skipped";
  }
  return stageDefinitions.map((definition, index) => ({
    id: definition.id,
    label: definition.label,
    actionLabel: definition.actionLabel,
    state: states[index],
    history: findStageHistory(record, definition.historyTerms),
  }));
}

export function currentIncidentWorkStage(stages: IncidentWorkStage[]) {
  return stages.find((stage) => stage.state === "current") ?? null;
}

export function incidentWorkStageFlow(stages:IncidentWorkStage[]){
  const current=currentIncidentWorkStage(stages);
  if(!current)return "모든 사건 처리 단계가 완료되었습니다.";
  const index=Math.max(0,stages.findIndex(stage=>stage===current));
  const previous=stages.slice(0,index).reverse().find(stage=>stage.state==="done");
  const next=stages.slice(index+1).find(stage=>stage.state==="pending"||stage.state==="current");
  if(current.id==="decision"&&previous)return `${previous.label} 완료 · 판정 결과에 따라 출동 또는 종료`;
  if(previous&&next)return `${previous.label} 완료 · 다음 단계 ${next.label}`;
  if(next)return `다음 단계 ${next.label}`;
  if(previous)return `${previous.label} 완료 · 최종 종료 단계`;
  return "모든 업무 단계가 완료되었습니다.";
}
