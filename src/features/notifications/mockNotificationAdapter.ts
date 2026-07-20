import type { AuthenticatedUser } from "@/components/auth/AuthContext";
import { canReceiveNotification } from "./notificationDomain";
import type { LinkedResourceState, NotificationAdapter, NotificationEvidence, NotificationPage, NotificationRecord } from "./notificationTypes";

const ago = (minutes: number) => new Date(Date.now() - minutes * 60_000).toISOString();
const resource = (resource_type: "INCIDENT" | "DISPATCH", resource_public_id: string) => ({ resource_type, resource_public_id });

const records: NotificationRecord[] = [
  { public_id: "10000000-0000-4000-8000-000000000001", notification_type: "INCIDENT_CREATED", severity: "HIGH", title: "신규 위험 사건", body: "중부고속도로에서 낙하물이 탐지되었습니다.", resource: resource("INCIDENT", "INC-20260719-0012"), target_path: "/control", delivery_status: "DELIVERED", read: false, delivered_at: ago(2), read_at: null, created_at: ago(2) },
  { public_id: "10000000-0000-4000-8000-000000000002", notification_type: "INCIDENT_CREATED", severity: "WARNING", title: "미확인 위험 사건", body: "차로 위 정지 물체를 확인해 주세요.", resource: resource("INCIDENT", "INC-20260719-0011"), target_path: "/control", delivery_status: "DELIVERED", read: true, delivered_at: ago(6), read_at: ago(4), created_at: ago(6) },
  { public_id: "10000000-0000-4000-8000-000000000003", notification_type: "DISPATCH_REJECTED", severity: "WARNING", title: "출동 요청 거절", body: "담당자가 출동 요청을 거절했습니다. 재배정 검토가 필요합니다.", resource: resource("INCIDENT", "INC-20260719-0008"), target_path: "/control", delivery_status: "DELIVERED", read: false, delivered_at: ago(8), read_at: null, created_at: ago(8) },
  { public_id: "10000000-0000-4000-8000-000000000004", notification_type: "ACTION_COMPLETED", severity: "INFO", title: "현장 조치 완료", body: "조치 결과를 확인하고 사건 종료 여부를 검토해 주세요.", resource: resource("INCIDENT", "INC-20260719-0005"), target_path: "/control", delivery_status: "DELIVERED", read: false, delivered_at: ago(18), read_at: null, created_at: ago(18) },
  { public_id: "10000000-0000-4000-8000-000000000005", notification_type: "DISPATCH_ARRIVED", severity: "INFO", title: "현장 도착", body: "출동 담당자가 현장 도착을 등록했습니다.", resource: resource("INCIDENT", "INC-20260719-0006"), target_path: "/control", delivery_status: "DELIVERED", read: true, delivered_at: ago(24), read_at: ago(20), created_at: ago(24) },
  { public_id: "10000000-0000-4000-8000-000000000006", notification_type: "INCIDENT_STATUS_CHANGED", severity: "INFO", title: "사건 처리 완료", body: "현장 조치 확인을 마치고 사건이 종료되었습니다.", resource: resource("INCIDENT", "INC-20260718-0098"), target_path: "/control", delivery_status: "DELIVERED", read: true, delivered_at: ago(1500), read_at: ago(1490), created_at: ago(1500) },
  { public_id: "10000000-0000-4000-8000-000000000007", notification_type: "DISPATCH_ASSIGNED", severity: "HIGH", title: "새 출동 요청", body: "현장 출동 요청이 배정되었습니다. 수락 여부를 확인해 주세요.", resource: resource("DISPATCH", "DSP-20260719-0031"), target_path: "/dispatch", delivery_status: "DELIVERED", read: false, delivered_at: ago(3), read_at: null, created_at: ago(3) },
  { public_id: "10000000-0000-4000-8000-000000000008", notification_type: "DISPATCH_CANCELLED", severity: "INFO", title: "출동 요청 취소", body: "관제센터에서 출동 요청을 취소했습니다.", resource: resource("DISPATCH", "DSP-20260718-0021"), target_path: "/dispatch", delivery_status: "DELIVERED", read: true, delivered_at: ago(1460), read_at: ago(1455), created_at: ago(1460) },
];

const states: Record<string, LinkedResourceState> = {
  "INC-20260719-0012": { resource_type: "INCIDENT", public_id: "INC-20260719-0012", status: "NEW", active_dispatch: false },
  "INC-20260719-0011": { resource_type: "INCIDENT", public_id: "INC-20260719-0011", status: "NEW", active_dispatch: false },
  "INC-20260719-0008": { resource_type: "INCIDENT", public_id: "INC-20260719-0008", status: "DISPATCH_REQUESTED", active_dispatch: false },
  "INC-20260719-0005": { resource_type: "INCIDENT", public_id: "INC-20260719-0005", status: "ACTION_COMPLETED", active_dispatch: true },
  "INC-20260719-0006": { resource_type: "INCIDENT", public_id: "INC-20260719-0006", status: "ACKNOWLEDGED", active_dispatch: true },
  "INC-20260718-0098": { resource_type: "INCIDENT", public_id: "INC-20260718-0098", status: "CLOSED", active_dispatch: false },
  "DSP-20260719-0031": { resource_type: "DISPATCH", public_id: "DSP-20260719-0031", status: "REQUESTED", assigned_user_public_id: "__CURRENT__" },
  "DSP-20260718-0021": { resource_type: "DISPATCH", public_id: "DSP-20260718-0021", status: "CANCELLED", assigned_user_public_id: "__CURRENT__" },
};

const readOverrides = new Set<string>();
const evidence: Record<string, NotificationEvidence> = {
  "INC-20260719-0012": {
    kind: "CCTV",
    camera: "CAM 02",
    location: "중부고속도로 137.4K",
    objectLabel: "낙하물",
    confidence: 92,
    imagePath: "/images/incidents/cctv-highway-base.webp",
  },
};

export function getMockNotificationEvidence(publicId: string) {
  return evidence[publicId] ?? null;
}

export function getMockResourceState(publicId: string, user: AuthenticatedUser): LinkedResourceState | null {
  const state = states[publicId];
  if (!state) return null;
  if (state.resource_type === "DISPATCH" && state.assigned_user_public_id === "__CURRENT__") return { ...state, assigned_user_public_id: user.publicId ?? null };
  return state;
}

export const mockNotificationAdapter: NotificationAdapter = {
  async list(user): Promise<NotificationPage> {
    await Promise.resolve();
    const unique = [...new Map(records.map(item => [item.public_id, item])).values()]
      .map(item => readOverrides.has(item.public_id) ? { ...item, read: true, read_at: new Date().toISOString() } : item)
      .filter(item => canReceiveNotification(item, getMockResourceState(item.resource.resource_public_id, user), user))
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    return { items: unique, pagination: { page: 1, size: 20, total: unique.length, has_next: false }, unread_count: unique.filter(item => !item.read).length };
  },
  async markRead(publicId) { readOverrides.add(publicId); },
  async markAllRead() { records.forEach(item => readOverrides.add(item.public_id)); },
};
