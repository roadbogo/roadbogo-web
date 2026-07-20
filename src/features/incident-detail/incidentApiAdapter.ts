import type { IncidentActionRequest, IncidentActionResult, IncidentDetailAdapter, IncidentDetailRecord } from "./incidentDetailTypes";
export class ApiIncidentDetailAdapter implements IncidentDetailAdapter{
  async get(public_id:string):Promise<IncidentDetailRecord|null>{void public_id;throw new Error("사건 상세 REST API가 아직 연결되지 않았습니다.")}
  async act(request:IncidentActionRequest):Promise<IncidentActionResult>{void request;throw new Error("사건 처리 REST API가 아직 연결되지 않았습니다.")}
}
export interface IncidentRealtimeInvalidation{event_id:string;incident_public_id:string;event_type:"INCIDENT.STATUS_CHANGED"|"INCIDENT.UPDATED"|"DISPATCH.STATUS_CHANGED"}
