import { describe, expect, it } from "vitest";
import type { AuthenticatedUser } from "@/components/auth/AuthContext";
import { canReceiveNotification, compareNotificationPriority, deriveNotificationActionState, formatUnreadCount, notificationNavigationLabel, notificationPresentation, notificationQueueGroup, notificationStateCopy, notificationTaskCopy, safeNotificationTarget } from "./notificationDomain";
import type { LinkedResourceState, NotificationRecord, NotificationViewModel } from "./notificationTypes";

const user = (role: AuthenticatedUser["role"], publicId = "user-1"): AuthenticatedUser => ({
  publicId, name: "테스트 사용자", role, roles: [role], email: "test@example.com",
  apiPermissions: [], uiRoles: role === "RESPONDER" ? ["FIELD_RESPONDER"] : role === "GENERAL_USER" ? [] : ["CONTROL_OPERATOR"],
  uiPermissions: ["profile:view"],
});
const notification = (type: NotificationRecord["notification_type"], resourceType: "INCIDENT" | "DISPATCH" = "INCIDENT"): NotificationRecord => ({
  public_id: "10000000-0000-4000-8000-000000000001", notification_type: type, severity: "HIGH", title: "알림", body: "본문",
  resource: { resource_type: resourceType, resource_public_id: "resource-1" }, target_path: resourceType === "INCIDENT" ? "/control" : "/dispatch",
  delivery_status: "DELIVERED", read: false, delivered_at: "2026-07-19T00:00:00Z", read_at: null, created_at: "2026-07-19T00:00:00Z",
});

describe("deriveNotificationActionState", () => {
  it("keeps unread and action-required as independent states", () => {
    const item = { ...notification("INCIDENT_CREATED"), read: true };
    const state: LinkedResourceState = { resource_type: "INCIDENT", public_id: "resource-1", status: "NEW", active_dispatch: false };
    expect(deriveNotificationActionState(item, state, user("CONTROLLER"))).toMatchObject({ action_required: true, action_label: "사건 확인" });
  });

  it("derives controller reassignment and completed-action review", () => {
    const controller = user("CONTROL_MANAGER");
    expect(deriveNotificationActionState(notification("DISPATCH_REJECTED"), { resource_type: "INCIDENT", public_id: "resource-1", status: "DISPATCH_REQUESTED", active_dispatch: false }, controller).reason).toBe("DISPATCH_REASSIGNMENT_REQUIRED");
    expect(deriveNotificationActionState(notification("ACTION_COMPLETED"), { resource_type: "INCIDENT", public_id: "resource-1", status: "ACTION_COMPLETED", active_dispatch: true }, controller).reason).toBe("ACTION_REVIEW_REQUIRED");
  });

  it("requires the assigned responder for a requested dispatch", () => {
    const responder = user("RESPONDER");
    const item = notification("DISPATCH_ASSIGNED", "DISPATCH");
    expect(deriveNotificationActionState(item, { resource_type: "DISPATCH", public_id: "resource-1", status: "REQUESTED", assigned_user_public_id: responder.publicId ?? null }, responder).action_required).toBe(true);
    expect(canReceiveNotification(item, { resource_type: "DISPATCH", public_id: "resource-1", status: "REQUESTED", assigned_user_public_id: "another-user" }, responder)).toBe(false);
  });

  it("hides operations notifications from general users and rejects unknown paths", () => {
    const general = user("GENERAL_USER");
    expect(canReceiveNotification(notification("INCIDENT_CREATED"), null, general)).toBe(false);
    expect(safeNotificationTarget("/admin", general)).toBeNull();
  });

  it("caps the visible unread badge at 99+", () => {
    expect(formatUnreadCount(0)).toBe("0");
    expect(formatUnreadCount(1)).toBe("1");
    expect(formatUnreadCount(100)).toBe("99+");
  });

  it("sorts unread actionable work ahead of updates without coupling read and action state", () => {
    const view = (overrides: Partial<NotificationViewModel>): NotificationViewModel => ({
      ...notification("INCIDENT_CREATED"),
      action_required: false,
      action_label: null,
      target_path: null,
      reason: "UPDATE_ONLY",
      state_label: "상태 업데이트",
      resource_label: "INC-1",
      ...overrides,
    });
    const items = [
      view({ public_id: "update", read: false }),
      view({ public_id: "read-action", read: true, action_required: true, reason: "INCIDENT_UNACKNOWLEDGED" }),
      view({ public_id: "unread-action", read: false, action_required: true, reason: "INCIDENT_UNACKNOWLEDGED" }),
    ].sort(compareNotificationPriority);

    expect(items.map(item => item.public_id)).toEqual(["unread-action", "read-action", "update"]);
  });

  it("keeps display category and tone in the shared presentation map", () => {
    expect(notificationPresentation.INCIDENT_CREATED).toMatchObject({ category: "ACTION_REQUIRED", tone: "critical" });
    expect(notificationPresentation.DISPATCH_ARRIVED).toMatchObject({ category: "UPDATE", tone: "info" });
  });

  it("uses task-specific metadata instead of repeating a generic action label", () => {
    expect(notificationStateCopy({ reason: "INCIDENT_UNACKNOWLEDGED", state_label: "조치 필요" })).toBe("확인 필요");
    expect(notificationStateCopy({ reason: "DISPATCH_REASSIGNMENT_REQUIRED", state_label: "조치 필요" })).toBe("재배정 필요");
    expect(notificationStateCopy({ reason: "ACTION_REVIEW_REQUIRED", state_label: "조치 필요" })).toBe("종료 검토");
  });

  it("keeps navigation labels separate from workflow state-changing actions", () => {
    expect(notificationNavigationLabel({ reason: "INCIDENT_UNACKNOWLEDGED", target_path: "/control" })).toBe("사건 상세 보기");
    expect(notificationNavigationLabel({ reason: "DISPATCH_REASSIGNMENT_REQUIRED", target_path: "/control" })).toBe("재배정 화면 열기");
    expect(notificationNavigationLabel({ reason: "DISPATCH_RESPONSE_REQUIRED", target_path: "/dispatch" })).toBe("출동 상세 보기");
    expect(notificationTaskCopy({ reason: "ACTION_REVIEW_REQUIRED", action_required: true })).toContain("사건 종료 여부");
  });

  it("separates priority, actionable, and update queue groups", () => {
    const base = {
      ...notification("INCIDENT_CREATED"),
      action_label: "사건 확인",
      target_path: "/control" as const,
      reason: "INCIDENT_UNACKNOWLEDGED",
      state_label: "조치 필요" as const,
      resource_label: "INC-1",
    };
    expect(notificationQueueGroup({ ...base, action_required: true, read: false, severity: "HIGH" })).toBe("priority");
    expect(notificationQueueGroup({ ...base, action_required: true, read: true, severity: "HIGH" })).toBe("action");
    expect(notificationQueueGroup({ ...base, action_required: false, read: false, severity: "INFO" })).toBe("update");
  });
});
