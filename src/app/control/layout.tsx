import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
export default function ControlLayout({children}:{children:React.ReactNode}){return <ProtectedRoute requiredRoles={["CONTROL_OPERATOR"]} requiredPermissions={["control:view"]}>{children}</ProtectedRoute>}
