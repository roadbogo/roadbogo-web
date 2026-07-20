import type { AuthenticatedUser } from "@/components/auth/AuthContext";
import type { LinkedResourceState, NotificationActionState, NotificationPresentation, NotificationRecord, NotificationSeverity, NotificationTargetPath, NotificationType, NotificationViewModel } from "./notificationTypes";

export const notificationPresentation: Record<NotificationType, NotificationPresentation> = {
  INCIDENT_CREATED: { label: "신규 위험 사건", icon: "incident", category: "ACTION_REQUIRED", tone: "critical" },
  INCIDENT_STATUS_CHANGED: { label: "사건 상태 변경", icon: "incident", category: "UPDATE", tone: "info" },
  DISPATCH_ASSIGNED: { label: "출동 요청", icon: "dispatch", category: "ACTION_REQUIRED", tone: "warning" },
  DISPATCH_ACCEPTED: { label: "출동 수락", icon: "dispatch", category: "UPDATE", tone: "success" },
  DISPATCH_REJECTED: { label: "출동 요청 거절", icon: "dispatch", category: "ACTION_REQUIRED", tone: "warning" },
  DISPATCH_CANCELLED: { label: "출동 요청 취소", icon: "dispatch", category: "UPDATE", tone: "neutral" },
  DISPATCH_ARRIVED: { label: "현장 도착", icon: "dispatch", category: "UPDATE", tone: "info" },
  ACTION_COMPLETED: { label: "현장 조치 완료", icon: "complete", category: "ACTION_REQUIRED", tone: "success" },
};

export const severityLabels: Record<NotificationSeverity, string> = { INFO: "일반", WARNING: "주의", HIGH: "높음", CRITICAL: "긴급" };

const controlUser = (user: AuthenticatedUser) =>
  user.roles.some(role => ["SYSTEM_ADMIN", "CONTROL_MANAGER", "CONTROLLER"].includes(role))
  || user.apiPermissions.some(permission => ["INCIDENT.READ_ALL", "INCIDENT.CLAIM", "INCIDENT.DECIDE", "DISPATCH.ASSIGN"].includes(permission));
const responder = (user: AuthenticatedUser) =>
  user.roles.includes("RESPONDER") || user.apiPermissions.some(permission => ["DISPATCH.READ_OWN", "DISPATCH.UPDATE_OWN"].includes(permission));

export function canReceiveNotification(notification: NotificationRecord, resource: LinkedResourceState | null, user: AuthenticatedUser) {
  if (user.roles.length === 1 && user.roles[0] === "GENERAL_USER") return false;
  if (notification.resource.resource_type === "INCIDENT") return controlUser(user);
  if (controlUser(user)) return notification.notification_type !== "DISPATCH_ASSIGNED";
  return responder(user) && resource?.resource_type === "DISPATCH" && resource.assigned_user_public_id === user.publicId;
}

export function deriveNotificationActionState(notification: NotificationRecord, linkedResource: LinkedResourceState | null, currentUser: AuthenticatedUser): NotificationActionState {
  const fallback: NotificationActionState = { action_required: false, action_label: null, target_path: null, reason: "UPDATE_ONLY", state_label: "상태 업데이트" };
  if (!linkedResource || !canReceiveNotification(notification, linkedResource, currentUser)) return fallback;
  if (linkedResource.resource_type === "INCIDENT" && controlUser(currentUser)) {
    if (notification.notification_type === "INCIDENT_CREATED" && linkedResource.status === "NEW") return { action_required: true, action_label: "사건 확인", target_path: "/control", reason: "INCIDENT_UNACKNOWLEDGED", state_label: "조치 필요" };
    if (notification.notification_type === "DISPATCH_REJECTED" && linkedResource.status === "DISPATCH_REQUESTED" && !linkedResource.active_dispatch) return { action_required: true, action_label: "재배정 검토", target_path: "/control", reason: "DISPATCH_REASSIGNMENT_REQUIRED", state_label: "조치 필요" };
    if (notification.notification_type === "ACTION_COMPLETED" && linkedResource.status === "ACTION_COMPLETED") return { action_required: true, action_label: "조치 결과 확인", target_path: "/control", reason: "ACTION_REVIEW_REQUIRED", state_label: "조치 필요" };
    if (linkedResource.status === "CLOSED" || linkedResource.status === "ACKNOWLEDGED") return { ...fallback, reason: "INCIDENT_PROCESSED", state_label: "처리됨" };
  }
  if (linkedResource.resource_type === "DISPATCH" && responder(currentUser)) {
    if (notification.notification_type === "DISPATCH_ASSIGNED" && linkedResource.status === "REQUESTED" && linkedResource.assigned_user_public_id === currentUser.publicId) return { action_required: true, action_label: "출동 요청 확인", target_path: "/dispatch", reason: "DISPATCH_RESPONSE_REQUIRED", state_label: "조치 필요" };
    if (["ACCEPTED", "ARRIVED", "ACTION_COMPLETED", "CANCELLED"].includes(linkedResource.status)) return { ...fallback, reason: "DISPATCH_PROCESSED", state_label: "처리됨" };
  }
  return fallback;
}

const incidentPublicIdPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function safeNotificationTarget(path: string | null, user: AuthenticatedUser): NotificationTargetPath | null {
  if (path === "/control" && controlUser(user)) return path;
  if (path?.startsWith("/control/incidents/") && controlUser(user)) {
    const publicId = path.slice("/control/incidents/".length);
    if (incidentPublicIdPattern.test(publicId)) return `/control/incidents/${publicId}`;
  }
  if (path === "/dispatch" && responder(user)) return path;
  return null;
}

