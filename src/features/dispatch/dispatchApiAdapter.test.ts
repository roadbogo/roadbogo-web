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
  it("uses the action report, file, link, and complete contracts",async()=>{
    const current=(await import("./dispatchMapper")).mapDispatchDetail({...dispatchDto,status:"ACTION_IN_PROGRESS",version_no:4});
    apiRequest.mockResolvedValueOnce({}).mockResolvedValueOnce({...dispatchDto,status:"ACTION_IN_PROGRESS",version_no:4});
    await new ApiDispatchAdapter().saveActionReport(dispatchDto.public_id,"현장 조치",4,"report-key",current);
    expect(apiRequest.mock.calls[0]).toEqual([`/dispatches/${dispatchDto.public_id}/action-report`,expect.objectContaining({method:"PUT",idempotencyKey:"report-key",body:{detail:"현장 조치",expected_version_no:4}})]);
    apiRequest.mockReset().mockResolvedValueOnce({file_public_id:"file-public-id"});
    const file=new File(["image"],"before.jpg",{type:"image/jpeg"});await new ApiDispatchAdapter().uploadActionFile(file,"ACTION_BEFORE","client-file","upload-key");
    const uploadOptions=apiRequest.mock.calls[0][1];expect(apiRequest.mock.calls[0][0]).toBe("/files");expect(uploadOptions).toMatchObject({method:"POST",idempotencyKey:"upload-key",body:expect.any(FormData)});expect(uploadOptions.headers).toBeUndefined();expect(uploadOptions.body.get("purpose_code")).toBe("ACTION_BEFORE");
    apiRequest.mockReset().mockResolvedValueOnce({});await new ApiDispatchAdapter().linkActionFile(dispatchDto.public_id,"file-public-id","ACTION_BEFORE",0,"link-key");expect(apiRequest.mock.calls[0][1]).toMatchObject({method:"POST",idempotencyKey:"link-key",body:{file_public_id:"file-public-id",purpose_code:"ACTION_BEFORE",display_order:0}});
    apiRequest.mockReset().mockResolvedValueOnce({}).mockResolvedValueOnce({...dispatchDto,status:"ACTION_COMPLETED",version_no:5,action_completed_at:"2026-07-21T03:00:00Z"});await new ApiDispatchAdapter().completeAction(dispatchDto.public_id,4,"complete-key",current);expect(apiRequest.mock.calls[0][1]).toMatchObject({method:"POST",idempotencyKey:"complete-key",body:{expected_version_no:4}});
  });
});
