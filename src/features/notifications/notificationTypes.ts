import type { AuthenticatedUser } from "@/components/auth/AuthContext";

export type NotificationType =
  | "INCIDENT_CREATED" | "INCIDENT_STATUS_CHANGED"
  | "DISPATCH_ASSIGNED" | "DISPATCH_ACCEPTED" | "DISPATCH_REJECTED"
  | "DISPATCH_CANCELLED" | "DISPATCH_ARRIVED" | "ACTION_COMPLETED";
export type NotificationSeverity = "INFO" | "WARNING" | "HIGH" | "CRITICAL";
export type NotificationResourceType = "INCIDENT" | "DISPATCH";
export type NotificationTargetPath = "/control" | `/control/incidents/${string}` | "/dispatch";

export type NotificationRecord = {
  public_id: string;
  notification_type: NotificationType;
  severity: NotificationSeverity;
  title: string;
  body: string;
  resource: { resource_type: NotificationResourceType; resource_public_id: string; resource_label: string };
  target_path: string | null;
  delivery_status: "DELIVERED";
  read: boolean;
  delivered_at: string;
  read_at: string | null;
  created_at: string;
};

export type NotificationPage = {
  items: NotificationRecord[];
  pagination: { page: number; size: number; total: number; has_next: boolean };
  unread_count: number;
};

export type LinkedResourceState =
  | { resource_type: "INCIDENT"; public_id: string; status: "NEW" | "ACKNOWLEDGED" | "DISPATCH_REQUESTED" | "ACTION_COMPLETED" | "CLOSED"; active_dispatch: boolean }
  | { resource_type: "DISPATCH"; public_id: string; status: "REQUESTED" | "ACCEPTED" | "ARRIVED" | "CANCELLED" | "ACTION_COMPLETED"; assigned_user_public_id: string | null };

export type NotificationActionState = {
  action_required: boolean;
  action_label: string | null;
  target_path: NotificationTargetPath | null;
  reason: string;
  state_label: "조치 필요" | "처리됨" | "상태 업데이트";
};

export type NotificationViewModel = NotificationRecord & NotificationActionState & {
  resource_label: string;
  evidence?: NotificationEvidence | null;
};

export type NotificationEvidence = {
  kind: "CCTV";
  camera: string;
  location: string;
  objectLabel: string;
  confidence: number;
  imagePath: string;
};

export type NotificationPresentation = {
  label: string;
  icon: "incident" | "dispatch" | "complete";
  category: "ACTION_REQUIRED" | "UPDATE";
  tone: "critical" | "warning" | "info" | "success" | "neutral";
};

export interface NotificationAdapter {
  list(user: AuthenticatedUser): Promise<NotificationPage>;
  markRead(user: AuthenticatedUser, publicId: string): Promise<void>;
  markAllRead(user: AuthenticatedUser): Promise<void>;
}

export interface NotificationResourceStateProvider {
  get(publicId: string): LinkedResourceState | null;
}

export type RealtimeStatus = "connecting" | "recovering" | "unavailable";
