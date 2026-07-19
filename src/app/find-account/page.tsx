import Link from "next/link";
import { AuthShell } from "@/components/auth/AuthShell";
import { LoginHeroCarousel } from "@/components/auth/LoginHeroCarousel";
import styles from "../recovery.module.css";

export default function FindAccountPage() {
  return <AuthShell pageClassName={styles.page} panelClassName={styles.panel} panelLabel="계정 확인 안내" visual={<LoginHeroCarousel />}>
    <section className={`${styles.card} ${styles.accountHelp}`}><header><p>ACCOUNT HELP</p><h1>계정을 확인할 수 없나요?</h1><span>일반 서비스 계정은 회원가입을 통해 직접 만들 수 있습니다. 관제·출동·관리자 운영 계정은 시스템 관리자 또는 소속 기관 관리자가 별도로 발급합니다.</span></header><ul className={styles.helpList}><li>일반 계정이 없다면 일반 사용자 회원가입을 이용해 주세요.</li><li>비밀번호를 잊었다면 비밀번호 재설정을 이용해 주세요.</li><li>운영 계정 이메일이나 발급 상태는 소속 기관 관리자에게 문의해 주세요.</li></ul><div className={styles.helpActions}><Link className={styles.primaryLink} href="/signup">일반 사용자 회원가입</Link><Link href="/login">로그인으로 돌아가기</Link><Link href="/forgot-password">비밀번호 재설정</Link></div></section>
  </AuthShell>;
}
