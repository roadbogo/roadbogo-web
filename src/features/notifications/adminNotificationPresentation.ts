import type { NotificationSeverity, NotificationViewModel } from "./notificationTypes";

export type AdminNotificationPresentation =
  | { category: "ACTION_REQUIRED"; priority: number; actionLabel: string | null; targetPath: string | null }
  | { category: "AUDIT_ACTIVITY" };

const severityPriority: Record<NotificationSeverity, number> = {
  CRITICAL: 4,
  HIGH: 3,
  WARNING: 2,
  INFO: 1,
};

export function classifyAdminNotification(item: NotificationViewModel): AdminNotificationPresentation {
  const systemIssue = item.notification_type === "SYSTEM_STATUS";
  const accountRisk = item.notification_type === "ACCOUNT_CHANGED" && item.severity !== "INFO";
  const roleRisk = item.notification_type === "ROLE_CHANGED" && item.severity === "CRITICAL";
  if (!systemIssue && !accountRisk && !roleRisk) return { category: "AUDIT_ACTIVITY" };

  return {
    category: "ACTION_REQUIRED",
    priority: severityPriority[item.severity],
    actionLabel: item.action_label
      ?? (item.notification_type === "SYSTEM_STATUS"
        ? "상태 확인"
        : item.notification_type === "ACCOUNT_CHANGED"
          ? "계정 상태 확인"
          : item.notification_type === "ROLE_CHANGED"
            ? "역할 변경 확인"
            : item.target_path ? "상세 확인" : null),
    targetPath: item.target_path,
  };
}

export function adminActionNotifications(items: NotificationViewModel[]) {
  return items
    .filter(item => classifyAdminNotification(item).category === "ACTION_REQUIRED")
    .sort((a, b) => {
      const unread = Number(a.read) - Number(b.read);
      if (unread) return unread;
      const priority = severityPriority[b.severity] - severityPriority[a.severity];
      if (priority) return priority;
      const created = new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
      return created || a.public_id.localeCompare(b.public_id);
    });
}
