import { mockIncidentPublicIds } from "@/features/mocks/mockResourceIds";
import { createMockDashboardSnapshot } from "./mockDashboardAdapter";
import { activeStatuses, prioritizeIncidents } from "./dashboardDomain";
import type { DashboardDispatch, DashboardSnapshot, DispatchLookupStatus } from "./dashboardTypes";

export interface DashboardDispatchLookup {
  incidentId:string|null;
  status:DispatchLookupStatus;
  dispatch:DashboardDispatch|null;
}

export function createDashboardInitialState(mode:"api"|"mock"):{data:DashboardSnapshot|null;selectedIncident:string|null;loading:boolean}{
  if(mode==="api")return{data:null,selectedIncident:null,loading:true};
  return{data:createMockDashboardSnapshot(),selectedIncident:mockIncidentPublicIds["INC-20260719-0013"],loading:false};
}

export function selectIncidentAfterDashboardLoad(snapshot:DashboardSnapshot,current:string|null):string|null{
  if(current&&snapshot.incidents.some(item=>item.public_id===current))return current;
  return prioritizeIncidents(snapshot.incidents.filter(item=>activeStatuses.includes(item.status)))[0]?.public_id??null;
}

export function beginDispatchLookup(incidentId:string|null):DashboardDispatchLookup{
  return incidentId?{incidentId,status:"loading",dispatch:null}:{incidentId:null,status:"idle",dispatch:null};
}

export function completeDispatchLookup(current:DashboardDispatchLookup,incidentId:string,dispatch:DashboardDispatch|null):DashboardDispatchLookup{
  return current.incidentId===incidentId?{incidentId,status:"ready",dispatch}:current;
}

export function failDispatchLookup(current:DashboardDispatchLookup,incidentId:string):DashboardDispatchLookup{
  return current.incidentId===incidentId?{incidentId,status:"error",dispatch:null}:current;
}
