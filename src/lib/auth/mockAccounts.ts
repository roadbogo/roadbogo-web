import type { LoginResult, MockAccount } from "@/types/auth";

export const mockAccounts:MockAccount[] = [
  { email:"admin@roadbogo.kr", password:"1234", userName:"시스템 관리자", roles:["SYSTEM_ADMIN"] },
  { email:"manager@roadbogo.kr", password:"1234", userName:"관제센터 책임자", roles:["CONTROL_MANAGER"] },
  { email:"controller@roadbogo.kr", password:"1234", userName:"관제 담당자", roles:["CONTROLLER"] },
  { email:"responder@roadbogo.kr", password:"1234", userName:"출동 담당자", roles:["RESPONDER"] },
  { email:"user@roadbogo.kr", password:"1234", userName:"일반 사용자", roles:["GENERAL_USER"] },
];

export function authenticateMockAccount(email:string,password:string):LoginResult{
  const normalized=email.trim().toLowerCase();
  const account=mockAccounts.find(candidate=>candidate.email===normalized);
  if(!account)return{ok:false,reason:"email_not_found"};
  if(account.password!==password)return{ok:false,reason:"invalid_password"};
  if(account.active===false)return{ok:false,reason:"inactive_account"};
  return{ok:true,user:{email:account.email,userName:account.userName,roles:[...account.roles]}};
}
