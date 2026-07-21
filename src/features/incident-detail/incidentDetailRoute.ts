import { createMockDashboardSnapshot } from "@/features/control-dashboard/mockDashboardAdapter";
import type { DashboardDataMode } from "@/features/control-dashboard/dashboardAdapterFactory";

const incidentPublicIdPattern=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const incidentNumberPattern=/^INC-\d{8}-\d{4}$/;

export type IncidentDetailRouteResolution=
  |{kind:"valid";publicId:string}
  |{kind:"redirect";publicId:string}
  |{kind:"invalid"};

export function incidentDetailPath(publicId:string){
  if(!incidentPublicIdPattern.test(publicId))throw new Error("INVALID_INCIDENT_PUBLIC_ID");
  return `/control/incidents/${publicId}` as const;
}

export function resolveIncidentDetailRoute(identifier:string,mode:DashboardDataMode):IncidentDetailRouteResolution{
  if(incidentPublicIdPattern.test(identifier))return{kind:"valid",publicId:identifier};
  if(mode==="mock"&&incidentNumberPattern.test(identifier)){
    const incident=createMockDashboardSnapshot().incidents.find(item=>item.incident_no===identifier);
    if(incident)return{kind:"redirect",publicId:incident.public_id};
  }
  return{kind:"invalid"};
}
