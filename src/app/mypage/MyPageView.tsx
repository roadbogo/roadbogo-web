"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { AuthenticatedUser } from "@/components/auth/AuthContext";
import { LandingHeader } from "@/components/landing/LandingHeader";
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

type AccountTab = "profile" | "security";

function UserIcon() {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="8" r="4" /><path d="M4.5 21a7.5 7.5 0 0 1 15 0" /></svg>;
}

function MailIcon() {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="2" /><path d="m4 7 8 6 8-6" /></svg>;
}

function PhoneIcon() {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 3h3l1.5 4-2 1.5a15 15 0 0 0 6 6L17 12.5l4 1.5v3c0 2-1.5 4-4 4C9.3 21 3 14.7 3 7c0-2.5 2-4 4-4Z" /></svg>;
}

function BuildingIcon() {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 21V7l8-4 8 4v14M8 10h1M8 14h1M8 18h1M15 10h1M15 14h1M15 18h1M2 21h20" /></svg>;
}

function ShieldIcon() {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3 5 6v5c0 4.7 2.9 8.2 7 10 4.1-1.8 7-5.3 7-10V6Z" /><path d="m9 12 2 2 4-4" /></svg>;
}

export function MyPageView({ user, initialEditing = false, onSave, isLoggingOut = false, onLogout }: Props) {
  const router = useRouter();
  const savingRef = useRef(false);
  const editTriggerRef = useRef<HTMLButtonElement>(null);
  const drawerRef = useRef<HTMLElement>(null);
  const nameInputRef = useRef<HTMLInputElement>(null);
  const errorRef = useRef<HTMLParagraphElement>(null);
  const [editing, setEditing] = useState(initialEditing);
  const [name, setName] = useState(user.name);
  const [phone, setPhone] = useState(user.phone ?? "");
  const [fieldError, setFieldError] = useState("");
  const [saveError, setSaveError] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [activeTab, setActiveTab] = useState<AccountTab>("profile");

  useEffect(() => {
    setName(user.name);
    setPhone(user.phone ?? "");
  }, [user]);

  const cancel = useCallback(() => {
    setName(user.name);
    setPhone(user.phone ?? "");
    setFieldError("");
    setSaveError("");
    setEditing(false);
    if (initialEditing) router.replace("/mypage");
    window.requestAnimationFrame(() => editTriggerRef.current?.focus());
  }, [initialEditing, router, user]);

  useEffect(() => {
    if (!editing) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.requestAnimationFrame(() => nameInputRef.current?.focus());
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !saving) cancel();
      if (event.key !== "Tab" || !drawerRef.current) return;
      const focusable = drawerRef.current.querySelectorAll<HTMLElement>(
        'button:not([disabled]), input:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])',
      );
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", handleKey);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", handleKey);
    };
  }, [cancel, editing, saving]);

  useEffect(() => {
    if (fieldError || saveError) errorRef.current?.focus();
  }, [fieldError, saveError]);

  const update = useMemo(() => buildProfileUpdate(user, name, phone), [name, phone, user]);
  const changed = hasProfileChanges(update);
  const roleLabels = getRoleLabels(user.roles);
  const operationalUser = user.roles.some(role => role !== "GENERAL_USER");
  const shortcuts = operationalUser ? getAccountShortcuts(user.apiPermissions) : [];
  const permissionSummaries = operationalUser ? getPermissionSummaries(user.apiPermissions) : [];
  const organization = user.organization?.name ?? "";
  const status = getAccountStatusLabel(user.accountStatus);
  const lastLogin = formatKstDate(user.lastLoginAt, "로그인 기록 없음");
  const lastUpdated = formatKstDate(user.updatedAt, "기록 없음");
  const phoneLabel = user.phone || "미등록";

  const startEditing = () => {
    setEditing(true);
    setSaved(false);
    setFieldError("");
    setSaveError("");
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
      if (initialEditing) router.replace("/mypage");
      window.requestAnimationFrame(() => editTriggerRef.current?.focus());
    } catch (error) {
      setSaveError(getProfileErrorMessage(error, "정보를 저장하지 못했습니다. 입력 내용을 확인하고 다시 시도해 주세요."));
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  };

  const selectTab = (tab: AccountTab) => setActiveTab(tab);
  const handleTabKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>) => {
    if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
    event.preventDefault();
    const next = event.key === "ArrowLeft" || event.key === "End" ? "security" : "profile";
    setActiveTab(next);
    document.getElementById(`mypage-tab-${next}`)?.focus();
  };

  return <div className={styles.page}>
    <LandingHeader showSections={false} />
    <main className={styles.workspace}>
      <header className={styles.pageHeading}>
        <div>
          <nav aria-label="현재 위치"><Link href="/">홈</Link><span aria-hidden="true">/</span><span>내 계정</span></nav>
          <p>ACCOUNT WORKSPACE</p>
          <h1>내 계정</h1>
          <span>계정 정보와 서비스 이용 상태를 한곳에서 관리합니다.</span>
        </div>
        <button ref={editTriggerRef} className={styles.primaryAction} type="button" onClick={startEditing}>내 정보 수정</button>
      </header>

      {saved && <p className={styles.toast} role="status" aria-live="polite">회원 정보가 안전하게 저장되었습니다.</p>}

      <section className={styles.accountSummary} aria-labelledby="account-summary-title">
        <div className={styles.profileIdentity}>
          <span className={styles.avatar}><UserIcon /></span>
          <div>
            <span className={styles.statusBadge}><i aria-hidden="true" />{status}</span>
            <h2 id="account-summary-title">{user.name}</h2>
            <p>{operationalUser ? roleLabels.join(" · ") : "일반 사용자"}</p>
          </div>
        </div>
        <dl className={styles.summaryGrid}>
          <div><dt>계정 유형</dt><dd>{operationalUser ? "운영 계정" : "일반 계정"}</dd></div>
          <div><dt>대표 역할</dt><dd>{roleLabels[0]}</dd></div>
          <div><dt>최근 로그인</dt><dd>{lastLogin}</dd></div>
        </dl>
      </section>

      <div className={styles.tabs} role="tablist" aria-label="계정 정보">
        <button id="mypage-tab-profile" role="tab" type="button" aria-selected={activeTab === "profile"} aria-controls="mypage-panel-profile" tabIndex={activeTab === "profile" ? 0 : -1} onClick={() => selectTab("profile")} onKeyDown={handleTabKeyDown}>프로필 정보</button>
        <button id="mypage-tab-security" role="tab" type="button" aria-selected={activeTab === "security"} aria-controls="mypage-panel-security" tabIndex={activeTab === "security" ? 0 : -1} onClick={() => selectTab("security")} onKeyDown={handleTabKeyDown}>보안 및 활동</button>
      </div>

      {activeTab === "profile" ? <section id="mypage-panel-profile" role="tabpanel" aria-labelledby="mypage-tab-profile" className={styles.tabPanel}>
        <div className={styles.panelHeading}><div><p>PROFILE</p><h2>프로필 정보</h2><span>서비스에서 사용하는 계정 정보입니다.</span></div></div>
        <dl className={styles.settingsList}>
          <div><dt><span><MailIcon /></span><b>이메일</b></dt><dd>{user.email}</dd></div>
          <div><dt><span><UserIcon /></span><b>사용자명</b></dt><dd>{user.name}</dd></div>
          <div><dt><span><PhoneIcon /></span><b>전화번호</b></dt><dd>{phoneLabel}{!user.phone && <button type="button" onClick={startEditing}>등록하기</button>}</dd></div>
          {operationalUser && <div><dt><span><BuildingIcon /></span><b>소속 기관</b></dt><dd>{organization || "기관 정보 없음"}</dd></div>}
          <div><dt><span><ShieldIcon /></span><b>역할</b></dt><dd>{roleLabels.join(", ")}</dd></div>
        </dl>

        {operationalUser && <div className={styles.operationArea}>
          <div className={styles.operationColumn}>
            <h3>부여된 권한</h3>
            {permissionSummaries.length ? <ul className={styles.permissionList}>{permissionSummaries.map(item => <li key={item.label}><strong>{item.label}</strong><span>{item.description}</span></li>)}</ul> : <p>표시할 수 있는 권한이 없습니다.</p>}
          </div>
          {shortcuts.length > 0 && <div className={styles.operationColumn}>
            <h3>업무 바로가기</h3>
            <div className={styles.shortcutList}>{shortcuts.map(item => <Link key={`${item.href}-${item.label}`} href={item.href}><span><strong>{item.label}</strong><small>{item.description}</small></span><b aria-hidden="true">→</b></Link>)}</div>
          </div>}
        </div>}
      </section> : <section id="mypage-panel-security" role="tabpanel" aria-labelledby="mypage-tab-security" className={styles.tabPanel}>
        <div className={styles.panelHeading}><div><p>SECURITY</p><h2>보안 및 활동</h2><span>현재 계정의 상태와 최근 활동을 확인합니다.</span></div></div>
        <dl className={styles.activityList}>
          <div><dt>계정 상태</dt><dd><span className={styles.inlineStatus}><i aria-hidden="true" />{status}</span></dd></div>
          <div><dt>최근 로그인</dt><dd>{lastLogin}</dd></div>
          <div><dt>마지막 정보 수정</dt><dd>{lastUpdated}</dd></div>
        </dl>
        <div className={styles.logoutArea}><div><strong>현재 계정에서 로그아웃</strong><span>이 브라우저의 인증 세션을 안전하게 종료합니다.</span></div><button type="button" disabled={isLoggingOut} aria-busy={isLoggingOut} onClick={event => onLogout?.(event.currentTarget)}>{isLoggingOut ? "로그아웃 중…" : "로그아웃"}</button></div>
      </section>}
    </main>

    {editing && <>
      <button type="button" className={styles.drawerBackdrop} aria-label="정보 수정 닫기" onClick={cancel} />
      <aside ref={drawerRef} className={styles.drawer} role="dialog" aria-modal="true" aria-labelledby="profile-drawer-title">
        <header><div><p>EDIT PROFILE</p><h2 id="profile-drawer-title">내 정보 수정</h2><span>사용자명과 전화번호만 변경할 수 있습니다.</span></div><button type="button" onClick={cancel} aria-label="닫기">×</button></header>
        <form className={styles.editForm} onSubmit={save} noValidate>
          <div className={styles.editFields}>
            <label htmlFor="profile-name-input">사용자명<input ref={nameInputRef} id="profile-name-input" value={name} onChange={event => setName(event.target.value)} minLength={2} maxLength={100} autoComplete="name" aria-invalid={Boolean(fieldError)} aria-describedby={fieldError || saveError ? "profile-form-error" : undefined} /></label>
            <label htmlFor="profile-phone">전화번호<input id="profile-phone" type="tel" value={phone} onChange={event => setPhone(event.target.value)} placeholder="010-1234-5678 또는 +82 형식" inputMode="tel" autoComplete="tel" aria-invalid={Boolean(fieldError)} aria-describedby={fieldError || saveError ? "profile-form-error" : undefined} /><small>비워 두고 저장하면 등록된 전화번호가 삭제됩니다.</small></label>
          </div>
          <div className={styles.readOnlySummary} aria-label="읽기 전용 계정 정보"><div><span>이메일</span><strong>{user.email}</strong></div><div><span>계정 유형</span><strong>{operationalUser ? "운영 계정" : "일반 계정"}</strong></div>{operationalUser && <div><span>소속</span><strong>{organization || "기관 정보 없음"}</strong></div>}</div>
          <p ref={errorRef} id="profile-form-error" className={styles.formError} role={fieldError || saveError ? "alert" : undefined} aria-live="assertive" tabIndex={fieldError || saveError ? -1 : undefined}>{fieldError || saveError || " "}</p>
          <div className={styles.formActions}><button type="button" onClick={cancel} disabled={saving}>취소</button><button type="submit" disabled={!changed || saving} aria-busy={saving}>{saving ? "저장 중…" : "변경사항 저장"}</button></div>
        </form>
      </aside>
    </>}
  </div>;
}
