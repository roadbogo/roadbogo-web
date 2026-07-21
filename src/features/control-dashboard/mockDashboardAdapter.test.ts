import{describe,expect,it}from"vitest";
import{countKpi,activeStatuses}from"./dashboardDomain";
import{createMockDashboardSnapshot,MockDashboardAdapter}from"./mockDashboardAdapter";

describe("mock dashboard data path",()=>{
 it("creates six CCTV cards through the mock snapshot mapper",()=>{expect(createMockDashboardSnapshot().cctvs).toHaveLength(6)});
 it("returns six CCTV cards from MockDashboardAdapter.load",async()=>{expect((await new MockDashboardAdapter().load()).cctvs).toHaveLength(6)});
 it("uses unique resource identifiers without CCTV/incident collisions",()=>{const snapshot=createMockDashboardSnapshot();const cctvIds=snapshot.cctvs.map(item=>item.public_id),incidentIds=snapshot.incidents.map(item=>item.public_id);expect(new Set(cctvIds).size).toBe(cctvIds.length);expect(new Set(incidentIds).size).toBe(incidentIds.length);expect(cctvIds.some(id=>incidentIds.includes(id))).toBe(false)});
 it("links every incident to an existing mock CCTV",()=>{const snapshot=createMockDashboardSnapshot(),cctvIds=new Set(snapshot.cctvs.map(item=>item.public_id));expect(snapshot.incidents.every(item=>cctvIds.has(item.cctv_public_id))).toBe(true)});
 it("preserves CCTV contracts, incidents, and non-zero operational KPIs",()=>{const snapshot=createMockDashboardSnapshot(),active=snapshot.incidents.filter(item=>activeStatuses.includes(item.status));expect(snapshot.incidents.length).toBeGreaterThan(0);expect(snapshot.summary.total_count).toBe(snapshot.incidents.length);expect(["NORMAL","DELAYED","FAULT","INACTIVE","UNKNOWN"]).toContain(snapshot.cctvs[0].operational_status);expect(snapshot.cctvs.every(item=>item.source_type&&item.stream_type&&item.direction_code)).toBe(true);expect(["unconfirmed","review","dispatch","closing"].map(key=>countKpi(active,key as "unconfirmed"|"review"|"dispatch"|"closing")).some(count=>count>0)).toBe(true)});
});
