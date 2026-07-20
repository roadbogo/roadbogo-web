"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/auth/AuthContext";
import { PENDING_RETURN_TO_KEY, readRecentWork, resolvePostLoginDestination } from "@/lib/auth/postLoginRouting";
import { LoginForm } from "@/components/auth/LoginForm";
import { LoginHeroCarousel } from "@/components/auth/LoginHeroCarousel";
import { AuthIntentTabs } from "@/components/auth/AuthIntentTabs";
import { AuthShell } from "@/components/auth/AuthShell";
import type { LoginIntent } from "@/types/auth";
import styles from "./login.module.css";

const UserPlusIcon = () => <svg viewBox="0 0 24 24" aria-hidden="true">
  <circle cx="9" cy="8" r="4"/>
  <path d="M3 20a6 6 0 0 1 12 0M18 8v6M15 11h6"/>
</svg>;

const content = {
  general: {
    eyebrow: "GENERAL ACCESS",
    title: "도로보GO 로그인",
    description: "일반 서비스와 내 계정을 이용하려면 로그인하세요",
    guideTitle: "처음 이용하시나요?",
    guideDescription: "일반 사용자는 직접 가입할 수 있습니다",
  },
  operations: {
    eyebrow: "OPERATIONS ACCESS",
    title: "운영 계정 로그인",
    description: "관제·출동 업무 계정으로 로그인하세요",
    guideTitle: "기관 발급 계정",
    guideDescription: "운영 계정은 소속 기관 관리자가 발급합니다",
  },
} as const;

export default function LoginPage() {
  const router = useRouter();
  const {user,ready}=useAuth();
  const [intent, setIntent] = useState<LoginIntent>("general");
  const [registered, setRegistered] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setIntent(params.get("intent") === "operations" ? "operations" : "general");
    setRegistered(params.get("registered") === "1");
  }, []);

  useEffect(()=>{
    if(!ready||!user)return;
    const params=new URLSearchParams(window.location.search);
    const returnTo=params.get("returnTo")??params.get("next")??sessionStorage.getItem(PENDING_RETURN_TO_KEY);
    const destination=resolvePostLoginDestination({user,returnTo,recentWork:readRecentWork(user)});
    sessionStorage.removeItem(PENDING_RETURN_TO_KEY);
    router.replace(destination.path);
  },[ready,router,user]);

  const selectIntent = (next: LoginIntent) => {
    setIntent(next);
    const params = new URLSearchParams(window.location.search);
    params.set("intent", next);
    router.replace(`/login?${params.toString()}`, { scroll: false });
  };

  const current = content[intent];
  return <AuthShell pageClassName={styles.page} panelClassName={styles.panel} panelLabel="로그인 영역" visual={<LoginHeroCarousel intent={intent}/>}>
    <main className={styles.formArea} data-login-workspace>
      <AuthIntentTabs intent={intent} onChange={selectIntent}/>
      <div className={styles.authContent}>
      <header className={styles.heading} data-login-heading><p>{current.eyebrow}</p><h2><span>{current.title}</span></h2><span>{current.description}</span></header>
      {registered && intent === "general" && <p className={styles.registrationNotice} role="status">회원가입이 완료되었습니다.<br/>등록한 이메일과 비밀번호로 로그인해 주세요.</p>}
      <LoginForm intent={intent} />
      <section className={`${styles.accountGuidance} ${intent === "operations" ? styles.accountGuidanceOperations : styles.accountGuidanceGeneral}`} aria-labelledby="account-guidance-title">
        <div>
          {intent === "operations" ? <>
            <span className={styles.operationsGuidanceIcon} aria-hidden="true"><svg viewBox="0 0 24 24"><rect x="4" y="5" width="16" height="14" rx="2"/><path d="M8 9h8M8 13h5"/><circle cx="17" cy="14" r="1.5"/></svg></span>
            <span className={styles.operationsGuidanceCopy}><strong id="account-guidance-title">{current.guideTitle}</strong><p>{current.guideDescription}</p></span>
          </> : <>
            <strong id="account-guidance-title">계정이 없으신가요?</strong>
            <Link href="/signup?intent=general"><UserPlusIcon/>일반 사용자 회원가입</Link>
          </>}
        </div>
      </section>
      </div>
    </main>
  </AuthShell>;
}
