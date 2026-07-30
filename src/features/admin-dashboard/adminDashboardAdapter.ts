import type { SystemHealthResponse } from "@/types/systemHealth";
import type { AdminDashboardAdapter, AdminDashboardSnapshot, AdminStatus } from "./adminDashboardTypes";
import { mockAdminDashboardSnapshot } from "./adminDashboardMock";

const unavailableFeatures:AdminDashboardSnapshot["featureAvailability"]={
  users:{available:true,href:"/admin/users"},roles:{available:true,href:"/admin/roles"},cctv:{available:true,href:"/admin/cctvs"},audit:{available:false},
};

function mapHealth(status:SystemHealthResponse["status"]):AdminStatus{
  return status==="healthy"?"healthy":status==="degraded"?"warning":"offline";
}

export class ApiAdminDashboardAdapter implements AdminDashboardAdapter{
  async load(signal:AbortSignal):Promise<AdminDashboardSnapshot>{
    const generatedAt=new Date().toISOString();
    try{
      const response=await fetch("/api/system-health",{cache:"no-store",signal});
      if(!response.ok)throw new Error("health request failed");
      const health=await response.json() as SystemHealthResponse;
      return{
        generatedAt:health.checkedAt??generatedAt,
        systemHealth:{status:mapHealth(health.status),api:health.api?"healthy":"offline",database:health.database?"healthy":health.api?"warning":"offline"},
        users:null,accountSummary:null,roleCounts:null,recentChanges:null,featureAvailability:unavailableFeatures,
        partialErrors:["계정 데이터와 감사 기록 API가 연결되지 않았습니다."],
      };
    }catch(error){
      if(error instanceof DOMException&&error.name==="AbortError")throw error;
      return{
        generatedAt,systemHealth:{status:"unavailable",api:"unavailable",database:"unavailable"},
        users:null,accountSummary:null,roleCounts:null,recentChanges:null,featureAvailability:unavailableFeatures,
        partialErrors:["운영 상태를 불러오지 못했습니다.","계정 데이터와 감사 기록 API가 연결되지 않았습니다."],
      };
    }
  }
}

export class MockAdminDashboardAdapter implements AdminDashboardAdapter{
  async load(signal:AbortSignal):Promise<AdminDashboardSnapshot>{
    await new Promise<void>((resolve,reject)=>{
      const timeout=setTimeout(resolve,180);
      signal.addEventListener("abort",()=>{clearTimeout(timeout);reject(new DOMException("Aborted","AbortError"))},{once:true});
    });
    return structuredClone({...mockAdminDashboardSnapshot,generatedAt:new Date().toISOString()});
  }
}

export function createAdminDashboardAdapter():AdminDashboardAdapter{
  return process.env.NODE_ENV==="development"&&process.env.NEXT_PUBLIC_USE_MOCK==="true"
    ?new MockAdminDashboardAdapter()
    :new ApiAdminDashboardAdapter();
}
