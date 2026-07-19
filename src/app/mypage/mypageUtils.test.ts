import { describe, expect, it } from "vitest";
import { getPermissionGroups } from "./mypageUtils";

function incidentProcessing(permissions: string[], generalUser = false) {
  return getPermissionGroups(permissions, generalUser).find(group => group.label === "사건 처리");
}

describe("getPermissionGroups incident processing", () => {
  it("shows claim-only access without implying decision access", () => {
    expect(incidentProcessing(["INCIDENT.CLAIM"])).toEqual({
      label: "사건 처리",
      state: "담당 범위만 가능",
      description: "사건 확인 및 선점 가능",
    });
  });

  it("shows decide-only access without implying claim access", () => {
    expect(incidentProcessing(["INCIDENT.DECIDE"])).toEqual({
      label: "사건 처리",
      state: "담당 범위만 가능",
      description: "허용된 사건의 판단 업무 가능",
    });
  });

  it("shows full processing access only when both permissions exist", () => {
    expect(incidentProcessing(["INCIDENT.CLAIM", "INCIDENT.DECIDE"])).toEqual({
      label: "사건 처리",
      state: "사용 가능",
      description: "사건 담당 및 판단 업무",
    });
  });

  it.each([
    [[], false],
    [[], true],
  ])("restricts incident processing with empty permissions (generalUser=%s)", (permissions, generalUser) => {
    expect(incidentProcessing(permissions, generalUser)).toEqual({
      label: "사건 처리",
      state: "접근 제한",
      description: "현재 부여된 권한 없음",
    });
  });
});
