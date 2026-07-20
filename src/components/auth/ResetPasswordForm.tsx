"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { useSearchParams } from "next/navigation";
import { SignupPasswordField } from "./SignupPasswordField";
import { RecoverySteps } from "./RecoverySteps";
import { ApiError } from "@/lib/apiClient";
import { authApi } from "@/lib/authApi";
import { getPasswordChecks, isPasswordValid } from "@/lib/auth/passwordPolicy";
import styles from "@/app/recovery.module.css";

const messages: Record<string, string> = {
  AUTH_PASSWORD_RESET_TOKEN_INVALID: "유효하지 않거나 이미 사용된 재설정 링크입니다. 새 링크를 요청해 주세요.",
  AUTH_PASSWORD_RESET_TOKEN_EXPIRED: "재설정 링크가 만료되었습니다. 새 링크를 요청해 주세요.",
  AUTH_ACCOUNT_UNAVAILABLE: "현재 사용할 수 없는 계정입니다. 소속 기관 관리자에게 문의해 주세요.",
  USER_PASSWORD_POLICY_VIOLATION: "비밀번호 조건을 모두 충족해 주세요.",
  COMMON_VALIDATION_ERROR: "입력 내용을 확인해 주세요.",
};

export function ResetPasswordForm() {
  const token = useSearchParams().get("token")?.trim() ?? "";
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [complete, setComplete] = useState(false);
  const checks = getPasswordChecks(password);
  const confirmationMatches = confirmation.length > 0 && password === confirmation;
  const canSubmit = isPasswordValid(password) && confirmationMatches && !submitting;
  const steps = <RecoverySteps currentStep={complete ? undefined : 3} completedThrough={complete ? 3 : 2}/>;
  if (!token) return <>{steps}<section className={styles.complete} role="alert"><h2>재설정 링크를 확인해 주세요</h2><p>유효한 비밀번호 재설정 링크가 아닙니다.</p><div className={styles.missingTokenActions}><Link className={styles.primaryLink} href="/forgot-password">비밀번호 재설정 다시 요청</Link><Link href="/login">로그인으로 돌아가기</Link></div></section></>;
  if (complete) return <>{steps}<section className={styles.complete} role="status"><div aria-hidden="true">✓</div><h2>비밀번호 변경 완료</h2><p>비밀번호가 변경되었습니다. 새 비밀번호로 다시 로그인해 주세요.</p><Link className={styles.primaryLink} href="/login">로그인 화면으로 이동</Link></section></>;
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (submitting) return;
    if (!isPasswordValid(password)) { setError(messages.USER_PASSWORD_POLICY_VIOLATION); return; }
    if (password !== confirmation) { setError("새 비밀번호가 일치하지 않습니다."); return; }
    setSubmitting(true); setError("");
    try { await authApi.confirmPasswordReset(token, password, confirmation); setPassword(""); setConfirmation(""); setComplete(true); }
    catch (caught) { setError(caught instanceof ApiError ? messages[caught.code] ?? "비밀번호를 변경하지 못했습니다. 잠시 후 다시 시도해 주세요." : "서버에 연결할 수 없습니다. 잠시 후 다시 시도해 주세요."); }
    finally { setSubmitting(false); }
  };
  return <>{steps}<form className={styles.resetForm} onSubmit={submit} noValidate>
    <SignupPasswordField id="reset-password" label="새 비밀번호" value={password} onChange={setPassword} error={error === messages.USER_PASSWORD_POLICY_VIOLATION ? error : undefined} hint="8~64자, 영문과 숫자를 포함해 주세요." disabled={submitting} />
    <fieldset className={styles.passwordChecklist}>
      <legend>비밀번호 조건</legend>
      <ul>
        <li data-valid={checks.length}><span aria-hidden="true">{checks.length ? "✓" : "○"}</span>{checks.length ? "충족: " : "미충족: "}8~64자</li>
        <li data-valid={checks.letter}><span aria-hidden="true">{checks.letter ? "✓" : "○"}</span>{checks.letter ? "충족: " : "미충족: "}영문 포함</li>
        <li data-valid={checks.number}><span aria-hidden="true">{checks.number ? "✓" : "○"}</span>{checks.number ? "충족: " : "미충족: "}숫자 포함</li>
        <li data-optional="true"><span aria-hidden="true">○</span>선택: 특수문자</li>
      </ul>
    </fieldset>
    <SignupPasswordField
      id="reset-password-confirm"
      label="새 비밀번호 확인"
      value={confirmation}
      onChange={setConfirmation}
      error={confirmation && !confirmationMatches ? "비밀번호가 일치하지 않습니다." : undefined}
      hint={confirmationMatches ? "비밀번호가 일치합니다." : "새 비밀번호를 한 번 더 입력해 주세요."}
      hintTone={confirmationMatches ? "success" : "neutral"}
      disabled={submitting}
    />
    <p className={styles.error} role="alert">{error || " "}</p>
    <button className={styles.resetSubmit} type="submit" disabled={!canSubmit} aria-busy={submitting}>{submitting && <i className={styles.spinner} aria-hidden="true"/>}{submitting ? "변경 중…" : "비밀번호 변경"}</button>
    <div className={styles.loginPrompt}><span>비밀번호가 기억나셨나요?</span><Link href="/login">로그인하기</Link></div>
  </form></>;
}
