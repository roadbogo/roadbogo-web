import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import {LandingHeader} from "@/components/landing/LandingHeader";
import {DispatchLocalNavigation} from "@/components/dispatch/DispatchLocalNavigation";
export default function DispatchLayout({children}:{children:React.ReactNode}){return <ProtectedRoute requiredRoles={["FIELD_RESPONDER"]} requiredPermissions={["dispatch:assigned"]} requiredAnyApiPermissions={["DISPATCH.READ_OWN"]}><LandingHeader showSections={false}/><DispatchLocalNavigation/>{children}</ProtectedRoute>}
