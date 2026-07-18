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
  const shortcuts: AccountShortcut[] = [];
  if (permissions.some(permission => ["CCTV.READ", "INCIDENT.READ_ALL", "INCIDENT.READ_ASSIGNED", "INCIDENT.CLAIM", "INCIDENT.DECIDE"].includes(permission))) {
    shortcuts.push({ href: "/control", label: "실시간 관제", description: "CCTV와 사건 업무 확인" });
  }
  if (permissions.some(permission => ["DISPATCH.READ_OWN", "DISPATCH.UPDATE_OWN", "DISPATCH.ASSIGN"].includes(permission))) {
    shortcuts.push({ href: "/dispatch", label: "출동 관리", description: "배정된 출동 업무 확인" });
  }
  if (allowed.has("USER.READ_ALL") || allowed.has("USER.WRITE") || allowed.has("ROLE.MANAGE")) {
    shortcuts.push({ href: "/admin", label: "사용자 관리", description: "사용자와 역할 관리" });
  }
  return shortcuts;
}

export type PermissionSummary = {
  label: string;
  description: string;
};

const permissionLabels: Record<string, PermissionSummary> = {
  "CCTV.READ": { label: "CCTV 조회", description: "실시간 CCTV 관제 화면 조회" },
  "INCIDENT.READ_ALL": { label: "전체 사건 조회", description: "등록된 모든 사건 정보 조회" },
  "INCIDENT.READ_ASSIGNED": { label: "담당 사건 조회", description: "본인에게 배정된 사건 조회" },
  "INCIDENT.CLAIM": { label: "사건 담당", description: "사건 담당자로 배정 및 인계" },
  "INCIDENT.DECIDE": { label: "사건 판단", description: "위험 여부와 대응 필요성 판단" },
  "DISPATCH.ASSIGN": { label: "출동 배정", description: "현장 대응 담당자 배정" },
  "DISPATCH.READ_OWN": { label: "내 출동 조회", description: "본인에게 배정된 출동 업무 조회" },
  "DISPATCH.UPDATE_OWN": { label: "출동 상태 관리", description: "본인의 출동 및 현장 조치 상태 변경" },
  "USER.READ_ALL": { label: "사용자 조회", description: "서비스 사용자 정보 조회" },
  "USER.WRITE": { label: "사용자 관리", description: "서비스 사용자 정보 관리" },
  "ROLE.MANAGE": { label: "역할 관리", description: "사용자 역할과 권한 관리" },
  "NOTIFICATION.READ_OWN": { label: "내 알림 조회", description: "본인에게 전달된 알림 조회" },
};

export function getPermissionSummaries(permissions: string[]): PermissionSummary[] {
  return permissions
    .map(permission => permissionLabels[permission])
    .filter((summary): summary is PermissionSummary => Boolean(summary));
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
