import type { UserRole } from "@/types/auth";
import type { ManagedUser } from "./userManagementTypes";
import {getUnifiedPermissionCodes,ROLE_ORDER,sortRoles} from "./rolePresentationConfig";

export type RoleChangeSet={
  original:UserRole[];draft:UserRole[];added:UserRole[];removed:UserRole[];kept:UserRole[];
  addedPermissions:string[];removedPermissions:string[];keptPermissions:string[];
};

export function normalizeRoles(roles:UserRole[]){
  return sortRoles([...new Set(roles.filter(role=>ROLE_ORDER.includes(role)))]);
}

export function compareRoles(originalRoles:UserRole[],draftRoles:UserRole[]):RoleChangeSet{
  const original=normalizeRoles(originalRoles),draft=normalizeRoles(draftRoles);
  const beforePermissions=getUnifiedPermissionCodes(original),afterPermissions=getUnifiedPermissionCodes(draft);
  return{
    original,draft,
    added:draft.filter(role=>!original.includes(role)),
    removed:original.filter(role=>!draft.includes(role)),
    kept:draft.filter(role=>original.includes(role)),
    addedPermissions:afterPermissions.filter(permission=>!beforePermissions.includes(permission)),
    removedPermissions:beforePermissions.filter(permission=>!afterPermissions.includes(permission)),
    keptPermissions:afterPermissions.filter(permission=>beforePermissions.includes(permission)),
  };
}

export function hasRoleChanges(change:RoleChangeSet){return change.added.length>0||change.removed.length>0}
export function isOperatingRole(role:UserRole){return role!=="GENERAL_USER"}
export function isLastActiveSystemAdmin(user:ManagedUser,activeSystemAdminCount:number){
  return user.accountStatus==="ACTIVE"&&user.roles.includes("SYSTEM_ADMIN")&&activeSystemAdminCount<=1;
}

export type RoleDraftBlock="ROLE_REQUIRED"|"LAST_ACTIVE_SYSTEM_ADMIN"|"RESPONDER_PROFILE_REQUIRED"|"RESPONDER_ACTIVE_ASSIGNMENT"|null;
export function validateRoleDraft(user:ManagedUser,draftRoles:UserRole[],activeSystemAdminCount:number):RoleDraftBlock{
  const draft=normalizeRoles(draftRoles);
  if(!draft.length)return"ROLE_REQUIRED";
  if(isLastActiveSystemAdmin(user,activeSystemAdminCount)&&!draft.includes("SYSTEM_ADMIN"))return"LAST_ACTIVE_SYSTEM_ADMIN";
  if(!user.roles.includes("RESPONDER")&&draft.includes("RESPONDER")&&!user.responderProfile)return"RESPONDER_PROFILE_REQUIRED";
  if(user.roles.includes("RESPONDER")&&!draft.includes("RESPONDER")&&(user.activeAssignments??0)>0)return"RESPONDER_ACTIVE_ASSIGNMENT";
  return null;
}
