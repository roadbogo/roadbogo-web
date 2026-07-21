import { describe, expect, it } from "vitest";
import { createMockDashboardSnapshot } from "@/features/control-dashboard/mockDashboardAdapter";
import { resolvePrimaryIncidentAction } from "./incidentDetailDomain";
import { MockIncidentDetailAdapter } from "./mockIncidentDetailAdapter";

describe("mock incident assignment state",()=>{
  it("uses the friendly claim label",()=>{
    const incident=createMockDashboardSnapshot().incidents[0];
    expect(resolvePrimaryIncidentAction({...incident,status:"ACKNOWLEDGED",assigned_controller:null},{public_id:"me",permissions:["INCIDENT.CLAIM"]})).toMatchObject({key:"claim",label:"내가 담당하기"});
  });

  it("persists the assigned controller, history, and dashboard state after claim",async()=>{
    const adapter=new MockIncidentDetailAdapter();
    const publicId=createMockDashboardSnapshot().incidents.find(item=>item.status==="ACKNOWLEDGED")!.public_id;
    const before=await adapter.get(publicId);
    const result=await adapter.act({incident_public_id:publicId,expected_version_no:before!.incident.version_no,action:"claim",idempotency_key:"claim-state",payload:{actor_public_id:"controller-me",actor_name:"로컬 개발 관제자"}});
    expect(result.ok).toBe(true);
    if(result.ok){
      expect(result.record?.incident).toMatchObject({status:"CLAIMED",assigned_controller:{public_id:"controller-me",display_name:"로컬 개발 관제자"}});
      expect(result.record?.histories.at(-1)).toMatchObject({label:"담당 지정",actor_name:"로컬 개발 관제자"});
    }
    expect(createMockDashboardSnapshot().incidents.find(item=>item.public_id===publicId)?.assigned_controller?.display_name).toBe("로컬 개발 관제자");
  });
});
