import type { DispatchStatus, IncidentStatus } from "@/features/control-dashboard/dashboardTypes";

export interface DispatchPaginationDto { page:number;size:number;total_elements:number;total_pages:number }
export interface DispatchUserDto { public_id:string;user_name:string }
export interface DispatchIncidentDto { public_id:string;incident_no:string;status:IncidentStatus;object_category:string;ai_risk_grade:string;cctv_name:string;road_name:string;road_section_name:string;latitude:number;longitude:number }
export interface DispatchMineItemDto { public_id:string;attempt_no:number;status:DispatchStatus;request_message:string|null;requested_at:string;accepted_at:string|null;version_no:number;incident:DispatchIncidentDto;assigned_by:DispatchUserDto }
export interface DispatchDetailDto extends DispatchMineItemDto { rejection_reason:string|null;departed_at:string|null;en_route_at:string|null;arrived_at:string|null;action_started_at:string|null;action_completed_at:string|null;cancelled_at:string|null;previous_dispatch_public_id:string|null }
export interface DispatchMineDataDto { items:DispatchMineItemDto[];pagination:DispatchPaginationDto }
export interface DispatchAcceptDataDto { dispatch:{public_id:string;previous_status:DispatchStatus;status:DispatchStatus;accepted_at:string;version_no:number};incident:{public_id:string;previous_status:IncidentStatus;status:IncidentStatus;version_no:number} }
export interface DispatchRejectDataDto { dispatch:{public_id:string;previous_status:DispatchStatus;status:DispatchStatus;rejection_reason:string;version_no:number};incident:{public_id:string;status:IncidentStatus;version_no:number};responder:{public_id:string;duty_status:string} }

export interface DispatchItem { publicId:string;attemptNo:number;status:DispatchStatus;requestMessage:string|null;requestedAt:string;acceptedAt:string|null;versionNo:number;incident:{publicId:string;incidentNo:string;status:IncidentStatus;objectCategory:string;riskGrade:string;cctvName:string;roadName:string;roadSectionName:string;latitude:number;longitude:number};assignedBy:{publicId:string;name:string} }
export interface DispatchDetail extends DispatchItem { rejectionReason:string|null;departedAt:string|null;enRouteAt:string|null;arrivedAt:string|null;actionStartedAt:string|null;actionCompletedAt:string|null;cancelledAt:string|null;previousDispatchPublicId:string|null;incidentVersionNo?:number }
export interface DispatchPage { items:DispatchItem[];pagination:{page:number;size:number;totalElements:number;totalPages:number} }
export interface DispatchListQuery { page?:number;size?:number;status?:DispatchStatus;activeOnly?:boolean }
export type DispatchCommandResult={ok:true;detail:DispatchDetail}|{ok:false;code:string;latest:DispatchDetail|null};
export interface DispatchAdapter { readonly mode:"api"|"mock";list(query?:DispatchListQuery):Promise<DispatchPage>;detail(publicId:string):Promise<DispatchDetail|null>;accept(publicId:string,versionNo:number,idempotencyKey:string):Promise<DispatchCommandResult>;reject(publicId:string,versionNo:number,reason:string,idempotencyKey:string):Promise<DispatchCommandResult> }
