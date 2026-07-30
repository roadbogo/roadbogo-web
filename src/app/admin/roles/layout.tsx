import type {ReactNode} from "react";
import {ProtectedRoute} from "@/components/auth/ProtectedRoute";

export default function AdminRolesLayout({children}:{children:ReactNode}){
  return <ProtectedRoute accessDeniedTitle="역할 관리 접근 권한이 없습니다" requiredAnyApiPermissions={["ROLE.MANAGE"]}>{children}</ProtectedRoute>;
}
