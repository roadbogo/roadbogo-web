import { describe, expect, it } from "vitest";
import type { AppPermission, AppRole } from "@/components/navigation/navigationConfig";
import type { UserRole } from "@/types/auth";
import { getActiveSidebarMenuId, getAuthenticatedSidebarMenus } from "./sidebarMenuConfig";

const accessByRole:Record<UserRole,{uiRoles:AppRole[];uiPermissions:AppPermission[]}>={
  SYSTEM_ADMIN:{uiRoles:["SYSTEM_ADMIN"],uiPermissions:["users:manage","roles:manage","alerts:view","profile:view"]},
  CONTROL_MANAGER:{uiRoles:["CONTROL_OPERATOR"],uiPermissions:["control:view","cctv:view","incidents:view","dispatch:manage","alerts:view","profile:view"]},
  CONTROLLER:{uiRoles:["CONTROL_OPERATOR"],uiPermissions:["control:view","cctv:view","incidents:view","dispatch:manage","alerts:view","profile:view"]},
  RESPONDER:{uiRoles:["FIELD_RESPONDER"],uiPermissions:["dispatch:assigned","field:update","alerts:view","profile:view"]},
  GENERAL_USER:{uiRoles:[],uiPermissions:["profile:view"]},
};

function user(role:UserRole,apiPermissions:string[],roles:UserRole[]=[role]){
  const combined=roles.reduce((result,current)=>({
    uiRoles:[...new Set([...result.uiRoles,...accessByRole[current].uiRoles])],
    uiPermissions:[...new Set([...result.uiPermissions,...accessByRole[current].uiPermissions])],
  }),{uiRoles:[] as AppRole[],uiPermissions:[] as AppPermission[]});
  return{role,roles,accountStatus:"ACTIVE",apiPermissions,...combined};
}

describe("authenticated sidebar menus",()=>{
  it.each(["SYSTEM_ADMIN","CONTROL_MANAGER","CONTROLLER","RESPONDER","GENERAL_USER"] as UserRole[])("keeps common destinations for %s",role=>{
    const items=getAuthenticatedSidebarMenus(user(role,[]));
    expect(items.find(item=>item.id==="home")?.href).toBe("/");
    expect(items.find(item=>item.id==="mypage")?.href).toBe("/mypage");
  });

  it("filters fixed-order work menus by API permission and an existing protected route",()=>{
    expect(getAuthenticatedSidebarMenus(user("SYSTEM_ADMIN",["USER.READ_ALL","ROLE.MANAGE","NOTIFICATION.READ_OWN"])).map(item=>item.id)).toEqual(["home","notifications","admin","mypage"]);
    expect(getAuthenticatedSidebarMenus(user("CONTROL_MANAGER",["CCTV.READ","INCIDENT.READ_ALL","DISPATCH.ASSIGN","NOTIFICATION.READ_OWN"])).map(item=>item.id)).toEqual(["home","control","incidents","notifications","mypage"]);
    expect(getAuthenticatedSidebarMenus(user("CONTROLLER",["CCTV.READ","INCIDENT.READ_ALL","DISPATCH.ASSIGN","NOTIFICATION.READ_OWN"])).map(item=>item.id)).toEqual(["home","control","incidents","notifications","mypage"]);
    expect(getAuthenticatedSidebarMenus(user("RESPONDER",["DISPATCH.READ_OWN","DISPATCH.UPDATE_OWN","NOTIFICATION.READ_OWN"])).map(item=>item.id)).toEqual(["home","dispatch","notifications","mypage"]);
    expect(getAuthenticatedSidebarMenus(user("GENERAL_USER",["NOTIFICATION.READ_OWN"])).map(item=>item.id)).toEqual(["home","mypage"]);
  });

  it("uses the union of multi-role permissions without duplicating menu ids",()=>{
    const items=getAuthenticatedSidebarMenus(user("SYSTEM_ADMIN",["INCIDENT.READ_ALL","USER.READ_ALL"],["SYSTEM_ADMIN","CONTROLLER"]));
    expect(items.map(item=>item.id)).toEqual(["home","control","incidents","admin","mypage"]);
    expect(new Set(items.map(item=>item.id)).size).toBe(items.length);
  });
});

describe("authenticated sidebar active route",()=>{
  const items=getAuthenticatedSidebarMenus(user("CONTROLLER",["CCTV.READ","INCIDENT.READ_ALL","NOTIFICATION.READ_OWN"]));
  it.each([
    ["/","home"],
    ["/mypage","mypage"],
    ["/mypage/edit","mypage"],
    ["/control","control"],
    ["/control/incidents","incidents"],
    ["/control/incidents/11111111-1111-4111-8111-111111111107","incidents"],
    ["/notifications","notifications"],
  ])("selects only the most specific item for %s",(pathname,expected)=>{
    const active=getActiveSidebarMenuId(items,pathname);
    expect(active).toBe(expected);
    expect(items.filter(item=>item.id===active)).toHaveLength(1);
  });

  it("keeps dispatch detail paths attached to the dispatch item",()=>{
    const responderItems=getAuthenticatedSidebarMenus(user("RESPONDER",["DISPATCH.READ_OWN"]));
    expect(getActiveSidebarMenuId(responderItems,"/dispatch/dispatch-1")).toBe("dispatch");
  });
});
