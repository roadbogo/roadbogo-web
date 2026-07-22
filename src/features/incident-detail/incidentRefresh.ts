import type { IncidentDetailRecord } from "./incidentDetailTypes";

export type IncidentRefreshChange =
  | "version"
  | "status"
  | "assignee"
  | "risk"
  | "latestEvidence"
  | "detectionCount"
  | "dispatch"
  | "evidenceCount";

export function getIncidentRefreshChanges(previous: IncidentDetailRecord, next: IncidentDetailRecord): IncidentRefreshChange[] {
  const changes: IncidentRefreshChange[] = [];
  const before = previous.incident, after = next.incident;
  if (before.version_no !== after.version_no) changes.push("version");
  if (before.status !== after.status) changes.push("status");
  if (before.assigned_controller?.public_id !== after.assigned_controller?.public_id) changes.push("assignee");
  if (before.current_risk_score !== after.current_risk_score || before.current_risk_grade !== after.current_risk_grade) changes.push("risk");
  if (before.updated_at !== after.updated_at) changes.push("latestEvidence");
  if (before.detection_count !== after.detection_count) changes.push("detectionCount");
  if (previous.dispatch?.status !== next.dispatch?.status) changes.push("dispatch");
  if (previous.evidences.length !== next.evidences.length) changes.push("evidenceCount");
  return changes;
}

export function resolveEvidenceSelection(current: string, record: IncidentDetailRecord) {
  if (record.evidences.some(item => item.detection_public_id === current)) return current;
  return record.evidences.find(item => item.is_representative)?.detection_public_id
    ?? record.evidences[0]?.detection_public_id
    ?? "";
}
