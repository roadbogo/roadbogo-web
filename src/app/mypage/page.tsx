"use client";

import { useAuth } from "@/components/auth/AuthContext";
import { useLogout } from "@/components/auth/LogoutProvider";
import { authApi, toAuthUser } from "@/lib/authApi";
import type { ProfileUpdate } from "./mypageUtils";
import { MyPageView } from "./MyPageView";
import styles from "./mypage.module.css";
import "@/components/landing/landing.css";

export function MyPageContent({ initialEditing = false }: { initialEditing?: boolean }) {
  const { user, ready, setAuthenticatedUser } = useAuth();
  const { isLoggingOut, requestLogout } = useLogout();

  if (!ready) {
    return <main className={styles.statePage} role="status" aria-live="polite"><span className={styles.spinner} /><h1>내 정보를 준비하고 있습니다</h1><p>로그인 상태와 최신 계정 정보를 안전하게 확인하고 있습니다.</p></main>;
  }
  if (!user) return null;

  const saveProfile = async (update: ProfileUpdate) => {
    const updated = await authApi.updateMe(update);
    setAuthenticatedUser(toAuthUser(updated));
  };

  return <MyPageView
    user={user}
    initialEditing={initialEditing}
    onSave={saveProfile}
    isLoggingOut={isLoggingOut}
    onLogout={requestLogout}
  />;
}

export default function MyPage() {
  return <MyPageContent />;
}
