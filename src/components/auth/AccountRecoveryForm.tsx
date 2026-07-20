"use client";

import Link from "next/link";
import { FormEvent, useRef, useState } from "react";
import { ApiError } from "@/lib/apiClient";
import { authApi } from "@/lib/authApi";
import { RecoverySteps } from "./RecoverySteps";
import styles from "@/app/recovery.module.css";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const SHOW_DEVELOPMENT_TOOLS = process.env.NODE_ENV !== "production";

const MailIcon = () => <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="m4 7 8 6 8-6"/></svg>;
const MailCheckIcon = () => <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="m4 7 8 6 8-6M14.5 16l1.7 1.7 3.3-3.7"/></svg>;
const InfoIcon = () => <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01"/></svg>;
const CodeIcon = () => <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m8 9-3 3 3 3M16 9l3 3-3 3M14 5l-4 14"/></svg>;
const ExternalLinkIcon = () => <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M14 5h5v5M19 5l-9 9"/><path d="M19 13v5a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1h5"/></svg>;

function safeDebugUrl(value?: string) {
  if (process.env.NODE_ENV === "production" || !value || typeof window === "undefined") return null;
  try {
    const url = new URL(value);
    return url.origin === window.location.origin && url.pathname === "/reset-password" ? url.toString() : null;
  } catch { return null; }
}

function maskEmail(email: string) {
  const [local, domain] = email.split("@");
  if (!local || !domain) return email;
  const visible = local.slice(0, 1);
  return `${visible}${"*".repeat(Math.max(3, Math.min(6, local.length - 1)))}@${domain}`;
}

export function AccountRecoveryForm() {
  const [email, setEmail] = useState("");
  const [submittedEmail, setSubmittedEmail] = useState("");
  const [error, setError] = useState("");
  const [feedback, setFeedback] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [completed, setCompleted] = useState(false);
  const [debugUrl, setDebugUrl] = useState<string | null>(null);
  const emailRef = useRef<HTMLInputElement>(null);

  const requestReset = async (targetEmail: string) => {
    if (submitting) return false;
    setError("");
    setFeedback("");
    setSubmitting(true);
    try {
      const result = await authApi.requestPasswordReset(targetEmail);
      setDebugUrl(safeDebugUrl(result.debug_reset_url));
      setSubmittedEmail(targetEmail);
      setCompleted(true);
      return true;
    } catch (caught) {
      setError(caught instanceof ApiError && caught.code === "AUTH_PASSWORD_RESET_DELIVERY_UNAVAILABLE"
        ? "현재 비밀번호 재설정 안내를 전송할 수 없습니다. 잠시 후 다시 시도해 주세요."
        : "요청을 처리하지 못했습니다. 잠시 후 다시 시도해 주세요.");
      return false;
    } finally {
      setSubmitting(false);
    }
  };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const normalized = email.trim().toLowerCase();
    if (!EMAIL_PATTERN.test(normalized)) {
      setError("올바른 이메일 형식을 입력해 주세요.");
      emailRef.current?.focus();
      return;
    }
    await requestReset(normalized);
  };

  const editEmail = () => {
    setCompleted(false);
    setError("");
    setFeedback("");
    window.requestAnimationFrame(() => {
      emailRef.current?.focus();
      emailRef.current?.select();
    });
  };

  const resend = async () => {
    const success = await requestReset(submittedEmail);
    if (success) setFeedback("재설정 링크를 다시 보냈습니다.");
  };

  return <>
    <header className={styles.recoveryHeader}>
      <p>PASSWORD RESET</p>
      <h1>비밀번호 재설정</h1>
      <span>{completed
        ? <>입력한 이메일로 등록된 계정이 있다면<br/>비밀번호 재설정 링크가 전송됩니다.</>
        : <>계정에 등록한 이메일을 입력해 주세요.<br/>비밀번호 재설정 링크를 보내드립니다.</>}</span>
    </header>
    <RecoverySteps currentStep={completed ? 2 : 1} completedThrough={completed ? 1 : 0}/>

    {completed ? <section className={styles.recoveryComplete} role="status">
      <div className={styles.successResult}>
        <div className={styles.successHeading}><span aria-hidden="true"><MailCheckIcon/></span><h2>재설정 안내를 보냈어요</h2></div>
        <p>입력한 이메일로 등록된 계정이 있다면<br/>비밀번호 재설정 링크가 전송됩니다.</p>
        <div className={styles.sentEmail}><MailIcon/><span><small>전송 이메일</small><strong>{maskEmail(submittedEmail)}</strong></span></div>
      </div>
      <aside className={styles.securityNotice}><InfoIcon/><div><strong>메일이 보이지 않나요?</strong><p>받은편지함과 스팸함을 확인하고, 입력한 이메일 주소가 정확한지 확인해 주세요.</p></div></aside>
      {error && <p className={styles.error} role="alert">{error}</p>}
      {feedback && <p className={styles.successFeedback} role="status">{feedback}</p>}
      <Link className={styles.primaryLink} href="/login">로그인으로 돌아가기</Link>
      <div className={styles.secondaryActions}>
        <button type="button" onClick={editEmail}>다른 이메일 입력</button>
        <span aria-hidden="true">·</span>
        <button type="button" onClick={() => void resend()} disabled={submitting} aria-busy={submitting}>{submitting ? "전송 중…" : "재설정 링크 다시 보내기"}</button>
      </div>
      {SHOW_DEVELOPMENT_TOOLS && <aside className={styles.developmentTools}>
        <div className={styles.developmentHeading}><span aria-hidden="true"><CodeIcon/></span><div><b>개발 환경 전용</b><strong>비밀번호 재설정 테스트</strong></div></div>
        <p>로컬 환경에서는 메일 발송 없이 재설정 화면을 직접 확인할 수 있습니다.</p>
        {debugUrl
          ? <a href={debugUrl} target="_blank" rel="noopener noreferrer">재설정 화면 열기<ExternalLinkIcon/></a>
          : <><button type="button" disabled>재설정 화면 열기<ExternalLinkIcon/></button><small>현재 확인할 수 있는 재설정 링크가 없습니다.</small></>}
      </aside>}
    </section> : <form className={styles.form} onSubmit={submit} noValidate>
      <label htmlFor="recovery-email">이메일</label>
      <input ref={emailRef} id="recovery-email" type="email" inputMode="email" autoComplete="email" placeholder="name@example.com" value={email} onChange={event => setEmail(event.target.value)} disabled={submitting} aria-invalid={Boolean(error)} aria-describedby="recovery-error" required />
      <p id="recovery-error" className={styles.error} role="alert">{error || " "}</p>
      <button type="submit" disabled={submitting} aria-busy={submitting}>{submitting && <i className={styles.spinner} aria-hidden="true"/>}{submitting ? "전송 중…" : "재설정 링크 보내기"}</button>
    </form>}

    {!completed && <div className={styles.loginPrompt}><span>비밀번호가 기억나셨나요?</span><Link href="/login">로그인하기</Link></div>}
  </>;
}
