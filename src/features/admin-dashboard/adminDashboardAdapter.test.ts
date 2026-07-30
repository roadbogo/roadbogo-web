import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiAdminDashboardAdapter, MockAdminDashboardAdapter } from "./adminDashboardAdapter";

afterEach(()=>vi.unstubAllGlobals());

describe("admin dashboard adapters",()=>{
  it("keeps unavailable admin domains honest in real mode while preserving health",async()=>{
    vi.stubGlobal("fetch",vi.fn().mockResolvedValue({ok:true,json:async()=>({status:"degraded",api:true,database:false,checkedAt:"2026-07-29T03:00:00.000Z"})}));
    const snapshot=await new ApiAdminDashboardAdapter().load(new AbortController().signal);
    expect(snapshot.systemHealth).toEqual({status:"warning",api:"healthy",database:"warning"});
    expect(snapshot.accountSummary).toBeNull();
    expect(snapshot.roleCounts).toBeNull();
    expect(snapshot.recentChanges).toBeNull();
    expect(snapshot.partialErrors).toContain("계정 데이터와 감사 기록 API가 연결되지 않았습니다.");
  });

  it("does not replace a failed real request with mock dashboard data",async()=>{
    vi.stubGlobal("fetch",vi.fn().mockRejectedValue(new Error("offline")));
    const snapshot=await new ApiAdminDashboardAdapter().load(new AbortController().signal);
    expect(snapshot.systemHealth.status).toBe("unavailable");
    expect(snapshot.accountSummary).toBeNull();
    expect(snapshot.recentChanges).toBeNull();
  });

  it("uses the same snapshot contract for the development mock",async()=>{
    const snapshot=await new MockAdminDashboardAdapter().load(new AbortController().signal);
    expect(snapshot.accountSummary?.totalUsers).toBeGreaterThan(0);
    expect(snapshot.roleCounts?.SYSTEM_ADMIN).toBeTypeOf("number");
    expect(snapshot.featureAvailability.users).toEqual({available:true,href:"/admin/users"});
    expect(snapshot.featureAvailability.roles).toEqual({available:true,href:"/admin/roles"});
    expect(snapshot.featureAvailability.cctv).toEqual({available:true,href:"/admin/cctvs"});
  });
});
