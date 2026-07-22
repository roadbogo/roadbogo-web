"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAuth, type AuthenticatedUser } from "@/components/auth/AuthContext";
import { ApiError, finishLogoutSession } from "@/lib/apiClient";
import { clearPostLoginRoutingState } from "@/lib/auth/postLoginRouting";
import { canWithdrawAccount } from "@/app/mypage/mypageUtils";
import { createAccountWithdrawalAdapter } from "./accountWithdrawal";
import styles from "./AccountWithdrawalDialog.module.css";

type Props = { open: boolean; user: AuthenticatedUser; triggerRef: React.RefObject<HTMLButtonElement | null>; onClose: () => void };
type Step = "notice" | "password" | "submitting" | "success";
const authErrorCodes = new Set(["AUTH_ACCOUNT_UNAVAILABLE", "AUTH_SESSION_INVALID", "AUTH_ACCESS_TOKEN_EXPIRED"]);

function maskEmail(email: string) {
  const [local, domain] = email.split("@");
  if (!domain) return "••••";
  return `${local.slice(0, 2)}${"•".repeat(Math.max(3, Math.min(8, local.length - 2)))}@${domain}`;
}

function hasCurrentPasswordField(details: Record<string, unknown> | null) {
  if (!details) return false;
  if (Object.hasOwn(details, "current_password")) return true;
  const fields = details.fields;
  if (fields && typeof fields === "object" && !Array.isArray(fields)) return Object.hasOwn(fields, "current_password");
  return Array.isArray(fields) && fields.some(field => typeof field === "object" && field !== null && JSON.stringify(field).includes("current_password"));
}

