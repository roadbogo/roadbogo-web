import type { AuthenticatedUser } from "@/components/auth/AuthContext";

export type NotificationAudienceView = "action" | "all" | "unread";

export function isGeneralUserOnly(user: Pick<AuthenticatedUser,"roles"> | null | undefined) {
  return user?.roles?.length === 1 && user.roles[0] === "GENERAL_USER";
}

export function resolveNotificationAudience(user: Pick<AuthenticatedUser,"roles"> | null | undefined) {
  const general=isGeneralUserOnly(user);
  return {
    general,
    showOperationsControls:!general,
    views:(general?["all","unread"]:["action","all","unread"]) as NotificationAudienceView[],
    pageTitle:general?"알림":"업무 알림",
    pageDescription:general?"계정과 서비스 관련 안내를 확인합니다":"확인이 필요한 사건과 출동 상태 변경을 우선순위에 따라 처리합니다.",
    breadcrumb:general?"알림":"업무 알림",
    listTitle:general?"알림 목록":"처리할 업무",
    listDescription:general?"계정 및 서비스 안내":null,
    detailTitle:general?"알림 상세":"업무 상세",
    emptyTitle:general?"새로운 알림이 없습니다":"새로운 업무 알림이 없습니다",
    emptyDescription:general?"계정이나 서비스 관련 안내가 도착하면 이곳에서 확인할 수 있습니다":"새로운 알림이 도착하면 이곳에서 확인할 수 있습니다.",
    detailEmptyDescription:general?"알림 목록에서 확인할 알림을 선택해 주세요":"처리할 업무에서 알림을 선택해 주세요.",
  };
}
