import type {DashboardDispatch,DashboardIncident,DashboardSnapshot,IncidentStatus} from "@/features/control-dashboard/dashboardTypes";

export type ManagerAttentionKind="urgent"|"unassigned"|"dispatch"|"closure";
export type ControlManagerSummary={urgentUnacknowledgedCount:number;unassignedCount:number;dispatchAttentionCount:number;closurePendingCount:number};
export type ControllerWorkload={userPublicId:string;userName:string;assignedCount:number;reviewingCount:number;dispatchLinkedCount:number;closurePendingCount:number;lastActivityAt:string|null};
export type ResponseFlowKey="intake"|"review"|"dispatch"|"field"|"closure";

export const responseFlowGroups:Record<ResponseFlowKey,IncidentStatus[]>={
 intake:["NEW","ACKNOWLEDGED"],
 review:["CLAIMED","UNDER_REVIEW"],
 dispatch:["DISPATCH_REQUESTED"],
 field:["DISPATCHED","ON_SCENE","ACTION_IN_PROGRESS"],
 closure:["ACTION_COMPLETED"],
};
const terminal=new Set<IncidentStatus>(["CLOSED","FALSE_POSITIVE"]);
const dispatchAttention=(dispatches:DashboardDispatch[])=>new Set(dispatches.filter(item=>item.status==="REQUESTED"||item.status==="REJECTED").map(item=>item.incident_public_id));

export function getAttentionKinds(incident:DashboardIncident,attentionDispatchIds:Set<string>):ManagerAttentionKind[]{
 const kinds:ManagerAttentionKind[]=[];
 if(incident.status==="NEW"&&(incident.current_risk_grade==="HIGH"||incident.current_risk_grade==="CRITICAL"))kinds.push("urgent");
 if(!terminal.has(incident.status)&&!incident.assigned_controller)kinds.push("unassigned");
 if(attentionDispatchIds.has(incident.public_id))kinds.push("dispatch");
 if(incident.status==="ACTION_COMPLETED")kinds.push("closure");
 return kinds;
}

export function selectControlManagerSummary(snapshot:DashboardSnapshot):ControlManagerSummary{
 const dispatchIds=dispatchAttention(snapshot.dispatches);
 return{
  urgentUnacknowledgedCount:snapshot.incidents.filter(item=>getAttentionKinds(item,dispatchIds).includes("urgent")).length,
  unassignedCount:snapshot.incidents.filter(item=>getAttentionKinds(item,dispatchIds).includes("unassigned")).length,
  dispatchAttentionCount:snapshot.incidents.filter(item=>getAttentionKinds(item,dispatchIds).includes("dispatch")).length,
  closurePendingCount:snapshot.incidents.filter(item=>getAttentionKinds(item,dispatchIds).includes("closure")).length,
 };
}

export function selectManagerAttentionIncidents(snapshot:DashboardSnapshot,kind:ManagerAttentionKind|"all"="all"){
 const dispatchIds=dispatchAttention(snapshot.dispatches);
 return snapshot.incidents.filter(item=>{const kinds=getAttentionKinds(item,dispatchIds);return kind==="all"?kinds.length>0:kinds.includes(kind)})
  .sort((a,b)=>Date.parse(b.updated_at)-Date.parse(a.updated_at));
}

export function selectControllerWorkloads(snapshot:DashboardSnapshot):ControllerWorkload[]{
 const dispatchByIncident=new Set(snapshot.dispatches.map(item=>item.incident_public_id));
 const grouped=new Map<string,DashboardIncident[]>();
 snapshot.incidents.filter(item=>!terminal.has(item.status)&&item.assigned_controller).forEach(item=>{const id=item.assigned_controller!.public_id;const list=grouped.get(id)??[];list.push(item);grouped.set(id,list)});
 return[...grouped.entries()].map(([userPublicId,incidents])=>({
  userPublicId,userName:incidents[0].assigned_controller!.display_name,assignedCount:incidents.length,
  reviewingCount:incidents.filter(item=>item.status==="CLAIMED"||item.status==="UNDER_REVIEW").length,
  dispatchLinkedCount:incidents.filter(item=>dispatchByIncident.has(item.public_id)).length,
  closurePendingCount:incidents.filter(item=>item.status==="ACTION_COMPLETED").length,
  lastActivityAt:incidents.reduce<string|null>((latest,item)=>!latest||Date.parse(item.updated_at)>Date.parse(latest)?item.updated_at:latest,null),
 })).sort((a,b)=>b.assignedCount-a.assignedCount||a.userName.localeCompare(b.userName,"ko-KR"));
}

export function selectResponseFlow(snapshot:DashboardSnapshot){
 return(Object.entries(responseFlowGroups) as [ResponseFlowKey,IncidentStatus[]][]).map(([key,statuses])=>({key,count:snapshot.incidents.filter(item=>statuses.includes(item.status)).length}));
}
