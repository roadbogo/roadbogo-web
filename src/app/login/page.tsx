"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { LoginForm } from "@/components/auth/LoginForm";
import { LoginSystemHealth } from "@/components/auth/LoginSystemHealth";
import type { LoginIntent } from "@/types/auth";
import styles from "./login.module.css";

const content = {
  general: {
    eyebrow: "GENERAL ACCESS",
    title: "도로보GO에 로그인하세요",
    description: <>발급받은 계정으로 서비스 정보와<br />개인 알림을 확인할 수 있습니다.</>,
    guide: "계정 권한에 따라 이용 가능한 메뉴가 자동으로 제공됩니다.",
  },
  operations: {
    eyebrow: "OPERATIONS ACCESS",
    title: "도로보GO 운영 시스템",
    description: <>승인된 운영 계정으로 로그인하면<br />권한에 맞는 관제·출동·관리 화면으로 연결됩니다.</>,
    guide: "권한은 계정에 등록된 정보로 자동 확인됩니다.",
  },
} as const;

export default function LoginPage() {
  const router = useRouter();
  const [intent, setIntent] = useState<LoginIntent>("general");

  useEffect(() => {
    setIntent(new URLSearchParams(window.location.search).get("intent") === "operations" ? "operations" : "general");
  }, []);

  const selectIntent = (next: LoginIntent) => {
    setIntent(next);
    const params = new URLSearchParams(window.location.search);
    params.set("intent", next);
    router.replace(`/login?${params.toString()}`, { scroll: false });
  };

  const current = content[intent];
  return <main className={styles.page}>
    <section className={styles.visual} aria-labelledby="login-brand-title">
      <Image className={styles.roadImage} src="/images/incidents/response-ai-detection-v2.png" alt="고속도로 CCTV 도로 안전 관제 화면" fill priority sizes="(max-width: 767px) 100vw, 64vw" />
      <div className={styles.visualOverlay} />
      <div className={styles.scanLine} aria-hidden="true" />
      <Link className={styles.brand} href="/" aria-label="도로보GO 메인으로 이동"><Image src="/brand/roadbogo-logo-final.png" alt="도로보GO" width={170} height={48} priority /></Link>
      <div className={styles.hazardSequence} aria-hidden="true"><div className={styles.hazardMotorcycle}><span>이륜차 위험 후보 · 91%</span></div></div>
      <div className={styles.visualCopy}>
        <p>ROAD FLOW INTELLIGENCE</p>
        <h1 id="login-brand-title">AI가 먼저 발견하고,<br />대응은 더 빠르게.</h1>
        <span>위험 탐지부터 관제 판단,<br />출동과 현장 조치까지 하나로 연결합니다.</span>
      </div>
      <div className={styles.accessFlow} aria-label="도로보GO 대응 흐름"><span>AI 탐지</span><i/><span>관제 판단</span><i/><span>출동 연결</span><i/><span>현장 대응</span></div>
    </section>
    <section className={styles.panel} aria-label="로그인 영역"><div className={styles.formArea}>
      <div className={styles.intentTabs} role="tablist" aria-label="접속 목적" onKeyDown={(event)=>{if(event.key!=="ArrowLeft"&&event.key!=="ArrowRight")return;event.preventDefault();const next=intent==="general"?"operations":"general";selectIntent(next);event.currentTarget.querySelector<HTMLButtonElement>(`[aria-selected="${false}"]`)?.focus()}}>
        <button type="button" role="tab" aria-selected={intent === "general"} className={intent === "general" ? styles.intentActive : ""} onClick={() => selectIntent("general")}>일반 서비스</button>
        <button type="button" role="tab" aria-selected={intent === "operations"} className={intent === "operations" ? styles.intentActive : ""} onClick={() => selectIntent("operations")}>운영 시스템</button>
      </div>
      <header className={styles.heading}><p>{current.eyebrow}</p><h2>{current.title}</h2><span>{current.description}</span><b>{current.guide}</b></header>
      {intent === "operations" && <><LoginSystemHealth/><p className={styles.roleGuide}>시스템 관리자 · 관제센터 책임자 · 관제 담당자 · 출동 담당자</p></>}
      <LoginForm intent={intent} />
      <p className={styles.accountNotice}>도로보GO 계정은 관리자 발급 또는<br />승인된 초대를 통해 생성됩니다.</p>
      <Link className={styles.homeLink} href="/">← 메인으로 돌아가기</Link>
    </div></section>
  </main>;
}
