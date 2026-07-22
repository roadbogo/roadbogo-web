export type IncidentStatus =
  | "NEW" | "ACKNOWLEDGED" | "CLAIMED" | "UNDER_REVIEW"
  | "DISPATCH_REQUESTED" | "DISPATCHED" | "ON_SCENE"
  | "ACTION_IN_PROGRESS" | "ACTION_COMPLETED" | "CLOSED" | "FALSE_POSITIVE";
export type RiskGrade = "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";
export type OperationalStatus = "NORMAL" | "DELAYED" | "FAULT" | "INACTIVE" | "UNKNOWN";
export type CctvSourceType = "ITS" | "MANUAL" | "DEMO";
export type CctvStreamType = "LIVE" | "DEMO";
export type DirectionCode = "ASC" | "DESC" | "BOTH" | "UNKNOWN";
export type ObjectCategory = "VEHICLE" | "DEBRIS" | "WILDLIFE" | "OTHER";
export type VideoState = "LOADING" | "PLAYING" | "DEMO" | "FALLBACK" | "UNAVAILABLE";
export type DispatchStatus = "REQUESTED" | "ACCEPTED" | "DEPARTED" | "EN_ROUTE" | "ARRIVED" | "ACTION_IN_PROGRESS" | "ACTION_COMPLETED" | "REJECTED" | "CANCELLED";

export interface DashboardCctv {
  public_id: string;
  cctv_code: string;
  cctv_name: string;
  source_type: CctvSourceType;
  stream_type: CctvStreamType | null;
  direction_code: DirectionCode;
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
  object_category: ObjectCategory;
  class_code: string | null;
  class_name: string | null;
  current_risk_score: number;
  current_risk_grade: RiskGrade;
  representative_confidence: number | null;
  duration_ms: number;
  detection_count: number;
  representative_image_url?: string | null;
  detection_bbox?: { x:number;y:number;width:number;height:number } | null;
  assigned_controller: { public_id: string; display_name: string } | null;
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
  summary: { total_count:number; new_count:number; acknowledged_count:number; claimed_count:number; under_review_count:number; dispatch_requested_count:number; dispatch_in_progress_count:number; action_completed_count:number; closed_count:number; false_positive_count:number; generated_at:string };
  cctvs: DashboardCctv[];
  incidents: DashboardIncident[];
  dispatches: DashboardDispatch[];
  fallback_used: boolean;
  fetched_at: string;
  source: "mock" | "api";
}
export interface DashboardAdapter {
  readonly mode:"api"|"mock";
  load(): Promise<DashboardSnapshot>;
  refreshIncident(public_id: string): Promise<DashboardIncident | null>;
  refreshCctv(public_id: string): Promise<DashboardCctv | null>;
  refreshDispatch(public_id: string): Promise<DashboardDispatch | null>;
  loadIncidentSelection(public_id:string):Promise<{incident:DashboardIncident;dispatch:DashboardDispatch|null}|null>;
}
export type DispatchLookupStatus="idle"|"loading"|"ready"|"error";
export interface DashboardRealtimeEvent {
  event_id: string;
  event_type: "INCIDENT.CREATED" | "INCIDENT.STATUS_CHANGED" | "INCIDENT.UPDATED" | "DISPATCH.REQUESTED" | "DISPATCH.STATUS_CHANGED";
  resource_public_id: string;
}
export interface DashboardRealtimeAdapter {
  connect(onEvent: (event: DashboardRealtimeEvent) => void): () => void;
}
