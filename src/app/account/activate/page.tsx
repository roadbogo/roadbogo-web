"use client";

import Image from "next/image";
import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import styles from "./activate.module.css";

export default function AccountActivatePage() {
  const [email, setEmail] = useState("");
  const [token, setToken] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [status, setStatus] = useState("");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setToken(params.get("token") ?? "");
    setEmail(params.get("email") ?? "");
  }, []);

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (password !== passwordConfirm) {
      setStatus("새 비밀번호와 비밀번호 확인이 일치하지 않습니다.");
      return;
    }
    setStatus("현재 초대 확인 및 계정 활성화 API가 연결되지 않았습니다. 관리자에게 초대 상태를 확인해주세요.");
  };

  return <main className={styles.page}>
    <section className={styles.panel} aria-labelledby="activate-title">
      <Link className={styles.brand} href="/"><Image src="/brand/roadbogo-logo-final.png" alt="도로보GO" width={160} height={46} priority /></Link>
      <header><p>INVITED ACCOUNT</p><h1 id="activate-title">초대받은 계정 활성화</h1><span>초대받은 이메일과 초대 정보를 확인한 뒤 비밀번호를 설정해주세요.</span></header>
      <aside><strong>활성화 서비스 연결 준비 중</strong><p>초대의 유효성·만료·사용 여부는 서버에서 확인해야 합니다. 현재는 입력 화면만 제공하며 계정을 활성화하거나 성공 처리하지 않습니다.</p></aside>
      <form onSubmit={submit}>
        <label><span>초대받은 이메일</span><input type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" required /></label>
        <label><span>초대 코드 또는 URL token</span><input value={token} onChange={(event) => setToken(event.target.value)} autoComplete="off" required /></label>
        <label><span>새 비밀번호</span><input type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="new-password" required /></label>
        <label><span>새 비밀번호 확인</span><input type="password" value={passwordConfirm} onChange={(event) => setPasswordConfirm(event.target.value)} autoComplete="new-password" required /></label>
        <p role="alert" aria-live="polite">{status || " "}</p>
        <button type="submit">계정 활성화</button>
      </form>
      <Link className={styles.loginLink} href="/login">← 로그인 화면으로 돌아가기</Link>
    </section>
  </main>;
}
