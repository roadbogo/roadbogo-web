import { describe, expect, it } from "vitest";
import { canAccessControl, isPathActive } from "./controlAccess";
import { getAuthenticatedSidebarMenus } from "@/components/landing/sidebarMenuConfig";
import type { UserRole } from "@/types/auth";

const user = (role: UserRole, uiRoles: ("CONTROL_OPERATOR"|"SYSTEM_ADMIN"|"FIELD_RESPONDER")[], uiPermissions: ("control:view"|"incidents:view"|"profile:view"|"alerts:view"|"dispatch:assigned")[]) => ({
  role,
  roles:[role],
  accountStatus:"ACTIVE",
  apiPermissions:role==="CONTROLLER"?["INCIDENT.READ_ALL"]:[],
  uiRoles,
  uiPermissions,
});

describe("control navigation access", () => {
  it("shows control only when the shared role and permission requirements are both met", () => {
    const controller=user("CONTROLLER",["CONTROL_OPERATOR"],["control:view","incidents:view","profile:view","alerts:view"]);
    expect(canAccessControl(controller)).toBe(true);
    expect(getAuthenticatedSidebarMenus(controller).map(item=>item.href)).toContain("/control");

    const responder=user("RESPONDER",["FIELD_RESPONDER"],["incidents:view","profile:view","alerts:view","dispatch:assigned"]);
    expect(canAccessControl(responder)).toBe(false);
    expect(getAuthenticatedSidebarMenus(responder).map(item=>item.href)).not.toContain("/control");
  });

  it("does not expose work navigation for an inactive or general account", () => {
    const general=user("GENERAL_USER",[],["profile:view"]);
    expect(canAccessControl(general)).toBe(false);
    expect(getAuthenticatedSidebarMenus(general).map(item=>item.href)).toEqual(["/","/mypage"]);
    expect(canAccessControl({...general,accountStatus:"SUSPENDED",uiRoles:["CONTROL_OPERATOR"],uiPermissions:["control:view"]})).toBe(false);
  });

  it("requires a real control API permission in addition to the mapped UI role",()=>{
    const controller={...user("CONTROLLER",["CONTROL_OPERATOR"],["control:view","incidents:view"]),apiPermissions:[]};
    expect(canAccessControl(controller)).toBe(false);
    expect(canAccessControl({...controller,apiPermissions:["CCTV.READ"]})).toBe(true);
    const admin={...user("SYSTEM_ADMIN",["SYSTEM_ADMIN"],["incidents:view"]),apiPermissions:["INCIDENT.READ_ALL"]};
    expect(canAccessControl(admin)).toBe(true);
    expect(canAccessControl({...admin,apiPermissions:[]})).toBe(false);
  });

  it("keeps nested work routes active without treating every route as home", () => {
    expect(isPathActive("/control/incidents/incident-1","/control")).toBe(true);
    expect(isPathActive("/notifications","/notifications")).toBe(true);
    expect(isPathActive("/control","/")).toBe(false);
  });
});
