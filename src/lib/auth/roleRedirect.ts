import type { UserRole } from "@/types/auth";

const priority:UserRole[]=["SYSTEM_ADMIN","CONTROL_MANAGER","CONTROLLER","RESPONDER","GENERAL_USER"];
const destinations:Record<UserRole,string>={SYSTEM_ADMIN:"/admin",CONTROL_MANAGER:"/control",CONTROLLER:"/control",RESPONDER:"/dispatch",GENERAL_USER:"/"};

export function getRoleRedirect(roles:UserRole[]){
  const role=priority.find(candidate=>roles.includes(candidate))??"GENERAL_USER";
  return destinations[role];
}
