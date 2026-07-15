"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useAuth } from "@/components/auth/AuthContext";
import { CONTROL_HREF, HOME_HREF, SIGNUP_HREF } from "@/lib/paths";
import styles from "./login.module.css";

export default function LoginPage() {
  const router = useRouter();
  const { login } = useAuth();
  const [email, setEmail] = useState("admin@roadbogo.demo");
  const [password, setPassword] = useState("demo1234");
  const submit = (event: React.FormEvent) => { event.preventDefault(); if (!email || !password) return; login(); router.push(CONTROL_HREF); };
  return <div className={styles.loginPage}><main className={styles.loginShell}>
    <section className={styles.brandPanel}><Link href={HOME_HREF}><img src="/brand/roadbogo-logo-final.png" alt="도로보GO" className={styles.brandLogo} /></Link><div><p className={styles.brandLabel}>ROAD FLOW INTELLIGENCE</p><h1>위험을 발견하고,<br />대응을 하나로 연결합니다.</h1><p className={styles.brandDescription}>AI 탐지부터 관제 판단과 현장 조치까지<br />도로보GO의 흐름으로 연결됩니다.</p></div><div className={styles.statusBar}><span className={styles.statusIndicator} /> 데모 시스템 연결 가능</div></section>
    <section className={styles.loginPanel}><div className={styles.panelHeader}><p className={styles.panelEyebrow}>관제 시스템 로그인</p><h2>관리자 계정으로 시작하세요</h2><p className={styles.panelDescription}>데모 계정이 미리 입력되어 있습니다.</p></div><form className={styles.loginForm} onSubmit={submit}><div className={styles.formGroup}><label htmlFor="email">이메일</label><input id="email" className={styles.inputField} value={email} onChange={(e)=>setEmail(e.target.value)} type="email" required /></div><div className={styles.formGroup}><label htmlFor="password">비밀번호</label><input id="password" className={styles.inputField} value={password} onChange={(e)=>setPassword(e.target.value)} type="password" required /></div><div className={styles.actionGroup}><button className={styles.primaryButton}>로그인</button><button type="button" className={styles.secondaryButton} onClick={()=>{ login(); router.push(CONTROL_HREF); }}>데모 관리자로 입장</button></div></form><div className={styles.footerRow}><Link href={SIGNUP_HREF} className={styles.textButton}>가입 신청</Link><Link href={HOME_HREF} className={styles.textButton}>메인으로 돌아가기</Link></div></section>
  </main></div>;
}
