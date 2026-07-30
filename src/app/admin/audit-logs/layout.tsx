import type {ReactNode} from "react";
import {ProtectedRoute} from "@/components/auth/ProtectedRoute";

export default function AuditLogLayout({children}:{children:ReactNode}){
  return (
    <ProtectedRoute
      accessDeniedTitle="감사 로그 조회 권한이 없습니다"
      requiredRoles={["SYSTEM_ADMIN"]}
      requiredAnyApiPermissions={["AUDIT.READ"]}
    >
      {children}
    </ProtectedRoute>
  );
}
