import { describe, expect, it } from "vitest";
import type { AuthenticatedUser } from "@/components/auth/AuthContext";
import { canReceiveNotification, compareNotificationPriority, deriveNotificationActionState, formatUnreadCount, hasNewUnreadNotification, managerGuidance, managerQueueGroup, managerTaskCopy, notificationNavigationLabel, notificationPresentation, notificationQueueGroup, notificationStateCopy, notificationTaskCopy, resolveNotificationTarget, resolveNotificationVisualTone, safeNotificationTarget, severityLabels, sortNotificationQueue, systemAdminQueue } from "./notificationDomain";
import type { LinkedResourceState, NotificationRecord, NotificationViewModel } from "./notificationTypes";
import { mockDispatchPublicIds, mockIncidentPublicIds } from "@/features/mocks/mockResourceIds";
import { mockSystemAdminNotifications } from "./mockSystemAdminNotifications";

const user = (role: AuthenticatedUser["role"], publicId = "user-1"): AuthenticatedUser => ({
  publicId, name: "테스트 사용자", role, roles: [role], email: "test@example.com",
  apiPermissions: [], uiRoles: role === "RESPONDER" ? ["FIELD_RESPONDER"] : role === "GENERAL_USER" ? [] : ["CONTROL_OPERATOR"],
  uiPermissions: ["profile:view"],
});
const notification = (type: NotificationRecord["notification_type"], resourceType: "INCIDENT" | "DISPATCH" = "INCIDENT"): NotificationRecord => ({
  public_id: "10000000-0000-4000-8000-000000000001", notification_type: type, severity: "HIGH", title: "알림", body: "본문",
  resource: { resource_type: resourceType, resource_public_id: resourceType === "INCIDENT" ? mockIncidentPublicIds["INC-20260719-0012"] : mockDispatchPublicIds["DSP-20260719-0031"], resource_label: resourceType === "INCIDENT" ? "INC-20260719-0012" : "DSP-20260719-0031" }, target_path: resourceType === "INCIDENT" ? "/control" : "/dispatch",
  delivery_status: "DELIVERED", read: false, delivered_at: "2026-07-19T00:00:00Z", read_at: null, created_at: "2026-07-19T00:00:00Z",
});

describe("notification bell state",()=>{
  it("uses the unified label for HIGH without changing the severity code",()=>{expect(severityLabels.HIGH).toBe("주의");expect(notification("INCIDENT_CREATED").severity).toBe("HIGH")});
  it("detects only newly visible unread notification IDs",()=>{expect(hasNewUnreadNotification(["visible-1"],new Set())).toBe(true);expect(hasNewUnreadNotification(["visible-1"],new Set(["visible-1"]))).toBe(false);expect(hasNewUnreadNotification([],new Set(["visible-1"]))).toBe(false)});
});

describe("notification visual tone",()=>{
  it("prioritizes critical, security, caution, and neutral information semantics",()=>{
    expect(resolveNotificationVisualTone({...notification("INCIDENT_CREATED"),severity:"CRITICAL"})).toBe("URGENT");
    expect(resolveNotificationVisualTone({...notification("ACCOUNT_CHANGED"),severity:"HIGH",resource:{resource_type:"ACCOUNT",resource_public_id:"account",resource_label:"계정"}})).toBe("SECURITY");
    expect(resolveNotificationVisualTone({...notification("SYSTEM_STATUS"),severity:"WARNING",title:"전달 지연",body:"알림 전달이 지연됩니다."})).toBe("CAUTION");
    expect(resolveNotificationVisualTone({...notification("SYSTEM_STATUS"),severity:"INFO",title:"서비스 복구",body:"정상 상태입니다."})).toBe("SUCCESS");
  });
});

