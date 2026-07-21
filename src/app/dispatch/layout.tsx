import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
export default function DispatchLayout({children}:{children:React.ReactNode}){return <ProtectedRoute requiredRoles={["FIELD_RESPONDER"]} requiredPermissions={["dispatch:assigned"]} requiredAnyApiPermissions={["DISPATCH.READ_OWN"]}>{children}</ProtectedRoute>}
