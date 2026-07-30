import {Suspense} from "react";
import {AuditLogWorkspace} from "@/features/audit-log/AuditLogWorkspace";

export default function AuditLogsPage(){
  return (
    <Suspense fallback={<main aria-busy="true">감사 로그를 준비하고 있습니다.</main>}>
      <AuditLogWorkspace/>
    </Suspense>
  );
}
