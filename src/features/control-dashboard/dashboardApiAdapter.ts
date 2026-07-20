import type { DashboardAdapter, DashboardDispatch, DashboardIncident, DashboardRealtimeAdapter, DashboardSnapshot } from "./dashboardTypes";
export class ApiDashboardAdapter implements DashboardAdapter {
  async load():Promise<DashboardSnapshot>{throw new Error("관제 REST API가 아직 연결되지 않았습니다.")}
  async refreshIncident(public_id:string):Promise<DashboardIncident|null>{void public_id;throw new Error("사건 REST API가 아직 연결되지 않았습니다.")}
  async refreshDispatch(public_id:string):Promise<DashboardDispatch|null>{void public_id;throw new Error("출동 REST API가 아직 연결되지 않았습니다.")}
}
export class UnavailableDashboardRealtimeAdapter implements DashboardRealtimeAdapter {
  connect(){return()=>undefined}
}
