import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
export default function AdminLayout({children}:{children:React.ReactNode}){return <ProtectedRoute requiredAnyPermissions={["users:manage","roles:manage"]}>{children}</ProtectedRoute>}