describe("system administrator operating inbox",()=>{
  it("derives priority queues without adding an API field",()=>{
    const critical={...notification("SYSTEM_STATUS","INCIDENT"),notification_type:"SYSTEM_STATUS" as const,severity:"CRITICAL" as const,resource:{resource_type:"SYSTEM" as const,resource_public_id:"system",resource_label:"인증 서비스"}};
    const warning={...critical,public_id:"warning",notification_type:"ACCOUNT_CHANGED" as const,severity:"WARNING" as const,resource:{resource_type:"ACCOUNT" as const,resource_public_id:"account",resource_label:"운영 계정"}};
    expect(systemAdminQueue({...critical,action_required:false,action_label:null,reason:"UPDATE_ONLY",state_label:"상태 업데이트",resource_label:"인증 서비스"} as NotificationViewModel)).toBe("immediate");
    expect(systemAdminQueue({...warning,action_required:false,action_label:null,reason:"UPDATE_ONLY",state_label:"상태 업데이트",resource_label:"운영 계정"} as NotificationViewModel)).toBe("attention");
    expect(systemAdminQueue({...warning,read:true,action_required:false,action_label:null,reason:"UPDATE_ONLY",state_label:"상태 업데이트",resource_label:"운영 계정"} as NotificationViewModel)).toBe("attention");
  });
  it("keeps read state independent from unresolved administrator work",()=>{
    const unresolved=mockSystemAdminNotifications.slice(0,4).map(item=>{
      const readItem={...item,read:true};
      return systemAdminQueue(readItem);
    });
    expect(unresolved).toEqual(["immediate","attention","attention","immediate"]);
  });
  it("splits the seven administrator mocks into pending work and completed history",()=>{
    const grouped=mockSystemAdminNotifications.map(item=>[item.public_id,systemAdminQueue(item)]);
    expect(grouped).toEqual([
      ["admin-notification-001","immediate"],
      ["admin-notification-002","attention"],
      ["admin-notification-003","attention"],
      ["admin-notification-004","immediate"],
      ["admin-notification-005","change"],
      ["admin-notification-006","change"],
      ["admin-notification-007","change"],
    ]);
  });
  it("uses a distinct change tone for role notifications",()=>{
    const role={...notification("ROLE_CHANGED"),resource:{resource_type:"ROLE" as const,resource_public_id:"role",resource_label:"역할 정책"}};
    expect(resolveNotificationVisualTone(role)).toBe("CHANGE");
  });
});

