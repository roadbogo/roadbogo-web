import { ApiError, apiRequest } from "@/lib/apiClient";
import type { IncidentActionRequest, IncidentActionResult, IncidentDetailAdapter, IncidentDetailRecord, IncidentDecisionPayload, IncidentDispatchAssignmentRequest, IncidentMemo, IncidentMemoRequest } from "./incidentDetailTypes";
import type { IncidentCommandResponseDto, IncidentDetailDto, IncidentDispatchResponseDto, IncidentEvidenceListDto, IncidentHistoryListDto, ResponderListDto } from "./incidentApiTypes";
import { mapDispatchResponder, mapIncidentDetailRecord } from "./incidentMapper";

const commandErrorCodes=["INCIDENT_VERSION_CONFLICT","INCIDENT_ALREADY_CLAIMED","INCIDENT_NOT_ASSIGNED_CONTROLLER","INCIDENT_INVALID_STATE_TRANSITION"] as const;
const dispatchErrorCodes=["INCIDENT_VERSION_CONFLICT","INCIDENT_NOT_ASSIGNED_CONTROLLER","INCIDENT_INVALID_STATE_TRANSITION","DISPATCH_RESPONDER_NOT_FOUND","DISPATCH_RESPONDER_UNAVAILABLE","DISPATCH_RESPONDER_BUSY","DISPATCH_ALREADY_ASSIGNED","DISPATCH_IDEMPOTENCY_CONFLICT"] as const;
const incidentPublicIdPattern=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export class ApiIncidentDetailAdapter implements IncidentDetailAdapter{
 readonly mode="api" as const;
 readonly supportsRelease=false;
 readonly supportsDispatchAssignment=true;
 readonly supportsMemoRead=false;
 readonly supportsMemoWrite=false;

 async get(publicId:string):Promise<IncidentDetailRecord|null>{
  if(!incidentPublicIdPattern.test(publicId))throw new Error("INVALID_INCIDENT_PUBLIC_ID");
  try{
   const id=encodeURIComponent(publicId);
   const[detail,evidences,histories]=await Promise.all([
    apiRequest<IncidentDetailDto>(`/incidents/${id}`),
    apiRequest<IncidentEvidenceListDto>(`/incidents/${id}/evidences?size=100&sort=detected_at%2Casc`),
    apiRequest<IncidentHistoryListDto>(`/incidents/${id}/histories?size=100&sort=changed_at%2Casc`),
   ]);
   return mapIncidentDetailRecord(detail,evidences.items,histories.items);
  }catch(error){
   if(error instanceof ApiError&&error.httpStatus===404)return null;
   throw error;
  }
 }

 async act(request:IncidentActionRequest):Promise<IncidentActionResult>{
  if(!["acknowledge","claim","review","decide"].includes(request.action))throw new Error("UNSUPPORTED_INCIDENT_COMMAND");
  if(!Number.isInteger(request.expected_version_no)||request.expected_version_no<0)throw new Error("INVALID_INCIDENT_VERSION");
  const id=encodeURIComponent(request.incident_public_id);
  try{
   const isDecision=request.action==="decide";
   const decision=request.payload as IncidentDecisionPayload|undefined;
   if(isDecision&&(!decision||!["REAL_RISK","FALSE_POSITIVE","NEEDS_REVIEW","NO_DISPATCH"].includes(decision.decision_type)||!decision.decision_reason.trim()))throw new Error("INVALID_INCIDENT_DECISION");
   const response=await apiRequest<IncidentCommandResponseDto>(isDecision?`/incidents/${id}/decisions`:`/incidents/${id}/${request.action}`,{
    method:"POST",
    idempotencyKey:request.idempotency_key,
    body:isDecision?{decision_type:decision!.decision_type,decision_reason:decision!.decision_reason.trim(),expected_version_no:request.expected_version_no}:{expected_version_no:request.expected_version_no},
   });
   return{ok:true,status:response.status,version_no:response.version_no};
  }catch(error){
   if(!(error instanceof ApiError)||!commandErrorCodes.some(code=>code===error.code))throw error;
   const latest=await this.get(request.incident_public_id);
   if(!latest)throw error;
   const controllerName=typeof error.details?.controller_name==="string"
    ?error.details.controller_name
    :typeof error.details?.claimed_by_name==="string"
      ?error.details.claimed_by_name
      :latest.incident.assigned_controller?.display_name??null;
   return{ok:false,code:error.code as typeof commandErrorCodes[number],latest,controller_name:controllerName};
  }
 }

 async listResponders(){
  const response=await apiRequest<ResponderListDto>("/responders?available_only=true");
  return response.items.map(mapDispatchResponder);
 }

 async assignDispatch(request:IncidentDispatchAssignmentRequest):Promise<IncidentActionResult>{
  if(!incidentPublicIdPattern.test(request.incident_public_id))throw new Error("INVALID_INCIDENT_PUBLIC_ID");
  if(!incidentPublicIdPattern.test(request.responder_public_id))throw new Error("INVALID_RESPONDER_PUBLIC_ID");
  if(!Number.isInteger(request.expected_version_no)||request.expected_version_no<0)throw new Error("INVALID_INCIDENT_VERSION");
  const id=encodeURIComponent(request.incident_public_id);
  const send=()=>apiRequest<IncidentDispatchResponseDto>(`/incidents/${id}/dispatches`,{
   method:"POST",
   idempotencyKey:request.idempotency_key,
   body:{responder_public_id:request.responder_public_id,request_message:request.request_message,expected_version_no:request.expected_version_no},
  });
  try{
   let response:IncidentDispatchResponseDto;
   try{response=await send()}catch(error){if(!(error instanceof TypeError))throw error;response=await send()}
   return{ok:true,status:response.incident.status,version_no:response.incident.version_no};
  }catch(error){
   if(!(error instanceof ApiError)||!dispatchErrorCodes.some(code=>code===error.code))throw error;
   const latest=await this.get(request.incident_public_id);
   if(!latest)throw error;
   return{ok:false,code:error.code as typeof dispatchErrorCodes[number],latest};
 }
 }

 async createMemo(request:IncidentMemoRequest):Promise<IncidentMemo>{
  void request;
  throw new Error("UNSUPPORTED_INCIDENT_MEMO");
 }
}

export interface IncidentRealtimeInvalidation{event_id:string;incident_public_id:string;event_type:"INCIDENT.STATUS_CHANGED"|"INCIDENT.UPDATED"|"DISPATCH.STATUS_CHANGED"}
