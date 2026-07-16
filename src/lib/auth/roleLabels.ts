import type { UserRole } from "@/types/auth";

const roleLabels: Record<UserRole, string> = {
  SYSTEM_ADMIN: "시스템 관리자",
  CONTROL_MANAGER: "관제센터 책임자",
  CONTROLLER: "관제 담당자",
  RESPONDER: "출동 담당자",
  GENERAL_USER: "일반 사용자",
};

export function getRoleLabel(role?: string) {
  return role && role in roleLabels ? roleLabels[role as UserRole] : "일반 사용자";
}
