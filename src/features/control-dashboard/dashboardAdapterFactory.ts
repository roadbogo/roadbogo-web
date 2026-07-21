import { ApiDashboardAdapter } from "./dashboardApiAdapter";
import { MockDashboardAdapter } from "./mockDashboardAdapter";
import type { DashboardAdapter } from "./dashboardTypes";

export type DashboardDataMode="api"|"mock";

export function resolveDashboardDataMode(nodeEnv:string|undefined,useMock:string|undefined):DashboardDataMode{
  return nodeEnv==="development"&&useMock==="true"?"mock":"api";
}

export function createDashboardAdapter():DashboardAdapter{
  return resolveDashboardDataMode(process.env.NODE_ENV,process.env.NEXT_PUBLIC_USE_MOCK)==="mock"
    ?new MockDashboardAdapter()
    :new ApiDashboardAdapter();
}
