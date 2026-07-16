"use client";

import { KeyboardEvent, useEffect, useId, useMemo, useRef, useState } from "react";
import {
  getOrganizationSuggestionsByEmail,
  organizations,
  organizationTypeOptions,
  regionOptions,
  type Organization,
  type OrganizationSelection,
  type OrganizationType,
} from "@/data/organizations";
import styles from "@/app/signup/signup.module.css";

type Props = {
  value: OrganizationSelection;
  onChange: (value: OrganizationSelection) => void;
  email: string;
  error?: string;
  onClearError: () => void;
  required: boolean;
};

const emptyNewRequest: OrganizationSelection = {
  mode: "new_request",
  organizationId: null,
  organizationName: "",
  organizationType: undefined,
  organizationRegion: "",
  organizationContact: "",
};

export function OrganizationSelector({ value, onChange, email, error, onClearError, required }: Props) {
  const inputId = useId();
  const listboxId = useId();
  const helperId = useId();
  const errorId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const [newDraft, setNewDraft] = useState<OrganizationSelection>(emptyNewRequest);

  const results = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase("ko");
    if (!normalized) return organizations;
    return organizations.filter((item) => `${item.name} ${item.typeLabel} ${item.region}`.toLocaleLowerCase("ko").includes(normalized));
  }, [query]);
  const suggestions = useMemo(() => getOrganizationSuggestionsByEmail(email, organizations), [email]);
  const selected = value.mode === "registered" ? organizations.find((item) => item.id === value.organizationId) : undefined;

  useEffect(() => {
    const closeOnOutside = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const closeOnEscape = (event: globalThis.KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", closeOnOutside);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("mousedown", closeOnOutside);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, []);

  useEffect(() => setActiveIndex(0), [query]);

  const selectOrganization = (organization: Organization) => {
    onChange({ mode: "registered", organizationId: organization.id, organizationName: organization.name });
    onClearError();
    setQuery("");
    setOpen(false);
  };

  const startNewRequest = () => {
    const next = { ...newDraft, organizationName: newDraft.organizationName || query.trim() };
    setNewDraft(next);
    onChange(next);
    onClearError();
    setOpen(false);
  };

  const updateNew = (field: "organizationName" | "organizationType" | "organizationRegion" | "organizationContact", nextValue: string) => {
    const next = { ...value, mode: "new_request" as const, organizationId: null, [field]: nextValue };
    setNewDraft(next);
    onChange(next);
    onClearError();
  };

  const handleKeys = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Escape") { setOpen(false); return; }
    if (event.key === "ArrowDown") { event.preventDefault(); setOpen(true); setActiveIndex((index) => Math.min(index + 1, Math.max(results.length - 1, 0))); }
    if (event.key === "ArrowUp") { event.preventDefault(); setActiveIndex((index) => Math.max(index - 1, 0)); }
    if (event.key === "Enter" && open && results[activeIndex]) { event.preventDefault(); selectOrganization(results[activeIndex]); }
  };

  if (value.mode === "new_request") {
    return (
      <fieldset className={styles.newOrganization}>
        <legend>신규 기관 등록 요청</legend>
        <p>목록에 없는 기관은 가입 신청과 함께 관리자 검토를 거칩니다. 기관 확인 후 계정 개설 여부를 안내해 드립니다.</p>
        <div className={styles.newOrganizationGrid}>
          <label><span>기관 정식 명칭</span><input value={value.organizationName} minLength={2} maxLength={100} onChange={(event) => updateNew("organizationName", event.target.value)} required /></label>
          <label><span>기관 유형</span><select value={value.organizationType ?? ""} onChange={(event) => updateNew("organizationType", event.target.value as OrganizationType)} required><option value="">기관 유형 선택</option>{organizationTypeOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
          <label><span>지역</span><select value={value.organizationRegion ?? ""} onChange={(event) => updateNew("organizationRegion", event.target.value)} required><option value="">시·도 선택</option>{regionOptions.map((region) => <option key={region}>{region}</option>)}</select></label>
          <label><span>홈페이지 또는 대표 연락처 <small>선택</small></span><input value={value.organizationContact ?? ""} maxLength={150} onChange={(event) => updateNew("organizationContact", event.target.value)} /></label>
        </div>
        {error && <p className={styles.organizationError} aria-live="polite">{error}</p>}
        <button className={styles.organizationModeLink} type="button" onClick={() => { setNewDraft(value); onChange({ mode: "registered", organizationId: null, organizationName: "" }); onClearError(); }}>← 등록된 기관에서 다시 검색</button>
      </fieldset>
    );
  }

  if (selected) {
    return (
      <div className={styles.selectedOrganizationField}>
        <p>소속 기관 <small>{required ? "필수" : "선택"}</small></p>
        <div className={styles.selectedOrganization}>
          <span className={styles.selectedCheck} aria-hidden="true">✓</span>
          <div><strong>{selected.name}</strong><small>{selected.typeLabel} · {selected.region}</small></div>
          <button type="button" onClick={() => onChange({ mode: "registered", organizationId: null, organizationName: "" })}>기관 변경</button>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.organizationSelector} ref={rootRef}>
      <label htmlFor={inputId}>소속 기관 <small>{required ? "필수" : "선택"}</small></label>
      <span className={styles.organizationSearchIcon} aria-hidden="true"><svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="6"/><path d="m16 16 4 4"/></svg></span>
      <input id={inputId} value={query} placeholder="기관명 검색" autoComplete="off" role="combobox" aria-autocomplete="list" aria-expanded={open} aria-controls={listboxId} aria-activedescendant={open && results[activeIndex] ? `${listboxId}-${results[activeIndex].id}` : undefined} aria-invalid={Boolean(error)} aria-required={required} aria-describedby={`${helperId}${error ? ` ${errorId}` : ""}`} onFocus={() => setOpen(true)} onClick={() => setOpen(true)} onChange={(event) => { setQuery(event.target.value); setOpen(true); onClearError(); }} onKeyDown={handleKeys} />
      <p id={helperId} className={styles.organizationHelper}>{required ? "등록된 기관을 선택하거나 신규 기관 등록을 요청해주세요." : "기관에 소속되지 않은 경우 입력하지 않아도 됩니다."}</p>
      {open && <div className={styles.organizationPopover}>
        <div className={styles.mobilePopoverHeader}><strong>소속 기관 선택</strong><button type="button" aria-label="기관 선택 닫기" onClick={() => setOpen(false)}>×</button></div>
        <div id={listboxId} role="listbox" className={styles.organizationResults}>
          {results.map((item, index) => <button id={`${listboxId}-${item.id}`} key={item.id} type="button" role="option" aria-selected={false} className={index === activeIndex ? styles.organizationOptionActive : ""} onMouseEnter={() => setActiveIndex(index)} onClick={() => selectOrganization(item)}><span><strong>{item.name}</strong><small>{item.typeLabel} · {item.region}</small></span><i aria-hidden="true">✓</i></button>)}
          {results.length === 0 && <div className={styles.noOrganization}><strong>검색 결과가 없습니다.</strong><span>기관명을 다시 확인하거나 신규 기관 등록을 요청해주세요.</span></div>}
        </div>
        <button className={styles.newOrganizationButton} type="button" onClick={startNewRequest}>{query.trim() ? `“${query.trim()}” 신규 기관 등록 요청` : "+ 신규 기관 등록 요청"}</button>
      </div>}
      {!open && suggestions.length > 0 && <aside className={styles.organizationSuggestions}><p>입력한 업무 이메일과 관련된 기관인가요?</p>{suggestions.map((item) => <button key={item.id} type="button" onClick={() => selectOrganization(item)}><span><strong>{item.name}</strong><small>{item.typeLabel} · {item.region}</small></span><b>이 기관 선택</b></button>)}</aside>}
      {error && <p id={errorId} className={styles.organizationError} aria-live="polite">{error}</p>}
    </div>
  );
}
