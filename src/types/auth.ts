export type UserRole =
  | "SYSTEM_ADMIN"
  | "CONTROL_MANAGER"
  | "CONTROLLER"
  | "RESPONDER"
  | "GENERAL_USER";

export type LoginIntent = "general" | "operations";

export type AuthUser = { email:string; userName:string; roles:UserRole[] };
export type MockAccount = AuthUser & { password:string; active?:boolean };
export type LoginFailureReason = "email_not_found" | "invalid_password" | "inactive_account";
export type LoginResult = { ok:true; user:AuthUser } | { ok:false; reason:LoginFailureReason };
