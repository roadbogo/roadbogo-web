import { ApiError } from "@/lib/apiClient";
import { getRoleLabel } from "@/lib/auth/roleLabels";
import type { UserRole } from "@/types/auth";

export type ProfileUpdate = { user_name?: string; phone?: string | null };

const phonePattern = /^[+0-9() -]{7,30}$/;

export function validateProfile(name: string, phone: string) {
  const trimmedName = name.trim();
  if (trimmedName.length < 2 || trimmedName.length > 100) {
    return "사용자명은 2자 이상 100자 이하로 입력해 주세요.";
  }
  if (phone.trim() && !phonePattern.test(phone.trim())) {
    return "전화번호는 숫자, 공백, 하이픈, 괄호와 + 기호를 사용해 입력해 주세요.";
  }
  return null;
}

export function buildProfileUpdate(
  current: { name: string; phone?: string },
  name: string,
  phone: string,
): ProfileUpdate {
  const update: ProfileUpdate = {};
  const trimmedName = name.trim();
  const trimmedPhone = phone.trim();
  if (trimmedName !== current.name) update.user_name = trimmedName;
  if (trimmedPhone !== (current.phone ?? "")) update.phone = trimmedPhone || null;
  return update;
}

export function hasProfileChanges(update: ProfileUpdate) {
  return Object.keys(update).length > 0;
}

export function formatKstDate(value?: string | null, emptyLabel = "기록 없음") {
  if (!value) return emptyLabel;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "확인할 수 없음";
  return new Intl.DateTimeFormat("ko-KR", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Seoul",
  }).format(date);
}

export function getRoleLabels(roles: UserRole[]) {
  return roles.length ? roles.map(getRoleLabel) : [getRoleLabel("GENERAL_USER")];
}

export type AccountShortcut = { href: string; label: string; description: string };

export function getAccountShortcuts(permissions: string[]): AccountShortcut[] {
  const allowed = new Set(permissions);
  const shortcuts: AccountShortcut[] = [
    { href: "/", label: "일반 홈", description: "도로보GO 서비스 홈" },
    { href: "#profile-info", label: "내 정보 수정", description: "사용자명과 전화번호 관리" },
    { href: "/forgot-password", label: "비밀번호 재설정", description: "이메일로 재설정 안내 받기" },
    { href: "#access-scope", label: "이용 범위", description: "역할과 접근 범위 확인" },
  ];
  if (permissions.some(permission => ["CCTV.READ", "INCIDENT.READ_ALL", "INCIDENT.READ_ASSIGNED", "INCIDENT.CLAIM", "INCIDENT.DECIDE"].includes(permission))) {
    shortcuts.push({ href: "/control", label: "관제 대시보드", description: "CCTV와 사건 업무" });
  }
  if (permissions.some(permission => ["DISPATCH.READ_OWN", "DISPATCH.UPDATE_OWN", "DISPATCH.ASSIGN"].includes(permission))) {
    shortcuts.push({ href: "/dispatch", label: "출동 현황", description: "배정된 출동 업무" });
  }
  if (allowed.has("USER.READ_ALL") || allowed.has("ROLE.MANAGE")) {
    shortcuts.push({ href: "/admin", label: "시스템 관리", description: "사용자와 역할 관리" });
  }
  return shortcuts;
}

export type PermissionGroup = {
  label: string;
  state: "사용 가능" | "담당 범위만 가능" | "접근 제한";
  description: string;
};

export function getPermissionGroups(permissions: string[], generalUser: boolean): PermissionGroup[] {
  const hasAnyPermission = (...codes: string[]) => codes.some(code => permissions.includes(code));
  const hasAllPermissions = (...codes: string[]) => codes.every(code => permissions.includes(code));
  const scoped = (...codes: string[]) => hasAnyPermission(...codes) ? "담당 범위만 가능" as const : "접근 제한" as const;
  const canClaimIncident = hasAnyPermission("INCIDENT.CLAIM");
  const canDecideIncident = hasAnyPermission("INCIDENT.DECIDE");
  const incidentProcessing = hasAllPermissions("INCIDENT.CLAIM", "INCIDENT.DECIDE")
    ? { state: "사용 가능" as const, description: "사건 담당 및 판단 업무" }
    : canClaimIncident
      ? { state: "담당 범위만 가능" as const, description: "사건 확인 및 선점 가능" }
      : canDecideIncident
        ? { state: "담당 범위만 가능" as const, description: "허용된 사건의 판단 업무 가능" }
        : { state: "접근 제한" as const, description: "현재 부여된 권한 없음" };
  return [
    { label: "계정 관리", state: "사용 가능", description: "본인 계정 정보 조회 및 수정" },
    { label: "CCTV 조회", state: hasAnyPermission("CCTV.READ") ? "사용 가능" : "접근 제한", description: hasAnyPermission("CCTV.READ") ? "CCTV 관제 화면 조회" : generalUser ? "운영 계정 전용 기능" : "현재 부여된 권한 없음" },
    { label: "사건 조회", state: hasAnyPermission("INCIDENT.READ_ALL") ? "사용 가능" : scoped("INCIDENT.READ_ASSIGNED"), description: hasAnyPermission("INCIDENT.READ_ALL") ? "전체 사건 조회 가능" : hasAnyPermission("INCIDENT.READ_ASSIGNED") ? "내가 담당하는 사건만 조회 가능" : "현재 부여된 권한 없음" },
    { label: "사건 처리", ...incidentProcessing },
    { label: "출동 관리", state: hasAnyPermission("DISPATCH.ASSIGN") ? "사용 가능" : scoped("DISPATCH.READ_OWN", "DISPATCH.UPDATE_OWN"), description: hasAnyPermission("DISPATCH.ASSIGN") ? "출동 배정 및 현황 관리" : hasAnyPermission("DISPATCH.READ_OWN", "DISPATCH.UPDATE_OWN") ? "내게 배정된 출동만 조회·처리 가능" : "현재 부여된 권한 없음" },
    { label: "사용자·역할 관리", state: hasAnyPermission("USER.READ_ALL", "ROLE.MANAGE") ? "사용 가능" : "접근 제한", description: hasAnyPermission("USER.READ_ALL", "ROLE.MANAGE") ? "사용자 또는 역할 관리" : "시스템 관리자 전용 기능" },
    { label: "알림", state: hasAnyPermission("NOTIFICATION.READ_OWN") ? "담당 범위만 가능" : "접근 제한", description: hasAnyPermission("NOTIFICATION.READ_OWN") ? "내 알림 조회 가능" : "알림 권한 또는 화면 준비 필요" },
  ];
}

export function getAccountStatusLabel(status?: string) {
  const labels: Record<string, string> = {
    ACTIVE: "활성",
    INACTIVE: "비활성",
    SUSPENDED: "이용 정지",
    PENDING: "승인 대기",
    DEACTIVATED: "비활성",
  };
  return status ? labels[status] ?? status : "상태 미확인";
}

export function getProfileErrorMessage(error: unknown, fallback: string) {
  if (error instanceof ApiError) {
    if (error.httpStatus === 403) return "이 계정에는 해당 요청을 수행할 권한이 없습니다.";
    return error.message || fallback;
  }
  if (error instanceof TypeError) return "네트워크 연결을 확인한 뒤 다시 시도해 주세요.";
  return fallback;
}
