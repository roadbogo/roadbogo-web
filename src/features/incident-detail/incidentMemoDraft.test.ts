import { describe, expect, it } from "vitest";
import { composeMemoContent, createEmptyMemoDraft, hasMemoDraftContent, memoDraftStorageKey, parseMemoDraft } from "./incidentMemoDraft";

describe("incident memo draft",()=>{
  it("keeps free writing unchanged",()=>{
    const draft=createEmptyMemoDraft();
    draft.values.GENERAL[0]="  자유로운 메모\n둘째 줄  ";
    expect(composeMemoContent("GENERAL",draft.values)).toBe("  자유로운 메모\n둘째 줄  ");
  });

  it("composes only populated structured sections with stable spacing",()=>{
    const draft=createEmptyMemoDraft();
    draft.values.REVIEW=[" 원본 영상 확인 ","","추가 확인 필요"];
    expect(composeMemoContent("REVIEW",draft.values)).toBe("[확인한 내용]\n원본 영상 확인\n\n[추가 확인 사항]\n추가 확인 필요");
  });

  it("creates incident-scoped keys and safely restores every writing mode",()=>{
    const draft=createEmptyMemoDraft();
    draft.type="DISPATCH";
    draft.values.GENERAL[0]="자유 메모";
    draft.values.DISPATCH[1]="차로 진입 주의";
    expect(memoDraftStorageKey("incident-a")).not.toBe(memoDraftStorageKey("incident-b"));
    expect(parseMemoDraft(JSON.stringify(draft))).toEqual(draft);
    expect(parseMemoDraft("{bad")).toBeNull();
    expect(hasMemoDraftContent(draft)).toBe(true);
  });
});
