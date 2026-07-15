"use client";

import { useEffect, useRef, useState } from "react";
import styles from "@/app/access-request/access-request.module.css";

type AgreementFieldProps = {
  id: string;
  checked: boolean;
  disabled: boolean;
  label: string;
  title: string;
  onChange: (checked: boolean) => void;
};

export function AgreementField({ id, checked, disabled, label, title, onChange }: AgreementFieldProps) {
  const [open, setOpen] = useState(false);
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeButtonRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => event.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return <>
    <div className={styles.agreementRow}>
      <label htmlFor={id}>
        <input id={id} type="checkbox" checked={checked} disabled={disabled} onChange={(event) => onChange(event.target.checked)} />
        <span>{label}</span>
      </label>
      <button type="button" disabled={disabled} onClick={() => setOpen(true)}>내용 보기</button>
    </div>
    {open && <div className={styles.modalBackdrop} role="presentation" onMouseDown={(event) => event.target === event.currentTarget && setOpen(false)}>
      <section className={styles.termsModal} role="dialog" aria-modal="true" aria-labelledby={`${id}-modal-title`}>
        <header><h2 id={`${id}-modal-title`}>{title}</h2><button ref={closeButtonRef} type="button" aria-label="약관 닫기" onClick={() => setOpen(false)}>×</button></header>
        {/* 실제 서비스 적용 전 법률 검토를 거쳐 확정 문구로 교체해야 하는 임시 안내입니다. */}
        <div><p>본 내용은 이용 신청 화면 구성을 위한 임시 안내입니다.</p><p>신청 정보는 도로보GO 이용 가능 여부 확인과 관리자 검토를 위해 사용되며, 실제 보관 기간과 처리 기준은 정식 정책 확정 후 반영됩니다.</p></div>
        <button className={styles.modalClose} type="button" onClick={() => setOpen(false)}>확인</button>
      </section>
    </div>}
  </>;
}
