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
  getPermissionGroups,
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

const roleDescriptions = {
  SYSTEM_ADMIN: "사용자·역할·감사·시스템 운영",
  CONTROL_MANAGER: "전체 관제 업무 감독·사건 관리·출동 배정",
  CONTROLLER: "CCTV 조회·사건 확인·판정·출동 요청",
  RESPONDER: "본인 출동 요청·상태 변경·현장 조치",
  GENERAL_USER: "일반 홈·본인 계정 관리·비밀번호 재설정",
} as const;

export function MyPageView({ user, initialEditing = false, onSave, isLoggingOut = false, onLogout }: Props) {
  const savingRef = useRef(false);
  const [editing, setEditing] = useState(initialEditing);
  const [name, setName] = useState(user.name);
  const [phone, setPhone] = useState(user.phone ?? "");
  const [fieldError, setFieldError] = useState("");
  const [saveError, setSaveError] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setName(user.name);
    setPhone(user.phone ?? "");
  }, [user]);

  const update = useMemo(() => buildProfileUpdate(user, name, phone), [name, phone, user]);
  const changed = hasProfileChanges(update);
  const roleLabels = getRoleLabels(user.roles);
  const generalUser = user.roles.every(role => role === "GENERAL_USER");
  const shortcuts = getAccountShortcuts(user.apiPermissions);
  const permissionGroups = getPermissionGroups(user.apiPermissions, generalUser);
  const organization = user.organization?.name ?? "개인 계정";
  const status = getAccountStatusLabel(user.accountStatus);
  const startEditing = () => { setEditing(true); setSaved(false); setFieldError(""); setSaveError(""); };
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
        <Link className={styles.brand} href="/" aria-label="도로보GO 홈"><Image src="/brand/roadbogo-logo-final.png" alt="도로보GO" width={160} height={45} priority /></Link>
        <span>마이</span>
        <AccountMenu compact />
      </div>

      <header className={styles.identityHeader}>
        <div className={styles.roadLines} aria-hidden="true" />
        <div className={styles.identityCopy}>
          <p>ACCOUNT CENTER</p>
          <h1>{user.name}님, 안녕하세요</h1>
          <span>도로보GO 계정 정보와 이용 권한을 관리합니다.</span>
        </div>
        <div className={styles.identityProfile}>
          <div className={styles.avatar} aria-hidden="true">{user.name.slice(0, 1)}</div>
          <div><strong>{user.name}</strong><span>{roleLabels[0]}</span></div>
          <div className={styles.identityBadges}><span className={styles.statusBadge}><i aria-hidden="true" />{status}</span><span>{organization}</span></div>
          <small>최근 로그인 {formatKstDate(user.lastLoginAt, "로그인 기록 없음")}</small>
        </div>
      </header>

      <nav className={styles.mobileSectionNav} aria-label="마이페이지 메뉴">
        <a href="#profile-info">계정 정보</a><a href="#access-scope">역할과 접근 범위</a><a href="#security">로그인 및 보안</a>
      </nav>

      {saved && <p className={styles.successNotice} role="status" aria-live="polite">회원 정보가 안전하게 저장되었습니다.</p>}

      <div className={styles.layout}>
        <aside className={styles.summaryPanel} aria-labelledby="account-summary-title">
          <div className={styles.summaryHeading}><span>ACCOUNT OVERVIEW</span><h2 id="account-summary-title">계정 개요</h2></div>
          <dl className={styles.summaryList}>
            <div><dt>사용자명</dt><dd>{user.name}</dd></div>
            <div><dt>이메일</dt><dd>{user.email}</dd></div>
            <div><dt>대표 역할</dt><dd>{roleLabels[0]}</dd></div>
            {roleLabels.length > 1 && <div><dt>보조 역할</dt><dd className={styles.roleWrap}>{roleLabels.slice(1).map(label => <span key={label}>{label}</span>)}</dd></div>}
            <div><dt>계정 구분</dt><dd>{organization}</dd></div>
            <div><dt>계정 상태</dt><dd><span className={styles.inlineStatus}><i aria-hidden="true" />{status}</span></dd></div>
            <div><dt>최근 로그인</dt><dd>{formatKstDate(user.lastLoginAt, "로그인 기록 없음")}</dd></div>
            <div><dt>최근 정보 수정</dt><dd>{formatKstDate(user.updatedAt, "수정 기록 없음")}</dd></div>
          </dl>
          <div className={styles.roleSummary}><strong>{roleLabels[0]} 이용 범위</strong><p>{roleDescriptions[user.role]}</p></div>
        </aside>

        <div className={styles.content}>
          <section className={styles.shortcutSection} aria-labelledby="shortcut-title">
            <div className={styles.sectionHeading}><div><span>QUICK ACCESS</span><h2 id="shortcut-title">이용 가능한 기능</h2></div></div>
            <div className={styles.shortcutGrid}>
              {shortcuts.map(item => <Link key={`${item.href}-${item.label}`} href={item.href} onClick={item.href === "#profile-info" ? startEditing : undefined}><span><strong>{item.label}</strong><small>{item.description}</small></span><b aria-hidden="true">→</b></Link>)}
            </div>
          </section>

          <section id="profile-info" className={styles.section} aria-labelledby="profile-info-title">
            <div className={styles.sectionHeading}>
              <div><span>PROFILE</span><h2 id="profile-info-title">내 정보</h2><p>계정의 기본 정보와 연락처를 관리합니다.</p></div>
              {!editing && <button className={styles.primaryAction} type="button" onClick={startEditing}>정보 수정</button>}
            </div>
            {!editing ? <dl className={styles.infoRows}>
              <div><dt>사용자명</dt><dd>{user.name}</dd></div>
              <div><dt>이메일</dt><dd>{user.email}</dd></div>
              <div><dt>전화번호</dt><dd>{user.phone || "미등록"}</dd></div>
              <div><dt>소속</dt><dd>{organization}</dd></div>
              <div><dt>역할</dt><dd className={styles.roleWrap}>{roleLabels.map(label => <span key={label}>{label}</span>)}</dd></div>
              <div><dt>계정 상태</dt><dd>{status}</dd></div>
            </dl> : <form className={styles.editForm} onSubmit={save} noValidate>
              <div className={styles.editFields}>
                <label htmlFor="profile-name-input">사용자명<input id="profile-name-input" value={name} onChange={event => setName(event.target.value)} minLength={2} maxLength={100} autoComplete="name" aria-describedby="profile-form-error" /></label>
                <label htmlFor="profile-phone">전화번호<input id="profile-phone" type="tel" value={phone} onChange={event => setPhone(event.target.value)} placeholder="010-1234-5678 또는 +82 형식" inputMode="tel" autoComplete="tel" aria-describedby="profile-form-error" /></label>
              </div>
              <div className={styles.lockedNotice}><span aria-hidden="true">🔒</span><p>이메일, 소속, 역할과 계정 상태는 이 화면에서 변경할 수 없습니다.</p></div>
              <dl className={styles.readOnlyInfo}>
                <div><dt>이메일</dt><dd>{user.email}</dd></div><div><dt>소속</dt><dd>{organization}</dd></div><div><dt>역할</dt><dd>{roleLabels.join(", ")}</dd></div><div><dt>계정 상태</dt><dd>{status}</dd></div>
              </dl>
              <p id="profile-form-error" className={styles.formError} role={fieldError || saveError ? "alert" : undefined} aria-live="assertive">{fieldError || saveError || " "}</p>
              <div className={styles.formActions}><button type="button" onClick={cancel} disabled={saving}>취소</button><button type="submit" disabled={!changed || saving} aria-busy={saving}>{saving ? "저장 중…" : "변경사항 저장"}</button></div>
            </form>}
          </section>

          <section id="access-scope" className={`${styles.section} ${styles.accessSection}`} aria-labelledby="access-title">
            <div className={styles.sectionHeading}><div><span>ACCESS</span><h2 id="access-title">역할과 접근 범위</h2><p>{generalUser ? "일반 사용자 계정은 계정 관리와 일반 서비스 기능을 이용할 수 있습니다. 관제·사건 판단·출동 관리 기능은 운영 계정에만 제공됩니다." : `${roleLabels[0]}에게 부여된 기능 범위입니다.`}</p></div></div>
            <div className={styles.permissionGrid}>
              {permissionGroups.map(group => <article key={group.label}><div><strong>{group.label}</strong><span data-state={group.state}>{group.state}</span></div><p>{group.description}</p></article>)}
            </div>
            <details className={styles.permissionDetails}><summary>상세 권한 코드 보기</summary>{user.apiPermissions.length ? <ul>{user.apiPermissions.map(permission => <li key={permission}>{permission}</li>)}</ul> : <p>일반 사용자 기본 이용 범위가 적용됩니다.</p>}</details>
          </section>

          <section id="security" className={`${styles.section} ${styles.securitySection}`} aria-labelledby="security-title">
            <div className={styles.sectionHeading}><div><span>SECURITY</span><h2 id="security-title">로그인 및 보안</h2><p>현재 제공되는 계정 보안 기능을 관리합니다.</p></div></div>
            <dl className={styles.securityInfo}><div><dt>계정 상태</dt><dd>{status}</dd></div><div><dt>최근 로그인</dt><dd>{formatKstDate(user.lastLoginAt, "로그인 기록 없음")}</dd></div></dl>
            <div className={styles.securityActions}><Link href="/forgot-password">비밀번호 재설정</Link><button type="button" disabled={isLoggingOut} onClick={event => onLogout?.(event.currentTarget)}>{isLoggingOut ? "로그아웃 중…" : "로그아웃"}</button></div>
          </section>
        </div>
      </div>
    </main>
  </div>;
}
