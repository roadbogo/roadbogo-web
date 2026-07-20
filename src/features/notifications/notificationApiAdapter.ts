import type { NotificationAdapter } from "./notificationTypes";

// The backend router is not implemented yet. This adapter is an explicit
// replacement seam; enabling it must follow backend contract verification.
export const notificationApiAdapter: NotificationAdapter = {
  async list() { throw new Error("알림 API를 사용할 수 없습니다."); },
  async markRead() { throw new Error("알림 API를 사용할 수 없습니다."); },
  async markAllRead() { throw new Error("알림 API를 사용할 수 없습니다."); },
};

export interface NotificationRealtimeAdapter {
  start(onNotificationAvailable: () => void): () => void;
}

export const unavailableRealtimeAdapter: NotificationRealtimeAdapter = {
  start() { return () => undefined; },
};
