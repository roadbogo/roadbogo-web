import type {
  CctvSourceType,
  CctvStreamType,
  DirectionCode,
  DispatchStatus,
  IncidentStatus,
  ObjectCategory,
  OperationalStatus,
  RiskGrade,
  VideoState,
} from "./dashboardTypes";

/** Backend response contracts. Keep these separate from screen-facing dashboard models. */
export interface DashboardCctvDto {
  public_id: string;
  cctv_name: string;
  source_type: CctvSourceType;
  stream_type: CctvStreamType;
  direction_code: DirectionCode;
  operational_status: OperationalStatus;
  has_stream: boolean;
  fallback_used: boolean;
  video_state: VideoState;
  road: { road_name: string };
  road_section: { section_name: string };
}

export interface DashboardIncidentDto {
  public_id: string;
  incident_no: string;
  cctv_public_id: string;
  status: IncidentStatus;
  object_category: ObjectCategory;
  class_code: string;
  class_name: string;
  current_risk_score: number;
  current_risk_grade: RiskGrade;
  representative_confidence: number;
  duration_ms: number;
  detection_count: number;
  assigned_controller: { public_id: string; display_name: string } | null;
  version_no: number;
  created_at: string;
  updated_at: string;
}

export interface DashboardDispatchDto {
  public_id: string;
  incident_public_id: string;
  status: DispatchStatus;
  responder_label: string;
  requested_at: string;
  updated_at: string;
}

export interface DashboardSnapshotDto {
  cctvs: DashboardCctvDto[];
  incidents: DashboardIncidentDto[];
  dispatches: DashboardDispatchDto[];
  fetched_at: string;
}
