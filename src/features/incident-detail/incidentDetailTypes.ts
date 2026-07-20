import type { DashboardCctv, DashboardDispatch, DashboardIncident } from "@/features/control-dashboard/dashboardTypes";
export type IncidentWorkspaceMode="EVIDENCE_REVIEW"|"FIELD_RESPONSE"|"CLOSURE_REVIEW"|"READ_ONLY";
export interface IncidentEvidence {
  detection_public_id:string;detected_at:string;class_name:string;confidence:number;is_representative:boolean;
  bbox:{x:number;y:number;width:number;height:number}|null;original_image_url:string|null;annotated_image_url:string|null;
  risk:{risk_score:number;risk_grade:string;duration_ms:number;repeat_count:number;track_id:string|null;reason_codes:string[]};
}
export interface IncidentHistory {public_id:string;event_type:string;label:string;actor_name:string|null;occurred_at:string;detail:string|null}
export interface FieldAction {action_type:string;detail:string;before_image_url:string|null;after_image_url:string|null;completed_at:string}
export interface IncidentDetailRecord {
  incident:DashboardIncident;cctv:DashboardCctv;evidences:IncidentEvidence[];dispatch:DashboardDispatch|null;
  histories:IncidentHistory[];field_action:FieldAction|null;decision:{result:string;reason:string;decided_by:string;decided_at:string}|null;
  controller_note:string|null;request_message:string|null;
}
export interface IncidentActionRequest {incident_public_id:string;expected_version_no:number;action:string;payload?:Record<string,unknown>}
export type IncidentActionResult={ok:true;record:IncidentDetailRecord}|{ok:false;code:"INCIDENT_CLAIM_CONFLICT"|"INCIDENT_VERSION_CONFLICT"|"FORBIDDEN"|"INVALID_TRANSITION";latest:IncidentDetailRecord};
export interface IncidentDetailAdapter {
  get(public_id:string):Promise<IncidentDetailRecord|null>;
  act(request:IncidentActionRequest):Promise<IncidentActionResult>;
}
