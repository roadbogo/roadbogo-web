export type IncidentStatus =
  | "new"
  | "claimed"
  | "confirmed"
  | "falsePositive"
  | "dispatchRequested"
  | "dispatched"
  | "resolved";

export type IncidentSeverity = "긴급" | "주의" | "검토 중" | "미배정";

export type SortOption = "risk" | "waiting" | "detectedAt";

export type FilterOption = "all" | "긴급" | "주의" | "검토 중" | "미배정";

export interface Incident {
  id: string;
  number: string;
  status: IncidentStatus;
  severity: IncidentSeverity;
  type: string;
  road: string;
  direction: string;
  segment: string;
  cctvId: string;
  risk: number;
  riskLabel: string;
  evidence: string;
  detectedAt: string;
  detectedAtTs?: string;
  waiting: string;
  assignedTo?: string;
  claimedAtTs?: string;
  dispatchRequested: boolean;
  dispatchRequestedAtTs?: string;
  highlighted?: boolean;
}

export interface CctvFeed {
  id: string;
  label: string;
  event: string;
  duration: string;
  road: string;
  direction: string;
  station: string;
  relatedIncidentIds: string[];
}

export interface DispatchTeam {
  id: string;
  name: string;
  task: string;
  eta: string;
  status: string;
}

export interface ActivityLogEntry {
  id: string;
  time: string;
  actor: string;
  action: string;
  target: string;
  incidentId?: string;
  badge: string;
  variant: "success" | "info" | "warning" | "danger";
}

export interface ToastMessage {
  id: string;
  type: "success" | "info" | "warning" | "urgent";
  title: string;
  message: string;
  incidentId?: string;
  actionLabel?: string;
  duration?: number;
}
