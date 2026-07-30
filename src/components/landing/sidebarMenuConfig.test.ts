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
    expect(getAuthenticatedSidebarMenus(user("SYSTEM_ADMIN",["USER.READ_ALL","ROLE.MANAGE","NOTIFICATION.READ_OWN"])).map(item=>item.id)).toEqual(["home","admin","notifications","mypage"]);
    expect(getAuthenticatedSidebarMenus(user("CONTROL_MANAGER",["CCTV.READ","INCIDENT.READ_ALL","DISPATCH.ASSIGN","NOTIFICATION.READ_OWN"])).map(item=>item.id)).toEqual(["home","control","incidents","notifications","mypage"]);
    expect(getAuthenticatedSidebarMenus(user("CONTROLLER",["CCTV.READ","INCIDENT.READ_ALL","DISPATCH.ASSIGN","NOTIFICATION.READ_OWN"])).map(item=>item.id)).toEqual(["home","control","incidents","notifications","mypage"]);
    expect(getAuthenticatedSidebarMenus(user("RESPONDER",["DISPATCH.READ_OWN","DISPATCH.UPDATE_OWN","NOTIFICATION.READ_OWN"])).map(item=>item.id)).toEqual(["home","dispatch","notifications","mypage"]);
    expect(getAuthenticatedSidebarMenus(user("GENERAL_USER",["NOTIFICATION.READ_OWN"])).map(item=>item.id)).toEqual(["home","mypage"]);
  });

  it("uses the union of multi-role permissions without duplicating menu ids",()=>{
    const items=getAuthenticatedSidebarMenus(user("SYSTEM_ADMIN",["INCIDENT.READ_ALL","USER.READ_ALL"],["SYSTEM_ADMIN","CONTROLLER"]));
    expect(items.map(item=>item.id)).toEqual(["home","admin","control","incidents","mypage"]);
    expect(new Set(items.map(item=>item.id)).size).toBe(items.length);
  });

  it("does not expose system administration to a non-admin primary role",()=>{
    const items=getAuthenticatedSidebarMenus(user("CONTROLLER",["CCTV.READ","INCIDENT.READ_ALL","USER.READ_ALL"],["CONTROLLER","SYSTEM_ADMIN"]));
    expect(items.find(item=>item.id==="control")?.label).toBe("실시간 관제");
    expect(items.find(item=>item.id==="admin")).toBeUndefined();
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

describe("system admin navigation",()=>{
  const admin={...user("SYSTEM_ADMIN",["CCTV.READ","INCIDENT.READ_ALL","NOTIFICATION.READ_OWN","USER.READ_ALL","ROLE.MANAGE"]),uiPermissions:[...accessByRole.SYSTEM_ADMIN.uiPermissions,"incidents:view"] as AppPermission[]};

  it("keeps a single system-management entry in the common sidebar",()=>{
    const items=getAuthenticatedSidebarMenus(admin);
    expect(items.find(item=>item.id==="admin")?.description).toBe("계정·권한·서비스 운영");
    expect(items.map(item=>[item.section,item.label,item.href])).toEqual([
      ["공통","홈","/"],
      ["운영 메뉴","시스템 관리","/admin"],
      ["시스템 운영","운영 알림","/notifications"],
      ["운영 조회","관제 현황","/control"],
      ["운영 조회","사건 조회","/control/incidents"],
      ["계정","마이페이지","/mypage"],
    ]);
    expect(items.find(item=>item.id==="admin")?.children).toBeUndefined();
    expect(getActiveSidebarMenuId(items,"/admin")).toBe("admin");
    expect(getActiveSidebarMenuId(items,"/admin/users/new")).toBe("admin");
  });
});
