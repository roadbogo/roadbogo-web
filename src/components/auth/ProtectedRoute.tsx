"use client";
import Link from "next/link";
import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import type { AppPermission, AppRole } from "@/components/navigation/navigationConfig";
import { getRoleRedirect } from "@/lib/auth/roleRedirect";
import { getPrimaryRole } from "@/lib/auth/roleRedirect";
import { getRoleLabel } from "@/lib/auth/roleLabels";
import { getControlAccessHandoff, storeAccessHandoff } from "@/lib/auth/accessHandoff";
import { PENDING_RETURN_TO_KEY, sanitizeInternalReturnTo, saveRecentWork } from "@/lib/auth/postLoginRouting";
import { LandingHeader } from "@/components/landing/LandingHeader";
import { useLogout } from "./LogoutProvider";
import { useAuth } from "./AuthContext";

type AccessSubject={uiRoles:AppRole[];uiPermissions:AppPermission[];apiPermissions?:string[];accountStatus?:string};
type AccessRequirements={requiredRoles?:AppRole[];requiredPermissions?:AppPermission[];requiredAnyPermissions?:AppPermission[];requiredAnyApiPermissions?:string[]};
type Props={children:React.ReactNode;accessDeniedTitle?:string;accessHandoff?:boolean}&AccessRequirements;

export function hasProtectedRouteAccess(user:AccessSubject|null|undefined,{requiredRoles=[],requiredPermissions=[],requiredAnyPermissions=[],requiredAnyApiPermissions=[]}:AccessRequirements){
 if(!user)return false;
 if(user.accountStatus&&user.accountStatus!=="ACTIVE")return false;
 const roleAllowed=!requiredRoles.length||requiredRoles.some(role=>user.uiRoles.includes(role));
 const permissionAllowed=!requiredPermissions.length||requiredPermissions.every(permission=>user.uiPermissions.includes(permission));
 const anyPermissionAllowed=!requiredAnyPermissions.length||requiredAnyPermissions.some(permission=>user.uiPermissions.includes(permission));
 const anyApiPermissionAllowed=!requiredAnyApiPermissions.length||requiredAnyApiPermissions.some(permission=>user.apiPermissions?.includes(permission));
 return roleAllowed&&permissionAllowed&&anyPermissionAllowed&&anyApiPermissionAllowed;
}

function ShieldLockIcon(){return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3 5 6v5c0 4.7 2.8 8.1 7 10 4.2-1.9 7-5.3 7-10V6l-7-3Z"/><rect x="9" y="10" width="6" height="5" rx="1"/><path d="M10.5 10V8.8a1.5 1.5 0 0 1 3 0V10"/></svg>}

function AccessRestricted(){
 const{user}=useAuth();const{requestLogout}=useLogout();
 if(!user)return null;
 const inactive=Boolean(user.accountStatus&&user.accountStatus!=="ACTIVE");
 const primaryRole=getPrimaryRole(user.roles);
 const roleLabel=getRoleLabel(primaryRole);
 const title=inactive?"현재 사용할 수 없는 계정입니다":user.roles.length?"관제 권한을 확인해 주세요":"계정 역할 정보를 확인할 수 없습니다";
 const description=inactive?"이 계정은 현재 서비스 이용이 제한된 상태입니다.":"현재 로그인한 계정에는 실시간 관제 화면을 이용할 수 있는 관제 권한이 부여되지 않았습니다.";
 return <div className="access-restricted-page"><LandingHeader showSections={false}/><main className="access-restricted">
   <section className="access-restricted__panel" aria-labelledby="access-restricted-title">
    <div className="access-restricted__icon"><ShieldLockIcon/></div>
    <p className="access-restricted__eyebrow">ACCESS RESTRICTED</p>
    <h1 id="access-restricted-title">{title}</h1>
    <p className="access-restricted__description">{description}</p>
    <div className="access-restricted__account">
      <span>현재 로그인 계정</span>
      <strong>{user.name}</strong>
      <p>{primaryRole==="GENERAL_USER"?"일반 계정":"운영 계정"} · {roleLabel}</p>
      <span className="access-restricted__email">{user.email}</span>
      {user.organization?.name&&<small>{user.organization.name}</small>}
      {user.accountStatus&&<em>계정 상태 · {user.accountStatus}</em>}
    </div>
    <p className="access-restricted__help">{inactive?"계정 상태를 확인하거나 소속 기관 관리자에게 문의해 주세요.":"권한 변경이 필요한 경우 소속 기관 관리자에게 문의해 주세요."}</p>
    <div className="access-restricted__actions">
      <Link className="access-restricted__primary" href={inactive?"/":"/mypage"}>{inactive?"메인으로 돌아가기":"내 계정 확인"}</Link>
      {!inactive&&<Link className="access-restricted__secondary" href="/">메인으로 돌아가기</Link>}
    </div>
    <button type="button" className="access-restricted__switch" onClick={event=>requestLogout(event.currentTarget)}>다른 계정으로 로그인</button>
   </section>
  </main></div>;
}

export function ProtectedRoute({children,accessDeniedTitle,accessHandoff=false,requiredRoles=[],requiredPermissions=[],requiredAnyPermissions=[],requiredAnyApiPermissions=[]}:Props){
 const{user,ready}=useAuth();const pathname=usePathname();const router=useRouter();
 const allowed=hasProtectedRouteAccess(user,{requiredRoles,requiredPermissions,requiredAnyPermissions,requiredAnyApiPermissions});
 const handoff=accessHandoff&&user?.accountStatus==="ACTIVE"&&!allowed?getControlAccessHandoff(user.roles):null;
 useEffect(()=>{if(!ready)return;if(!user){const current=sanitizeInternalReturnTo(`${pathname}${window.location.search}${window.location.hash}`);if(current){sessionStorage.setItem(PENDING_RETURN_TO_KEY,current);router.replace(`/login?returnTo=${encodeURIComponent(current)}`)}else router.replace("/login");return}if(allowed){if(accessHandoff)saveRecentWork(user,pathname);return}if(accessHandoff&&user.accountStatus==="ACTIVE"){const handoff=getControlAccessHandoff(user.roles);if(handoff&&handoff.destination!==pathname){storeAccessHandoff(handoff);router.replace(handoff.destination);return}}if(!accessHandoff&&!accessDeniedTitle){const destination=getRoleRedirect(user.roles);if(destination!==pathname)router.replace(destination)}},[accessDeniedTitle,accessHandoff,allowed,pathname,ready,router,user]);
 if(!ready||!user)return <main className="auth-check" role="status" aria-live="polite"><span/>인증 정보를 확인하고 있습니다.</main>;
 if(!allowed&&handoff)return <main className="auth-check" role="status" aria-live="polite"><span/>역할에 맞는 화면으로 안전하게 이동하고 있습니다.</main>;
 if(!allowed&&accessHandoff)return <AccessRestricted/>;
 if(!allowed)return <main className="access-denied" role="alert" aria-labelledby="access-denied-title">
   <span className="access-denied__icon" aria-hidden="true">!</span>
   <p>ACCESS RESTRICTED</p>
   <h1 id="access-denied-title">{accessDeniedTitle??"이 화면에 접근할 권한이 없습니다"}</h1>
   <span>현재 계정에는 이 업무 화면을 사용할 역할 또는 권한이 부여되지 않았습니다.</span>
   <div><button type="button" onClick={()=>router.back()}>이전 화면</button><button type="button" onClick={()=>router.push("/")}>메인으로 이동</button></div>
  </main>;
 return children;
}
