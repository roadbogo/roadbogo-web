import {describe,expect,it} from "vitest";
import type {ManagedUser} from "./userManagementTypes";
import {compareRoles,hasRoleChanges,normalizeRoles,validateRoleDraft} from "./roleManagementDomain";

const user=(roles:ManagedUser["roles"],overrides:Partial<ManagedUser>={}):ManagedUser=>({
  publicId:"user-public-id",email:"user@example.com",userName:"사용자",phone:null,accountStatus:"ACTIVE",organization:null,
  roles,lastLoginAt:null,createdAt:"2026-01-01T00:00:00Z",updatedAt:"2026-01-01T00:00:00Z",changes:[],...overrides,
});

describe("role management domain",()=>{
  it("normalizes duplicate roles and ignores order-only changes",()=>{
    expect(normalizeRoles(["CONTROLLER","SYSTEM_ADMIN","CONTROLLER"])).toEqual(["SYSTEM_ADMIN","CONTROLLER"]);
    expect(hasRoleChanges(compareRoles(["CONTROLLER","CONTROL_MANAGER"],["CONTROL_MANAGER","CONTROLLER"]))).toBe(false);
  });
  it("compares roles and effective permission unions",()=>{
    const result=compareRoles(["CONTROLLER"],["CONTROL_MANAGER","CONTROLLER"]);
    expect(result.added).toEqual(["CONTROL_MANAGER"]);
    expect(result.removed).toEqual([]);
    expect(result.addedPermissions).not.toContain("CCTV.READ");
    expect(result.keptPermissions).toContain("CCTV.READ");
  });
  it("protects the last active system administrator",()=>{
    expect(validateRoleDraft(user(["SYSTEM_ADMIN"]),["CONTROLLER"],1)).toBe("LAST_ACTIVE_SYSTEM_ADMIN");
    expect(validateRoleDraft(user(["SYSTEM_ADMIN"]),["CONTROLLER"],2)).toBeNull();
  });
  it("enforces the current non-empty role and responder policies",()=>{
    expect(validateRoleDraft(user(["CONTROLLER"]),[],2)).toBe("ROLE_REQUIRED");
    expect(validateRoleDraft(user(["CONTROLLER"]),["CONTROLLER","RESPONDER"],2)).toBe("RESPONDER_PROFILE_REQUIRED");
    expect(validateRoleDraft(user(["RESPONDER"],{responderProfile:{responderCode:"RSP-1",dutyStatus:"AVAILABLE",coverageArea:null,isDispatchEnabled:true,linked:true},activeAssignments:2}),["CONTROLLER"],2)).toBe("RESPONDER_ACTIVE_ASSIGNMENT");
  });
});
