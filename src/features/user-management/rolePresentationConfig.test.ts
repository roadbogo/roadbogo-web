import {describe,expect,it} from "vitest";
import {ROLE_ORDER,ROLE_PRESENTATIONS,ROLE_SYMBOLS,getUnifiedPermissionLabels,sortRoles} from "./rolePresentationConfig";

describe("role presentation",()=>{
  it("모든 지원 역할의 이름·설명·뮤트 색상을 제공한다",()=>{
    for(const role of ROLE_ORDER){
      const meta=ROLE_PRESENTATIONS[role];
      expect(meta.label).not.toBe(role);
      expect(meta.shortDescription.length).toBeGreaterThan(5);
      expect(meta.fullDescription.length).toBeGreaterThan(meta.shortDescription.length);
      expect(meta.color.background).toMatch(/^#[0-9A-F]{6}$/);
      expect(Object.values(meta.color)).not.toContain("#DF595D");
    }
  });

  it("복수 역할을 중앙 우선순위대로 정렬한다",()=>{
    expect(sortRoles(["RESPONDER","SYSTEM_ADMIN","CONTROLLER"])).toEqual(["SYSTEM_ADMIN","CONTROLLER","RESPONDER"]);
  });

  it("복수 역할의 접근 범위를 중복 없이 통합한다",()=>{
    const labels=getUnifiedPermissionLabels(["CONTROL_MANAGER","CONTROLLER"]);
    expect(labels.filter(label=>label==="전체 사건 조회")).toHaveLength(1);
  });

  it("역할별 식별 기호를 일관되게 제공한다",()=>{
    expect(ROLE_SYMBOLS).toEqual({
      SYSTEM_ADMIN:"◆",
      CONTROL_MANAGER:"◎",
      CONTROLLER:"▣",
      RESPONDER:"◉",
      GENERAL_USER:"○",
    });
    expect(new Set(Object.values(ROLE_SYMBOLS))).toHaveLength(ROLE_ORDER.length);
  });
});
