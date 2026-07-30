import {Suspense} from "react";
import {RoleManagementWorkspace} from "@/features/user-management/RoleManagementWorkspace";

export default function AdminRolesPage(){
  return <Suspense fallback={<main role="status">역할 관리 화면을 준비하고 있습니다.</main>}><RoleManagementWorkspace/></Suspense>;
}
