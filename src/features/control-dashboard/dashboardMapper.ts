import type { CctvDetailDto, CctvListItemDto, IncidentListItemDto, IncidentSummaryDto } from "./dashboardApiTypes";
import type { DashboardCctv, DashboardDispatch, DashboardIncident, DashboardSnapshot, DirectionCode, IncidentStatus, ObjectCategory, OperationalStatus } from "./dashboardTypes";

export const directionLabel:Record<DirectionCode,string>={ASC:"상행",DESC:"하행",BOTH:"양방향",UNKNOWN:"방향 미상"};
export const operationalStatusLabel:Record<OperationalStatus,string>={NORMAL:"정상",DELAYED:"지연",FAULT:"장애",INACTIVE:"비활성",UNKNOWN:"상태 미상"};
export const objectCategoryLabel:Record<ObjectCategory,string>={VEHICLE:"차량",DEBRIS:"낙하물",WILDLIFE:"야생동물",OTHER:"기타"};

export function mapDashboardCctv(dto:CctvListItemDto):DashboardCctv {
  return {
    public_id:dto.public_id,cctv_code:dto.cctv_code,cctv_name:dto.cctv_name,source_type:dto.source_type,
    stream_type:null,direction_code:dto.direction_code,operational_status:dto.operational_status,
    has_stream:dto.has_stream,fallback_used:false,video_state:dto.has_stream?"PLAYING":"UNAVAILABLE",road:{road_name:dto.road.road_name},
    road_section:{section_name:dto.road_section.section_name},
  };
}
export function mapDashboardCctvDetail(dto:CctvDetailDto):DashboardCctv{return{public_id:dto.public_id,cctv_code:dto.cctv_code,cctv_name:dto.cctv_name,source_type:dto.source_type,stream_type:dto.stream.stream_type,direction_code:dto.direction_code,operational_status:dto.operational_status,has_stream:dto.stream.available,fallback_used:false,video_state:dto.stream.available?(dto.stream.stream_type==="DEMO"?"DEMO":"PLAYING"):"UNAVAILABLE",road:{road_name:dto.road.road_name},road_section:{section_name:dto.road_section.section_name}}}

export function mapDashboardIncident(dto:IncidentListItemDto):DashboardIncident {
  return {
    public_id:dto.public_id,incident_no:dto.incident_no,cctv_public_id:dto.cctv.public_id,status:dto.status,
    object_category:dto.object_category,class_code:dto.class_code,class_name:dto.class_name,
    current_risk_score:dto.ai_risk_score,current_risk_grade:dto.ai_risk_grade,
    representative_confidence:dto.representative_confidence,duration_ms:dto.duration_ms,
    detection_count:dto.detection_count,representative_image_url:dto.representative_image_url,representative_image_kind:null,detection_bbox:null,
    assigned_controller:dto.claimed_by?{public_id:dto.claimed_by.public_id,display_name:dto.claimed_by.user_name}:null,
    claimed_at:null,version_no:dto.version_no,created_at:dto.first_detected_at,updated_at:dto.updated_at,
  };
}

export function mergeDashboardIncidentSelection(current:DashboardIncident,detail:DashboardIncident):DashboardIncident{
 const useDetailEvidence=detail.representative_image_url!==null&&detail.representative_image_url!==undefined;
 return{
  ...detail,
  representative_image_url:useDetailEvidence?detail.representative_image_url:current.representative_image_url??null,
  representative_image_kind:useDetailEvidence?detail.representative_image_kind:current.representative_image_kind,
  detection_bbox:useDetailEvidence?detail.detection_bbox:current.detection_bbox??null,
 };
}

export function mapDashboardSnapshot(input:{summary:IncidentSummaryDto;incidents:IncidentListItemDto[];cctvs:CctvListItemDto[];fallbackUsed:boolean;fetchedAt:string}):DashboardSnapshot {
  return {summary:input.summary,cctvs:input.cctvs.map(item=>({...mapDashboardCctv(item),fallback_used:input.fallbackUsed})),incidents:input.incidents.map(mapDashboardIncident),dispatches:[],fallback_used:input.fallbackUsed,fetched_at:input.fetchedAt,source:"api"};
}

export interface MockDashboardSnapshotDto{cctvs:DashboardCctv[];incidents:DashboardIncident[];dispatches:DashboardDispatch[];fetched_at:string}
const summaryStatusKey:Partial<Record<IncidentStatus,"new_count"|"acknowledged_count"|"claimed_count"|"under_review_count"|"dispatch_requested_count"|"action_completed_count"|"closed_count"|"false_positive_count">>={NEW:"new_count",ACKNOWLEDGED:"acknowledged_count",CLAIMED:"claimed_count",UNDER_REVIEW:"under_review_count",DISPATCH_REQUESTED:"dispatch_requested_count",ACTION_COMPLETED:"action_completed_count",CLOSED:"closed_count",FALSE_POSITIVE:"false_positive_count"};
export function mapMockDashboardSnapshot(dto:MockDashboardSnapshotDto):DashboardSnapshot{
 const counts={new_count:0,acknowledged_count:0,claimed_count:0,under_review_count:0,dispatch_requested_count:0,action_completed_count:0,closed_count:0,false_positive_count:0};
 for(const incident of dto.incidents){const key=summaryStatusKey[incident.status];if(key)counts[key]+=1}
 const dispatch_in_progress_count=dto.incidents.filter(item=>["DISPATCHED","ON_SCENE","ACTION_IN_PROGRESS"].includes(item.status)).length;
 return{...structuredClone(dto),summary:{total_count:dto.incidents.length,...counts,dispatch_in_progress_count,generated_at:dto.fetched_at},fallback_used:dto.cctvs.some(item=>item.fallback_used),source:"mock"};
}
