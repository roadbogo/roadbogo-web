import type { ReactNode } from "react";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import {LandingHeader} from "@/components/landing/LandingHeader";
import {AdminLocalNavigation} from "@/components/admin/AdminLocalNavigation";
export default function AdminLayout({children}:{children:ReactNode}){return <ProtectedRoute accessDeniedTitle="관리 콘솔 접근 권한이 없습니다" requiredRoles={["SYSTEM_ADMIN"]} requiredAnyPermissions={["users:manage","roles:manage"]}><LandingHeader showSections={false}/><AdminLocalNavigation/>{children}</ProtectedRoute>}
