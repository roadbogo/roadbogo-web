import type { CctvSourceType, DirectionCode, IncidentStatus, ObjectCategory, OperationalStatus, RiskGrade } from "./dashboardTypes";

export interface PaginationDto { page:number; size:number; total_elements:number; total_pages:number }
export interface PublicUserDto { public_id:string; user_name:string }

export interface IncidentSummaryDto {
  total_count:number; new_count:number; acknowledged_count:number; claimed_count:number;
  under_review_count:number; dispatch_requested_count:number; dispatch_in_progress_count:number;
  action_completed_count:number; closed_count:number; false_positive_count:number;
  risk_grade_counts:Record<RiskGrade,number>; object_category_counts:Record<ObjectCategory,number>;
  generated_at:string;
}

export interface IncidentListItemDto {
  public_id:string; incident_no:string; status:IncidentStatus; object_category:ObjectCategory;
  class_code:string|null; class_name:string|null; ai_risk_score:number; ai_risk_grade:RiskGrade;
  representative_confidence:number|null; detection_count:number; duration_ms:number;
  first_detected_at:string; last_detected_at:string; acknowledged_at:string|null;
  claimed_by:PublicUserDto|null;
  cctv:{public_id:string;cctv_name:string;direction_code:DirectionCode};
  location:{road_name:string;road_section_name:string;latitude:number;longitude:number};
  representative_image_url:string|null; version_no:number; updated_at:string;
}
export interface IncidentListDto { items:IncidentListItemDto[]; pagination:PaginationDto }

export interface CctvListItemDto {
  public_id:string; cctv_code:string; cctv_name:string; source_type:CctvSourceType;
  direction_code:DirectionCode; latitude:number; longitude:number; km_post:number|null;
  operational_status:OperationalStatus; is_active:boolean; has_stream:boolean;
  road:{public_id:string;road_code:string;road_name:string};
  road_section:{public_id:string;section_code:string;section_name:string};
  last_successful_sync_at:string|null;
}
export interface CctvListDto { items:CctvListItemDto[]; pagination:PaginationDto; fallback_used:boolean }
export interface CctvDetailDto extends Omit<CctvListItemDto,"has_stream"> {
  external_its_cctv_id:string|null; stream:{available:boolean;stream_type:"LIVE"|"DEMO"|null;protocol_type:"RTSP"|"HLS"|"HTTP"|"FILE"|"OTHER"|null;stream_status:"ACTIVE"|"INACTIVE"|"ERROR"|null};created_at:string;updated_at:string;
}
