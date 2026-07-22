import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createMockDashboardSnapshot } from "@/features/control-dashboard/mockDashboardAdapter";
import { MockIncidentDetailAdapter, resetAllMockOperationsRuntime } from "./mockIncidentDetailAdapter";

beforeEach(resetAllMockOperationsRuntime);
afterEach(resetAllMockOperationsRuntime);

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
    if(!claimed.ok)throw new Error("mock claim failed");
    expect(claimed.record?.incident.claimed_at).not.toBeNull();
    const reviewed=await adapter.act({incident_public_id:publicId,expected_version_no:claimed.ok?claimed.version_no:-1,action:"review",idempotency_key:"mock-3"});
    expect(reviewed).toMatchObject({ok:true,status:"UNDER_REVIEW"});
    expect(adapter.supportsRelease).toBe(true);
    const released=await adapter.act({incident_public_id:publicId,expected_version_no:reviewed.ok?reviewed.version_no:-1,action:"release",idempotency_key:"mock-4"});
    expect(released).toMatchObject({ok:true,status:"ACKNOWLEDGED"});
    if(!released.ok)throw new Error("mock release failed");
    expect(released.record?.incident.claimed_at).toBeNull();
  });

  it("keeps a realistic claimed timestamp on assigned mock incidents",async()=>{
    const adapter=new MockIncidentDetailAdapter();
    const assigned=createMockDashboardSnapshot().incidents.find(item=>item.assigned_controller)!;
    const detail=await adapter.get(assigned.public_id);
    expect(detail?.incident.claimed_at).not.toBeNull();
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

  it("shares a mock dispatch assignment with detail reloads and the dashboard snapshot",async()=>{
    const adapter=new MockIncidentDetailAdapter();
    const candidate=createMockDashboardSnapshot().incidents.find(item=>item.status==="UNDER_REVIEW" && !createMockDashboardSnapshot().dispatches.some(dispatch=>dispatch.incident_public_id===item.public_id))!;
    const current=await adapter.get(candidate.public_id);
    const responder=(await adapter.listResponders()).find(item=>item.available)!;
    const result=await adapter.assignDispatch({incident_public_id:candidate.public_id,expected_version_no:current!.incident.version_no,idempotency_key:"mock-shared-dispatch",responder_public_id:responder.public_id,request_message:"  현장 확인 요청  "});
    expect(result).toMatchObject({ok:true,status:"DISPATCH_REQUESTED",record:{dispatch:{status:"REQUESTED",responder_public_id:responder.public_id,responder_label:responder.display_name},request_message:"현장 확인 요청"}});
    expect((await adapter.get(candidate.public_id))?.dispatch).toMatchObject({responder_public_id:responder.public_id,status:"REQUESTED"});
    expect(createMockDashboardSnapshot().dispatches.find(dispatch=>dispatch.incident_public_id===candidate.public_id)).toMatchObject({responder_public_id:responder.public_id,responder_label:responder.display_name,status:"REQUESTED"});
    const duplicate=await adapter.assignDispatch({incident_public_id:candidate.public_id,expected_version_no:result.ok?result.version_no:-1,idempotency_key:"mock-duplicate-dispatch",responder_public_id:responder.public_id,request_message:"중복 요청"});
    expect(duplicate).toMatchObject({ok:false,code:"DISPATCH_ALREADY_ASSIGNED"});
  });

  it("restores incident and dispatch fixtures after an explicit runtime reset",async()=>{
    const adapter=new MockIncidentDetailAdapter();
    const initialSnapshot=createMockDashboardSnapshot();
    const candidate=initialSnapshot.incidents.find(item=>item.status==="UNDER_REVIEW" && !initialSnapshot.dispatches.some(dispatch=>dispatch.incident_public_id===item.public_id))!;
    const initialRecord=await adapter.get(candidate.public_id);
    const responder=(await adapter.listResponders()).find(item=>item.available)!;
    await adapter.createMemo({incident_public_id:candidate.public_id,memo_type:"REVIEW",content:"초기화할 메모",actor_public_id:initialRecord!.incident.assigned_controller!.public_id,actor_name:initialRecord!.incident.assigned_controller!.display_name});
    expect((await adapter.get(candidate.public_id))!.memos).toHaveLength(initialRecord!.memos.length+1);
    const assigned=await adapter.assignDispatch({incident_public_id:candidate.public_id,expected_version_no:initialRecord!.incident.version_no,idempotency_key:"mock-reset-dispatch",responder_public_id:responder.public_id,request_message:"  초기화 확인  "});
    expect(assigned).toMatchObject({ok:true,status:"DISPATCH_REQUESTED"});
    expect(createMockDashboardSnapshot().dispatches.some(dispatch=>dispatch.incident_public_id===candidate.public_id)).toBe(true);

    resetAllMockOperationsRuntime();

    expect(await adapter.get(candidate.public_id)).toEqual(initialRecord);
    expect(createMockDashboardSnapshot().incidents.find(item=>item.public_id===candidate.public_id)).toEqual(candidate);
    expect(createMockDashboardSnapshot().dispatches.some(dispatch=>dispatch.incident_public_id===candidate.public_id)).toBe(false);
  });

  it("starts repeated mutations of the same incident from the original record",async()=>{
    const adapter=new MockIncidentDetailAdapter();
    const publicId=createMockDashboardSnapshot().incidents.find(item=>item.status==="NEW")!.public_id;
    const initial=await adapter.get(publicId);
    const changed=await adapter.act({incident_public_id:publicId,expected_version_no:initial!.incident.version_no,action:"acknowledge",idempotency_key:"mock-reset-first"});
    expect(changed).toMatchObject({ok:true,status:"ACKNOWLEDGED"});

    resetAllMockOperationsRuntime();

    const restored=await adapter.get(publicId);
    expect(restored).toEqual(initial);
    const repeated=await adapter.act({incident_public_id:publicId,expected_version_no:restored!.incident.version_no,action:"acknowledge",idempotency_key:"mock-reset-second"});
    expect(repeated).toMatchObject({ok:true,status:"ACKNOWLEDGED",version_no:initial!.incident.version_no+1});
  });

  it("keeps stopped-vehicle evidence on a vehicle scene instead of the fallen-object image",async()=>{
    const adapter=new MockIncidentDetailAdapter();
    const incident=createMockDashboardSnapshot().incidents.find(item=>item.class_code==="STOPPED_VEHICLE")!;
    const detail=await adapter.get(incident.public_id);
    expect(detail?.evidences[0]).toMatchObject({class_name:"정지 차량",original_image_url:"/images/incidents/highway-traffic-realistic.png",annotated_image_url:null});
    expect(detail?.evidences[0].bbox).not.toBeNull();
  });
});
