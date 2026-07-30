import type { UserRole } from "@/types/auth";

export type AccountStatus="ACTIVE"|"INACTIVE";
export type OrganizationType="CONTROL_CENTER"|"OPERATIONS_HEADQUARTERS"|"FIELD_SUPPORT";
export type OrganizationOption={publicId:string;name:string;code?:string;type?:OrganizationType;parentPublicId?:string|null;parentName?:string|null;isActive?:boolean};
export type UserChange={id:string;action:string;summary:string;actor:string;occurredAt:string};
export type ResponderDutyStatus="AVAILABLE"|"BUSY"|"OFF_DUTY"|"UNAVAILABLE";
export type ResponderProfile={responderCode:string;dutyStatus:ResponderDutyStatus;coverageArea:string|null;isDispatchEnabled:boolean;linked:boolean};
export type ManagedUser={
  publicId:string;email:string;userName:string;phone:string|null;accountStatus:AccountStatus;
  organization:OrganizationOption|null;roles:UserRole[];lastLoginAt:string|null;createdAt:string;updatedAt:string;
  changes:UserChange[];responderProfile?:ResponderProfile|null;deactivatedAt?:string|null;deletedAt?:string|null;activeAssignments?:number;
};
export type CreateAdminUserInput={email:string;password:string;userName:string;phone?:string;organizationPublicId:string;roles:UserRole[];responderProfile?:Omit<ResponderProfile,"linked">};
export type UpdateAdminUserInput={userName?:string;phone?:string|null;organizationPublicId?:string};
export type UpdateUserRolesInput={roles:UserRole[];reason:string;responderProfile?:Omit<ResponderProfile,"linked">};
export type AdminRole={code:UserRole;name:string;description:string;permissionLabels:string[];permissionCodes:string[]};
export type DeactivateUserInput={reason:string};
export type ActivateUserInput={reason:string};
export type DeactivationBlockReason="SELF"|"LAST_ACTIVE_ADMIN"|"ACTIVE_ASSIGNMENT"|"ALREADY_INACTIVE";
export type DeactivationCheckResult={user:ManagedUser;allowed:boolean;blockReason?:DeactivationBlockReason;activeAssignments?:number};
export type AvailabilityResult={available:boolean;existingPublicId?:string};
export class UserManagementError extends Error{constructor(public code:string,message:string,public details?:Record<string,unknown>){super(message)}}
export type UserWorkView="all"|"operating"|"general"|"attention"|"inactive";
export type UserAttentionReason="unassigned"|"never-logged-in"|"no-organization";
export const USER_DIRECTORY_PAGE_SIZES=[10,20,50] as const;
export const USER_DIRECTORY_DEFAULT_PAGE_SIZE=10;
export function normalizeUserDirectoryPageSize(value:string|null){
  const parsed=Number(value);
  return USER_DIRECTORY_PAGE_SIZES.includes(parsed as typeof USER_DIRECTORY_PAGE_SIZES[number])?parsed:USER_DIRECTORY_DEFAULT_PAGE_SIZE;
}
export type UserListQuery={page:number;size:number;keyword:string;view:UserWorkView;attentionReason:UserAttentionReason|null;role:UserRole|null;accountStatus:AccountStatus|null;organizationPublicId:string|null;organizationUnassigned:boolean;sort:"created_at,desc"|"created_at,asc"};
export type UserListSummary={total:number;operating:number;general:number;active:number;attention:number;unassigned:number;inactive:number;neverLoggedIn:number;withoutOrganization:number};
export type UserListResult={items:ManagedUser[];summary:UserListSummary;pagination:{page:number;size:number;totalElements:number;totalPages:number}};
export interface UserManagementAdapter{
  getRoles(signal:AbortSignal):Promise<AdminRole[]>;
  listUsers(query:UserListQuery,signal:AbortSignal):Promise<UserListResult>;
  getUserDetail(publicId:string,signal:AbortSignal):Promise<ManagedUser|null>;
  listOrganizations(signal:AbortSignal):Promise<OrganizationOption[]>;
  createUser(input:CreateAdminUserInput):Promise<ManagedUser>;
  updateUser(publicId:string,input:UpdateAdminUserInput):Promise<ManagedUser>;
  updateUserRoles(publicId:string,input:UpdateUserRolesInput):Promise<ManagedUser>;
  checkDeactivation(publicId:string,actorPublicId:string,signal:AbortSignal):Promise<DeactivationCheckResult>;
  deactivateUser(publicId:string,input:DeactivateUserInput):Promise<ManagedUser>;
  activateUser(publicId:string,input:ActivateUserInput):Promise<ManagedUser>;
  checkEmailAvailability(email:string):Promise<AvailabilityResult>;
  checkResponderCodeAvailability(code:string):Promise<AvailabilityResult>;
}
