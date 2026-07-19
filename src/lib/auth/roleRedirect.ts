import type { UserRole } from "@/types/auth";

const priority:UserRole[]=["SYSTEM_ADMIN","CONTROL_MANAGER","CONTROLLER","RESPONDER","GENERAL_USER"];
const destinations:Record<UserRole,string>={SYSTEM_ADMIN:"/admin",CONTROL_MANAGER:"/control",CONTROLLER:"/control",RESPONDER:"/dispatch",GENERAL_USER:"/"};

export function getPrimaryRole(roles:UserRole[]){
  return priority.find(candidate=>roles.includes(candidate))??"GENERAL_USER";
}

export function getRoleRedirect(roles:UserRole[]){
  return destinations[getPrimaryRole(roles)];
}

export function getSafeNextPath(value:string|null){
  if(!value||!value.startsWith("/")||value.startsWith("//")||value.includes("\\"))return null;
  try{
    const base="https://roadbogo.local";
    const parsed=new URL(value,base);
    return parsed.origin===base?`${parsed.pathname}${parsed.search}${parsed.hash}`:null;
  }catch{return null}
}
