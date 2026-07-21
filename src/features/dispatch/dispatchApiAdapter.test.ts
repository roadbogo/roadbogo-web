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
});
