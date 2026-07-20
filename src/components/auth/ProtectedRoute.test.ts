import { describe, expect, it } from "vitest";
import { getAccountShortcuts } from "@/app/mypage/mypageUtils";
import type { AppPermission, AppRole } from "@/components/navigation/navigationConfig";
import { mapApiPermissionsToUiPermissions, mapApiRolesToUiAccess } from "@/lib/auth/accessMapping";
import type { UserRole } from "@/types/auth";
import { hasProtectedRouteAccess } from "./ProtectedRoute";

const adminRequirements = {
  requiredAnyPermissions: ["users:manage", "roles:manage"] as AppPermission[],
};

function user(uiRoles: AppRole[], uiPermissions: AppPermission[]) {
  return { uiRoles, uiPermissions };
}

describe("hasProtectedRouteAccess", () => {
  it.each([
    ["SYSTEM_ADMIN", ["SYSTEM_ADMIN"], [], true],
    ["USER.READ_ALL", [], ["USER.READ_ALL"], true],
    ["USER.WRITE", [], ["USER.WRITE"], true],
    ["ROLE.MANAGE", [], ["ROLE.MANAGE"], true],
    ["USER.WRITE + ROLE.MANAGE", [], ["USER.WRITE", "ROLE.MANAGE"], true],
    ["no permission", [], [], false],
  ] as const)("keeps the admin shortcut and route policy aligned for %s", (_label, roles, apiPermissions, expected) => {
    const roleAccess = mapApiRolesToUiAccess([...roles] as UserRole[]);
    const permissionAccess = mapApiPermissionsToUiPermissions([...apiPermissions]);
    const uiPermissions = [...new Set([...roleAccess.uiPermissions, ...permissionAccess])];
    const subject = user(roleAccess.uiRoles, uiPermissions);
    const hasShortcut = getAccountShortcuts([...apiPermissions], uiPermissions).some(shortcut => shortcut.href === "/admin");

    expect(hasShortcut).toBe(expected);
    expect(hasProtectedRouteAccess(subject, adminRequirements)).toBe(expected);
  });

  it("keeps requiredPermissions as an every/AND condition", () => {
    expect(hasProtectedRouteAccess(user([], ["users:manage"]), {
      requiredPermissions: ["users:manage", "roles:manage"],
    })).toBe(false);
    expect(hasProtectedRouteAccess(user([], ["users:manage", "roles:manage"]), {
      requiredPermissions: ["users:manage", "roles:manage"],
    })).toBe(true);
  });

  it("keeps existing role requirements compatible", () => {
    expect(hasProtectedRouteAccess(user(["CONTROL_OPERATOR"], ["control:view"]), {
      requiredRoles: ["CONTROL_OPERATOR"],
      requiredPermissions: ["control:view"],
    })).toBe(true);
    expect(hasProtectedRouteAccess(user(["FIELD_RESPONDER"], ["control:view"]), {
      requiredRoles: ["CONTROL_OPERATOR"],
      requiredPermissions: ["control:view"],
    })).toBe(false);
  });

  it("requires a real API permission when the route declares one",()=>{
    expect(hasProtectedRouteAccess({...user(["CONTROL_OPERATOR"],["control:view"]),apiPermissions:["INCIDENT.READ_ALL"],accountStatus:"ACTIVE"},{
      requiredRoles:["CONTROL_OPERATOR"],
      requiredAnyPermissions:["control:view"],
      requiredAnyApiPermissions:["CCTV.READ","INCIDENT.READ_ALL"],
    })).toBe(true);
    expect(hasProtectedRouteAccess({...user(["CONTROL_OPERATOR"],["control:view"]),apiPermissions:[],accountStatus:"ACTIVE"},{
      requiredRoles:["CONTROL_OPERATOR"],
      requiredAnyPermissions:["control:view"],
      requiredAnyApiPermissions:["CCTV.READ","INCIDENT.READ_ALL"],
    })).toBe(false);
  });

  it("rejects inactive accounts before role and permission checks",()=>{
    expect(hasProtectedRouteAccess({...user(["CONTROL_OPERATOR"],["control:view"]),accountStatus:"SUSPENDED"},{
      requiredRoles:["CONTROL_OPERATOR"],
      requiredPermissions:["control:view"],
    })).toBe(false);
  });

  it.each([
    ["CONTROL_MANAGER", ["CONTROL_OPERATOR"], ["control:view"], true],
    ["CONTROLLER", ["CONTROL_OPERATOR"], ["control:view"], true],
    ["SYSTEM_ADMIN with incident access", ["SYSTEM_ADMIN"], ["incidents:view"], true],
    ["SYSTEM_ADMIN without control permissions", ["SYSTEM_ADMIN"], [], false],
    ["GENERAL_USER", [], ["profile:view"], false],
  ] as const)("evaluates /control access for %s", (_label, roles, permissions, expected) => {
    expect(hasProtectedRouteAccess(user([...roles] as AppRole[], [...permissions] as AppPermission[]), {
      requiredRoles: ["CONTROL_OPERATOR", "SYSTEM_ADMIN"],
      requiredAnyPermissions: ["control:view", "incidents:view"],
    })).toBe(expected);
  });
});
