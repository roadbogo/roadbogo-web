import Link from "next/link";
import { AuthShell } from "@/components/auth/AuthShell";
import { LoginHeroCarousel } from "@/components/auth/LoginHeroCarousel";
import styles from "../recovery.module.css";

export default function FindAccountPage() {
  return <AuthShell pageClassName={styles.page} panelClassName={styles.panel} panelLabel="계정 확인 안내" visual={<LoginHeroCarousel />}>
    <section className={`${styles.card} ${styles.accountHelp}`}><header><p>ACCOUNT HELP</p><h1>계정을 확인할 수 없나요?</h1><span>도로보GO 계정은 소속 기관의 관리자가 등록합니다. 이메일을 잊었거나 계정 확인이 필요한 경우 소속 기관 관리자에게 문의해 주세요.</span></header><p className={styles.helpNotice}>비밀번호만 기억나지 않는 경우에는 비밀번호 재설정을 이용해 주세요.</p><div className={styles.helpActions}><Link className={styles.primaryLink} href="/login">로그인으로 돌아가기</Link><Link href="/forgot-password">비밀번호 재설정</Link></div></section>
  </AuthShell>;
}
