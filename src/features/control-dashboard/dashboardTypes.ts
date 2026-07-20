export type IncidentStatus =
  | "NEW" | "ACKNOWLEDGED" | "CLAIMED" | "UNDER_REVIEW"
  | "DISPATCH_REQUESTED" | "DISPATCHED" | "ON_SCENE"
  | "ACTION_IN_PROGRESS" | "ACTION_COMPLETED" | "CLOSED" | "FALSE_POSITIVE";
export type RiskGrade = "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";
export type OperationalStatus = "NORMAL" | "DELAYED" | "FAILED";
export type VideoState = "LOADING" | "PLAYING" | "DEMO" | "FALLBACK" | "UNAVAILABLE";
export type DispatchStatus = "REQUESTED" | "ACCEPTED" | "DEPARTED" | "EN_ROUTE" | "ARRIVED" | "ACTION_IN_PROGRESS" | "ACTION_COMPLETED" | "REJECTED" | "CANCELLED";

export interface DashboardCctv {
  public_id: string;
  cctv_name: string;
  source_type: "LIVE" | "DEMO";
  direction_code: string;
  operational_status: OperationalStatus;
  has_stream: boolean;
  fallback_used: boolean;
  video_state: VideoState;
  road: { road_name: string };
  road_section: { section_name: string };
}
export interface DashboardIncident {
  public_id: string;
  incident_no: string;
  cctv_public_id: string;
  status: IncidentStatus;
  object_category: string;
  class_name: string;
  current_risk_score: number;
  current_risk_grade: RiskGrade;
  representative_confidence: number;
  duration_ms: number;
  detection_count: number;
  assigned_controller: { public_id: string; display_name: string } | null;
  organization_public_id: string;
  version_no: number;
  created_at: string;
  updated_at: string;
}
export interface DashboardDispatch {
  public_id: string;
  incident_public_id: string;
  status: DispatchStatus;
  responder_label: string;
  requested_at: string;
  updated_at: string;
}
export interface DashboardSnapshot {
  cctvs: DashboardCctv[];
  incidents: DashboardIncident[];
  dispatches: DashboardDispatch[];
  fetched_at: string;
  source: "mock" | "api";
}
export interface DashboardAdapter {
  load(): Promise<DashboardSnapshot>;
  refreshIncident(public_id: string): Promise<DashboardIncident | null>;
  refreshDispatch(public_id: string): Promise<DashboardDispatch | null>;
}
export interface DashboardRealtimeEvent {
  event_id: string;
  event_type: "INCIDENT.CREATED" | "INCIDENT.STATUS_CHANGED" | "INCIDENT.UPDATED" | "DISPATCH.REQUESTED" | "DISPATCH.STATUS_CHANGED";
  resource_public_id: string;
}
export interface DashboardRealtimeAdapter {
  connect(onEvent: (event: DashboardRealtimeEvent) => void): () => void;
}
