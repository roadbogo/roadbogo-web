"use client";

import { useRef, useState } from "react";
import { AgreementField } from "./AgreementField";
import { AccessRequestError, requestRoadbogoAccess } from "@/lib/auth/requestAccess";
import type { AccessRequestPayload, AccessRequestPurpose, AccessRequestResult } from "@/types/accessRequest";
import styles from "@/app/access-request/access-request.module.css";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const purposes: Array<{ code: AccessRequestPurpose; title: string; description: string }> = [
  { code: "GENERAL_SERVICE", title: "도로 안전 정보 및 서비스 이용", description: "일반적인 서비스 이용을 신청합니다." },
  { code: "CONTROL_WORK", title: "관제 업무용 계정 발급 문의", description: "관제센터 또는 관제 업무와 관련된 이용을 문의합니다." },
  { code: "FIELD_RESPONSE", title: "현장 대응 업무용 계정 발급 문의", description: "출동 및 현장 대응 업무와 관련된 이용을 문의합니다." },
  { code: "ORGANIZATION_PARTNERSHIP", title: "기관·기업 협력 문의", description: "기관 또는 기업 단위의 서비스 연계를 문의합니다." },
  { code: "OTHER", title: "기타", description: "위 항목에 해당하지 않는 이용 목적입니다." },
];

type Values = { name: string; email: string; phone: string; organization: string; purpose: AccessRequestPurpose | ""; message: string; terms: boolean; privacy: boolean };
type Errors = Partial<Record<"name" | "email" | "phone" | "purpose" | "message" | "agreements", string>>;
const initialValues: Values = { name: "", email: "", phone: "", organization: "", purpose: "", message: "", terms: false, privacy: false };

