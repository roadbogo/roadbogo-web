"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { AuthenticatedUser } from "@/components/auth/AuthContext";
import { UserAvatar } from "@/components/auth/UserAvatar";
import { LandingHeader } from "@/components/landing/LandingHeader";
import {
  buildProfileUpdate,
  formatKstDate,
  getAccountShortcuts,
  getAccountStatusLabel,
  getNextAccountTab,
  getPermissionGroups,
  getProfileErrorMessage,
  getRoleDisplay,
  isOperationalAccount,
  hasProfileChanges,
  validateProfile,
  type AccountTab,
  type ProfileFieldErrors,
  type ProfileUpdate,
} from "./mypageUtils";
import styles from "./mypage.module.css";
import { canAccessControl } from "@/lib/auth/controlAccess";

type Props = {
  user: AuthenticatedUser;
  initialEditing?: boolean;
  onSave: (update: ProfileUpdate) => Promise<void>;
  isLoggingOut?: boolean;
  onLogout?: (trigger: HTMLElement) => void;
};

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
  const dialogRef = useRef<HTMLElement>(null);
  const nameInputRef = useRef<HTMLInputElement>(null);
  const phoneInputRef = useRef<HTMLInputElement>(null);
  const editFocusRef = useRef<"name" | "phone">("name");
  const errorRef = useRef<HTMLParagraphElement>(null);
  const [editing, setEditing] = useState(initialEditing);
  const [name, setName] = useState(user.name);
  const [phone, setPhone] = useState(user.phone ?? "");
  const [fieldErrors, setFieldErrors] = useState<ProfileFieldErrors>({});
  const [saveError, setSaveError] = useState("");
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState("");
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [discardConfirm, setDiscardConfirm] = useState(false);
  const [activeTab, setActiveTab] = useState<AccountTab>("overview");
  const [permissionsOpen, setPermissionsOpen] = useState(false);
  const update = useMemo(() => buildProfileUpdate(user, name, phone), [name, phone, user]);
  const validationErrors = useMemo(() => validateProfile(name, phone, user.phone), [name, phone, user.phone]);
  const changed = hasProfileChanges(update) || Boolean(user.phone && !phone.trim());

  useEffect(() => {
    setName(user.name);
    setPhone(user.phone ?? "");
  }, [user]);

  const cancel = useCallback(() => {
    setName(user.name);
    setPhone(user.phone ?? "");
    setFieldErrors({});
    setSaveError("");
    setDeleteConfirm(false);
    setDiscardConfirm(false);
    setEditing(false);
    if (initialEditing) router.replace("/mypage");
    window.requestAnimationFrame(() => editTriggerRef.current?.focus());
  }, [initialEditing, router, user]);

  useEffect(() => {
    if (!editing) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.requestAnimationFrame(() => (editFocusRef.current === "phone" ? phoneInputRef : nameInputRef).current?.focus());
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !saving) {
        if (deleteConfirm) setDeleteConfirm(false);
        else if (discardConfirm) setDiscardConfirm(false);
        else if (changed) setDiscardConfirm(true);
        else cancel();
      }
      if (event.key !== "Tab" || !dialogRef.current) return;
      const focusable = dialogRef.current.querySelectorAll<HTMLElement>(
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
  }, [cancel, changed, deleteConfirm, discardConfirm, editing, saving]);

  useEffect(() => {
    if (saveError) errorRef.current?.focus();
  }, [saveError]);

  const roleDisplay = getRoleDisplay(user.role, user.roles);
  const operationalUser = isOperationalAccount(user.roles);
  const shortcuts = operationalUser
    ? getAccountShortcuts(user.apiPermissions, user.uiPermissions).filter(item => item.href !== "/control" || canAccessControl(user))
    : [];
  const permissionGroups = operationalUser ? getPermissionGroups(user.apiPermissions, false) : [];
  const organization = user.organization?.name ?? "";
  const status = getAccountStatusLabel(user.accountStatus);
  const lastLogin = formatKstDate(user.lastLoginAt, "로그인 기록 없음");
  const lastUpdated = formatKstDate(user.updatedAt, "기록 없음");
  const visiblePermissionGroups = permissionGroups.filter(item => item.label !== "계정 관리" && item.state !== "접근 제한");
  const accessLabel = shortcuts.some(item => item.href === "/control")
    ? "관제 시스템 접근 가능"
    : shortcuts.some(item => item.href === "/dispatch")
      ? "출동 업무 접근 가능"
      : operationalUser ? "일부 업무 제한" : "정상적으로 이용 중입니다";

  const startEditing = (focus: "name" | "phone" = "name") => {
    editFocusRef.current = focus;
    setEditing(true);
    setToast("");
    setDeleteConfirm(false);
    setDiscardConfirm(false);
    setFieldErrors({});
    setSaveError("");
  };

  const requestClose = () => {
    if (saving) return;
    if (deleteConfirm) {
      setDeleteConfirm(false);
      return;
    }
    if (changed) {
      setDiscardConfirm(true);
      return;
    }
    cancel();
  };

  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    if (savingRef.current) return;
    setFieldErrors(validationErrors);
    if (validationErrors.name || validationErrors.phone) {
      window.requestAnimationFrame(() => {
        if (validationErrors.name) nameInputRef.current?.focus();
        else phoneInputRef.current?.focus();
      });
      return;
    }
    if (!changed || validationErrors.name || validationErrors.phone || deleteConfirm) return;
    savingRef.current = true;
    setSaving(true);
    setSaveError("");
    setToast("");
    try {
      await onSave(update);
      setToast("내 정보가 수정되었습니다");
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

  const deletePhone = async () => {
    if (savingRef.current || !user.phone) return;
    savingRef.current = true;
    setSaving(true);
    setSaveError("");
    try {
      await onSave({ phone: null });
      setToast("전화번호가 삭제되었습니다");
      setDeleteConfirm(false);
      setEditing(false);
      if (initialEditing) router.replace("/mypage");
      window.requestAnimationFrame(() => editTriggerRef.current?.focus());
    } catch (error) {
      setSaveError(getProfileErrorMessage(error, "전화번호를 삭제하지 못했습니다. 잠시 후 다시 시도해 주세요."));
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  };

  const formStatus = saving
    ? "변경사항을 저장하고 있습니다"
    : validationErrors.name || validationErrors.phone
      ? "입력 내용을 확인해 주세요"
      : changed
        ? "변경사항이 있습니다"
        : "변경사항 없음";

  const selectTab = (tab: AccountTab) => setActiveTab(tab);
  const handleTabKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>) => {
    const next = getNextAccountTab(activeTab, event.key);
    if (!next) return;
    event.preventDefault();
    setActiveTab(next);
    window.requestAnimationFrame(() => document.getElementById(`mypage-tab-${next}`)?.focus());
  };

  return <div className={styles.page}>
    <LandingHeader showSections={false} />
    <main className={styles.workspace}>
      <header className={styles.pageHeading}>
        <div>
          <nav aria-label="현재 위치"><Link href="/">홈</Link><span aria-hidden="true">/</span><span>내 계정</span></nav>
          <h1>내 계정</h1>
          <span>계정 정보와 이용 상태를 확인하고 필요한 정보를 관리할 수 있습니다.</span>
        </div>
      </header>

      {toast && <p className={styles.toast} role="status" aria-live="polite">{toast}</p>}

      <section className={styles.accountSummary} aria-labelledby="account-summary-title">
        <div className={styles.profileIdentity}>
          <UserAvatar className={styles.avatar} />
          <div>
            <h2 id="account-summary-title">{user.name}</h2>
            <p><span className={styles.statusBadge}><i aria-hidden="true" />{status}</span><strong>{operationalUser ? roleDisplay.primary : "일반 계정"}</strong></p>
            {operationalUser && <span>{organization || "소속 기관 정보 없음"}</span>}
            <small>최근 로그인 {lastLogin}</small>
          </div>
        </div>
        <button ref={editTriggerRef} className={styles.primaryAction} type="button" onClick={() => startEditing()}>내 정보 수정</button>
      </section>

      <div className={styles.tabs} role="tablist" aria-label="계정 정보">
        <button id="mypage-tab-overview" role="tab" type="button" aria-selected={activeTab === "overview"} aria-controls="mypage-panel-overview" tabIndex={activeTab === "overview" ? 0 : -1} onClick={() => selectTab("overview")} onKeyDown={handleTabKeyDown}>개요</button>
        <button id="mypage-tab-profile" role="tab" type="button" aria-selected={activeTab === "profile"} aria-controls="mypage-panel-profile" tabIndex={activeTab === "profile" ? 0 : -1} onClick={() => selectTab("profile")} onKeyDown={handleTabKeyDown}>내 정보</button>
        <button id="mypage-tab-security" role="tab" type="button" aria-selected={activeTab === "security"} aria-controls="mypage-panel-security" tabIndex={activeTab === "security" ? 0 : -1} onClick={() => selectTab("security")} onKeyDown={handleTabKeyDown}>보안 및 활동</button>
      </div>

      {activeTab === "overview" ? <section id="mypage-panel-overview" role="tabpanel" aria-labelledby="mypage-tab-overview" className={`${styles.tabPanel} ${styles.overviewPanel}`}>
        <div className={styles.overviewGrid}>
          <section className={styles.overviewStatus}>
            <header><h2>{operationalUser ? "운영 계정 상태" : "내 계정 상태"}</h2><p><i aria-hidden="true" />{accessLabel}</p></header>
            <dl>
              <div><dt>계정 상태</dt><dd>{status}</dd></div>
              {operationalUser ? <><div><dt>소속</dt><dd>{organization || "소속 기관 정보 없음"}</dd></div><div><dt>역할</dt><dd>{roleDisplay.all.join(", ")}</dd></div></> : <><div><dt>계정 유형</dt><dd>일반 계정</dd></div><div><dt>전화번호</dt><dd>{user.phone ? "등록됨" : "미등록"}</dd></div></>}
              <div><dt>최근 로그인</dt><dd>{lastLogin}</dd></div>
              {!operationalUser && <div><dt>최근 정보 수정</dt><dd>{lastUpdated}</dd></div>}
            </dl>
            {operationalUser && <div className={styles.permissionOverview}>
              <h3>업무 접근 범위</h3>
              {visiblePermissionGroups.length ? <ul>{visiblePermissionGroups.map(item => <li key={item.label}><span>{item.label}</span><strong>{item.description}</strong></li>)}</ul> : <p>현재 확인할 수 있는 업무 권한이 없습니다.</p>}
              <button type="button" aria-expanded={permissionsOpen} aria-controls="mypage-permission-codes" onClick={() => setPermissionsOpen(value => !value)}>{permissionsOpen ? "전체 권한 코드 닫기" : "전체 권한 코드 보기"}</button>
              {permissionsOpen && <ul id="mypage-permission-codes" className={styles.permissionCodes}>{user.apiPermissions.length ? [...user.apiPermissions].sort().map(code => <li key={code}><code>{code}</code></li>) : <li>부여된 권한 코드가 없습니다.</li>}</ul>}
            </div>}
          </section>
          <section className={styles.quickActions}>
            <header><h2>{operationalUser ? "업무 바로가기" : "빠른 작업"}</h2><p>{operationalUser ? "권한에 따라 이용할 수 있는 업무입니다." : "자주 사용하는 계정 관리 기능입니다."}</p></header>
            <div>
              {!operationalUser && <button type="button" onClick={() => startEditing()}><UserAvatar/><span><strong>내 정보 수정</strong><small>이름과 전화번호 관리</small></span><b aria-hidden="true">›</b></button>}
              {!operationalUser && <Link href="/forgot-password"><ShieldIcon/><span><strong>비밀번호 재설정</strong><small>이메일로 재설정 링크 받기</small></span><b aria-hidden="true">›</b></Link>}
              {operationalUser && shortcuts.map((item, index) => <Link key={`${item.href}-${item.label}`} href={item.href} className={index === 0 ? styles.featuredShortcut : undefined}><BuildingIcon/><span><strong>{item.label}</strong><small>{item.description}</small></span><b aria-hidden="true">›</b></Link>)}
              <button type="button" disabled={isLoggingOut} onClick={event => onLogout?.(event.currentTarget)}><ShieldIcon/><span><strong>로그아웃</strong><small>현재 계정에서 안전하게 로그아웃</small></span><b aria-hidden="true">›</b></button>
            </div>
          </section>
        </div>
      </section> : activeTab === "profile" ? <section id="mypage-panel-profile" role="tabpanel" aria-labelledby="mypage-tab-profile" className={styles.tabPanel}>
        <div className={styles.panelHeading}><div><h2>기본 정보</h2><span>로그인과 서비스 이용에 사용하는 개인 정보입니다.</span></div></div>
        <dl className={styles.settingsList}>
          <div><dt><span><MailIcon /></span><b>이메일</b><small>로그인에 사용하는 이메일이며 변경할 수 없습니다.</small></dt><dd>{user.email}</dd></div>
          <div><dt><span><UserAvatar /></span><b>사용자명</b></dt><dd>{user.name}<button type="button" onClick={() => startEditing("name")}>수정</button></dd></div>
          <div><dt><span><PhoneIcon /></span><b>전화번호</b></dt><dd>{user.phone || "등록된 전화번호가 없습니다"}<button type="button" onClick={() => startEditing("phone")}>{user.phone ? "수정" : "등록"}</button></dd></div>
        </dl>
      </section> : <section id="mypage-panel-security" role="tabpanel" aria-labelledby="mypage-tab-security" className={styles.tabPanel}>
        <div className={styles.panelHeading}><div><h2>보안·활동</h2><span>실제 계정 활동과 현재 브라우저의 보안 작업입니다.</span></div></div>
        <div className={styles.securityGrid}>
          <section className={styles.activityTimeline}><h3>최근 계정 활동</h3><ol><li><i aria-hidden="true"/><div><strong>최근 로그인</strong><time>{lastLogin}</time><span>현재 계정으로 마지막 로그인한 시각입니다.</span></div></li><li><i aria-hidden="true"/><div><strong>최근 정보 수정</strong><time>{lastUpdated}</time><span>계정 정보가 마지막으로 갱신된 시각입니다.</span></div></li></ol></section>
          <section className={styles.securityTasks}><h3>계정 보안</h3><div><span><strong>비밀번호 재설정</strong><small>비밀번호를 잊었거나 새 비밀번호가 필요한 경우 등록된 이메일로 재설정 링크를 받을 수 있습니다.</small></span><Link href="/forgot-password">비밀번호 재설정</Link></div><div><span><strong>현재 세션</strong><small>현재 브라우저에서 로그인 중입니다.</small></span><button type="button" disabled={isLoggingOut} aria-busy={isLoggingOut} onClick={event => onLogout?.(event.currentTarget)}>{isLoggingOut ? "로그아웃 중…" : "로그아웃"}</button></div></section>
        </div>
      </section>}
    </main>

    {editing && <>
      <button type="button" className={styles.dialogBackdrop} aria-label="정보 수정 닫기" onClick={requestClose} />
      <section ref={dialogRef} className={styles.profileDialog} role="dialog" aria-modal="true" aria-labelledby="profile-dialog-title" aria-describedby="profile-dialog-description">
        <header><div><p>EDIT PROFILE</p><h2 id="profile-dialog-title">내 정보 수정</h2><span id="profile-dialog-description">사용자명과 연락처를 관리합니다.</span></div><button type="button" onClick={requestClose} aria-label="내 정보 수정 닫기">×</button></header>
        <form className={styles.editForm} onSubmit={save} noValidate>
          <div className={styles.dialogBody}>
            <div className={styles.editFields}>
              <label htmlFor="profile-name-input">사용자명<input ref={nameInputRef} id="profile-name-input" value={name} onChange={event => { const nextName = event.target.value; setName(nextName); setFieldErrors(errors => ({ ...errors, name: validateProfile(nextName, phone, user.phone).name })); setSaveError(""); }} minLength={2} maxLength={100} autoComplete="name" aria-invalid={Boolean(fieldErrors.name)} aria-describedby={fieldErrors.name ? "profile-name-help profile-name-error" : "profile-name-help"} /><small id="profile-name-help">2~100자로 입력해 주세요</small>{fieldErrors.name && <small id="profile-name-error" className={styles.fieldError}>{fieldErrors.name}</small>}</label>
              <label htmlFor="profile-phone"><span className={styles.fieldLabel}>전화번호{user.phone && <button type="button" disabled={changed} title={changed ? "변경사항을 저장하거나 취소한 후 삭제할 수 있습니다." : undefined} onClick={() => { setDeleteConfirm(true); setDiscardConfirm(false); setSaveError(""); }}>등록된 전화번호 삭제</button>}</span><input ref={phoneInputRef} id="profile-phone" type="tel" value={phone} onChange={event => { const nextPhone = event.target.value; setPhone(nextPhone); setFieldErrors(errors => ({ ...errors, phone: validateProfile(name, nextPhone, user.phone).phone })); setDeleteConfirm(false); setSaveError(""); }} placeholder="010-1234-5678 또는 +82 형식" inputMode="tel" autoComplete="tel" aria-invalid={Boolean(fieldErrors.phone)} aria-describedby={fieldErrors.phone ? "profile-phone-help profile-phone-error" : "profile-phone-help"} /><small id="profile-phone-help">010-1234-5678 또는 +82 형식으로 입력해 주세요</small>{fieldErrors.phone && <small id="profile-phone-error" className={styles.fieldError}>{fieldErrors.phone}</small>}</label>
            </div>
            {deleteConfirm && <div className={styles.confirmArea} role="alertdialog" aria-labelledby="phone-delete-title" aria-describedby="phone-delete-description"><div><strong id="phone-delete-title">전화번호를 삭제할까요?</strong><span id="phone-delete-description">삭제 후에는 연락처가 미등록 상태로 표시됩니다.</span></div><div><button type="button" onClick={() => setDeleteConfirm(false)} disabled={saving}>유지</button><button type="button" onClick={() => void deletePhone()} disabled={saving}>{saving ? "삭제 중…" : "전화번호 삭제"}</button></div></div>}
            {discardConfirm && <div className={styles.confirmArea} role="alertdialog" aria-labelledby="discard-title" aria-describedby="discard-description"><div><strong id="discard-title">수정 중인 내용이 저장되지 않았습니다</strong><span id="discard-description">변경사항을 취소하고 닫을까요?</span></div><div><button type="button" onClick={() => setDiscardConfirm(false)}>계속 수정</button><button type="button" onClick={cancel}>변경사항 취소</button></div></div>}
            <div className={styles.readOnlyBlock}><h3>변경할 수 없는 계정 정보</h3><dl><div><dt>이메일</dt><dd>{user.email}</dd></div><div><dt>계정 유형</dt><dd>{operationalUser ? "운영 계정" : "일반 계정"}</dd></div></dl></div>
            <p ref={errorRef} id="profile-form-error" className={styles.formError} role={saveError ? "alert" : undefined} aria-live="assertive" tabIndex={saveError ? -1 : undefined}>{saveError || " "}</p>
          </div>
          <footer className={styles.dialogFooter}><span role="status" aria-live="polite">{formStatus}</span><div className={styles.formActions}><button type="button" onClick={requestClose} disabled={saving}>취소</button><button type="submit" disabled={!changed || Boolean(validationErrors.name || validationErrors.phone) || deleteConfirm || saving} aria-busy={saving}>{saving ? "저장 중…" : "변경사항 저장"}</button></div></footer>
        </form>
      </section>
    </>}
  </div>;
}
