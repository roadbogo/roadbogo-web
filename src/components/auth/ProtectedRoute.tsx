"use client";
import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import type { AppPermission, AppRole } from "@/components/navigation/navigationConfig";
import { getRoleRedirect } from "@/lib/auth/roleRedirect";
import type { UserRole } from "@/types/auth";
import { useAuth } from "./AuthContext";

type Props={children:React.ReactNode;requiredRoles?:AppRole[];requiredPermissions?:AppPermission[]};
export function ProtectedRoute({children,requiredRoles=[],requiredPermissions=[]}:Props){
 const{user,ready}=useAuth();const pathname=usePathname();const router=useRouter();
 const roleAllowed=!requiredRoles.length||requiredRoles.some(role=>user?.roles?.includes(role));
 const permissionAllowed=!requiredPermissions.length||requiredPermissions.every(permission=>user?.permissions?.includes(permission));
 const allowed=Boolean(user&&roleAllowed&&permissionAllowed);
 useEffect(()=>{if(!ready)return;if(!user){sessionStorage.setItem("roadbogo_return_to",pathname);router.replace(`/login?next=${encodeURIComponent(pathname)}`)}else if(!allowed){const role=user.role as UserRole;router.replace(getRoleRedirect([role]))}},[allowed,pathname,ready,router,user]);
 if(!ready||!allowed)return <main className="auth-check" role="status" aria-live="polite"><span/>인증 정보를 확인하고 있습니다.</main>;
 return children;
}
