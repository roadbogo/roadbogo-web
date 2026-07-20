import styles from "@/app/recovery.module.css";

const CheckIcon = () => <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m5 12 4 4L19 6"/></svg>;

type RecoveryStepsProps = {
  currentStep?: 1 | 2 | 3;
  completedThrough: 0 | 1 | 2 | 3;
};

export function RecoverySteps({ currentStep, completedThrough }: RecoveryStepsProps) {
  const steps = ["이메일 입력", "메일 확인", "새 비밀번호 설정"];

  return <ol className={styles.recoverySteps} aria-label="비밀번호 재설정 단계">
    {steps.map((label, index) => {
      const step = (index + 1) as 1 | 2 | 3;
      const done = step <= completedThrough;
      const current = step === currentStep;
      return <li key={label} className={done ? styles.stepDone : current ? styles.stepCurrent : styles.stepUpcoming} aria-current={current ? "step" : undefined}>
        <span>{done ? <CheckIcon/> : step}</span><strong>{label}</strong>
      </li>;
    })}
  </ol>;
}
