"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { SignupPasswordField } from "./SignupPasswordField";
import { ApiError } from "@/lib/apiClient";
import { authApi } from "@/lib/authApi";
import { getPasswordChecks, isPasswordValid } from "@/lib/auth/passwordPolicy";
import styles from "@/app/signup/signup.module.css";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PASSWORD_POLICY_MESSAGE = "비밀번호는 8~64자이며 영문과 숫자를 포함해야 합니다.";
const REQUEST_ERROR_MESSAGE = "회원가입 요청을 처리하지 못했습니다. 잠시 후 다시 시도해 주세요.";

type FieldName = "userName" | "email" | "password" | "passwordConfirmation";
type FieldErrors = Partial<Record<FieldName, string>>;
type ValidationField = { field?: unknown; reason?: unknown };

const serverFieldMap: Record<string, FieldName> = {
  user_name: "userName",
  email: "email",
  password: "password",
  password_confirmation: "passwordConfirmation",
};

function mapValidationErrors(details: Record<string, unknown> | null): FieldErrors {
  if (!details || !Array.isArray(details.fields)) return {};
  return details.fields.reduce<FieldErrors>((errors, item) => {
    if (!item || typeof item !== "object") return errors;
    const { field, reason } = item as ValidationField;
    if (typeof field !== "string") return errors;
    const fieldName = serverFieldMap[field.split(".").at(-1) ?? ""];
    if (fieldName) errors[fieldName] = typeof reason === "string" ? reason : "입력 내용을 확인해 주세요.";
    return errors;
  }, {});
}

