import { describe, expect, it } from "vitest";
import { createMockDashboardSnapshot } from "@/features/control-dashboard/mockDashboardAdapter";
import { MockIncidentDetailAdapter } from "./mockIncidentDetailAdapter";

describe("MockIncidentDetailAdapter commands",()=>{
  it("returns every existing dashboard incident by public id without substituting another record",async()=>{
    const adapter=new MockIncidentDetailAdapter();
    const incidents=createMockDashboardSnapshot().incidents;
    for(const incident of incidents){
      const detail=await adapter.get(incident.public_id);
      expect(detail?.incident.public_id).toBe(incident.public_id);
      expect(detail?.incident.incident_no).toBe(incident.incident_no);
    }
    await expect(adapter.get("00000000-0000-4000-8000-000000000000")).resolves.toBeNull();
  });

  it("keeps the acknowledge, claim, review, and release demo flow",async()=>{
    const adapter=new MockIncidentDetailAdapter();
    const publicId=createMockDashboardSnapshot().incidents.find(item=>item.status==="NEW")!.public_id;
    const initial=await adapter.get(publicId);
    expect(initial).not.toBeNull();
    const acknowledged=await adapter.act({incident_public_id:publicId,expected_version_no:initial!.incident.version_no,action:"acknowledge",idempotency_key:"mock-1"});
    expect(acknowledged).toMatchObject({ok:true,status:"ACKNOWLEDGED"});
    const claimed=await adapter.act({incident_public_id:publicId,expected_version_no:acknowledged.ok?acknowledged.version_no:-1,action:"claim",idempotency_key:"mock-2"});
    expect(claimed).toMatchObject({ok:true,status:"CLAIMED"});
    const reviewed=await adapter.act({incident_public_id:publicId,expected_version_no:claimed.ok?claimed.version_no:-1,action:"review",idempotency_key:"mock-3"});
    expect(reviewed).toMatchObject({ok:true,status:"UNDER_REVIEW"});
    expect(adapter.supportsRelease).toBe(true);
    const released=await adapter.act({incident_public_id:publicId,expected_version_no:reviewed.ok?reviewed.version_no:-1,action:"release",idempotency_key:"mock-4"});
    expect(released).toMatchObject({ok:true,status:"ACKNOWLEDGED"});
  });

  it.each([
    ["REAL_RISK","DISPATCH_REQUESTED",24],
    ["FALSE_POSITIVE","FALSE_POSITIVE",25],
    ["NEEDS_REVIEW","UNDER_REVIEW",26],
    ["NO_DISPATCH","CLOSED",27],
  ] as const)("maps the %s demo decision to %s",async(decisionType,status,sequence)=>{
    const adapter=new MockIncidentDetailAdapter();
    const publicId=`22222222-2222-4222-8222-${String(sequence).padStart(12,"0")}`;
    const current=await adapter.get(publicId);
    expect(current).not.toBeNull();
    const result=await adapter.act({incident_public_id:publicId,expected_version_no:current!.incident.version_no,action:"decide",idempotency_key:`mock-${decisionType}`,payload:{decision_type:decisionType,decision_reason:"Mock 판정"}});
    expect(result).toMatchObject({ok:true,status});
  });

  it("provides selectable responders only in mock mode",async()=>{
    const adapter=new MockIncidentDetailAdapter();
    expect(adapter.supportsDispatchAssignment).toBe(true);
    expect((await adapter.listResponders()).some(item=>item.available)).toBe(true);
  });

  it("keeps stopped-vehicle evidence on a vehicle scene instead of the fallen-object image",async()=>{
    const adapter=new MockIncidentDetailAdapter();
    const incident=createMockDashboardSnapshot().incidents.find(item=>item.class_code==="STOPPED_VEHICLE")!;
    const detail=await adapter.get(incident.public_id);
    expect(detail?.evidences[0]).toMatchObject({class_name:"정지 차량",original_image_url:"/images/incidents/highway-traffic-realistic.png",annotated_image_url:null});
    expect(detail?.evidences[0].bbox).not.toBeNull();
  });
});
