import type { DirectionCode, DispatchStatus, IncidentStatus, ObjectCategory, RiskGrade } from "@/features/control-dashboard/dashboardTypes";
import type { PaginationDto, PublicUserDto } from "@/features/control-dashboard/dashboardApiTypes";
export interface IncidentDetailDto {
 public_id:string;incident_no:string;status:IncidentStatus;version_no:number;
 object:{object_category:ObjectCategory;class_code:string|null;class_name:string|null;tracked_object_public_id:string|null;external_track_id:string|null};
 ai_analysis:{representative_confidence:number|null;confidence_calculation_type:"LAST"|"MAX"|"AVERAGE"|null;risk_score:number;risk_grade:RiskGrade;duration_ms:number;repeat_count:number|null;rule_code:string|null;rule_version:string|null;reason_codes:string[]};
 cctv_snapshot:{cctv_public_id:string;cctv_name:string;direction_code:DirectionCode;road_name:string;road_section_name:string;latitude:number;longitude:number;km_post:number|null};
 timeline:{first_detected_at:string;last_detected_at:string;created_at:string;updated_at:string;acknowledged_at:string|null;claimed_at:string|null;review_started_at:string|null;closed_at:string|null};
 controller:PublicUserDto|null;
 decision:{public_id:string;decision_type:"REAL_RISK"|"FALSE_POSITIVE"|"NEEDS_REVIEW"|"NO_DISPATCH";decision_reason:string;decided_by:PublicUserDto;decided_at:string}|null;
 active_dispatch:{public_id:string;status:DispatchStatus;responder:PublicUserDto;requested_at:string;updated_at:string}|null;
 representative_evidence:{detection_public_id:string|null;original_image_url:string|null;annotated_image_url:string|null;bbox:BboxDto|null}|null;
 evidence_count:number;memo_count:number;
}
export interface BboxDto{x:number;y:number;width:number;height:number}
export interface IncidentEvidenceDto {detection_public_id:string|null;evidence_type:"PRIMARY"|"ADDITIONAL"|"MERGED"|"MANUAL";is_representative:boolean;detected_at:string;class_code:string|null;class_name:string|null;confidence:number|null;bbox:BboxDto|null;original_image_url:string|null;annotated_image_url:string|null;risk:{risk_score:number;risk_grade:RiskGrade;duration_ms:number;repeat_count:number;tracked_object_public_id:string;external_track_id:string;reason_codes:string[]}|null}
export interface IncidentEvidenceListDto{items:IncidentEvidenceDto[];pagination:PaginationDto}
export interface IncidentHistoryDto{public_id:string;from_status:IncidentStatus|null;to_status:IncidentStatus;actor_type:"USER"|"SYSTEM"|"DEVICE";actor:PublicUserDto|null;change_source:"MANUAL"|"SYSTEM"|"DEVICE"|"AUTO";reason_code:string|null;reason_text:string|null;changed_at:string}
export interface IncidentHistoryListDto{items:IncidentHistoryDto[];pagination:PaginationDto}
export interface IncidentCommandResponseDto{public_id:string;status:IncidentStatus;version_no:number}
export type ResponderDutyStatus="AVAILABLE"|"BUSY"|"OFF_DUTY"|"UNAVAILABLE";
export interface ResponderListItemDto {
 public_id:string;
 user_name:string;
 duty_status:ResponderDutyStatus;
 organization:{public_id:string;organization_name:string}|null;
}
export interface ResponderListDto{items:ResponderListItemDto[];pagination:PaginationDto}
export interface IncidentDispatchResponseDto {
 public_id:string;
 status:DispatchStatus;
 incident:{public_id:string;status:IncidentStatus;version_no:number};
 responder:PublicUserDto;
 request_message:string|null;
 requested_at:string;
}
export interface IncidentMemoDto {public_id:string;incident_public_id:string;memo_type:"GENERAL"|"REVIEW"|"DISPATCH"|"CLOSURE";content:string;created_by:PublicUserDto;created_at:string}
