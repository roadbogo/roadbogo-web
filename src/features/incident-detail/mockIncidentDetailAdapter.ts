import { createMockDashboardSnapshot } from "@/features/control-dashboard/mockDashboardAdapter";
import type { DashboardIncident, IncidentStatus } from "@/features/control-dashboard/dashboardTypes";
import { updateMockIncidentRuntime } from "@/features/control-dashboard/mockIncidentRuntimeState";
import type { DispatchResponderOption, IncidentActionRequest, IncidentActionResult, IncidentDecisionPayload, IncidentDetailAdapter, IncidentDetailRecord, IncidentDispatchAssignmentRequest, IncidentEvidence, IncidentHistory, IncidentMemoRequest } from "./incidentDetailTypes";
const snapshot=createMockDashboardSnapshot();
const image="/images/incidents/fallen-object-realistic.png";
const original="/images/incidents/cctv-highway-base.webp";
function evidenceVisual(incident:DashboardIncident){
 const stoppedVehicle=incident.class_code==="STOPPED_VEHICLE"||incident.class_name==="정지 차량";
 return stoppedVehicle
  ?{original_image_url:"/images/incidents/highway-traffic-realistic.png",annotated_image_url:null,bbox:{x:.67,y:.38,width:.2,height:.28}}
  :{original_image_url:original,annotated_image_url:image,bbox:{x:.43,y:.42,width:.22,height:.25}};
}
function evidences(incident:DashboardIncident):IncidentEvidence[]{const visual=evidenceVisual(incident);return Array.from({length:6},(_,index)=>({detection_public_id:`detection-${incident.public_id}-${index}`,detected_at:new Date(Date.parse(incident.created_at)+index*1000).toISOString(),object_category:incident.object_category,class_code:incident.class_code,class_name:incident.class_name,confidence:Math.max(.7,(incident.representative_confidence??0)-index*.01),is_representative:index===0,bbox:visual.bbox,original_image_url:visual.original_image_url,annotated_image_url:index===0?visual.annotated_image_url:null,risk:{risk_score:incident.current_risk_score,risk_grade:incident.current_risk_grade,duration_ms:incident.duration_ms,repeat_count:incident.detection_count,track_id:"TRACK-120",reason_codes:["CONFIDENCE_THRESHOLD","DURATION_THRESHOLD","REPEAT_DETECTION","TRACK_STABLE"]}}))}
const labels=["AI 위험 후보","사건 생성","관제 확인","검토·판정","출동 배정","현장 조치","관제 종료"];
function histories(incident:DashboardIncident):IncidentHistory[]{const count=Math.min(7,{NEW:2,ACKNOWLEDGED:3,CLAIMED:3,UNDER_REVIEW:4,DISPATCH_REQUESTED:5,DISPATCHED:5,ON_SCENE:6,ACTION_IN_PROGRESS:6,ACTION_COMPLETED:6,CLOSED:7,FALSE_POSITIVE:7}[incident.status]);return labels.slice(0,count).map((label,index)=>({public_id:`history-${incident.public_id}-${index}`,event_type:index===0?"AI_CANDIDATE":"INCIDENT_UPDATED",label,actor_name:index<2?"시스템":incident.assigned_controller?.display_name??"관제센터",occurred_at:new Date(Date.parse(incident.created_at)+index*600000).toISOString(),detail:index===0?"AI가 위험 후보를 생성했습니다.":null}))}
function withStatus(base:DashboardIncident,status:IncidentStatus):DashboardIncident{const sequence=Object.keys(statusOrder).indexOf(status)+21;return{...base,public_id:`22222222-2222-4222-8222-${String(sequence).padStart(12,"0")}`,incident_no:`INC-20260719-${String(sequence).padStart(4,"0")}`,status,version_no:3,assigned_controller:["CLAIMED","UNDER_REVIEW","DISPATCH_REQUESTED","DISPATCHED","ON_SCENE","ACTION_IN_PROGRESS","ACTION_COMPLETED","CLOSED"].includes(status)?{public_id:"mock:controller@roadbogo.kr",display_name:"관제 담당자"}:null}}
const statusOrder:Record<IncidentStatus,number>={NEW:0,ACKNOWLEDGED:1,CLAIMED:2,UNDER_REVIEW:3,FALSE_POSITIVE:4,DISPATCH_REQUESTED:5,DISPATCHED:6,ON_SCENE:7,ACTION_IN_PROGRESS:8,ACTION_COMPLETED:9,CLOSED:10};
const base=snapshot.incidents[0];const records=new Map<string,IncidentDetailRecord>();
for(const status of Object.keys(statusOrder) as IncidentStatus[]){const incident=status==="NEW"?base:withStatus(base,status);const cctv=snapshot.cctvs.find(item=>item.public_id===incident.cctv_public_id)!;const dispatch=["DISPATCH_REQUESTED","DISPATCHED","ON_SCENE","ACTION_IN_PROGRESS","ACTION_COMPLETED","CLOSED"].includes(status)?{public_id:`55555555-5555-4555-8555-${String(statusOrder[status]+1).padStart(12,"0")}`,incident_public_id:incident.public_id,status:status==="DISPATCH_REQUESTED"?"REQUESTED":status==="DISPATCHED"?"EN_ROUTE":status==="ON_SCENE"?"ARRIVED":status==="ACTION_IN_PROGRESS"?"ACTION_IN_PROGRESS":"ACTION_COMPLETED",responder_label:"이천 도로대응팀 · 이출동",requested_at:"2026-07-19T05:30:00.000Z",updated_at:"2026-07-19T06:02:00.000Z"} as const:null;records.set(incident.public_id,{incident,cctv,evidences:evidences(incident),dispatch,histories:histories(incident),field_action:["ACTION_COMPLETED","CLOSED"].includes(status)?{action_type:"낙하물 제거",detail:"주행 차로의 낙하물을 제거하고 도로 상태를 확인했습니다.",before_image_url:image,after_image_url:"/images/incidents/highway-traffic-realistic.png",completed_at:"2026-07-19T06:02:00.000Z"}:null,decision:["UNDER_REVIEW","FALSE_POSITIVE","DISPATCH_REQUESTED","DISPATCHED","ON_SCENE","ACTION_IN_PROGRESS","ACTION_COMPLETED","CLOSED"].includes(status)?{result:status==="FALSE_POSITIVE"?"오탐":"실제 위험",reason:"반복 탐지와 지속시간을 확인했습니다.",decided_by:"관제 담당자",decided_at:"2026-07-19T05:28:00.000Z"}:null,controller_note:"현장 접근 시 2차 사고에 주의 바랍니다.",memos:[{public_id:`memo-${incident.public_id}`,incident_public_id:incident.public_id,memo_type:"GENERAL",content:"현장 접근 시 2차 사고에 주의 바랍니다.",created_by:{public_id:"mock:controller@roadbogo.kr",user_name:"관제 담당자"},created_at:incident.updated_at}],request_message:"안전 확보 후 낙하물을 제거하고 전후 사진을 등록해 주세요."})}
for(const incident of snapshot.incidents){
 if(records.has(incident.public_id))continue;
 const cctv=snapshot.cctvs.find(item=>item.public_id===incident.cctv_public_id);
 if(!cctv)continue;
 const dispatch=snapshot.dispatches.find(item=>item.incident_public_id===incident.public_id)??null;
 const completed=["ACTION_COMPLETED","CLOSED"].includes(incident.status);
 const decided=["UNDER_REVIEW","FALSE_POSITIVE","DISPATCH_REQUESTED","DISPATCHED","ON_SCENE","ACTION_IN_PROGRESS","ACTION_COMPLETED","CLOSED"].includes(incident.status);
 records.set(incident.public_id,{incident,cctv,evidences:evidences(incident),dispatch,histories:histories(incident),field_action:completed?{action_type:"낙하물 제거",detail:"주행 차로의 낙하물을 제거하고 도로 상태를 확인했습니다.",before_image_url:image,after_image_url:"/images/incidents/highway-traffic-realistic.png",completed_at:incident.updated_at}:null,decision:decided?{result:incident.status==="FALSE_POSITIVE"?"오탐":"실제 위험",reason:"반복 탐지와 지속시간을 확인했습니다.",decided_by:incident.assigned_controller?.display_name??"관제 담당자",decided_at:incident.updated_at}:null,controller_note:"현장 접근 시 2차 사고에 주의 바랍니다.",memos:[{public_id:`memo-${incident.public_id}`,incident_public_id:incident.public_id,memo_type:"GENERAL",content:"현장 접근 시 2차 사고에 주의 바랍니다.",created_by:{public_id:incident.assigned_controller?.public_id??"mock:system",user_name:incident.assigned_controller?.display_name??"관제센터"},created_at:incident.updated_at}],request_message:dispatch?"안전 확보 후 현장 상태를 확인해 주세요.":null});
}
records.set(base.public_id,records.get(base.public_id)!);
const transition:Record<string,IncidentStatus>={acknowledge:"ACKNOWLEDGED",claim:"CLAIMED",release:"ACKNOWLEDGED",review:"UNDER_REVIEW",assign:"DISPATCH_REQUESTED",close:"CLOSED"};
const decisionTransition:Record<IncidentDecisionPayload["decision_type"],IncidentStatus>={REAL_RISK:"DISPATCH_REQUESTED",FALSE_POSITIVE:"FALSE_POSITIVE",NEEDS_REVIEW:"UNDER_REVIEW",NO_DISPATCH:"CLOSED"};
const responders:DispatchResponderOption[]=[{public_id:"mock-responder-1",display_name:"이천 도로대응 1팀",organization_name:"이천 도로관리소",available:true},{public_id:"mock-responder-2",display_name:"이천 도로대응 2팀",organization_name:"이천 도로관리소",available:true},{public_id:"mock-responder-3",display_name:"광주 현장지원팀",organization_name:"광주 도로관리소",available:false}];
export function createMockIncidentDetailRecord(public_id:string){const value=records.get(public_id);return value?structuredClone(value):null}
export class MockIncidentDetailAdapter implements IncidentDetailAdapter{
  readonly mode="mock" as const;
  readonly supportsRelease=true;
  readonly supportsDispatchAssignment=true;
  async get(public_id:string){return createMockIncidentDetailRecord(public_id)}
  async act(request:IncidentActionRequest):Promise<IncidentActionResult>{
    const current=records.get(request.incident_public_id);
    if(!current)throw new Error("NOT_FOUND");
    if(request.expected_version_no!==current.incident.version_no)return{ok:false,code:"INCIDENT_VERSION_CONFLICT",latest:structuredClone(current)};
    const decision=request.action==="decide"?request.payload as IncidentDecisionPayload|undefined:undefined;
    const status=decision?decisionTransition[decision.decision_type]:transition[request.action];
    if(!status)return{ok:false,code:"INVALID_TRANSITION",latest:structuredClone(current)};
    const now=new Date().toISOString();
    const actor=request.payload&&typeof request.payload==="object"&&"actor_name" in request.payload?String(request.payload.actor_name):"관제 담당자";
    const actorPublicId=request.payload&&typeof request.payload==="object"&&"actor_public_id" in request.payload?String(request.payload.actor_public_id):"mock:controller@roadbogo.kr";
    const assignedController=request.action==="claim"?{public_id:actorPublicId,display_name:actor}:request.action==="release"?null:current.incident.assigned_controller;
    const actionLabel=request.action==="acknowledge"?"사건 확인":request.action==="claim"?"담당 지정":request.action==="release"?"담당 해제":request.action==="review"?"검토 시작":null;
    const updated={...current,incident:{...current.incident,status,assigned_controller:assignedController,version_no:current.incident.version_no+1,updated_at:now},histories:actionLabel?[...current.histories,{public_id:`history-${current.incident.public_id}-${Date.now()}`,event_type:"INCIDENT_UPDATED",label:actionLabel,actor_name:actor,occurred_at:now,detail:null}]:current.histories,decision:decision?{result:decision.decision_type,reason:decision.decision_reason,decided_by:current.incident.assigned_controller?.display_name??"관제 담당자",decided_at:now}:current.decision};
    records.set(request.incident_public_id,updated);
    updateMockIncidentRuntime(request.incident_public_id,{status,assigned_controller:assignedController,version_no:updated.incident.version_no,updated_at:now});
    return{ok:true,status,version_no:updated.incident.version_no,record:structuredClone(updated)};
  }
  async listResponders(){return structuredClone(responders)}
  async assignDispatch(request:IncidentDispatchAssignmentRequest){return this.act({incident_public_id:request.incident_public_id,expected_version_no:request.expected_version_no,action:"assign",idempotency_key:request.idempotency_key,payload:{responder_public_id:request.responder_public_id,request_message:request.request_message}})}
  async createMemo(request:IncidentMemoRequest){
    const current=records.get(request.incident_public_id);
    if(!current)throw new Error("INCIDENT_NOT_FOUND");
    const content=request.content.trim();
    if(!content||content.length>2000)throw new Error("COMMON_VALIDATION_ERROR");
    if(current.incident.status!=="UNDER_REVIEW")throw new Error("INCIDENT_INVALID_STATE_TRANSITION");
    if(current.incident.assigned_controller?.public_id!==request.actor_public_id)throw new Error("INCIDENT_NOT_ASSIGNED_CONTROLLER");
    const memo={public_id:`memo-${request.incident_public_id}-${Date.now()}`,incident_public_id:request.incident_public_id,memo_type:request.memo_type,content,created_by:{public_id:request.actor_public_id,user_name:request.actor_name},created_at:new Date().toISOString()};
    const memos=[memo,...current.memos.filter(item=>item.public_id!==memo.public_id)];
    records.set(request.incident_public_id,{...current,memos});
    return structuredClone(memo);
  }
}
