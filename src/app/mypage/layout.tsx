import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
export default function MyPageLayout({children}:{children:React.ReactNode}){return <ProtectedRoute requiredPermissions={["profile:view"]}>{children}</ProtectedRoute>}
