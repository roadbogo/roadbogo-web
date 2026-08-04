import {describe,expect,it} from "vitest";
import {hasProtectedRouteAccess,ProtectedRoute} from "@/components/auth/ProtectedRoute";
import AuditLogLayout from "./layout";

const systemAdmin=(apiPermissions:string[])=>({
  uiRoles:["SYSTEM_ADMIN" as const],
  uiPermissions:["users:manage" as const],
  apiPermissions,
  accountStatus:"ACTIVE" as const,
});

describe("AuditLogLayout",()=>{
  it("requires AUDIT.READ for direct audit-log access",()=>{
    const element=AuditLogLayout({children:<div>감사 로그</div>});
    expect(element.type).toBe(ProtectedRoute);
    expect(element.props.requiredAnyApiPermissions).toEqual(["AUDIT.READ"]);
    expect(hasProtectedRouteAccess(systemAdmin(["AUDIT.READ"]),{requiredRoles:["SYSTEM_ADMIN"],requiredAnyApiPermissions:["AUDIT.READ"]})).toBe(true);
    expect(hasProtectedRouteAccess(systemAdmin([]),{requiredRoles:["SYSTEM_ADMIN"],requiredAnyApiPermissions:["AUDIT.READ"]})).toBe(false);
  });
});
