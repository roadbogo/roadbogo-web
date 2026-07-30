import type {ReactNode} from "react";
import {ProtectedRoute} from "@/components/auth/ProtectedRoute";
export default function NewAdminUserLayout({children}:{children:ReactNode}){return <ProtectedRoute accessDeniedTitle="운영 사용자 등록 권한이 없습니다" requiredAnyApiPermissions={["USER.WRITE"]}>{children}</ProtectedRoute>}
