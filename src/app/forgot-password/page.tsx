import Link from "next/link";
import { AccountRecoveryForm } from "@/components/auth/AccountRecoveryForm";
import { AuthShell } from "@/components/auth/AuthShell";
import { LoginHeroCarousel } from "@/components/auth/LoginHeroCarousel";
import styles from "../recovery.module.css";

export default function ForgotPasswordPage() {
  return <AuthShell pageClassName={styles.page} panelClassName={styles.panel} panelLabel="비밀번호 재설정 요청" visual={<LoginHeroCarousel />}>
    <div className={styles.card}><header><p>PASSWORD RESET</p><h1>비밀번호 재설정</h1><span>가입된 이메일을 입력하면 비밀번호 재설정 안내를 보내드립니다.</span></header><AccountRecoveryForm /><Link className={styles.backLink} href="/login">← 로그인으로 돌아가기</Link></div>
  </AuthShell>;
}
