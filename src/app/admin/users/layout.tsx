import type { ReactNode } from "react";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";

export default function AdminUsersLayout({children}:{children:ReactNode}){
  return <ProtectedRoute accessDeniedTitle="사용자 관리 접근 권한이 없습니다" requiredAnyApiPermissions={["USER.READ_ALL"]}>{children}</ProtectedRoute>;
}
