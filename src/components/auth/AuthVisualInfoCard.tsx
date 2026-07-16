import styles from "@/app/login/login.module.css";

type Props = { description: string };

export function AuthVisualInfoCard({ description }: Props) {
  return (
    <div className={styles.visualInfoCard}>
      <i aria-hidden="true" />
      <span>
        <b>AI 위험 탐지 화면 예시</b>
        <small>{description}</small>
      </span>
    </div>
  );
}