export function resolveNotificationTarget(notification: NotificationRecord, user: AuthenticatedUser): NotificationTargetPath | null {
  if (notification.resource.resource_type === "INCIDENT" && controlUser(user)) {
    const publicId = notification.resource.resource_public_id;
    return incidentPublicIdPattern.test(publicId) ? `/control/incidents/${publicId}` : null;
  }
  if (notification.resource.resource_type === "DISPATCH" && responder(user)) return "/dispatch";
  return safeNotificationTarget(notification.target_path, user);
}

export function formatRelativeTime(value: string, now = Date.now()) {
  const timestamp = new Date(value).getTime();
  if (Number.isNaN(timestamp)) return "시간 확인 불가";
  const minutes = Math.max(0, Math.floor((now - timestamp) / 60_000));
  if (minutes < 1) return "방금 전";
  if (minutes < 60) return `${minutes}분 전`;
  if (minutes < 24 * 60) return `${Math.floor(minutes / 60)}시간 전`;
  if (minutes < 48 * 60) return "어제";
  return new Intl.DateTimeFormat("ko-KR", { month: "long", day: "numeric", timeZone: "Asia/Seoul" }).format(new Date(timestamp));
}

export function formatExactKst(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "시간 확인 불가";
  return new Intl.DateTimeFormat("ko-KR", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Seoul" }).format(date);
}

export function formatUnreadCount(count: number) {
  return count > 99 ? "99+" : String(Math.max(0, count));
}

export function notificationStateCopy(item: Pick<NotificationViewModel, "reason" | "state_label">) {
  const labels: Record<string, string> = {
    INCIDENT_UNACKNOWLEDGED: "확인 필요",
    DISPATCH_REASSIGNMENT_REQUIRED: "재배정 필요",
    DISPATCH_RESPONSE_REQUIRED: "응답 필요",
    ACTION_REVIEW_REQUIRED: "종료 검토",
    INCIDENT_PROCESSED: "처리됨",
    DISPATCH_PROCESSED: "처리됨",
  };
  return labels[item.reason] ?? item.state_label;
}

export function notificationTaskCopy(item: Pick<NotificationViewModel, "reason" | "action_required">) {
  const tasks: Record<string, string> = {
    INCIDENT_UNACKNOWLEDGED: "AI 탐지 결과와 CCTV 영상을 검토한 뒤 실제 위험 여부를 판단해 주세요.",
    DISPATCH_REASSIGNMENT_REQUIRED: "다른 출동 담당자를 선택하고 출동을 다시 요청해 주세요.",
    DISPATCH_RESPONSE_REQUIRED: "배정된 출동 요청의 위치와 내용을 확인한 뒤 응답해 주세요.",
    ACTION_REVIEW_REQUIRED: "조치 결과를 검토한 뒤 사건 종료 여부를 결정해 주세요.",
  };
  return tasks[item.reason] ?? (item.action_required
    ? "관련 업무 화면에서 현재 상태와 필요한 조치를 확인해 주세요."
    : "최근 상태 변경 내용을 확인해 주세요.");
}

export function notificationNavigationLabel(item: Pick<NotificationViewModel, "reason" | "target_path">) {
  if (item.target_path === "/dispatch") return "출동 화면 보기";
  if (item.target_path?.startsWith("/control/incidents/")) return "사건 상세 보기";
  return item.target_path === "/control" ? "관제 화면 보기" : null;
}

export type NotificationQueueGroup = "priority" | "action" | "update";

export function notificationQueueGroup(item: NotificationViewModel): NotificationQueueGroup {
  if (item.action_required && !item.read && ["CRITICAL", "HIGH"].includes(item.severity)) return "priority";
  return item.action_required ? "action" : "update";
}

const severityRank: Record<NotificationSeverity, number> = { CRITICAL: 0, HIGH: 1, WARNING: 2, INFO: 3 };
const actionReasonRank: Record<string, number> = {
  INCIDENT_UNACKNOWLEDGED: 0,
  DISPATCH_REASSIGNMENT_REQUIRED: 1,
  DISPATCH_RESPONSE_REQUIRED: 2,
  ACTION_REVIEW_REQUIRED: 3,
};

/** Frontend demo ordering. Replace with the server ordering contract when the notification API is available. */
export function compareNotificationPriority(a: NotificationViewModel, b: NotificationViewModel) {
  if (a.action_required !== b.action_required) return a.action_required ? -1 : 1;
  const unreadDifference = Number(a.read) - Number(b.read);
  if (unreadDifference) return unreadDifference;
  if (a.action_required && b.action_required) {
    const severityDifference = severityRank[a.severity] - severityRank[b.severity];
    if (severityDifference) return severityDifference;
    const reasonDifference = (actionReasonRank[a.reason] ?? 9) - (actionReasonRank[b.reason] ?? 9);
    if (reasonDifference) return reasonDifference;
    return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
  }
  return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
}

export function sortNotificationQueue(
  items: NotificationViewModel[],
  view: "action" | "all" | "unread",
  sort: "newest" | "oldest",
) {
  return [...items].sort((a, b) => {
    const grouped = compareNotificationPriority(a, b);
    if (view === "action" || notificationQueueGroup(a) !== notificationQueueGroup(b)) return grouped;
    const delta = new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    return sort === "newest" ? delta : -delta;
  });
}
