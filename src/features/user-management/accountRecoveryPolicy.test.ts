import {describe,expect,it} from "vitest";
import {getAccountRecoveryEligibility} from "./accountRecoveryPolicy";
import type {ManagedUser} from "./userManagementTypes";

const user=(patch:Partial<ManagedUser>={}):ManagedUser=>({publicId:"fixture",email:"fixture@roadbogo.test",userName:"복구 정책 사용자",phone:null,accountStatus:"INACTIVE",organization:null,roles:["GENERAL_USER"],lastLoginAt:null,createdAt:"2026-07-01T00:00:00Z",updatedAt:"2026-07-01T00:00:00Z",changes:[],...patch});

describe("account recovery policy",()=>{
  it("allows an administrative deactivation record",()=>expect(getAccountRecoveryEligibility(user({deactivatedAt:"2026-07-02T00:00:00Z",changes:[{id:"1",action:"계정 비활성화",summary:"관리자 처리",actor:"관리자",occurredAt:"2026-07-02T00:00:00Z"}]})).eligibility).toBe("AVAILABLE"));
  it("blocks withdrawn accounts",()=>expect(getAccountRecoveryEligibility(user({deletedAt:"2026-07-02T00:00:00Z"})).eligibility).toBe("UNAVAILABLE"));
  it("requires review when only inactive state is known",()=>expect(getAccountRecoveryEligibility(user()).eligibility).toBe("NEEDS_REVIEW"));
});
