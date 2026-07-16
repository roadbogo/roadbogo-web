import { Suspense } from "react";
import { AuthShell } from "@/components/auth/AuthShell";
import { LoginHeroCarousel } from "@/components/auth/LoginHeroCarousel";
import { ResetPasswordForm } from "@/components/auth/ResetPasswordForm";
import styles from "../recovery.module.css";

export default function ResetPasswordPage() {
  return <AuthShell pageClassName={styles.page} panelClassName={styles.panel} panelLabel="새 비밀번호 설정" visual={<LoginHeroCarousel />}>
    <div className={styles.card}><header><p>NEW PASSWORD</p><h1>새 비밀번호 설정</h1><span>새로 사용할 비밀번호를 입력해 주세요.</span></header><Suspense fallback={<p role="status">재설정 링크를 확인하고 있습니다.</p>}><ResetPasswordForm /></Suspense></div>
  </AuthShell>;
}
