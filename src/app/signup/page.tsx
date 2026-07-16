import Link from "next/link";
import { AuthShell } from "@/components/auth/AuthShell";
import { SignupRiskVisual } from "@/components/auth/SignupRiskVisual";
import styles from "./signup.module.css";

export default function SignupPolicyPage() {
  return <AuthShell pageClassName={styles.page} panelClassName={styles.panel} panelLabel="계정 발급 안내" visual={<SignupRiskVisual/>}>
    <section className={`${styles.requestPanel} ${styles.successPanel}`}>
      <div className={styles.success}>
        <div className={styles.successIcon} aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M12 3 4.5 6v5.2c0 4.7 3.2 8.1 7.5 9.8 4.3-1.7 7.5-5.1 7.5-9.8V6L12 3Z"/><path d="M8 12h8M12 8v8"/></svg></div>
        <p>ACCOUNT ISSUANCE</p>
        <h2>계정은 관리자 승인으로 발급됩니다</h2>
        <span>도로보GO는 공개 회원가입을 제공하지 않습니다.<br/>소속 기관 관리자에게 계정 생성 또는 초대를 요청해 주세요.</span>
        <ol>
          <li><b>1</b>소속 기관 관리자에게 계정 발급 문의</li>
          <li><b>2</b>초대받은 경우 계정 활성화 진행</li>
          <li><b>3</b>발급된 계정으로 로그인</li>
        </ol>
        <div className={styles.successActions}>
          <Link href="/account/activate">초대 계정 활성화</Link>
          <Link href="/login">로그인 화면으로 돌아가기</Link>
          <Link href="/find-account">기관 관리자 문의 안내</Link>
        </div>
      </div>
    </section>
  </AuthShell>;
}
