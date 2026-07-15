"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { AccessRequestForm } from "@/components/auth/AccessRequestForm";
import { AccessRequestSuccess } from "@/components/auth/AccessRequestSuccess";
import type { AccessRequestResult } from "@/types/accessRequest";
import styles from "./access-request.module.css";

type CompletedRequest = { result: AccessRequestResult; applicantName: string; email: string };

export default function AccessRequestPage() {
  const [completed, setCompleted] = useState<CompletedRequest | null>(null);
  return <main className={styles.page}>
    <section className={styles.visual} aria-labelledby="access-brand-title">
      <Image className={styles.roadImage} src="/images/incidents/response-ai-detection-v2.png" alt="고속도로 CCTV 도로 안전 관제 화면" fill priority sizes="(max-width: 767px) 100vw, 50vw" />
      <div className={styles.overlay} />
      <Link className={styles.brand} href="/" aria-label="도로보GO 메인으로 이동"><Image src="/brand/roadbogo-logo-final.png" alt="도로보GO" width={170} height={48} priority /></Link>
      <div className={styles.visualCopy}><p>ROADBOGO ACCESS</p><h1 id="access-brand-title">안전한 도로를 위한<br />연결의 시작</h1><span>이용 신청부터 계정 승인까지<br />안전한 절차로 관리합니다.</span></div>
    </section>
    <section className={styles.panel} aria-label="도로보GO 이용 신청">
      <div className={styles.panelInner}>
        {!completed && <><ol className={styles.steps} aria-label="이용 신청 절차"><li aria-current="step"><b>1</b><span>정보 입력</span></li><li><b>2</b><span>관리자 확인</span></li><li><b>3</b><span>계정 설정</span></li></ol><header className={styles.heading}><p>ACCESS REQUEST</p><h2>도로보GO 이용 신청</h2><span>도로보GO 서비스 이용을 위한 정보를 입력해 주세요.</span><small>신청 내용을 확인한 후 등록한 이메일로 계정 설정 방법을 안내해 드립니다.</small></header><AccessRequestForm onSuccess={(result, applicantName, email) => setCompleted({ result, applicantName, email })} /><Link className={styles.loginLink} href="/login">로그인 화면으로 돌아가기</Link></>}
        {completed && <AccessRequestSuccess {...completed} />}
      </div>
    </section>
  </main>;
}
