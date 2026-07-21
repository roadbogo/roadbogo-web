import { beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError, apiRequest } from "@/lib/apiClient";
import { ApiIncidentDetailAdapter } from "./incidentApiAdapter";
import type { IncidentDetailRecord } from "./incidentDetailTypes";

vi.mock("@/lib/apiClient",async()=>{
  const actual=await vi.importActual<typeof import("@/lib/apiClient")>("@/lib/apiClient");
  return{...actual,apiRequest:vi.fn()};
});

const request=vi.mocked(apiRequest);
const latest={incident:{assigned_controller:{display_name:"김관제"}}} as IncidentDetailRecord;
const incidentPublicId="11111111-1111-4111-8111-111111111112";
const responderPublicId="22222222-2222-4222-8222-222222222222";

describe("ApiIncidentDetailAdapter commands",()=>{
  beforeEach(()=>vi.clearAllMocks());

  it("does not send a display incident number to the detail API",async()=>{
    const adapter=new ApiIncidentDetailAdapter();
    await expect(adapter.get("INC-20260719-0012")).rejects.toThrow("INVALID_INCIDENT_PUBLIC_ID");
    expect(request).not.toHaveBeenCalled();
  });

  it.each([
    ["acknowledge","ACKNOWLEDGED"],
    ["claim","CLAIMED"],
    ["review","UNDER_REVIEW"],
  ] as const)("posts %s with version zero and the request idempotency key",async(action,status)=>{
    request.mockResolvedValue({public_id:"incident-id",status,version_no:1});
    const adapter=new ApiIncidentDetailAdapter();
    const result=await adapter.act({incident_public_id:"incident-id",expected_version_no:0,action,idempotency_key:"fixed-key"});
    expect(result).toMatchObject({ok:true,status,version_no:1});
    expect(request).toHaveBeenCalledWith(`/incidents/incident-id/${action}`,{method:"POST",idempotencyKey:"fixed-key",body:{expected_version_no:0}});
  });

  it.each([
    ["REAL_RISK","DISPATCH_REQUESTED"],
    ["FALSE_POSITIVE","FALSE_POSITIVE"],
    ["NEEDS_REVIEW","UNDER_REVIEW"],
    ["NO_DISPATCH","CLOSED"],
  ] as const)("posts the %s decision and applies the returned status",async(decisionType,status)=>{
    request.mockResolvedValue({public_id:"incident-id",status,version_no:8});
    const adapter=new ApiIncidentDetailAdapter();
    const result=await adapter.act({incident_public_id:"incident-id",expected_version_no:0,action:"decide",idempotency_key:"decision-key",payload:{decision_type:decisionType,decision_reason:"판정 사유"}});
    expect(result).toMatchObject({ok:true,status,version_no:8});
    expect(request).toHaveBeenCalledWith("/incidents/incident-id/decisions",{method:"POST",idempotencyKey:"decision-key",body:{decision_type:decisionType,decision_reason:"판정 사유",expected_version_no:0}});
  });

  it.each([
    "INCIDENT_VERSION_CONFLICT",
    "INCIDENT_ALREADY_CLAIMED",
    "INCIDENT_NOT_ASSIGNED_CONTROLLER",
    "INCIDENT_INVALID_STATE_TRANSITION",
  ] as const)("reloads detail after %s without retrying the command",async code=>{
    request.mockRejectedValue(new ApiError(code,"error",null,"trace",409));
    const adapter=new ApiIncidentDetailAdapter();
    vi.spyOn(adapter,"get").mockResolvedValue(latest);
    const result=await adapter.act({incident_public_id:"incident-id",expected_version_no:2,action:"claim",idempotency_key:"fixed-key"});
    expect(result).toMatchObject({ok:false,code,latest});
    expect(adapter.get).toHaveBeenCalledOnce();
    expect(request).toHaveBeenCalledOnce();
  });

  it("never sends the unavailable release command",async()=>{
    const adapter=new ApiIncidentDetailAdapter();
    await expect(adapter.act({incident_public_id:"incident-id",expected_version_no:2,action:"release",idempotency_key:"new-key"})).rejects.toThrow("UNSUPPORTED_INCIDENT_COMMAND");
    expect(adapter.supportsRelease).toBe(false);
    expect(request).not.toHaveBeenCalled();
  });

  it("lists assignable responders and maps nullable organizations",async()=>{
    const adapter=new ApiIncidentDetailAdapter();
    request.mockResolvedValue({items:[
      {public_id:responderPublicId,user_name:"출동 담당자",duty_status:"AVAILABLE",organization:{public_id:"org-id",organization_name:"도로 대응팀"}},
      {public_id:"33333333-3333-4333-8333-333333333333",user_name:"독립 담당자",duty_status:"AVAILABLE",organization:null},
    ],pagination:{page:1,size:20,total_elements:2,total_pages:1}});
    await expect(adapter.listResponders()).resolves.toEqual([
      {public_id:responderPublicId,display_name:"출동 담당자",organization_name:"도로 대응팀",available:true},
      {public_id:"33333333-3333-4333-8333-333333333333",display_name:"독립 담당자",organization_name:null,available:true},
    ]);
    expect(adapter.supportsDispatchAssignment).toBe(true);
    expect(request).toHaveBeenCalledWith("/responders?available_only=true");
  });

  it("assigns a responder with version zero and the supplied idempotency key",async()=>{
    request.mockResolvedValue({public_id:"dispatch-id",status:"REQUESTED",incident:{public_id:incidentPublicId,status:"DISPATCH_REQUESTED",version_no:1},responder:{public_id:responderPublicId,user_name:"출동 담당자"},request_message:null,requested_at:"2026-07-21T00:00:00Z"});
    const adapter=new ApiIncidentDetailAdapter();
    const result=await adapter.assignDispatch({incident_public_id:incidentPublicId,responder_public_id:responderPublicId,expected_version_no:0,idempotency_key:"dispatch-key",request_message:null});
    expect(result).toMatchObject({ok:true,status:"DISPATCH_REQUESTED",version_no:1});
    expect(request).toHaveBeenCalledWith(`/incidents/${incidentPublicId}/dispatches`,{method:"POST",idempotencyKey:"dispatch-key",body:{responder_public_id:responderPublicId,request_message:null,expected_version_no:0}});
  });

  it("reuses one idempotency key for an automatic network retry",async()=>{
    request.mockRejectedValueOnce(new TypeError("network failed")).mockResolvedValueOnce({public_id:"dispatch-id",status:"REQUESTED",incident:{public_id:incidentPublicId,status:"DISPATCH_REQUESTED",version_no:5},responder:{public_id:responderPublicId,user_name:"출동 담당자"},request_message:"현장 확인",requested_at:"2026-07-21T00:00:00Z"});
    const adapter=new ApiIncidentDetailAdapter();
    await expect(adapter.assignDispatch({incident_public_id:incidentPublicId,responder_public_id:responderPublicId,expected_version_no:4,idempotency_key:"same-key",request_message:"현장 확인"})).resolves.toMatchObject({ok:true,version_no:5});
    expect(request).toHaveBeenCalledTimes(2);
    expect(request.mock.calls[0]).toEqual(request.mock.calls[1]);
  });

  it.each([
    "INCIDENT_VERSION_CONFLICT",
    "INCIDENT_NOT_ASSIGNED_CONTROLLER",
    "INCIDENT_INVALID_STATE_TRANSITION",
    "DISPATCH_RESPONDER_NOT_FOUND",
    "DISPATCH_RESPONDER_UNAVAILABLE",
    "DISPATCH_RESPONDER_BUSY",
    "DISPATCH_ALREADY_ASSIGNED",
    "DISPATCH_IDEMPOTENCY_CONFLICT",
  ] as const)("reloads the incident after dispatch error %s",async code=>{
    request.mockRejectedValue(new ApiError(code,"error",null,"trace",409));
    const adapter=new ApiIncidentDetailAdapter();
    vi.spyOn(adapter,"get").mockResolvedValue(latest);
    const result=await adapter.assignDispatch({incident_public_id:incidentPublicId,responder_public_id:responderPublicId,expected_version_no:1,idempotency_key:"dispatch-key",request_message:"현장 확인"});
    expect(result).toMatchObject({ok:false,code,latest});
    expect(adapter.get).toHaveBeenCalledOnce();
    expect(request).toHaveBeenCalledOnce();
  });
});
