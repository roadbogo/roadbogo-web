import type { AppPermission, AppRole } from "@/components/navigation/navigationConfig";

export const controlAccessRequirements = {
  requiredRoles: ["CONTROL_OPERATOR", "SYSTEM_ADMIN"] as AppRole[],
  requiredAnyPermissions: ["control:view", "incidents:view"] as AppPermission[],
  requiredAnyApiPermissions: ["CCTV.READ","INCIDENT.READ_ALL","INCIDENT.CLAIM","INCIDENT.DECIDE","DISPATCH.ASSIGN"],
};

export type ControlAccessSubject = {
  accountStatus?: string;
  uiRoles: AppRole[];
  uiPermissions: AppPermission[];
  apiPermissions: string[];
};

export function canAccessControl(user: ControlAccessSubject | null | undefined) {
  if (!user || (user.accountStatus && user.accountStatus !== "ACTIVE")) return false;
  return controlAccessRequirements.requiredRoles.some(role => user.uiRoles.includes(role))
    && controlAccessRequirements.requiredAnyPermissions.some(permission => user.uiPermissions.includes(permission))
    && controlAccessRequirements.requiredAnyApiPermissions.some(permission=>user.apiPermissions.includes(permission));
}

export function isPathActive(pathname: string, href?: string) {
  if (!href) return false;
  const path = href.split(/[?#]/, 1)[0];
  return path === "/" ? pathname === "/" : pathname === path || pathname.startsWith(`${path}/`);
}
