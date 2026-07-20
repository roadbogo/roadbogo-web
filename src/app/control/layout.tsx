import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { controlAccessRequirements } from "@/lib/auth/controlAccess";
export default function ControlLayout({children}:{children:React.ReactNode}){return <ProtectedRoute accessHandoff {...controlAccessRequirements}>{children}</ProtectedRoute>}