export function SignupForm() {
  const router = useRouter();
  const [userName, setUserName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirmation, setPasswordConfirmation] = useState("");
  const [errors, setErrors] = useState<FieldErrors>({});
  const [submitError, setSubmitError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const passwordChecks = getPasswordChecks(password);
  const confirmationMatches = Boolean(passwordConfirmation) && password === passwordConfirmation;

  const updateField = (field: FieldName, value: string) => {
    setErrors((current) => ({
      ...current,
      [field]: undefined,
      ...(field === "password" ? { passwordConfirmation: undefined } : {}),
    }));
    if (field === "userName") setUserName(value);
    if (field === "email") setEmail(value);
    if (field === "password") setPassword(value);
    if (field === "passwordConfirmation") setPasswordConfirmation(value);
  };

  const validate = () => {
    const next: FieldErrors = {};
    const normalizedName = userName.trim();
    const normalizedEmail = email.trim();
    if (!normalizedName) next.userName = "이름을 입력해 주세요.";
    else if (normalizedName.length < 2 || normalizedName.length > 100) next.userName = "이름은 2~100자로 입력해 주세요.";
    if (!normalizedEmail) next.email = "이메일을 입력해 주세요.";
    else if (!EMAIL_PATTERN.test(normalizedEmail)) next.email = "올바른 이메일 형식을 입력해 주세요.";
    if (!password) next.password = "비밀번호를 입력해 주세요.";
    else if (!isPasswordValid(password)) next.password = PASSWORD_POLICY_MESSAGE;
    if (!passwordConfirmation) next.passwordConfirmation = "비밀번호 확인을 입력해 주세요.";
    else if (password !== passwordConfirmation) next.passwordConfirmation = "비밀번호가 일치하지 않습니다.";
    return next;
  };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (submitting) return;
    const nextErrors = validate();
    if (Object.keys(nextErrors).length) {
      setErrors(nextErrors);
      setSubmitError("");
      return;
    }
    setErrors({});
    setSubmitError("");
    setSubmitting(true);
    try {
      await authApi.register(email.trim().toLowerCase(), userName.trim(), password, passwordConfirmation);
      router.push("/login?intent=general&registered=1");
    } catch (error) {
      if (error instanceof ApiError) {
        if (error.code === "USER_EMAIL_DUPLICATED") setErrors({ email: "이미 가입된 이메일입니다." });
        else if (error.code === "USER_PASSWORD_POLICY_VIOLATION") setErrors({ password: PASSWORD_POLICY_MESSAGE });
        else if (error.code === "COMMON_VALIDATION_ERROR") {
          const validationErrors = mapValidationErrors(error.details);
          if (Object.keys(validationErrors).length) setErrors(validationErrors);
          else setSubmitError("입력 내용을 확인해 주세요.");
        } else setSubmitError(REQUEST_ERROR_MESSAGE);
      } else setSubmitError(REQUEST_ERROR_MESSAGE);
    } finally {
      setSubmitting(false);
    }
  };

  return <form className={styles.form} onSubmit={submit} noValidate aria-busy={submitting}>
    <fieldset className={styles.signupFieldset} disabled={submitting}>
      <div className={styles.field}>
        <label htmlFor="signup-name">이름</label>
        <input id="signup-name" name="user_name" value={userName} onChange={(event) => updateField("userName", event.target.value)} autoComplete="name" minLength={2} maxLength={100} aria-invalid={Boolean(errors.userName)} aria-describedby="signup-name-error" required />
        <p id="signup-name-error" className={styles.fieldError} aria-live="polite">{errors.userName ?? " "}</p>
      </div>
      <div className={styles.field}>
        <label htmlFor="signup-email">이메일</label>
        <input id="signup-email" name="email" type="email" inputMode="email" value={email} onChange={(event) => updateField("email", event.target.value)} autoComplete="email" maxLength={254} aria-invalid={Boolean(errors.email)} aria-describedby="signup-email-error" required />
        <p id="signup-email-error" className={styles.fieldError} aria-live="polite">{errors.email ?? " "}</p>
      </div>
      <SignupPasswordField id="signup-password" label="비밀번호" value={password} onChange={(value) => updateField("password", value)} error={errors.password} hint="8~64자, 영문과 숫자를 포함해 주세요." disabled={submitting} />
      <SignupPasswordField id="signup-password-confirmation" label="비밀번호 확인" value={passwordConfirmation} onChange={(value) => updateField("passwordConfirmation", value)} error={errors.passwordConfirmation} hint={confirmationMatches ? "비밀번호가 일치합니다." : "비밀번호를 다시 입력해 주세요."} disabled={submitting} />
      <ul className={styles.passwordRules} aria-label="비밀번호 조건">
        <li className={passwordChecks.length ? styles.isValid : undefined}><span aria-hidden="true">{passwordChecks.length ? "✓" : "○"}</span>8~64자</li>
        <li className={passwordChecks.letter ? styles.isValid : undefined}><span aria-hidden="true">{passwordChecks.letter ? "✓" : "○"}</span>영문 포함</li>
        <li className={passwordChecks.number ? styles.isValid : undefined}><span aria-hidden="true">{passwordChecks.number ? "✓" : "○"}</span>숫자 포함</li>
        <li className={confirmationMatches ? styles.isValid : undefined}><span aria-hidden="true">{confirmationMatches ? "✓" : "○"}</span>비밀번호 확인 일치</li>
      </ul>
    </fieldset>
    <p className={styles.submitError} role="alert" aria-live="assertive">{submitError || " "}</p>
    <button className={styles.submit} type="submit" disabled={submitting} aria-busy={submitting}>
      {submitting && <span className={styles.submitSpinner} aria-hidden="true" />}
      <span>{submitting ? "가입 처리 중…" : "회원가입"}</span>
    </button>
    <aside className={styles.accountNotice}>
      <span aria-hidden="true">i</span>
      <div><strong>일반 서비스 계정이 생성됩니다</strong><p>관제·출동·관리자 등 운영 계정은<br />시스템 관리자가 별도로 발급합니다.</p></div>
    </aside>
    <p className={styles.loginLink}>이미 계정이 있나요? <Link href="/login?intent=general">로그인</Link></p>
  </form>;
}
