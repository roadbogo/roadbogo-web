import{describe,expect,it}from"vitest";
import{createMockDashboardSnapshot}from"@/features/control-dashboard/mockDashboardAdapter";
import{selectControlManagerSummary,selectControllerWorkloads,selectManagerAttentionIncidents,selectResponseFlow}from"./controlManagerSelectors";

describe("control manager selectors",()=>{
 it("derives summary and attention rows from the dashboard snapshot",()=>{
  const snapshot=createMockDashboardSnapshot(),summary=selectControlManagerSummary(snapshot);
  expect(summary).toEqual({urgentUnacknowledgedCount:2,unassignedCount:3,dispatchAttentionCount:2,closurePendingCount:1});
  expect(selectManagerAttentionIncidents(snapshot).length).toBeGreaterThan(0);
  expect(selectManagerAttentionIncidents(snapshot,"closure").every(item=>item.status==="ACTION_COMPLETED")).toBe(true);
 });
 it("aggregates controller workloads and response flow without fixture counters",()=>{
  const snapshot=createMockDashboardSnapshot();
  expect(selectControllerWorkloads(snapshot).find(item=>item.userName==="조정민")?.assignedCount).toBe(4);
  expect(Object.fromEntries(selectResponseFlow(snapshot).map(item=>[item.key,item.count]))).toEqual({intake:3,review:2,dispatch:1,field:1,closure:1});
 });
});
