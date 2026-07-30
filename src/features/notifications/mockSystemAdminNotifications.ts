import type { NotificationRecord, SystemAdminNotificationCategory } from "./notificationTypes";

const ago = (minutes: number) => new Date(Date.now() - minutes * 60_000).toISOString();

const adminNotification = (
  id: string,
  notificationType: NotificationRecord["notification_type"],
  category: SystemAdminNotificationCategory,
  severity: NotificationRecord["severity"],
  title: string,
  body: string,
  resourceLabel: string,
  minutesAgo: number,
  read = false,
): NotificationRecord => ({
  public_id: id,
  notification_type: notificationType,
  admin_category: category,
  severity,
  title,
  body,
  resource: {
    resource_type: category,
    resource_public_id: `mock-admin-${id}`,
    resource_label: resourceLabel,
  },
  target_path: null,
  delivery_status: "DELIVERED",
  read,
  delivered_at: ago(minutesAgo),
  read_at: read ? ago(Math.max(0, minutesAgo - 2)) : null,
  created_at: ago(minutesAgo),
});

export const mockSystemAdminNotifications: NotificationRecord[] = [
  adminNotification("admin-notification-001", "SYSTEM_STATUS", "SYSTEM", "CRITICAL", "인증 서비스 연결 장애", "인증 서비스의 응답 지연이 임계값을 초과했습니다. 운영 상태를 확인해 주세요.", "인증 서비스", 4),
  adminNotification("admin-notification-002", "ROLE_CHANGED", "ROLE", "HIGH", "시스템 관리자 권한 변경", "운영 계정 1건의 역할과 권한 구성이 변경되었습니다.", "역할·권한 정책", 12),
  adminNotification("admin-notification-003", "ACCOUNT_CHANGED", "ACCOUNT", "WARNING", "비활성 계정 로그인 시도", "비활성 상태인 운영 계정에서 로그인 시도가 감지되었습니다.", "운영 계정", 31),
  adminNotification("admin-notification-004", "SYSTEM_STATUS", "SYSTEM", "WARNING", "알림 전달 지연", "일부 알림 전달 시간이 평소보다 길어지고 있습니다.", "알림 서비스", 58, true),
  adminNotification("admin-notification-005", "AUDIT_RECORDED", "AUDIT", "INFO", "사용자 정보 변경 기록", "관리자가 사용자 소속 정보를 변경했습니다.", "관리 감사 기록", 95, true),
  adminNotification("admin-notification-006", "ACCOUNT_CHANGED", "ACCOUNT", "INFO", "운영 사용자 계정 생성", "새 운영 사용자 계정이 등록되었습니다.", "사용자 관리", 180, true),
  adminNotification("admin-notification-007", "ROLE_CHANGED", "ROLE", "INFO", "권한 정책 검토 완료", "정기 권한 정책 검토가 완료되었습니다.", "역할·권한 정책", 420, true),
];
