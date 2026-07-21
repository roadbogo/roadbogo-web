import type { DashboardIncident, IncidentStatus } from "@/features/control-dashboard/dashboardTypes";
import type { IncidentCommandAction, IncidentEvidence, IncidentWorkspaceMode } from "./incidentDetailTypes";

export function resolveIncidentWorkspaceMode(status: IncidentStatus): IncidentWorkspaceMode {
  if (["NEW", "ACKNOWLEDGED", "CLAIMED", "UNDER_REVIEW"].includes(status)) return "EVIDENCE_REVIEW";
  if (["DISPATCH_REQUESTED", "DISPATCHED", "ON_SCENE", "ACTION_IN_PROGRESS"].includes(status)) return "FIELD_RESPONSE";
  if (status === "ACTION_COMPLETED") return "CLOSURE_REVIEW";
  return "READ_ONLY";
}

const permission: Partial<Record<IncidentStatus, string>> = {
  NEW: "INCIDENT.CLAIM", ACKNOWLEDGED: "INCIDENT.CLAIM", CLAIMED: "INCIDENT.DECIDE",
  UNDER_REVIEW: "INCIDENT.DECIDE", DISPATCH_REQUESTED: "DISPATCH.ASSIGN", ACTION_COMPLETED: "INCIDENT.CLOSE",
};
const action: Record<IncidentStatus, { key: IncidentCommandAction | "view_dispatch" | "view_field"; label: string } | null> = {
  NEW: { key: "acknowledge", label: "사건 확인" }, ACKNOWLEDGED: { key: "claim", label: "내가 담당하기" }, CLAIMED: { key: "review", label: "검토 시작" },
  UNDER_REVIEW: { key: "decide", label: "위험 여부 판정" }, FALSE_POSITIVE: null, DISPATCH_REQUESTED: { key: "assign", label: "출동 담당자 배정" },
  DISPATCHED: { key: "view_dispatch", label: "출동 진행 확인" }, ON_SCENE: { key: "view_field", label: "현장 상태 확인" },
  ACTION_IN_PROGRESS: { key: "view_field", label: "조치 진행 확인" }, ACTION_COMPLETED: { key: "close", label: "사건 최종 종료" }, CLOSED: null,
};

export function resolvePrimaryIncidentAction(incident: DashboardIncident, user: { public_id: string; permissions: string[] }) {
  const candidate = action[incident.status];
  if (!candidate) return null;
  const required = permission[incident.status];
  if (required && !user.permissions.includes(required)) return null;
  if (incident.assigned_controller && incident.assigned_controller.public_id !== user.public_id && ["CLAIMED", "UNDER_REVIEW", "DISPATCH_REQUESTED"].includes(incident.status)) return null;
  if (!Number.isInteger(incident.version_no) || incident.version_no < 0) return null;
  return candidate;
}

const apiSupportedActions = new Set<IncidentCommandAction>(["acknowledge", "claim", "review", "decide", "assign"]);
export function isIncidentActionSupported(mode:"api"|"mock",key:IncidentCommandAction|"view_dispatch"|"view_field"){
  return mode === "mock" || apiSupportedActions.has(key as IncidentCommandAction);
}

export function dedupeEvidences<T extends { detection_public_id: string }>(items: T[]) {
  return [...new Map(items.map(item => [item.detection_public_id, item])).values()].sort((a, b) =>
    "detected_at" in a && "detected_at" in b ? String(a.detected_at).localeCompare(String(b.detected_at)) : 0,
  );
}

export function canCompareEvidence(evidence: Pick<IncidentEvidence, "original_image_url" | "bbox">) {
  return Boolean(evidence.original_image_url && evidence.bbox);
}

export const reasonLabel: Record<string, string> = {
  CONFIDENCE_THRESHOLD: "신뢰도 기준 통과",
  DURATION_THRESHOLD: "지속시간 기준 통과",
  REPEAT_DETECTION: "반복 탐지 기준 통과",
  TRACK_STABLE: "추적 객체가 안정적으로 유지됨",
};
