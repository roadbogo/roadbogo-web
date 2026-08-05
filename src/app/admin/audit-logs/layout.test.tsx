import {describe,expect,it} from "vitest";
import {hasProtectedRouteAccess,ProtectedRoute} from "@/components/auth/ProtectedRoute";
import AuditLogLayout from "./layout";

const systemAdmin=(apiPermissions:string[])=>({
  uiRoles:["SYSTEM_ADMIN" as const],
  uiPermissions:["users:manage" as const],
  apiPermissions,
  accountStatus:"ACTIVE" as const,
});
const controlOperator=(apiPermissions:string[])=>({...systemAdmin(apiPermissions),uiRoles:["CONTROL_OPERATOR" as const]});

describe("AuditLogLayout",()=>{
  it("requires AUDIT.READ for direct audit-log access",()=>{
    const element=AuditLogLayout({children:<div>감사 로그</div>});
    expect(element.type).toBe(ProtectedRoute);
    expect(element.props.requiredRoles).toEqual(["SYSTEM_ADMIN"]);
    expect(element.props.requiredAnyApiPermissions).toEqual(["AUDIT.READ"]);
    const requirements={requiredRoles:element.props.requiredRoles,requiredAnyApiPermissions:element.props.requiredAnyApiPermissions};
    expect(hasProtectedRouteAccess(systemAdmin(["AUDIT.READ"]),requirements)).toBe(true);
    expect(hasProtectedRouteAccess(systemAdmin([]),requirements)).toBe(false);
    expect(hasProtectedRouteAccess(controlOperator(["AUDIT.READ"]),requirements)).toBe(false);
  });
});