describe("manager notification queue",()=>{
  const view=(type:NotificationRecord["notification_type"],reason:NotificationViewModel["reason"],actionRequired=true)=>({
    ...notification(type),
    resource_label:"INC-1",action_required:actionRequired,action_label:"사건 상세 보기",reason,state_label:"상태 업데이트",evidence:null,
  } as NotificationViewModel);
  it("maps only currently actionable reasons to one management group",()=>{
    expect(managerQueueGroup(view("INCIDENT_CREATED","INCIDENT_UNACKNOWLEDGED"))).toBe("immediate");
    expect(managerQueueGroup(view("DISPATCH_REJECTED","DISPATCH_REASSIGNMENT_REQUIRED"))).toBe("action");
    expect(managerQueueGroup(view("ACTION_COMPLETED","ACTION_REVIEW_REQUIRED"))).toBe("complete");
    expect(managerQueueGroup(view("INCIDENT_CREATED","INCIDENT_PROCESSED",false))).toBeNull();
    expect(managerQueueGroup(view("DISPATCH_CANCELLED","UPDATE_ONLY",false))).toBeNull();
    expect(managerQueueGroup(view("ACTION_COMPLETED","INCIDENT_PROCESSED",false))).toBeNull();
  });
  it("provides manager guidance without inventing an action endpoint",()=>{
    expect(managerGuidance.DISPATCH_REJECTED).toEqual({title:"재배정 확인",body:expect.stringContaining("후속 출동 담당자")});
    expect(managerGuidance.ACTION_COMPLETED.title).toBe("종료 확인");
  });
  it("uses manager task guidance only for actionable reasons",()=>{
    expect(managerTaskCopy(view("INCIDENT_CREATED","INCIDENT_UNACKNOWLEDGED"))).toContain("실제 위험 여부");
    expect(managerTaskCopy(view("DISPATCH_REJECTED","DISPATCH_REASSIGNMENT_REQUIRED"))).toContain("다른 출동 담당자");
    expect(managerTaskCopy(view("ACTION_COMPLETED","ACTION_REVIEW_REQUIRED"))).toContain("사건 종료 여부");
    expect(managerTaskCopy(view("INCIDENT_CREATED","INCIDENT_PROCESSED",false))).toBeNull();
    expect(managerTaskCopy(view("DISPATCH_CANCELLED","DISPATCH_PROCESSED",false))).toBeNull();
    expect(managerTaskCopy(view("INCIDENT_STATUS_CHANGED","UPDATE_ONLY",false))).toBeNull();
  });
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

  it.each(["ACCEPTED", "ARRIVED", "ACTION_COMPLETED", "CANCELLED"] as const)(
    "marks a %s dispatch as processed",
    (status) => {
      const responder = user("RESPONDER");
      const item = notification("DISPATCH_ASSIGNED", "DISPATCH");
      expect(deriveNotificationActionState(item, {
        resource_type: "DISPATCH",
        public_id: mockDispatchPublicIds["DSP-20260719-0031"],
        status,
        assigned_user_public_id: responder.publicId ?? null,
      }, responder)).toMatchObject({ action_required: false, reason: "DISPATCH_PROCESSED", state_label: "처리됨" });
    },
  );

  it("hides operations notifications from general users and rejects unknown paths", () => {
    const general = user("GENERAL_USER");
    expect(canReceiveNotification(notification("INCIDENT_CREATED"), null, general)).toBe(false);
    expect(safeNotificationTarget("/admin", general)).toBeNull();
  });

  it("resolves only authorized, valid internal notification targets", () => {
    const controller = user("CONTROLLER");
    const responder = user("RESPONDER");
    expect(resolveNotificationTarget(notification("INCIDENT_CREATED"), controller)).toBe("/control");
    expect(resolveNotificationTarget(notification("DISPATCH_ASSIGNED", "DISPATCH"), responder)).toBe("/dispatch");
    expect(resolveNotificationTarget({ ...notification("INCIDENT_CREATED"), target_path: null, resource: { resource_type: "INCIDENT", resource_public_id: "12", resource_label: "INC-12" } }, controller)).toBe("/notifications?notification=10000000-0000-4000-8000-000000000001");
    expect(safeNotificationTarget("//evil.example/path", controller)).toBeNull();
    expect(safeNotificationTarget("https://evil.example/path", controller)).toBeNull();
    expect(safeNotificationTarget("/control/incidents/INC-20260719-0012?next=https://evil.example", controller)).toBeNull();
    expect(resolveNotificationTarget(notification("INCIDENT_CREATED"), user("GENERAL_USER"))).toBe("/notifications?notification=10000000-0000-4000-8000-000000000001");
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

  it("sorts visible notifications by newest, severity, or unread state", () => {
    const view = (publicId: string, createdAt: string, severity: NotificationViewModel["severity"], read: boolean): NotificationViewModel => ({
      ...notification("INCIDENT_CREATED"),
      public_id: publicId,
      created_at: createdAt,
      delivered_at: createdAt,
      severity,
      read,
      action_required: true,
      action_label: "사건 확인",
      target_path: "/control/incidents/INC-20260719-0012",
      reason: "INCIDENT_UNACKNOWLEDGED",
      state_label: "조치 필요",
      resource_label: "INC-20260719-0012",
    });
    const items = [
      view("warning-unread", "2026-07-19T02:00:00Z", "WARNING", false),
      view("critical-read", "2026-07-19T03:00:00Z", "CRITICAL", true),
      view("critical-unread-old", "2026-07-19T00:00:00Z", "CRITICAL", false),
      view("critical-unread-new", "2026-07-19T01:00:00Z", "CRITICAL", false),
    ];
    const originalOrder = items.map(item => item.public_id);

    expect(sortNotificationQueue(items, "newest").map(item => item.public_id))
      .toEqual(["critical-read", "warning-unread", "critical-unread-new", "critical-unread-old"]);
    expect(sortNotificationQueue(items, "severity").map(item => item.public_id))
      .toEqual(["critical-read", "critical-unread-new", "critical-unread-old", "warning-unread"]);
    expect(sortNotificationQueue(items, "unread").map(item => item.public_id))
      .toEqual(["warning-unread", "critical-unread-new", "critical-unread-old", "critical-read"]);
    expect(items.map(item => item.public_id)).toEqual(originalOrder);
  });

  it("uses the public ID as a stable tie breaker for equal timestamps", () => {
    const base = {
      ...notification("INCIDENT_CREATED"),
      action_required: false,
      action_label: null,
      target_path: null,
      reason: "UPDATE_ONLY",
      state_label: "상태 업데이트" as const,
      resource_label: "INC-1",
    };
    const items = [{ ...base, public_id: "b" }, { ...base, public_id: "a" }];
    expect(sortNotificationQueue(items, "newest").map(item => item.public_id)).toEqual(["a", "b"]);
  });
});
