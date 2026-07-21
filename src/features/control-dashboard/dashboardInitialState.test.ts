import{describe,expect,it}from"vitest";
import{beginDispatchLookup,completeDispatchLookup,createDashboardInitialState,failDispatchLookup,selectIncidentAfterDashboardLoad}from"./dashboardInitialState";
import{createMockDashboardSnapshot}from"./mockDashboardAdapter";

describe("dashboard initial state",()=>{
 it("does not expose mock resources while API data is loading",()=>{const state=createDashboardInitialState("api");expect(state).toEqual({data:null,selectedIncident:null,loading:true})});
 it("keeps the immediate demonstration snapshot in mock mode",()=>{const state=createDashboardInitialState("mock");expect(state.data?.source).toBe("mock");expect(state.data?.cctvs).toHaveLength(6);expect(state.selectedIncident).toBeTruthy()});
 it("selects an API incident only after the loaded snapshot supplies it",()=>{const snapshot={...createMockDashboardSnapshot(),source:"api" as const};const selected=selectIncidentAfterDashboardLoad(snapshot,null);expect(snapshot.incidents.some(item=>item.public_id===selected)).toBe(true);expect(selectIncidentAfterDashboardLoad(snapshot,snapshot.incidents[2].public_id)).toBe(snapshot.incidents[2].public_id);expect(selectIncidentAfterDashboardLoad({...snapshot,incidents:[]},null)).toBeNull()});
 it("clears the previous dispatch while a new incident is loading and ignores stale completions",()=>{const first=beginDispatchLookup("incident-a");const switched=beginDispatchLookup("incident-b");expect(switched).toEqual({incidentId:"incident-b",status:"loading",dispatch:null});expect(completeDispatchLookup(switched,"incident-a",{public_id:"dispatch-a",incident_public_id:"incident-a",status:"REQUESTED",responder_label:"responder",requested_at:"2026-07-21T00:00:00Z",updated_at:"2026-07-21T00:00:00Z"})).toBe(switched);expect(failDispatchLookup(switched,"incident-a")).toBe(switched);expect(first.dispatch).toBeNull()});
});