export function AccountWithdrawalDialog({ open, user, triggerRef, onClose }: Props) {
  const router = useRouter();
  const { clearAuth } = useAuth();
  const [step, setStep] = useState<Step>("notice");
  const [confirmed, setConfirmed] = useState(false);
  const [password, setPassword] = useState("");
  const [visible, setVisible] = useState(false);
  const [passwordError, setPasswordError] = useState("");
  const [formError, setFormError] = useState("");
  const [closeHint, setCloseHint] = useState("");
  const dialogRef = useRef<HTMLElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);
  const runningRef = useRef(false);
  const adapter = useMemo(() => createAccountWithdrawalAdapter(user.roles), [user.roles]);
  const submitting = step === "submitting";

  const clearSensitive = useCallback(() => { setPassword(""); setVisible(false); setPasswordError(""); setFormError(""); }, []);
  const close = useCallback(() => {
    if (submitting) return;
    clearSensitive(); setConfirmed(false); setStep("notice"); setCloseHint(""); onClose();
    window.requestAnimationFrame(() => triggerRef.current?.focus());
  }, [clearSensitive, onClose, submitting, triggerRef]);
  const requestPassiveClose = useCallback(() => {
    if (submitting) return;
    if (password) { setCloseHint("입력한 비밀번호가 있습니다. 닫기 버튼을 눌러 종료해 주세요."); return; }
    close();
  }, [close, password, submitting]);

  useEffect(() => {
    if (!open) return;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.requestAnimationFrame(() => closeRef.current?.focus());
    return () => { document.body.style.overflow = overflow; };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const keydown = (event: KeyboardEvent) => {
      if (event.key === "Escape") { event.preventDefault(); requestPassiveClose(); return; }
      if (event.key !== "Tab" || !dialogRef.current) return;
      const controls = [...dialogRef.current.querySelectorAll<HTMLElement>('button:not([disabled]), input:not([disabled]), [href], [tabindex]:not([tabindex="-1"])')];
      if (!controls.length) return;
      const first = controls[0], last = controls[controls.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    document.addEventListener("keydown", keydown);
    return () => { document.removeEventListener("keydown", keydown); };
  }, [open, requestPassiveClose]);

  useEffect(() => { if (open && step === "password") window.requestAnimationFrame(() => passwordRef.current?.focus()); }, [open, step]);
  useEffect(() => () => { runningRef.current = false; }, []);

  const finish = () => {
    clearSensitive(); clearPostLoginRoutingState(); finishLogoutSession(); clearAuth();
    window.dispatchEvent(new Event("roadbogo:client-session-cleared"));
  };
  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (runningRef.current || !password || !canWithdrawAccount(user.roles)) return;
    runningRef.current = true; setStep("submitting"); setPasswordError(""); setFormError("");
    try {
      await adapter.withdraw(password);
      finish(); setStep("success");
      window.setTimeout(() => router.replace("/login?reason=withdrawn"), 700);
    } catch (error) {
      if (error instanceof ApiError && error.code === "AUTH_CURRENT_PASSWORD_INVALID") {
        setPassword(""); setPasswordError("현재 비밀번호가 일치하지 않습니다"); setStep("password");
        window.requestAnimationFrame(() => passwordRef.current?.focus());
      } else if (error instanceof ApiError && error.code === "AUTH_WITHDRAWAL_NOT_ALLOWED") {
        setFormError("운영 계정은 본인 회원탈퇴를 이용할 수 없습니다"); setStep("password");
      } else if (error instanceof ApiError && authErrorCodes.has(error.code)) {
        finish(); router.replace("/login?reason=expired");
      } else if (error instanceof ApiError && error.code === "COMMON_VALIDATION_ERROR") {
        if (hasCurrentPasswordField(error.details)) setPasswordError("현재 비밀번호를 확인해 주세요");
        else setFormError("입력 내용을 확인한 뒤 다시 시도해 주세요");
        setStep("password");
      } else { setFormError("회원 탈퇴를 처리하지 못했습니다. 잠시 후 다시 시도해 주세요"); setStep("password"); }
    } finally { runningRef.current = false; }
  };

  if (!open || !canWithdrawAccount(user.roles)) return null;
  return <div className={styles.layer}>
    <button className={styles.backdrop} type="button" aria-label="회원 탈퇴 창 닫기" onClick={requestPassiveClose} />
    <section ref={dialogRef} className={styles.dialog} role="dialog" aria-modal="true" aria-labelledby="withdrawal-dialog-title" aria-describedby="withdrawal-dialog-description" aria-busy={submitting}>
      <header><div>{step !== "notice" && step !== "success" && <button className={styles.backButton} type="button" onClick={() => { clearSensitive(); setStep("notice"); }} disabled={submitting} aria-label="이전 단계로 돌아가기"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m15 18-6-6 6-6" /></svg></button>}<h2 id="withdrawal-dialog-title">회원 탈퇴</h2><span>{step === "notice" ? "1 / 2" : "2 / 2"}</span></div>{step !== "success" && <button ref={closeRef} className={styles.closeButton} type="button" onClick={close} disabled={submitting} aria-label="회원 탈퇴 창 닫기"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18" /></svg></button>}</header>
      {step === "success" ? <div className={styles.success} role="status"><i aria-hidden="true">✓</i><h3>회원 탈퇴가 완료되었습니다</h3><p>모든 기기에서 로그아웃되었으며 계정은 더 이상 사용할 수 없습니다</p></div> : step === "notice" ? <>
        <div className={styles.body}><div className={styles.intro}><i aria-hidden="true">!</i><div><h3>회원 탈퇴 전에 확인해 주세요</h3><p id="withdrawal-dialog-description">아래 내용을 확인한 후 다음 단계로 진행해 주세요</p></div></div>
          <ul><li>탈퇴한 계정은 다시 복구할 수 없습니다</li><li>현재 기기를 포함한 모든 기기에서 로그아웃됩니다</li><li>같은 이메일로 다시 이용하려면 새로 회원가입해야 합니다</li><li>서비스 운영에 필요한 일부 기록은 개인정보를 제거한 형태로 보관될 수 있습니다</li></ul>
          <label className={`${styles.confirm} ${confirmed ? styles.checked : ""}`}><input type="checkbox" checked={confirmed} onChange={event => setConfirmed(event.target.checked)} /><span>위 내용을 모두 확인했으며, 탈퇴 후에는 계정을 복구할 수 없다는 점을 이해했습니다</span></label>
        </div><footer><button type="button" onClick={close}>취소</button><button className={styles.continue} type="button" disabled={!confirmed} onClick={() => setStep("password")}>계속</button></footer>
      </> : <form onSubmit={submit} noValidate><div className={styles.body}><div className={styles.intro}><i aria-hidden="true">✓</i><div><h3>현재 비밀번호를 확인해 주세요</h3><p id="withdrawal-dialog-description">안전한 회원 탈퇴를 위해 현재 사용 중인 비밀번호를 입력해 주세요</p></div></div>
        <dl><div><dt>사용자</dt><dd>{user.name}</dd></div><div><dt>이메일</dt><dd>{maskEmail(user.email)}</dd></div></dl>
        {formError && <p className={styles.formError} role="alert">{formError}</p>}
        <label className={styles.passwordLabel} htmlFor="withdrawal-password">현재 비밀번호</label><div className={styles.passwordField}><input ref={passwordRef} id="withdrawal-password" name="current_password" type={visible ? "text" : "password"} value={password} onChange={event => { setPassword(event.target.value); setPasswordError(""); setFormError(""); setCloseHint(""); }} placeholder="비밀번호를 입력해 주세요" autoComplete="current-password" maxLength={128} disabled={submitting} aria-invalid={Boolean(passwordError)} aria-describedby="withdrawal-password-error withdrawal-warning" /><button type="button" onClick={() => { setVisible(value => !value); window.requestAnimationFrame(() => passwordRef.current?.focus()); }} disabled={submitting} aria-label={visible ? "비밀번호 숨기기" : "비밀번호 표시"} aria-pressed={visible}>{visible ? <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 3l18 18M10.6 10.7a2 2 0 0 0 2.7 2.7M9.9 4.2A10.8 10.8 0 0 1 12 4c5.5 0 9 5 9 5a17 17 0 0 1-2.1 2.5M6.2 6.2C4.2 7.5 3 9 3 9s3.5 5 9 5c1 0 1.9-.2 2.7-.4" /></svg> : <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 12s3.5-5 9-5 9 5 9 5-3.5 5-9 5-9-5-9-5Z" /><circle cx="12" cy="12" r="2.5" /></svg>}</button></div>
        <p id="withdrawal-password-error" className={styles.fieldError} aria-live="polite">{passwordError}</p><p id="withdrawal-warning" className={styles.warning}>비밀번호 확인 후 회원 탈퇴가 즉시 진행됩니다</p><p className={styles.closeHint} role="status">{closeHint}</p>
      </div><footer><button type="button" disabled={submitting} onClick={close}>취소</button><button className={styles.danger} type="submit" disabled={!password || submitting}>{submitting ? "탈퇴 처리 중…" : "회원 탈퇴"}</button></footer></form>}
    </section>
  </div>;
}
