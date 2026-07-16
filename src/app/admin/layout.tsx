import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
export default function AdminLayout({children}:{children:React.ReactNode}){return <ProtectedRoute requiredRoles={["SYSTEM_ADMIN"]} requiredPermissions={["users:manage"]}>{children}</ProtectedRoute>}
