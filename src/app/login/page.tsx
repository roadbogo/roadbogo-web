"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { LoginForm } from "@/components/auth/LoginForm";
import { LoginSystemHealth } from "@/components/auth/LoginSystemHealth";
import { LoginHeroCarousel } from "@/components/auth/LoginHeroCarousel";
import { AuthIntentTabs } from "@/components/auth/AuthIntentTabs";
import { AuthShell } from "@/components/auth/AuthShell";
import type { LoginIntent } from "@/types/auth";
import styles from "./login.module.css";

const content = {
  general: {
    eyebrow: "GENERAL ACCESS",
    title: "도로보GO에 로그인하세요",
    description: "서비스 정보와 개인 알림을 확인합니다.",
    guide: "계정 권한에 따라 이용 가능한 메뉴가 자동으로 제공됩니다.",
    accessTitle: "처음 이용하시나요?",
    signupTitle: "일반 사용자 회원가입",
    signupDescription: "일반 서비스 계정을 직접 만들 수 있습니다.",
    signupHref: "/signup",
  },
  operations: {
    eyebrow: "OPERATIONS ACCESS",
    title: "도로보GO 운영 시스템",
    description: "관제·관리·현장 대응 업무를 시작합니다.",
    guide: "권한은 계정에 등록된 정보로 자동 확인됩니다.",
    accessTitle: "운영 계정이 필요하신가요?",
    signupTitle: "운영 계정 발급 안내",
    signupDescription: "운영 계정은 기관 또는 관제센터 관리자가 등록합니다.",
    signupHref: "/find-account",
  },
} as const;

export default function LoginPage() {
  const router = useRouter();
  const [intent, setIntent] = useState<LoginIntent>("general");
  const [registered, setRegistered] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setIntent(params.get("intent") === "operations" ? "operations" : "general");
    setRegistered(params.get("registered") === "1");
  }, []);

  const selectIntent = (next: LoginIntent) => {
    setIntent(next);
    const params = new URLSearchParams(window.location.search);
    params.set("intent", next);
    router.replace(`/login?${params.toString()}`, { scroll: false });
  };

  const current = content[intent];
  return <AuthShell pageClassName={styles.page} panelClassName={styles.panel} panelLabel="로그인 영역" visual={<LoginHeroCarousel/>}>
    <div className={styles.formArea} data-login-card>
      <AuthIntentTabs intent={intent} onChange={selectIntent}/>
      <div className={styles.authContent}>
      <header className={styles.heading} data-login-heading><p>{current.eyebrow}</p><h2>{intent==="general"?<><span>도로보GO에</span> <span>로그인하세요</span></>:<span>{current.title}</span>}</h2><span>{current.description}</span><b>{current.guide}</b></header>
      {registered && intent === "general" && <p className={styles.registrationNotice} role="status">회원가입이 완료되었습니다.<br/>등록한 이메일과 비밀번호로 로그인해 주세요.</p>}
      <div className={styles.operationsContext} aria-hidden={intent !== "operations"}>
        {intent === "operations" ? <><LoginSystemHealth/><p className={styles.roleGuide}>시스템 관리자 · 관제센터 책임자 · 관제 담당자 · 출동 담당자</p></> : <div className={styles.operationsContextPlaceholder}/>}
      </div>
      <LoginForm intent={intent} />
      <div className={styles.accountStartDivider} id="account-start-title"><span>{current.accessTitle}</span></div>
      <nav className={styles.accountMenu} aria-labelledby="account-start-title">
        <Link className={styles.accountMenuRow} href={current.signupHref}>
          <span className={styles.accountMenuIcon} aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M15 19c0-2.2-2-4-4.5-4h-3C5 15 3 16.8 3 19"/><circle cx="9" cy="8" r="4"/><path d="M18 8v6M15 11h6"/></svg></span>
          <span className={styles.accountMenuText}><strong>{current.signupTitle}</strong><small>{current.signupDescription}</small></span>
        </Link>
      </nav>
      <Link className={styles.homeLink} href="/"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m3 11 9-7 9 7"/><path d="M5 10v10h14V10M9 20v-6h6v6"/></svg><span>메인으로 돌아가기</span></Link>
      </div>
    </div>
  </AuthShell>;
}
