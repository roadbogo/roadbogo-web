import { Suspense } from "react";
import { UserManagementWorkspace } from "@/features/user-management/UserManagementWorkspace";
import styles from "./users.module.css";

export default function AdminUsersPage(){
  return <Suspense fallback={<main className={styles.page}><p>사용자 관리 화면을 준비하고 있습니다.</p></main>}><UserManagementWorkspace styles={styles}/></Suspense>;
}
