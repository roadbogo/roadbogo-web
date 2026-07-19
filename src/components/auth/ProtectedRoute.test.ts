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
});
