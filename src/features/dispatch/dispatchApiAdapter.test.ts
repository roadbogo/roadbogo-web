import { beforeEach, describe, expect, it, vi } from "vitest";
import { dispatchDto } from "./dispatchMapper.test";

const { apiRequest } = vi.hoisted(() => ({ apiRequest: vi.fn() }));
vi.mock("@/lib/apiClient", () => ({
  ApiError: class ApiError extends Error { code: string; httpStatus: number; constructor(code: string, _message: string, _details: unknown, _traceId: unknown, status: number) { super(code); this.code = code; this.httpStatus = status; } },
  apiRequest,
}));
import { ApiDispatchAdapter } from "./dispatchApiAdapter";

describe("ApiDispatchAdapter", () => {
  beforeEach(() => apiRequest.mockReset());
  it("sends version zero and reuses the idempotency key for a network retry", async () => {
    apiRequest.mockRejectedValueOnce(new TypeError("network"))
      .mockResolvedValueOnce({ dispatch: { public_id: dispatchDto.public_id, previous_status: "REQUESTED", status: "ACCEPTED", accepted_at: "2026-07-21T01:00:00Z", version_no: 1 }, incident: { public_id: dispatchDto.incident.public_id, previous_status: "DISPATCH_REQUESTED", status: "DISPATCHED", version_no: 2 } })
      .mockResolvedValueOnce({ ...dispatchDto, status: "ACCEPTED", accepted_at: "2026-07-21T01:00:00Z", version_no: 1 });
    const adapter = new ApiDispatchAdapter(); const key = crypto.randomUUID();
    const result = await adapter.accept(dispatchDto.public_id, 0, key);
    expect(result.ok).toBe(true);
    expect(apiRequest.mock.calls[0][1]).toMatchObject({ method: "POST", idempotencyKey: key, body: { expected_version_no: 0 } });
    expect(apiRequest.mock.calls[1][1].idempotencyKey).toBe(key);
  });
  it("refreshes detail after a version conflict without resubmitting", async () => {
    const { ApiError } = await import("@/lib/apiClient");
    apiRequest.mockRejectedValueOnce(new ApiError("DISPATCH_VERSION_CONFLICT", "conflict", null, null, 409)).mockResolvedValueOnce(dispatchDto);
    const result = await new ApiDispatchAdapter().reject(dispatchDto.public_id, 0, "업무 중", crypto.randomUUID());
    expect(result).toMatchObject({ ok: false, code: "DISPATCH_VERSION_CONFLICT", latest: { versionNo: 0 } });
    expect(apiRequest).toHaveBeenCalledTimes(2);
  });
  it.each(["accept","reject"] as const)("keeps a successful %s command when detail refresh fails",async(action)=>{
    const response=action==="accept"
      ?{dispatch:{public_id:dispatchDto.public_id,previous_status:"REQUESTED",status:"ACCEPTED",accepted_at:"2026-07-21T01:00:00Z",version_no:1},incident:{public_id:dispatchDto.incident.public_id,previous_status:"DISPATCH_REQUESTED",status:"DISPATCHED",version_no:2}}
      :{dispatch:{public_id:dispatchDto.public_id,previous_status:"REQUESTED",status:"REJECTED",rejection_reason:"업무 중",version_no:1},incident:{public_id:dispatchDto.incident.public_id,status:"DISPATCH_REQUESTED",version_no:2},responder:{public_id:"responder",duty_status:"AVAILABLE"}};
    apiRequest.mockResolvedValueOnce(response).mockRejectedValueOnce(new TypeError("refresh failed"));
    const adapter=new ApiDispatchAdapter();const current={...(await import("./dispatchMapper")).mapDispatchDetail(dispatchDto)};
    const result=action==="accept"?await adapter.accept(dispatchDto.public_id,0,"same-key",current):await adapter.reject(dispatchDto.public_id,0,"업무 중","same-key",current);
    expect(result).toMatchObject({ok:true,syncWarning:"DETAIL_REFRESH_FAILED",detail:{status:response.dispatch.status,versionNo:1,incident:{status:response.incident.status},incidentVersionNo:2}});
    expect(apiRequest).toHaveBeenCalledTimes(2);
    expect(apiRequest.mock.calls.filter(([url])=>String(url).endsWith(`/${action}`))).toHaveLength(1);
  });

  it.each([
    ["depart", "depart", "DEPARTED", "departedAt"],
    ["markEnRoute", "en-route", "EN_ROUTE", "enRouteAt"],
    ["arrive", "arrive", "ARRIVED", "arrivedAt"],
    ["startAction", "start-action", "ACTION_IN_PROGRESS", "actionStartedAt"],
  ] as const)("posts %s to its own progress endpoint and merges the timestamp", async (method, endpoint, status, timestampField) => {
    const occurredAt = "2026-07-21T02:00:00Z";
    apiRequest.mockResolvedValueOnce({
      dispatch: { public_id: dispatchDto.public_id, previous_status: dispatchDto.status, status, occurred_at: occurredAt, version_no: 1 },
      incident: { public_id: dispatchDto.incident.public_id, status: dispatchDto.incident.status, version_no: 2 },
    }).mockRejectedValueOnce(new TypeError("refresh failed"));
    const current = (await import("./dispatchMapper")).mapDispatchDetail(dispatchDto);
    const key = crypto.randomUUID();
    const result = await new ApiDispatchAdapter()[method](dispatchDto.public_id, 0, key, current);

    expect(apiRequest.mock.calls[0][0]).toContain(`/dispatches/${dispatchDto.public_id}/${endpoint}`);
    expect(apiRequest.mock.calls[0][1]).toMatchObject({ method: "POST", idempotencyKey: key, body: { expected_version_no: 0 } });
    expect(result).toMatchObject({ ok: true, detail: { status, versionNo: 1, [timestampField]: occurredAt }, syncWarning: "DETAIL_REFRESH_FAILED" });
  });

  it("does not resubmit a progress command after a version conflict", async () => {
    const { ApiError } = await import("@/lib/apiClient");
    apiRequest.mockRejectedValueOnce(new ApiError("DISPATCH_VERSION_CONFLICT", "conflict", null, null, 409))
      .mockResolvedValueOnce({ ...dispatchDto, status: "ACCEPTED", version_no: 4 });
    const result = await new ApiDispatchAdapter().depart(dispatchDto.public_id, 3, "same-key");
    expect(result).toMatchObject({ ok: false, code: "DISPATCH_VERSION_CONFLICT", latest: { versionNo: 4 } });
    expect(apiRequest).toHaveBeenCalledTimes(2);
  });
  it("preserves the staged report through the existing complete-action contract",async()=>{
    const current=(await import("./dispatchMapper")).mapDispatchDetail({...dispatchDto,status:"ACTION_IN_PROGRESS",version_no:4});
    const adapter=new ApiDispatchAdapter(),saved=await adapter.saveActionReport(dispatchDto.public_id,"  현장 조치  ",4,"report-key",current);
    expect(saved).toMatchObject({ok:true,report:{detail:"현장 조치",files:[]}});expect(apiRequest).not.toHaveBeenCalled();
    apiRequest.mockResolvedValueOnce({dispatch:{public_id:dispatchDto.public_id,previous_status:"ACTION_IN_PROGRESS",status:"ACTION_COMPLETED",action_completed_at:"2026-07-21T03:00:00Z",version_no:5},incident:{public_id:dispatchDto.incident.public_id,previous_status:"ACTION_IN_PROGRESS",status:"ACTION_COMPLETED",version_no:3},responder:{public_id:"responder",duty_status:"AVAILABLE"},report:{public_id:"report-public-id",action_type:"현장 조치",action_detail:"현장 조치",action_started_at:"2026-07-21T02:00:00Z",action_completed_at:"2026-07-21T03:00:00Z"}});
    const completed=await adapter.completeAction(dispatchDto.public_id,4,"complete-key",current);
    expect(apiRequest.mock.calls[0]).toEqual([`/dispatches/${dispatchDto.public_id}/complete-action`,expect.objectContaining({method:"POST",idempotencyKey:"complete-key",body:{expected_version_no:4,action_type:"현장 조치",action_detail:"현장 조치"}})]);
    expect(completed).toMatchObject({ok:true,report:{detail:"현장 조치",files:[],completedAt:"2026-07-21T03:00:00Z"},detail:{status:"ACTION_COMPLETED",versionNo:5}});
    expect(await adapter.getActionReport(dispatchDto.public_id)).toMatchObject({detail:"현장 조치",files:[]});
  });
  it("does not invent unsupported report-read or photo endpoints",async()=>{
    const adapter=new ApiDispatchAdapter(),file=new File(["image"],"before.jpg",{type:"image/jpeg"});
    expect(await adapter.getActionReport(dispatchDto.public_id)).toBeNull();
    await expect(adapter.uploadActionFile(file,"ACTION_BEFORE","client-file","upload-key")).rejects.toThrow("DISPATCH_ACTION_FILES_UNSUPPORTED");
    await expect(adapter.linkActionFile(dispatchDto.public_id,"file-public-id","ACTION_BEFORE",0,"link-key")).rejects.toThrow("DISPATCH_ACTION_FILES_UNSUPPORTED");
    expect(apiRequest).not.toHaveBeenCalled();
  });
});
