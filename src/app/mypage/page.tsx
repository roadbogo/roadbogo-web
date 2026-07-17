"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { AccountMenu } from "@/components/auth/AccountMenu";
import { useAuth } from "@/components/auth/AuthContext";
import { useLogout } from "@/components/auth/LogoutProvider";
import { getRoleLabel } from "@/lib/auth/roleLabels";
import { ApiError } from "@/lib/apiClient";
import { authApi, toAuthUser } from "@/lib/authApi";
import styles from "./mypage.module.css";

type Shortcut = { label: string; description: string; href: string };

function getShortcuts(roles: string[] = [], permissions: string[] = []): Shortcut[] {
  const items: Shortcut[] = [];
  if (roles.includes("FIELD_RESPONDER") && permissions.includes("dispatch:assigned")) {
    items.push({ label: "내 출동 요청", description: "배정된 요청과 현장 대응 확인", href: "/dispatch" });
  }
  if (roles.includes("CONTROL_OPERATOR") && permissions.includes("control:view")) {
    items.push({ label: "통합 관제", description: "CCTV와 위험 사건 통합 확인", href: "/control" });
  }
  if (roles.includes("SYSTEM_ADMIN") && permissions.includes("users:manage")) {
    items.push({ label: "시스템 관리", description: "사용자와 시스템 상태 관리", href: "/admin" });
  }
  return items.slice(0, 4);
}

export default function MyPage() {
  const { user, ready, setAuthenticatedUser } = useAuth();
  const { isLoggingOut, requestLogout } = useLogout();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");

  useEffect(() => {
    if (!user) return;
    setName(user.name);
    setPhone(user.phone ?? "");
  }, [user]);

  const shortcuts = useMemo(() => getShortcuts(user?.uiRoles, user?.uiPermissions), [user?.uiPermissions, user?.uiRoles]);
  if (!ready) return <main className="auth-check" role="status"><span />계정 정보를 확인하고 있습니다.</main>;
  if (!user) return null;

  const roleLabel = getRoleLabel(user.role);
  const changed = name.trim() !== user.name || phone.trim() !== (user.phone ?? "");
  const cancelEdit = () => { setName(user.name); setPhone(user.phone ?? ""); setEditing(false); };
  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!changed || !name.trim() || saving) return;
    setSaving(true); setSaveError("");
    try {
      const update: { user_name?: string; phone?: string | null } = {};
      if (name.trim() !== user.name) update.user_name = name.trim();
      if (phone.trim() !== (user.phone ?? "")) update.phone = phone.trim() || null;
      const updated = await authApi.updateMe(update);
      setAuthenticatedUser(toAuthUser(updated));
      setEditing(false);
    } catch (error) {
      setSaveError(error instanceof ApiError && error.httpStatus === 405
        ? "현재 서버에서는 회원 정보 수정을 지원하지 않습니다. 백엔드 기능이 배포된 후 다시 시도해 주세요."
        : "회원정보를 수정하지 못했습니다. 입력 내용을 확인하고 다시 시도해 주세요.");
    }
    finally { setSaving(false); }
  };

  return <div className={styles.hubPage}>
    <main className={styles.hubShell}>
      <header className={styles.pageHeader}>
        <Link href="/" aria-label="도로보GO 홈"><Image src="/brand/roadbogo-logo-final.png" alt="도로보GO" width={160} height={45} priority /></Link>
        <div><p>ACCOUNT HUB</p><h1>마이페이지</h1><span>계정 정보와 업무 접근 권한을 관리합니다.</span></div>
        <AccountMenu compact />
      </header>

      <div className={styles.hubGrid}>
        <aside className={`${styles.panel} ${styles.summary}`} aria-labelledby="profile-summary-title">
          <div className={styles.avatar} aria-hidden="true">{user.name.slice(0, 1)}</div>
          <div><p>PROFILE</p><h2 id="profile-summary-title">{user.name}</h2><strong>{roleLabel}</strong></div>
          <dl>
            <div><dt>소속</dt><dd>{user.organization?.name ?? "소속 기관 없음"}</dd></div>
            <div><dt>계정 상태</dt><dd><span className={styles.statusDot} />{user.accountStatus === "ACTIVE" ? "활성" : user.accountStatus}</dd></div>
          </dl>
        </aside>

        <section className={`${styles.panel} ${styles.shortcuts}`} aria-labelledby="shortcuts-title">
          <div className={styles.sectionHeading}><div><p>QUICK ACCESS</p><h2 id="shortcuts-title">내 업무 바로가기</h2></div></div>
          {shortcuts.length ? <div className={styles.shortcutGrid}>{shortcuts.map(item => <Link href={item.href} key={item.label}><strong>{item.label}</strong><span>{item.description}</span><i aria-hidden="true">→</i></Link>)}</div> : <p className={styles.empty}>현재 연결 가능한 업무 화면이 없습니다.</p>}
        </section>

        <section className={`${styles.panel} ${styles.basic}`} aria-labelledby="basic-title">
          <div className={styles.sectionHeading}><div><p>PROFILE INFO</p><h2 id="basic-title">기본 정보</h2></div>{!editing && <button type="button" onClick={() => setEditing(true)}>정보 수정</button>}</div>
          {!editing ? <dl className={styles.infoRows}>
            <div><dt>이름</dt><dd>{user.name}</dd></div>
            <div><dt>이메일</dt><dd className={styles.email}>{user.email}</dd></div>
            <div><dt>전화번호</dt><dd>{user.phone || "정보를 확인할 수 없습니다."}</dd></div>
          </dl> : <form className={styles.editForm} onSubmit={save}>
            <label>이름<input value={name} onChange={event => setName(event.target.value)} required /></label>
            <label>이메일<input value={user.email} readOnly aria-readonly="true" /></label>
            <label>전화번호<input type="tel" value={phone} onChange={event => setPhone(event.target.value)} placeholder="전화번호 입력" /></label>
            {saveError && <p className={styles.formError} role="alert">{saveError}</p>}
            <div className={styles.editActions}><button type="button" onClick={cancelEdit} disabled={saving}>취소</button><button type="submit" disabled={!changed || !name.trim() || saving}>{saving ? "저장 중…" : "저장"}</button></div>
          </form>}
        </section>

        <section className={`${styles.panel} ${styles.access}`} aria-labelledby="access-title">
          <div className={styles.sectionHeading}><div><p>ACCESS</p><h2 id="access-title">소속 및 권한</h2></div></div>
          <dl className={styles.infoRows}>
            <div><dt>소속 조직</dt><dd>{user.organization?.name ?? "소속 기관 없음"}</dd></div>
            <div><dt>현재 역할</dt><dd>{roleLabel}</dd></div>
            <div><dt>권한</dt><dd>{user.apiPermissions.length ? `${user.apiPermissions.length}개 API 권한` : "등록된 API 권한 없음"}</dd></div>
          </dl>
        </section>

        <section className={`${styles.panel} ${styles.security}`} aria-labelledby="security-title">
          <div className={styles.sectionHeading}><div><p>SECURITY</p><h2 id="security-title">로그인 및 보안</h2></div></div>
          <div className={styles.securityBody}><div><span className={styles.statusDot} /><strong>현재 로그인됨</strong><p>현재 계정의 로그인 세션과 보안 상태를 관리합니다.</p></div><button type="button" disabled={isLoggingOut} onClick={event => requestLogout(event.currentTarget)}>현재 계정에서 로그아웃</button></div>
        </section>
      </div>
    </main>
  </div>;
}
