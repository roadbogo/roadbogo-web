import { describe, expect, it } from "vitest";
import type { AuthenticatedUser } from "@/components/auth/AuthContext";
import { canReceiveNotification, compareNotificationPriority, deriveNotificationActionState, formatUnreadCount, notificationNavigationLabel, notificationPresentation, notificationQueueGroup, notificationStateCopy, notificationTaskCopy, resolveNotificationTarget, safeNotificationTarget, sortNotificationQueue } from "./notificationDomain";
import type { LinkedResourceState, NotificationRecord, NotificationViewModel } from "./notificationTypes";

const user = (role: AuthenticatedUser["role"], publicId = "user-1"): AuthenticatedUser => ({
  publicId, name: "테스트 사용자", role, roles: [role], email: "test@example.com",
  apiPermissions: [], uiRoles: role === "RESPONDER" ? ["FIELD_RESPONDER"] : role === "GENERAL_USER" ? [] : ["CONTROL_OPERATOR"],
  uiPermissions: ["profile:view"],
});
const notification = (type: NotificationRecord["notification_type"], resourceType: "INCIDENT" | "DISPATCH" = "INCIDENT"): NotificationRecord => ({
  public_id: "10000000-0000-4000-8000-000000000001", notification_type: type, severity: "HIGH", title: "알림", body: "본문",
  resource: { resource_type: resourceType, resource_public_id: resourceType === "INCIDENT" ? "INC-20260719-0012" : "DSP-20260719-0031" }, target_path: resourceType === "INCIDENT" ? "/control" : "/dispatch",
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

  it("resolves only authorized, valid internal notification targets", () => {
    const controller = user("CONTROLLER");
    const responder = user("RESPONDER");
    expect(resolveNotificationTarget(notification("INCIDENT_CREATED"), controller)).toBe("/control/incidents/INC-20260719-0012");
    expect(resolveNotificationTarget(notification("DISPATCH_ASSIGNED", "DISPATCH"), responder)).toBe("/dispatch");
    expect(resolveNotificationTarget({ ...notification("INCIDENT_CREATED"), resource: { resource_type: "INCIDENT", resource_public_id: "12" } }, controller)).toBeNull();
    expect(safeNotificationTarget("//evil.example/path", controller)).toBeNull();
    expect(safeNotificationTarget("https://evil.example/path", controller)).toBeNull();
    expect(safeNotificationTarget("/control/incidents/INC-20260719-0012?next=https://evil.example", controller)).toBeNull();
    expect(resolveNotificationTarget(notification("INCIDENT_CREATED"), user("GENERAL_USER"))).toBeNull();
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
    expect(notificationNavigationLabel({ reason: "INCIDENT_UNACKNOWLEDGED", target_path: "/control/incidents/INC-20260719-0012" })).toBe("사건 상세 보기");
    expect(notificationNavigationLabel({ reason: "DISPATCH_REASSIGNMENT_REQUIRED", target_path: "/control/incidents/INC-20260719-0012" })).toBe("사건 상세 보기");
    expect(notificationNavigationLabel({ reason: "DISPATCH_RESPONSE_REQUIRED", target_path: "/dispatch" })).toBe("출동 화면 보기");
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

  it("keeps action work priority fixed while applying time sort inside other groups", () => {
    const view = (publicId: string, createdAt: string, actionRequired = true): NotificationViewModel => ({
      ...notification("INCIDENT_CREATED"),
      public_id: publicId,
      created_at: createdAt,
      delivered_at: createdAt,
      action_required: actionRequired,
      action_label: actionRequired ? "사건 확인" : null,
      target_path: "/control/incidents/INC-20260719-0012",
      reason: actionRequired ? "INCIDENT_UNACKNOWLEDGED" : "UPDATE_ONLY",
      state_label: actionRequired ? "조치 필요" : "상태 업데이트",
      resource_label: "INC-20260719-0012",
    });
    const items = [
      view("older-action", "2026-07-19T00:00:00Z"),
      view("newer-action", "2026-07-19T01:00:00Z"),
    ];

    expect(sortNotificationQueue(items, "action", "newest").map(item => item.public_id))
      .toEqual(sortNotificationQueue(items, "action", "oldest").map(item => item.public_id));
    expect(sortNotificationQueue(items, "all", "newest").map(item => item.public_id)).toEqual(["newer-action", "older-action"]);
    expect(sortNotificationQueue(items, "all", "oldest").map(item => item.public_id)).toEqual(["older-action", "newer-action"]);
  });
});
