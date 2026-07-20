import{ProtectedRoute}from"@/components/auth/ProtectedRoute";
import{controlAccessRequirements}from"@/lib/auth/controlAccess";
export default function IncidentDetailLayout({children}:{children:React.ReactNode}){return <ProtectedRoute {...controlAccessRequirements}>{children}</ProtectedRoute>}
