import {describe,expect,it} from "vitest";
import {buildDeactivationReason,isDeactivationDraftDirty,validateDeactivationReason} from "./AccountDeactivationFlow";

describe("buildDeactivationReason",()=>{
  it("사유 유형과 정리된 상세 사유를 API 문자열로 조합한다",()=>{
    expect(buildDeactivationReason("퇴사 또는 계약 종료","  인사 이동으로 사용 종료  ")).toBe("퇴사 또는 계약 종료 - 인사 이동으로 사용 종료");
  });
  it("상세 사유가 없으면 사유 유형만 사용한다",()=>{
    expect(buildDeactivationReason("장기 미사용","   ")).toBe("장기 미사용");
  });
  it("사유 유형과 기타 상세 사유를 검증한다",()=>{
    expect(validateDeactivationReason("","")).toBe("사유 유형을 선택해 주세요.");
    expect(validateDeactivationReason("기타","   ")).toBe("기타 사유의 상세 내용을 입력해 주세요.");
    expect(validateDeactivationReason("보안 조치","")).toBe("");
    expect(validateDeactivationReason("보안 조치","가".repeat(261))).toBe("상세 사유는 260자 이내로 입력해 주세요.");
  });
  it("작성 중 이탈 확인이 필요한 상태를 판별한다",()=>{
    expect(isDeactivationDraftDirty("","",false)).toBe(false);
    expect(isDeactivationDraftDirty("담당 업무 변경","",false)).toBe(true);
    expect(isDeactivationDraftDirty("","",true)).toBe(true);
  });
});
