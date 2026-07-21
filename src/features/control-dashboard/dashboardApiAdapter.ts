import { apiRequest } from "@/lib/apiClient";
import type { CctvDetailDto, CctvListDto, IncidentListDto, IncidentSummaryDto } from "./dashboardApiTypes";
import { mapDashboardCctvDetail, mapDashboardIncident, mapDashboardSnapshot } from "./dashboardMapper";
import type { DashboardAdapter, DashboardDispatch, DashboardIncident, DashboardRealtimeAdapter, DashboardSnapshot } from "./dashboardTypes";

export class ApiDashboardAdapter implements DashboardAdapter {
  async load():Promise<DashboardSnapshot>{
    const [summary,incidents,cctvs]=await Promise.all([
      apiRequest<IncidentSummaryDto>("/incidents/summary"),
      apiRequest<IncidentListDto>("/incidents?size=100&sort=priority%2Cdesc"),
      apiRequest<CctvListDto>("/cctvs?size=100&sort=cctv_name%2Casc"),
    ]);
    return mapDashboardSnapshot({summary,incidents:incidents.items,cctvs:cctvs.items,fallbackUsed:cctvs.fallback_used,fetchedAt:summary.generated_at});
  }
  async refreshIncident(publicId:string):Promise<DashboardIncident|null>{
    const list=await apiRequest<IncidentListDto>(`/incidents?size=100&keyword=${encodeURIComponent(publicId)}`);
    const dto=list.items.find(item=>item.public_id===publicId);
    return dto?mapDashboardIncident(dto):null;
  }
  async refreshCctv(publicId:string){return mapDashboardCctvDetail(await apiRequest<CctvDetailDto>(`/cctvs/${encodeURIComponent(publicId)}`))}
  async refreshDispatch(publicId:string):Promise<DashboardDispatch|null>{void publicId;return null}
}
export class UnavailableDashboardRealtimeAdapter implements DashboardRealtimeAdapter { connect(){return()=>undefined} }
