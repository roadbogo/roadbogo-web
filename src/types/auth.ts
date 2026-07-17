export type UserRole =
  | "SYSTEM_ADMIN"
  | "CONTROL_MANAGER"
  | "CONTROLLER"
  | "RESPONDER"
  | "GENERAL_USER";

export type LoginIntent = "general" | "operations";

export type AuthOrganization = { publicId:string; name:string; type:string };
export type AuthUser = {
  publicId:string;
  email:string;
  userName:string;
  phone?:string;
  accountStatus:string;
  organization:AuthOrganization|null;
  roles:UserRole[];
  permissions:string[];
  lastLoginAt:string|null;
  updatedAt:string;
};
export type MockAccount = Pick<AuthUser,"email"|"userName"|"roles"> & { password:string; active?:boolean };
export type LoginFailureReason = "email_not_found" | "invalid_password" | "inactive_account";
export type LoginResult = { ok:true; user:AuthUser } | { ok:false; reason:LoginFailureReason };
