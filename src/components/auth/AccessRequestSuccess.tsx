"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";
import type { AccessRequestResult } from "@/types/accessRequest";
import styles from "@/app/access-request/access-request.module.css";

export function AccessRequestSuccess({ result, applicantName, email }: { result: AccessRequestResult; applicantName: string; email: string }) {
  const titleRef = useRef<HTMLHeadingElement>(null);
  useEffect(() => titleRef.current?.focus(), []);

  return <section className={styles.success} aria-labelledby="request-success-title">
    <span className={styles.successIcon} aria-hidden="true">✓</span>
    <p>REQUEST RECEIVED</p>
    <h1 id="request-success-title" ref={titleRef} tabIndex={-1}>이용 신청이 접수되었습니다</h1>
    <p className={styles.successDescription}>관리자 확인 후 등록한 이메일로 계정 설정 방법을 안내해 드립니다.</p>
    <p className={styles.successNotice}>신청 내용에 따라 별도의 확인 절차가 진행될 수 있습니다.</p>
    <dl className={styles.resultList}>
      <div><dt>신청 번호</dt><dd>{result.request_id}</dd></div>
      <div><dt>신청자 이름</dt><dd>{applicantName}</dd></div>
      <div><dt>신청 이메일</dt><dd>{email}</dd></div>
      <div><dt>신청 상태</dt><dd><span>확인 대기</span></dd></div>
      <div><dt>접수 시각</dt><dd>{new Intl.DateTimeFormat("ko-KR", { dateStyle: "medium", timeStyle: "short" }).format(new Date(result.submitted_at))}</dd></div>
    </dl>
    <div className={styles.successActions}><Link href="/login">로그인 화면으로 이동</Link><Link href="/">메인 화면으로 이동</Link></div>
  </section>;
}
