import type { AppPermission, AppRole } from "@/components/navigation/navigationConfig";
import type { UserRole } from "@/types/auth";

type UiAccess = { uiRoles: AppRole[]; uiPermissions: AppPermission[] };

const roleAccess: Record<UserRole, UiAccess> = {
  SYSTEM_ADMIN: { uiRoles: ["SYSTEM_ADMIN"], uiPermissions: ["users:manage", "roles:manage", "system:view", "audit:view", "alerts:view", "profile:view"] },
  CONTROL_MANAGER: { uiRoles: ["CONTROL_OPERATOR"], uiPermissions: ["control:view", "cctv:view", "incidents:view", "dispatch:manage", "alerts:view", "profile:view"] },
  CONTROLLER: { uiRoles: ["CONTROL_OPERATOR"], uiPermissions: ["control:view", "cctv:view", "incidents:view", "dispatch:manage", "alerts:view", "profile:view"] },
  RESPONDER: { uiRoles: ["FIELD_RESPONDER"], uiPermissions: ["dispatch:assigned", "field:update", "alerts:view", "profile:view"] },
  GENERAL_USER: { uiRoles: [], uiPermissions: ["profile:view"] },
};

const apiPermissionMap: Record<string, AppPermission[]> = {
  "CCTV.READ": ["cctv:view"],
  "INCIDENT.READ_ALL": ["incidents:view"],
  "INCIDENT.CLAIM": ["incidents:view"],
  "INCIDENT.DECIDE": ["incidents:view"],
  "DISPATCH.ASSIGN": ["dispatch:manage"],
  "DISPATCH.READ_OWN": ["dispatch:assigned"],
  "DISPATCH.UPDATE_OWN": ["field:update"],
  "USER.READ_ALL": ["users:manage"],
  "USER.WRITE": ["users:manage"],
  "ROLE.MANAGE": ["roles:manage"],
  "NOTIFICATION.READ_OWN": ["alerts:view"],
};

const knownRoles = new Set<UserRole>(Object.keys(roleAccess) as UserRole[]);

export function normalizeApiRoles(roles: string[]): UserRole[] {
  return roles.filter((role): role is UserRole => knownRoles.has(role as UserRole));
}

export function mapApiRolesToUiAccess(roles: UserRole[]): UiAccess {
  return roles.reduce<UiAccess>((result, role) => ({
    uiRoles: [...new Set([...result.uiRoles, ...roleAccess[role].uiRoles])],
    uiPermissions: [...new Set([...result.uiPermissions, ...roleAccess[role].uiPermissions])],
  }), { uiRoles: [], uiPermissions: [] });
}

export function mapApiPermissionsToUiPermissions(apiPermissions: string[]): AppPermission[] {
  return [...new Set(apiPermissions.flatMap((permission) => apiPermissionMap[permission] ?? []))];
}
