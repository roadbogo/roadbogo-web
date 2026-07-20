import type { UserRole } from "@/types/auth";

export const RECENT_WORK_TTL_MS=30*60*1000;
export const RECENT_WORK_KEY="roadbogo_recent_work";
export const PENDING_RETURN_TO_KEY="roadbogo_return_to";

type RoutingUser={
  publicId?:string;
  accountStatus?:string;
  roles:readonly UserRole[];
  apiPermissions:readonly string[];
};
export type DestinationReason="RETURN_TO"|"RECENT_WORK"|"ROLE_DEFAULT"|"SAFE_FALLBACK";
export type PostLoginDestination={path:string;reason:DestinationReason};
type RecentWork={userPublicId:string;path:string;savedAt:number;type:"CONTROL"|"DISPATCH"};

const blockedPaths=["/login","/logout","/signup","/forgot-password","/reset-password","/account/activate","/find-account"];
const controlPermissions=["CCTV.READ","INCIDENT.READ_ALL","INCIDENT.CLAIM","INCIDENT.DECIDE","DISPATCH.ASSIGN"];
const adminPermissions=["USER.READ_ALL","USER.WRITE","ROLE.MANAGE"];
const dispatchPermissions=["DISPATCH.READ_OWN","DISPATCH.UPDATE_OWN"];

function hasAny(values:readonly string[],candidates:string[]){return candidates.some(value=>values.includes(value))}
function hasControlAccess(user:RoutingUser){
  return (user.roles.some(role=>role==="CONTROLLER"||role==="CONTROL_MANAGER")||user.roles.includes("SYSTEM_ADMIN"))
    && hasAny(user.apiPermissions,controlPermissions);
}
function hasDispatchAccess(user:RoutingUser){
  return user.roles.includes("RESPONDER")&&hasAny(user.apiPermissions,dispatchPermissions);
}
function hasAdminAccess(user:RoutingUser){
  return user.roles.includes("SYSTEM_ADMIN")&&hasAny(user.apiPermissions,adminPermissions);
}

export function sanitizeInternalReturnTo(value:string|null|undefined){
  if(!value||/[\u0000-\u001f\u007f\\]/.test(value))return null;
  let decoded=value;
  try{
    for(let index=0;index<3;index+=1){
      const next=decodeURIComponent(decoded);
      if(next===decoded)break;
      decoded=next;
    }
  }catch{return null}
  if(!decoded.startsWith("/")||decoded.startsWith("//")||/^\/(?:https?:)?\/\//i.test(decoded))return null;
  try{
    const base="https://roadbogo.local";
    const url=new URL(value,base);
    if(url.origin!==base||url.username||url.password)return null;
    const path=`${url.pathname}${url.search}${url.hash}`;
    if(blockedPaths.some(blocked=>url.pathname===blocked||url.pathname.startsWith(`${blocked}/`)))return null;
    return path;
  }catch{return null}
}

export function canAccessInternalRoute(user:RoutingUser,path:string){
  if(user.accountStatus&&user.accountStatus!=="ACTIVE")return false;
  const safe=sanitizeInternalReturnTo(path);
  if(!safe)return false;
  const pathname=new URL(safe,"https://roadbogo.local").pathname;
  if(pathname==="/")return true;
  if(pathname==="/mypage"||pathname==="/mypage/edit"||pathname==="/notifications")return true;
  if(pathname==="/control"||/^\/control\/incidents\/[A-Za-z0-9-]+$/.test(pathname))return hasControlAccess(user);
  if(pathname==="/dispatch")return hasDispatchAccess(user);
  if(pathname==="/admin")return hasAdminAccess(user);
  return false;
}

export function getRoleDefaultRoute(user:RoutingUser){
  if(user.accountStatus&&user.accountStatus!=="ACTIVE")return "/mypage";
  if(hasControlAccess(user))return "/control";
  if(hasDispatchAccess(user))return "/dispatch";
  if(user.roles.includes("GENERAL_USER"))return "/";
  return "/mypage";
}

export function saveRecentWork(user:RoutingUser,path:string,now=Date.now()){
  if(!user.publicId)return;
  const safe=sanitizeInternalReturnTo(path);
  if(!safe)return;
  const pathname=new URL(safe,"https://roadbogo.local").pathname;
  const normalized=pathname.startsWith("/control")&&hasControlAccess(user)?"/control":pathname==="/dispatch"&&hasDispatchAccess(user)?"/dispatch":null;
  if(!normalized)return;
  const recent:RecentWork={userPublicId:user.publicId,path:normalized,savedAt:now,type:normalized==="/control"?"CONTROL":"DISPATCH"};
  try{sessionStorage.setItem(RECENT_WORK_KEY,JSON.stringify(recent))}catch{/* Storage is an optional optimization. */}
}

export function readRecentWork(user:RoutingUser,now=Date.now()){
  if(!user.publicId)return null;
  try{
    const raw=sessionStorage.getItem(RECENT_WORK_KEY);
    if(!raw)return null;
    const value=JSON.parse(raw) as Partial<RecentWork>;
    const valid=value.userPublicId===user.publicId&&typeof value.path==="string"&&typeof value.savedAt==="number"
      && now-value.savedAt>=0&&now-value.savedAt<=RECENT_WORK_TTL_MS&&canAccessInternalRoute(user,value.path);
    if(!valid){sessionStorage.removeItem(RECENT_WORK_KEY);return null}
    return value.path;
  }catch{
    try{sessionStorage.removeItem(RECENT_WORK_KEY)}catch{}
    return null;
  }
}

export function clearPostLoginRoutingState(){
  try{
    sessionStorage.removeItem(RECENT_WORK_KEY);
    sessionStorage.removeItem(PENDING_RETURN_TO_KEY);
  }catch{}
}

export function resolvePostLoginDestination({user,returnTo,recentWork}:{user:RoutingUser;returnTo?:string|null;recentWork?:string|null}):PostLoginDestination{
  const safeReturn=sanitizeInternalReturnTo(returnTo);
  if(safeReturn&&canAccessInternalRoute(user,safeReturn))return{path:safeReturn,reason:"RETURN_TO"};
  if(recentWork&&canAccessInternalRoute(user,recentWork))return{path:recentWork,reason:"RECENT_WORK"};
  const roleDefault=getRoleDefaultRoute(user);
  if(canAccessInternalRoute(user,roleDefault))return{path:roleDefault,reason:"ROLE_DEFAULT"};
  return{path:"/",reason:"SAFE_FALLBACK"};
}
