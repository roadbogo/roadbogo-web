import { describe, expect, it } from "vitest";
import { buildDispatchListQuery, canRespondToDispatch, dispatchStatusCopy, validateRejectionReason } from "./dispatchDomain";

describe("dispatch domain", () => {
  it("uses the backend list defaults and supports a status filter", () => {
    expect(buildDispatchListQuery()).toBe("page=1&size=20&active_only=true");
    expect(buildDispatchListQuery({ page: 2, size: 10, activeOnly: false, status: "REJECTED" })).toContain("status=REJECTED");
  });
  it("keeps REQUESTED distinct from ACCEPTED", () => {
    expect(dispatchStatusCopy.REQUESTED).toBe("응답 대기");
    expect(dispatchStatusCopy.ACCEPTED).toBe("수락 완료");
  });
  it("validates rejection reason and accepts version zero", () => {
    expect(validateRejectionReason(" ")).toBeTruthy();
    expect(validateRejectionReason("a".repeat(1001))).toBeTruthy();
    expect(validateRejectionReason("현장 접근 불가")).toBeNull();
    expect(canRespondToDispatch("REQUESTED", 0, ["DISPATCH.UPDATE_OWN"])).toBe(true);
    expect(canRespondToDispatch("REQUESTED", -1, ["DISPATCH.UPDATE_OWN"])).toBe(false);
  });
});
