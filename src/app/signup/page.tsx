import { AuthShell } from "@/components/auth/AuthShell";
import { SignupForm } from "@/components/auth/SignupForm";
import { SignupRiskVisual } from "@/components/auth/SignupRiskVisual";
import styles from "./signup.module.css";

export default function SignupPage() {
  return <AuthShell pageClassName={styles.page} panelClassName={styles.panel} panelLabel="일반 사용자 회원가입" visual={<SignupRiskVisual/>}>
    <section className={`${styles.requestPanel} ${styles.signupPanel}`}>
      <header className={styles.heading}>
        <p>GENERAL SIGNUP</p>
        <h2>일반 사용자 회원가입</h2>
        <span>도로보GO 일반 서비스를 이용할 계정을 만들어 주세요.</span>
      </header>
      <SignupForm />
    </section>
  </AuthShell>;
}
