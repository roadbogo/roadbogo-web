import { AccountRecoveryForm } from "@/components/auth/AccountRecoveryForm";
import { AuthShell } from "@/components/auth/AuthShell";
import { LoginHeroCarousel } from "@/components/auth/LoginHeroCarousel";
import styles from "../recovery.module.css";

export default function ForgotPasswordPage() {
  return <AuthShell pageClassName={styles.page} panelClassName={styles.panel} panelLabel="비밀번호 재설정 요청" visual={<LoginHeroCarousel />}>
    <div className={styles.card}><AccountRecoveryForm /></div>
  </AuthShell>;
}
