export type AppRole = "CONTROL_OPERATOR" | "SYSTEM_ADMIN" | "FIELD_RESPONDER";
export type AppPermission =
  | "control:view" | "cctv:view" | "incidents:view" | "dispatch:manage"
  | "users:manage" | "roles:manage" | "system:view" | "audit:view"
  | "dispatch:assigned" | "field:update" | "alerts:view" | "profile:view";

export type WorkMenuItem = { key: string; label: string; icon: string; permission: AppPermission; href?: string };

const roleMenus: Record<AppRole, WorkMenuItem[]> = {
  CONTROL_OPERATOR: [
    {key:"control",label:"통합 관제",icon:"🏠",permission:"control:view",href:"/control"},
    {key:"cctv",label:"CCTV 관제",icon:"📷",permission:"cctv:view"},
    {key:"incidents",label:"위험 사건",icon:"📋",permission:"incidents:view"},
    {key:"dispatch",label:"출동 관리",icon:"🚨",permission:"dispatch:manage"},
    {key:"alerts",label:"알림",icon:"🔔",permission:"alerts:view"},
    {key:"profile",label:"마이페이지",icon:"👤",permission:"profile:view",href:"/mypage"},
  ],
  SYSTEM_ADMIN: [
    {key:"users",label:"사용자 관리",icon:"👥",permission:"users:manage"},
    {key:"roles",label:"역할·권한 관리",icon:"🛡️",permission:"roles:manage"},
    {key:"system",label:"시스템 상태",icon:"⚙️",permission:"system:view"},
    {key:"audit",label:"감사 로그",icon:"🧾",permission:"audit:view"},
    {key:"alerts",label:"알림",icon:"🔔",permission:"alerts:view"},
    {key:"profile",label:"마이페이지",icon:"👤",permission:"profile:view",href:"/mypage"},
  ],
  FIELD_RESPONDER: [
    {key:"requests",label:"내 출동 요청",icon:"🚨",permission:"dispatch:assigned"},
    {key:"dispatch-detail",label:"출동 상세",icon:"📋",permission:"dispatch:assigned"},
    {key:"map",label:"지도",icon:"🗺️",permission:"dispatch:assigned"},
    {key:"field",label:"현장 조치",icon:"✅",permission:"field:update"},
    {key:"alerts",label:"알림",icon:"🔔",permission:"alerts:view"},
    {key:"profile",label:"마이페이지",icon:"👤",permission:"profile:view",href:"/mypage"},
  ],
};

export function getWorkMenu(roles: AppRole[] = [], permissions: AppPermission[] = []) {
  const allowed = new Set(permissions);
  const items = roles.flatMap(role => roleMenus[role] ?? []);
  return items.filter((item, index) => allowed.has(item.permission) && items.findIndex(candidate => candidate.key === item.key) === index);
}
