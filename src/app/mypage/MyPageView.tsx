"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { AccountMenu } from "@/components/auth/AccountMenu";
import type { AuthenticatedUser } from "@/components/auth/AuthContext";
import {
  buildProfileUpdate,
  formatKstDate,
  getAccountShortcuts,
  getAccountStatusLabel,
  getPermissionSummaries,
  getProfileErrorMessage,
  getRoleLabels,
  hasProfileChanges,
  validateProfile,
  type ProfileUpdate,
} from "./mypageUtils";
import styles from "./mypage.module.css";

type Props = {
  user: AuthenticatedUser;
  initialEditing?: boolean;
  onSave: (update: ProfileUpdate) => Promise<void>;
  isLoggingOut?: boolean;
  onLogout?: (trigger: HTMLElement) => void;
};

type SectionLink = { id: string; label: string };

export function MyPageView({ user, initialEditing = false, onSave, isLoggingOut = false, onLogout }: Props) {
  const savingRef = useRef(false);
  const nameInputRef = useRef<HTMLInputElement>(null);
  const errorRef = useRef<HTMLParagraphElement>(null);
  const [editing, setEditing] = useState(initialEditing);
  const [name, setName] = useState(user.name);
  const [phone, setPhone] = useState(user.phone ?? "");
  const [fieldError, setFieldError] = useState("");
  const [saveError, setSaveError] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [activeSection, setActiveSection] = useState("account-info");

  useEffect(() => {
    setName(user.name);
    setPhone(user.phone ?? "");
  }, [user]);

  useEffect(() => {
    if (editing) nameInputRef.current?.focus();
  }, [editing]);

  useEffect(() => {
    if (fieldError || saveError) errorRef.current?.focus();
  }, [fieldError, saveError]);

  const update = useMemo(() => buildProfileUpdate(user, name, phone), [name, phone, user]);
  const changed = hasProfileChanges(update);
  const roleLabels = getRoleLabels(user.roles);
  const operationalUser = user.roles.some(role => role !== "GENERAL_USER");
  const shortcuts = operationalUser ? getAccountShortcuts(user.apiPermissions) : [];
  const permissionSummaries = operationalUser ? getPermissionSummaries(user.apiPermissions) : [];
  const organization = user.organization?.name ?? "개인 계정";
  const status = getAccountStatusLabel(user.accountStatus);
  const lastLogin = formatKstDate(user.lastLoginAt, "로그인 기록 없음");
  const lastUpdated = formatKstDate(user.updatedAt, "기록 없음");
  const phoneLabel = user.phone || "등록된 전화번호 없음";
  const sectionLinks = useMemo<SectionLink[]>(() => {
    if (editing) return [{ id: "account-info", label: "정보 수정" }, { id: "security", label: "보안" }];
    if (!operationalUser) return [
      { id: "account-info", label: "계정 정보" },
      { id: "contact-info", label: "연락처" },
      { id: "security", label: "보안" },
    ];
    return [
      { id: "account-info", label: "계정 정보" },
      { id: "operation-info", label: "소속 및 권한" },
      ...(shortcuts.length ? [{ id: "work-shortcuts", label: "업무 바로가기" }] : []),
      { id: "security", label: "보안" },
    ];
  }, [editing, operationalUser, shortcuts.length]);

  useEffect(() => {
    const elements = sectionLinks
      .map(item => document.getElementById(item.id))
      .filter((element): element is HTMLElement => Boolean(element));
    if (!elements.length || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(
      entries => {
        const visible = entries
          .filter(entry => entry.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
        if (visible?.target.id) setActiveSection(visible.target.id);
      },
      { rootMargin: "-18% 0px -62% 0px", threshold: [0, 0.25, 0.6] },
    );
    elements.forEach(element => observer.observe(element));
    return () => observer.disconnect();
  }, [sectionLinks]);

  const startEditing = () => {
    setEditing(true);
    setSaved(false);
    setFieldError("");
    setSaveError("");
    setActiveSection("account-info");
  };

  const cancel = () => {
    setName(user.name);
    setPhone(user.phone ?? "");
    setFieldError("");
    setSaveError("");
    setEditing(false);
  };

  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    if (savingRef.current) return;
    const validationError = validateProfile(name, phone);
    setFieldError(validationError ?? "");
    if (validationError || !changed) return;
    savingRef.current = true;
    setSaving(true);
    setSaveError("");
    setSaved(false);
    try {
      await onSave(update);
      setSaved(true);
      setEditing(false);
    } catch (error) {
      setSaveError(getProfileErrorMessage(error, "정보를 저장하지 못했습니다. 입력 내용을 확인하고 다시 시도해 주세요."));
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  };

  return <div className={styles.page}>
    <main className={styles.shell}>
      <div className={styles.topbar}>
        <Link className={styles.brand} href="/" aria-label="도로보GO 홈">
          <Image src="/brand/roadbogo-logo-final.png" alt="도로보GO" width={160} height={45} priority />
        </Link>
        <span>마이</span>
        <AccountMenu compact />
      </div>

      <header className={styles.identityHeader}>
        <div className={styles.roadLines} aria-hidden="true" />
        <div className={styles.avatar} aria-hidden="true">{user.name.slice(0, 1)}</div>
        <div className={styles.identityCopy}>
          <p>ACCOUNT CENTER</p>
          <h1>{user.name}</h1>
          <span>{roleLabels[0]}</span>
        </div>
        <div className={styles.identityMeta}>
          <span className={styles.statusBadge}><i aria-hidden="true" />{status} 계정</span>
          <span>최근 로그인 <strong>{lastLogin}</strong></span>
        </div>
        {!editing && <button className={styles.primaryAction} type="button" onClick={startEditing}>정보 수정</button>}
      </header>

      <nav className={styles.mobileSectionNav} aria-label="마이페이지 섹션">
        {sectionLinks.map(item => <a
          key={item.id}
          href={`#${item.id}`}
          aria-current={activeSection === item.id ? "location" : undefined}
          onClick={() => setActiveSection(item.id)}
        >{item.label}</a>)}
      </nav>

      {saved && <p className={styles.successNotice} role="status" aria-live="polite">회원 정보가 안전하게 저장되었습니다.</p>}

      <div className={styles.content}>
        <section id="account-info" className={styles.section} aria-labelledby="account-info-title">
          <div className={styles.sectionHeading}>
            <div>
              <span>{editing ? "EDIT PROFILE" : "ACCOUNT"}</span>
              <h2 id="account-info-title">{editing ? "정보 수정" : "기본 계정 정보"}</h2>
              <p>{editing ? "사용자명과 전화번호를 변경할 수 있습니다." : "서비스 이용에 사용되는 기본 계정 정보입니다."}</p>
            </div>
            {!editing && <button className={styles.sectionAction} type="button" onClick={startEditing}>정보 수정</button>}
          </div>

          {editing ? <form className={styles.editForm} onSubmit={save} noValidate>
            <div className={styles.editFields}>
              <label htmlFor="profile-name-input">
                사용자명
                <input
                  ref={nameInputRef}
                  id="profile-name-input"
                  value={name}
                  onChange={event => setName(event.target.value)}
                  minLength={2}
                  maxLength={100}
                  autoComplete="name"
                  aria-invalid={Boolean(fieldError)}
                  aria-describedby={fieldError || saveError ? "profile-form-error" : undefined}
                />
              </label>
              <label htmlFor="profile-phone">
                전화번호
                <input
                  id="profile-phone"
                  type="tel"
                  value={phone}
                  onChange={event => setPhone(event.target.value)}
                  placeholder="010-1234-5678 또는 +82 형식"
                  inputMode="tel"
                  autoComplete="tel"
                  aria-invalid={Boolean(fieldError)}
                  aria-describedby={fieldError || saveError ? "profile-form-error" : undefined}
                />
              </label>
            </div>
            <div className={styles.readOnlySummary} aria-label="수정할 수 없는 계정 정보">
              <div><span>이메일</span><strong>{user.email}</strong></div>
              <div><span>계정 유형</span><strong>{roleLabels.join(", ")}</strong></div>
              <div><span>소속</span><strong>{organization}</strong></div>
            </div>
            <p
              ref={errorRef}
              id="profile-form-error"
              className={styles.formError}
              role={fieldError || saveError ? "alert" : undefined}
              aria-live="assertive"
              tabIndex={fieldError || saveError ? -1 : undefined}
            >{fieldError || saveError || " "}</p>
            <div className={styles.formActions}>
              <button type="button" onClick={cancel} disabled={saving}>취소</button>
              <button type="submit" disabled={!changed || saving} aria-busy={saving}>
                {saving ? "저장 중…" : "변경사항 저장"}
              </button>
            </div>
          </form> : <dl className={styles.infoRows}>
            <div><dt>이메일</dt><dd>{user.email}</dd></div>
            <div><dt>사용자명</dt><dd>{user.name}</dd></div>
            {operationalUser && <div><dt>전화번호</dt><dd>{phoneLabel}</dd></div>}
          </dl>}
        </section>

        {!editing && !operationalUser && <section id="contact-info" className={styles.section} aria-labelledby="contact-title">
          <div className={styles.sectionHeading}>
            <div><span>CONTACT</span><h2 id="contact-title">연락처 정보</h2><p>계정 알림과 연락에 사용하는 정보입니다.</p></div>
          </div>
          <dl className={styles.infoRows}><div><dt>전화번호</dt><dd>{phoneLabel}</dd></div></dl>
        </section>}

        {!editing && operationalUser && <section id="operation-info" className={`${styles.section} ${styles.operationSection}`} aria-labelledby="operation-title">
          <div className={styles.sectionHeading}>
            <div><span>OPERATION ACCESS</span><h2 id="operation-title">소속 및 역할</h2><p>현재 계정에 실제로 부여된 운영 정보와 권한입니다.</p></div>
          </div>
          <dl className={styles.operationInfo}>
            <div><dt>소속 기관</dt><dd>{organization}</dd></div>
            <div><dt>전체 역할</dt><dd className={styles.roleWrap}>{roleLabels.map(label => <span key={label}>{label}</span>)}</dd></div>
          </dl>
          <div className={styles.permissionSummary} aria-labelledby="permission-summary-title">
            <h3 id="permission-summary-title">부여된 권한</h3>
            {permissionSummaries.length ? <ul>
              {permissionSummaries.map(summary => <li key={summary.label}><strong>{summary.label}</strong><span>{summary.description}</span></li>)}
            </ul> : <p>표시할 수 있는 운영 권한이 없습니다.</p>}
          </div>
          {user.apiPermissions.length > 0 && <details className={styles.permissionDetails}>
            <summary>권한 코드 상세 보기</summary>
            <p id="permission-code-description">시스템에서 사용하는 원본 권한 코드입니다.</p>
            <ul aria-describedby="permission-code-description">{user.apiPermissions.map(permission => <li key={permission}>{permission}</li>)}</ul>
          </details>}
        </section>}

        {!editing && operationalUser && shortcuts.length > 0 && <section id="work-shortcuts" className={`${styles.section} ${styles.shortcutSection}`} aria-labelledby="shortcut-title">
          <div className={styles.sectionHeading}>
            <div><span>QUICK ACCESS</span><h2 id="shortcut-title">업무 바로가기</h2><p>현재 권한으로 이용할 수 있는 화면만 표시합니다.</p></div>
          </div>
          <div className={styles.shortcutGrid}>
            {shortcuts.map(item => <Link key={`${item.href}-${item.label}`} href={item.href}>
              <span><strong>{item.label}</strong><small>{item.description}</small></span><b aria-hidden="true">→</b>
            </Link>)}
          </div>
        </section>}

        <section id="security" className={`${styles.section} ${styles.securitySection}`} aria-labelledby="security-title">
          <div className={styles.sectionHeading}>
            <div><span>SECURITY</span><h2 id="security-title">로그인 및 보안</h2><p>현재 계정의 접속 기록과 상태를 확인합니다.</p></div>
          </div>
          <dl className={styles.securityInfo}>
            <div><dt>계정 상태</dt><dd><span className={styles.inlineStatus}><i aria-hidden="true" />{status}</span></dd></div>
            <div><dt>최근 로그인</dt><dd>{lastLogin}</dd></div>
            <div><dt>마지막 정보 수정</dt><dd>{lastUpdated}</dd></div>
          </dl>
          <div className={styles.securityActions}>
            <button type="button" disabled={isLoggingOut} aria-busy={isLoggingOut} onClick={event => onLogout?.(event.currentTarget)}>
              {isLoggingOut ? "로그아웃 중…" : "로그아웃"}
            </button>
          </div>
        </section>
      </div>
    </main>
  </div>;
}
