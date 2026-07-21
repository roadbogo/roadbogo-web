import { resolveDashboardDataMode } from "@/features/control-dashboard/dashboardAdapterFactory";
import { ApiIncidentDetailAdapter } from "./incidentApiAdapter";
import type { IncidentDetailAdapter } from "./incidentDetailTypes";
import { MockIncidentDetailAdapter } from "./mockIncidentDetailAdapter";

export function createIncidentDetailAdapter():IncidentDetailAdapter{
  return resolveDashboardDataMode(process.env.NODE_ENV,process.env.NEXT_PUBLIC_USE_MOCK)==="mock"
    ?new MockIncidentDetailAdapter()
    :new ApiIncidentDetailAdapter();
}
