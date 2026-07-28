import type { UserRole } from "@/types/auth";
import type { AppPermission, AppRole } from "@/components/navigation/navigationConfig";
import { canAccessControl } from "@/lib/auth/controlAccess";

export type SidebarIconName = "home" | "flow" | "login" | "profile" | "monitor" | "incidents" | "bell" | "dispatch" | "admin";

export type SidebarMenuItem = {
  id: string;
  label: string;
  description?: string;
  href?: string;
  icon: SidebarIconName;
  roles: UserRole[];
  section?: string;
  children?: SidebarMenuItem[];
  isExternal?: boolean;
  badge?: string | number;
  targetSection?: "home" | "platform-operations";
  activePaths?: string[];
};

export const allSidebarRoles: UserRole[] = [
  "SYSTEM_ADMIN",
  "CONTROL_MANAGER",
  "CONTROLLER",
  "RESPONDER",
  "GENERAL_USER",
];

const publicMenus: SidebarMenuItem[] = [
  {
    id: "home",
    label: "서비스 소개",
    description: "도로보GO 주요 기능 안내",
    href: "/#home",
    targetSection: "home",
    icon: "home",
    roles: allSidebarRoles,
    section: "서비스",
  },
  {
    id: "platform",
    label: "운영 체계 안내",
    description: "탐지부터 현장 조치까지",
    href: "/#platform-operations",
    targetSection: "platform-operations",
    icon: "flow",
    roles: allSidebarRoles,
    section: "서비스",
  },
];

export function getLandingSidebarMenus(role: UserRole, authenticated: boolean): SidebarMenuItem[] {
  const accountMenu: SidebarMenuItem = authenticated
    ? { id: "mypage", label: "마이페이지", description: "계정 및 권한 정보", href: "/mypage", icon: "profile", roles: allSidebarRoles, section: "계정" }
    : { id: "login", label: "로그인", description: "서비스 계정 접속", href: "/login?intent=general", icon: "login", roles: ["GENERAL_USER"], section: "계정" };

  const filterByRole = (items: SidebarMenuItem[]): SidebarMenuItem[] => items
    .filter((item) => item.roles.includes(role))
    .map((item) => ({ ...item, children: item.children ? filterByRole(item.children) : undefined }));

  return filterByRole([...publicMenus, accountMenu]);
}

type NavigationUser = {
  role: UserRole;
  roles: UserRole[];
  accountStatus?: string;
  apiPermissions: string[];
  uiRoles: AppRole[];
  uiPermissions: AppPermission[];
};

export function getAuthenticatedSidebarMenus(user: NavigationUser): SidebarMenuItem[] {
  const permissions=new Set(user.apiPermissions);
  const hasAny=(...required:string[])=>required.some(permission=>permissions.has(permission));
  const menus: SidebarMenuItem[] = [{ id:"home",label:"홈",description:"도로보GO 메인",href:"/",activePaths:["/"],icon:"home",roles:allSidebarRoles,section:"공통" }];
  if (canAccessControl(user)) menus.push({ id:"control",label:"실시간 관제",description:"CCTV와 우선 대응 사건",href:"/control",activePaths:["/control"],icon:"monitor",roles:allSidebarRoles,section:"운영 메뉴" });
  if (canAccessControl(user)&&hasAny("INCIDENT.READ_ALL","INCIDENT.CLAIM","INCIDENT.DECIDE")) menus.push({ id:"incidents",label:"사건 관리",description:"사건 목록과 처리 현황",href:"/control/incidents",activePaths:["/control/incidents"],icon:"incidents",roles:allSidebarRoles,section:"운영 메뉴" });
  if (user.roles.includes("RESPONDER")&&hasAny("DISPATCH.READ_OWN")) menus.push({ id:"dispatch",label:"내 출동 요청",description:"배정된 출동 업무 확인",href:"/dispatch",activePaths:["/dispatch"],icon:"dispatch",roles:allSidebarRoles,section:"운영 메뉴" });
  if (user.roles.some(role=>role!=="GENERAL_USER")&&hasAny("NOTIFICATION.READ_OWN")) menus.push({ id:"notifications",label:"업무 알림",description:"사건과 출동 알림",href:"/notifications",activePaths:["/notifications"],icon:"bell",roles:allSidebarRoles,section:"운영 메뉴" });
  if (hasAny("USER.READ_ALL","USER.WRITE","ROLE.MANAGE")) menus.push({ id:"admin",label:"시스템 관리",description:"사용자와 역할 관리",href:"/admin",activePaths:["/admin"],icon:"admin",roles:allSidebarRoles,section:"운영 메뉴" });
  menus.push({ id:"mypage",label:"내 계정",description:"계정과 권한 정보",href:"/mypage",icon:"profile",roles:allSidebarRoles,section:"계정" });
  return menus;
}

function matchesPath(pathname:string,path:string){
  return path==="/"?pathname==="/":pathname===path||pathname.startsWith(`${path}/`);
}

export function getActiveSidebarMenuId(items:SidebarMenuItem[],pathname:string){
  return items
    .flatMap(item=>(item.activePaths??(item.href?[item.href]:[])).map(path=>({id:item.id,path})))
    .filter(candidate=>matchesPath(pathname,candidate.path))
    .sort((a,b)=>b.path.length-a.path.length)[0]?.id??null;
}
