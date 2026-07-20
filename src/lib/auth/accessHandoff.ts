import type { UserRole } from "@/types/auth";
import { getPrimaryRole } from "./roleRedirect";

export const ACCESS_HANDOFF_KEY = "roadbogo_access_handoff";

export type AccessHandoff = {
  destination: string;
  message: string;
};

export function getControlAccessHandoff(roles: UserRole[]): AccessHandoff | null {
  const role=getPrimaryRole(roles);
  if(role==="GENERAL_USER")return {
    destination:"/",
    message:"관제 화면은 운영 계정 전용입니다. 일반 사용자 홈으로 이동했습니다.",
  };
  if(role==="RESPONDER")return {
    destination:"/dispatch",
    message:"관제 화면은 관제 업무 계정 전용입니다. 내 출동 화면으로 이동했습니다.",
  };
  return null;
}

export function storeAccessHandoff(handoff: AccessHandoff) {
  sessionStorage.setItem(ACCESS_HANDOFF_KEY, JSON.stringify(handoff));
}

export function consumeAccessHandoff(): AccessHandoff | null {
  const value=sessionStorage.getItem(ACCESS_HANDOFF_KEY);
  sessionStorage.removeItem(ACCESS_HANDOFF_KEY);
  if(!value)return null;
  try {
    const parsed=JSON.parse(value) as Partial<AccessHandoff>;
    return typeof parsed.message==="string"&&typeof parsed.destination==="string"
      ? {message:parsed.message,destination:parsed.destination}
      : null;
  } catch {
    return null;
  }
}
