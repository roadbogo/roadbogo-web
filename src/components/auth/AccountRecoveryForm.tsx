"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { ApiError } from "@/lib/apiClient";
import { authApi } from "@/lib/authApi";
import styles from "@/app/recovery.module.css";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function safeDebugUrl(value?: string) {
  if (process.env.NODE_ENV === "production" || !value || typeof window === "undefined") return null;
  try {
    const url = new URL(value);
    return url.origin === window.location.origin && url.pathname === "/reset-password" ? url.toString() : null;
  } catch { return null; }
}

export function AccountRecoveryForm() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [completed, setCompleted] = useState(false);
  const [debugUrl, setDebugUrl] = useState<string | null>(null);
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (submitting) return;
    const normalized = email.trim().toLowerCase();
    if (!EMAIL_PATTERN.test(normalized)) { setError("올바른 이메일 형식을 입력해 주세요."); return; }
    setError(""); setSubmitting(true);
    try {
      const result = await authApi.requestPasswordReset(normalized);
      setDebugUrl(safeDebugUrl(result.debug_reset_url));
      setCompleted(true);
    } catch (caught) {
      setError(caught instanceof ApiError && caught.code === "AUTH_PASSWORD_RESET_DELIVERY_UNAVAILABLE" ? "현재 비밀번호 재설정 안내를 전송할 수 없습니다. 잠시 후 다시 시도해 주세요." : "요청을 처리하지 못했습니다. 잠시 후 다시 시도해 주세요.");
    } finally { setSubmitting(false); }
  };
  if (completed) return <section className={styles.complete} role="status">
    <div aria-hidden="true">✓</div><h2>안내를 확인해 주세요</h2>
    <p>입력한 이메일로 등록된 계정이 있다면 비밀번호 재설정 안내가 전송됩니다.</p>
    {debugUrl && <a className={styles.debugLink} href={debugUrl}>개발 환경에서 재설정 링크 확인</a>}
    <Link className={styles.primaryLink} href="/login">로그인 화면으로 돌아가기</Link>
  </section>;
  return <form className={styles.form} onSubmit={submit} noValidate>
    <label htmlFor="recovery-email">등록 이메일</label>
    <input id="recovery-email" type="email" inputMode="email" autoComplete="email" value={email} onChange={event => setEmail(event.target.value)} disabled={submitting} aria-invalid={Boolean(error)} aria-describedby="recovery-error" required />
    <p id="recovery-error" className={styles.error} role="alert">{error || " "}</p>
    <button type="submit" disabled={submitting} aria-busy={submitting}>{submitting ? "요청 중…" : "재설정 안내 받기"}</button>
  </form>;
}