function formatPhone(value: string) {
  const digits = value.replace(/\D/g, "").slice(0, 11);
  if (digits.length <= 3) return digits;
  if (digits.length <= 7) return `${digits.slice(0, 3)}-${digits.slice(3)}`;
  return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7)}`;
}

export function AccessRequestForm({ onSuccess }: { onSuccess: (result: AccessRequestResult, applicantName: string, email: string) => void }) {
  const [values, setValues] = useState(initialValues);
  const [errors, setErrors] = useState<Errors>({});
  const [submitError, setSubmitError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);

  const update = <K extends keyof Values>(key: K, value: Values[K]) => {
    setValues((current) => ({ ...current, [key]: value }));
    setErrors((current) => ({ ...current, [key]: undefined, ...(key === "terms" || key === "privacy" ? { agreements: undefined } : {}) }));
  };

  const validate = () => {
    const next: Errors = {};
    const name = values.name.trim();
    if (!name) next.name = "이름을 입력해 주세요.";
    else if (name.length < 2 || name.length > 50) next.name = "이름은 2자 이상 50자 이하로 입력해 주세요.";
    const email = values.email.trim();
    if (!EMAIL_PATTERN.test(email)) next.email = "올바른 이메일 주소를 입력해 주세요.";
    if (!values.phone) next.phone = "연락처를 입력해 주세요.";
    else if (!/^010-\d{4}-\d{4}$/.test(values.phone)) next.phone = "연락처를 010-0000-0000 형식으로 입력해 주세요.";
    if (!values.purpose) next.purpose = "이용 목적을 선택해 주세요.";
    if (values.message.length > 500) next.message = "추가 요청사항은 500자 이하로 입력해 주세요.";
    if (!values.terms || !values.privacy) next.agreements = "필수 약관에 동의해 주세요.";
    return next;
  };

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (submitting) return;
    const nextErrors = validate();
    if (Object.keys(nextErrors).length) {
      setErrors(nextErrors);
      requestAnimationFrame(() => formRef.current?.querySelector<HTMLElement>("[aria-invalid='true']")?.focus());
      return;
    }
    setErrors({}); setSubmitError(""); setSubmitting(true);
    const payload: AccessRequestPayload = {
      applicant_name: values.name.trim(),
      email: values.email.trim().toLowerCase(),
      phone: values.phone,
      purpose: values.purpose as AccessRequestPurpose,
      terms_agreed: true,
      privacy_agreed: true,
      ...(values.organization.trim() ? { organization_name: values.organization.trim() } : {}),
      ...(values.message.trim() ? { additional_message: values.message.trim() } : {}),
    };
    try {
      const result = await requestRoadbogoAccess(payload);
      onSuccess(result, payload.applicant_name, payload.email);
    } catch (error) {
      setSubmitError(error instanceof AccessRequestError && error.code === "DUPLICATE" ? "이미 접수된 이용 신청이 있습니다." : "이용 신청을 접수하지 못했습니다. 잠시 후 다시 시도해 주세요.");
      setSubmitting(false);
    }
  };

  const disabled = submitting;
  return <form ref={formRef} className={styles.form} onSubmit={submit} noValidate aria-busy={submitting}>
    <div className={styles.twoColumns}>
      <div className={styles.field}><label htmlFor="request-name">이름 <b>*</b></label><input id="request-name" value={values.name} disabled={disabled} maxLength={50} autoComplete="name" aria-required="true" aria-invalid={Boolean(errors.name)} aria-describedby="request-name-error" onChange={(e) => update("name", e.target.value)} /><p id="request-name-error">{errors.name ?? " "}</p></div>
      <div className={styles.field}><label htmlFor="request-phone">연락처 <b>*</b></label><input id="request-phone" value={values.phone} disabled={disabled} inputMode="numeric" maxLength={13} autoComplete="tel" placeholder="010-0000-0000" aria-required="true" aria-invalid={Boolean(errors.phone)} aria-describedby="request-phone-error" onChange={(e) => update("phone", formatPhone(e.target.value))} /><p id="request-phone-error">{errors.phone ?? " "}</p></div>
    </div>
    <div className={styles.field}><label htmlFor="request-email">이메일 <b>*</b></label><input id="request-email" type="email" value={values.email} disabled={disabled} autoComplete="email" inputMode="email" aria-required="true" aria-invalid={Boolean(errors.email)} aria-describedby="request-email-error" onChange={(e) => update("email", e.target.value)} /><p id="request-email-error">{errors.email ?? " "}</p></div>
    <div className={styles.field}><label htmlFor="request-organization">소속 기관 또는 회사</label><input id="request-organization" value={values.organization} disabled={disabled} maxLength={100} autoComplete="organization" onChange={(e) => update("organization", e.target.value)} /><p> </p></div>
    <fieldset className={styles.purposeFieldset} tabIndex={-1} aria-invalid={Boolean(errors.purpose)} aria-describedby="request-purpose-guide request-purpose-error"><legend>이용 목적 <b>*</b></legend><p id="request-purpose-guide">선택한 이용 목적은 계정 권한을 자동으로 부여하지 않으며, 관리자 검토를 위한 참고 정보로 사용됩니다.</p><div className={styles.purposeGrid}>{purposes.map((purpose) => <label key={purpose.code} className={values.purpose === purpose.code ? styles.selectedPurpose : ""}><input type="radio" name="purpose" value={purpose.code} checked={values.purpose === purpose.code} disabled={disabled} onChange={() => update("purpose", purpose.code)} /><span><strong>{purpose.title}</strong><small>{purpose.description}</small></span></label>)}</div><p id="request-purpose-error" className={styles.fieldError}>{errors.purpose ?? " "}</p></fieldset>
    <div className={styles.field}><label htmlFor="request-message">추가 요청사항</label><textarea id="request-message" value={values.message} disabled={disabled} maxLength={500} rows={4} aria-invalid={Boolean(errors.message)} aria-describedby="request-message-error request-message-count" onChange={(e) => update("message", e.target.value)} /><div className={styles.textareaMeta}><p id="request-message-error">{errors.message ?? " "}</p><span id="request-message-count">{values.message.length}/500</span></div></div>
    <section className={styles.agreements} aria-labelledby="agreements-title"><h2 id="agreements-title">필수 동의</h2><AgreementField id="terms-agreed" checked={values.terms} disabled={disabled} label="서비스 이용약관에 동의합니다." title="서비스 이용약관" onChange={(checked) => update("terms", checked)} /><AgreementField id="privacy-agreed" checked={values.privacy} disabled={disabled} label="개인정보 수집 및 이용에 동의합니다." title="개인정보 수집 및 이용 안내" onChange={(checked) => update("privacy", checked)} /><p className={styles.fieldError}>{errors.agreements ?? " "}</p></section>
    <p className={styles.submitError} role="alert" aria-live="polite">{submitError || " "}</p>
    <button className={styles.submitButton} type="submit" disabled={submitting || !values.terms || !values.privacy}>{submitting && <span className={styles.spinner} aria-hidden="true" />}<span>{submitting ? "접수 중…" : "이용 신청하기"}</span></button>
  </form>;
}
