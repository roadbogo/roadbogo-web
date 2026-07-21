import { resolveDashboardDataMode } from "@/features/control-dashboard/dashboardAdapterFactory";
import { ApiDispatchAdapter } from "./dispatchApiAdapter";import { MockDispatchAdapter } from "./mockDispatchAdapter";import type { DispatchAdapter } from "./dispatchTypes";
export function createDispatchAdapter():DispatchAdapter{return resolveDashboardDataMode(process.env.NODE_ENV,process.env.NEXT_PUBLIC_USE_MOCK)==="mock"?new MockDispatchAdapter():new ApiDispatchAdapter()}
