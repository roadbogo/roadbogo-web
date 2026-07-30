import { describe, expect, it } from "vitest";
import type { NotificationViewModel } from "./notificationTypes";
import { adminActionNotifications, classifyAdminNotification } from "./adminNotificationPresentation";

const item = (overrides: Partial<NotificationViewModel>): NotificationViewModel => ({
  public_id: "notification",
  notification_type: "SYSTEM_STATUS",
  admin_category: "SYSTEM",
  severity: "WARNING",
  title: "운영 알림",
  body: "확인이 필요합니다.",
  resource: { resource_type: "SYSTEM", resource_public_id: "system", resource_label: "인증 서비스" },
  resource_label: "인증 서비스",
  target_path: null,
  delivery_status: "DELIVERED",
  read: false,
  delivered_at: "2026-07-29T01:00:00Z",
  read_at: null,
  created_at: "2026-07-29T01:00:00Z",
  action_required: false,
  action_label: null,
  reason: "UPDATE_ONLY",
  state_label: "상태 업데이트",
  ...overrides,
});

describe("system-admin notification presentation", () => {
  it("keeps operational and security issues while excluding completed activity", () => {
    expect(classifyAdminNotification(item({ notification_type: "SYSTEM_STATUS" })).category).toBe("ACTION_REQUIRED");
    expect(classifyAdminNotification(item({ notification_type: "ACCOUNT_CHANGED", admin_category: "ACCOUNT", severity: "WARNING" })).category).toBe("ACTION_REQUIRED");
    expect(classifyAdminNotification(item({ notification_type: "ACCOUNT_CHANGED", admin_category: "ACCOUNT", severity: "INFO" })).category).toBe("AUDIT_ACTIVITY");
    expect(classifyAdminNotification(item({ notification_type: "ROLE_CHANGED", admin_category: "ROLE", severity: "HIGH" })).category).toBe("AUDIT_ACTIVITY");
    expect(classifyAdminNotification(item({ notification_type: "AUDIT_RECORDED", admin_category: "AUDIT", severity: "INFO" })).category).toBe("AUDIT_ACTIVITY");
  });

  it("selects unread and severe notifications first with stable oldest-first ties", () => {
    const sorted = adminActionNotifications([
      item({ public_id: "read-critical", severity: "CRITICAL", read: true }),
      item({ public_id: "warning-new", severity: "WARNING", created_at: "2026-07-29T03:00:00Z" }),
      item({ public_id: "critical-new", severity: "CRITICAL", created_at: "2026-07-29T02:00:00Z" }),
      item({ public_id: "critical-old", severity: "CRITICAL", created_at: "2026-07-29T01:00:00Z" }),
    ]);
    expect(sorted.map(entry => entry.public_id)).toEqual(["critical-old", "critical-new", "warning-new", "read-critical"]);
  });
});
