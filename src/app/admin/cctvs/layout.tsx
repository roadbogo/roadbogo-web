import type {ReactNode} from "react";
import {ProtectedRoute} from "@/components/auth/ProtectedRoute";
export default function AdminCctvsLayout({children}:{children:ReactNode}){return <ProtectedRoute accessDeniedTitle="CCTV 네트워크 접근 권한이 없습니다" requiredAnyApiPermissions={["CCTV.READ"]}>{children}</ProtectedRoute>}
