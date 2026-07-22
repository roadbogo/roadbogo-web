"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

export default function WithdrawalPage() {
  const router = useRouter();
  useEffect(() => { router.replace("/mypage"); }, [router]);
  return <main role="status" aria-live="polite">마이페이지로 이동하고 있습니다.</main>;
}
