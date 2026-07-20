import { describe,expect,it } from "vitest";
import { canUsePrimaryAction,countKpi,incidentStatusForDispatch,prioritizeIncidents,selectIncidentForCctv } from "./dashboardDomain";
import type { DashboardIncident } from "./dashboardTypes";
const incident=(status:DashboardIncident["status"],grade:DashboardIncident["current_risk_grade"]="HIGH"):DashboardIncident=>({public_id:`i-${status}`,incident_no:"INC-1",cctv_public_id:"c-1",status,object_category:"DEBRIS",class_code:"TIRE",class_name:"타이어",current_risk_score:80,current_risk_grade:grade,representative_confidence:.9,duration_ms:1000,detection_count:2,assigned_controller:null,version_no:1,created_at:"2026-07-19T00:00:00.000Z",updated_at:"2026-07-19T00:00:00.000Z"});
describe("control dashboard domain",()=>{
  it("calculates the four operational KPI groups",()=>{const items=[incident("NEW"),incident("ACKNOWLEDGED"),incident("CLAIMED"),incident("DISPATCHED"),incident("ACTION_COMPLETED")];expect(countKpi(items,"unconfirmed")).toBe(1);expect(countKpi(items,"review")).toBe(2);expect(countKpi(items,"dispatch")).toBe(1);expect(countKpi(items,"closing")).toBe(1)});
  it("puts an unconfirmed critical incident first",()=>{expect(prioritizeIncidents([incident("DISPATCHED","CRITICAL"),incident("NEW","HIGH"),incident("NEW","CRITICAL")])[0].current_risk_grade).toBe("CRITICAL")});
  it("uses a stable operational order after urgent incidents",()=>{
    const items=[
      {...incident("ACTION_COMPLETED"),public_id:"closing"},
      {...incident("DISPATCHED"),public_id:"dispatch",assigned_controller:{public_id:"controller",display_name:"관제자"}},
      {...incident("UNDER_REVIEW"),public_id:"review",assigned_controller:{public_id:"controller",display_name:"관제자"}},
      {...incident("ACKNOWLEDGED"),public_id:"reassign"},
    ];
    expect(prioritizeIncidents(items).map(item=>item.public_id)).toEqual(["reassign","review","dispatch","closing"]);
  });
  it("maps rejected dispatch back to dispatch requested",()=>{expect(incidentStatusForDispatch("REJECTED")).toBe("DISPATCH_REQUESTED");expect(incidentStatusForDispatch("ARRIVED")).toBe("ON_SCENE")});
  it("requires permissions, a non-negative version and matching assignee",()=>{const item={...incident("CLAIMED"),assigned_controller:{public_id:"other",display_name:"다른 관제자"}};expect(canUsePrimaryAction(item,{publicId:"me",apiPermissions:["INCIDENT.DECIDE"]})).toBe(false);expect(canUsePrimaryAction({...item,assigned_controller:{public_id:"me",display_name:"나"},version_no:0},{publicId:"me",apiPermissions:["INCIDENT.DECIDE"]})).toBe(true);expect(canUsePrimaryAction({...item,assigned_controller:{public_id:"me",display_name:"나"},version_no:-1},{publicId:"me",apiPermissions:["INCIDENT.DECIDE"]})).toBe(false)});
  it("requires INCIDENT.CLAIM to acknowledge a new incident",()=>{const item={...incident("NEW"),version_no:0};expect(canUsePrimaryAction(item,{publicId:"me",apiPermissions:["INCIDENT.READ_ALL"]})).toBe(false);expect(canUsePrimaryAction(item,{publicId:"me",apiPermissions:["INCIDENT.CLAIM"]})).toBe(true)});
  it("selects the highest-priority incident linked to a CCTV without borrowing another CCTV incident",()=>{
    const critical={...incident("NEW","CRITICAL"),public_id:"critical",cctv_public_id:"c-2"};
    const high={...incident("NEW","HIGH"),public_id:"high",cctv_public_id:"c-2"};
    expect(selectIncidentForCctv([high,critical],"c-2")?.public_id).toBe("critical");
    expect(selectIncidentForCctv([high,critical],"c-3")).toBeNull();
  });
});
