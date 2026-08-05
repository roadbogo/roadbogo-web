import type { DashboardCctv, DashboardDispatch, DashboardIncident } from "@/features/control-dashboard/dashboardTypes";
export type IncidentWorkspaceMode="EVIDENCE_REVIEW"|"FIELD_RESPONSE"|"CLOSURE_REVIEW"|"READ_ONLY";
export interface IncidentEvidence {
  detection_public_id:string;detected_at:string;object_category:string;class_code:string|null;class_name:string|null;confidence:number|null;is_representative:boolean;
  bbox:{x:number;y:number;width:number;height:number}|null;original_image_url:string|null;annotated_image_url:string|null;
  risk:{risk_score:number;risk_grade:string;duration_ms:number;repeat_count:number;track_id:string|null;reason_codes:string[]};
}
export interface IncidentHistory {public_id:string;event_type:string;label:string;actor_name:string|null;occurred_at:string;detail:string|null}
export type IncidentMemoType="GENERAL"|"REVIEW"|"DISPATCH"|"CLOSURE";
export interface IncidentMemoActor{public_id:string;user_name:string}
export interface IncidentMemoRevision{memo_type:IncidentMemoType;content:string;revised_at:string;revised_by:IncidentMemoActor}
export interface IncidentMemo{public_id:string;incident_public_id:string;memo_type:IncidentMemoType;content:string;created_by:IncidentMemoActor;created_at:string;updated_at?:string|null;deleted_at?:string|null;deleted_by?:IncidentMemoActor|null;delete_reason?:string|null;revisions?:IncidentMemoRevision[]}
export interface IncidentMemoRequest {incident_public_id:string;memo_type:IncidentMemoType;content:string;actor_public_id:string;actor_name:string}
export interface IncidentMemoUpdateRequest extends IncidentMemoRequest{memo_public_id:string;actor_permissions:string[]}
export interface IncidentMemoDeleteRequest{incident_public_id:string;memo_public_id:string;reason:string;actor_public_id:string;actor_name:string;actor_permissions:string[]}
export interface FieldAction {action_type:string;detail:string;before_image_url:string|null;after_image_url:string|null;completed_at:string;photo_preview_expired?:boolean}
export interface IncidentDetailRecord {
  incident:DashboardIncident;cctv:DashboardCctv;evidences:IncidentEvidence[];dispatch:DashboardDispatch|null;
  histories:IncidentHistory[];field_action:FieldAction|null;field_action_supported?:boolean;decision:{result:string;reason:string;decided_by:string;decided_at:string}|null;
  controller_note:string|null;memos:IncidentMemo[];request_message:string|null;closed_at?:string|null;
}
export type IncidentDecisionType="REAL_RISK"|"FALSE_POSITIVE"|"NEEDS_REVIEW"|"NO_DISPATCH";
export interface IncidentDecisionPayload{decision_type:IncidentDecisionType;decision_reason:string}
export interface IncidentClosePayload{closure_note:string}
export interface DispatchResponderOption{public_id:string;display_name:string;organization_name:string|null;available:boolean}
export interface IncidentDispatchAssignmentRequest{incident_public_id:string;responder_public_id:string;expected_version_no:number;idempotency_key:string;request_message:string|null}
export type IncidentCommandAction="acknowledge"|"claim"|"review"|"release"|"decide"|"assign"|"close";
export interface IncidentActionRequest {incident_public_id:string;expected_version_no:number;action:IncidentCommandAction;idempotency_key:string;payload?:IncidentDecisionPayload|IncidentClosePayload|Record<string,unknown>}
export type ApiIncidentCommandErrorCode=
  |"INCIDENT_VERSION_CONFLICT"
  |"INCIDENT_ALREADY_CLAIMED"
  |"INCIDENT_NOT_ASSIGNED_CONTROLLER"
  |"INCIDENT_INVALID_STATE_TRANSITION"
  |"DISPATCH_RESPONDER_NOT_FOUND"
  |"DISPATCH_RESPONDER_UNAVAILABLE"
  |"DISPATCH_RESPONDER_BUSY"
  |"DISPATCH_ALREADY_ASSIGNED"
  |"DISPATCH_IDEMPOTENCY_CONFLICT";
export type MockIncidentCommandErrorCode="INCIDENT_CLAIM_CONFLICT"|"FORBIDDEN"|"INVALID_TRANSITION";
export type IncidentActionResult=
  |{ok:true;status:DashboardIncident["status"];version_no:number;record?:IncidentDetailRecord;closed_at?:string}
  |{ok:false;code:ApiIncidentCommandErrorCode|MockIncidentCommandErrorCode;latest:IncidentDetailRecord|null;sync_failed?:boolean;controller_name?:string|null};
export interface IncidentDetailAdapter {
  readonly mode:"api"|"mock";
  readonly supportsRelease:boolean;
  readonly supportsDispatchAssignment:boolean;
  readonly supportsMemoRead:boolean;
  readonly supportsMemoWrite:boolean;
  readonly supportsMemoMutation:boolean;
  get(public_id:string):Promise<IncidentDetailRecord|null>;
  act(request:IncidentActionRequest):Promise<IncidentActionResult>;
  listResponders():Promise<DispatchResponderOption[]>;
  assignDispatch(request:IncidentDispatchAssignmentRequest):Promise<IncidentActionResult>;
  createMemo(request:IncidentMemoRequest):Promise<IncidentMemo>;
  updateMemo(request:IncidentMemoUpdateRequest):Promise<IncidentMemo>;
  deleteMemo(request:IncidentMemoDeleteRequest):Promise<IncidentMemo>;
}
