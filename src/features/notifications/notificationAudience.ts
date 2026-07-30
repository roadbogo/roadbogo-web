import type { AuthenticatedUser } from "@/components/auth/AuthContext";

export type NotificationAudienceView = "action" | "all" | "unread" | "system" | "account";

export function isGeneralUserOnly(user: Pick<AuthenticatedUser,"role"> | null | undefined) {
  return user?.role === "GENERAL_USER";
}

export function resolveNotificationAudience(user: Pick<AuthenticatedUser,"role"> | null | undefined) {
  const systemAdmin=user?.role==="SYSTEM_ADMIN";
  const general=isGeneralUserOnly(user);
  return {
    kind:systemAdmin?"systemAdmin":general?"general":"operations",
    systemAdmin,
    general,
    showOperationsControls:!general&&!systemAdmin,
    views:(systemAdmin?["all","system","account","unread"]:general?["all","unread"]:["action","all","unread"]) as NotificationAudienceView[],
    pageTitle:systemAdmin?"운영 알림":general?"알림":"업무 알림",
    pageDescription:systemAdmin?"시스템 운영과 계정·권한 변경 사항을 확인합니다.":general?"계정과 서비스 관련 안내를 확인합니다":"확인이 필요한 사건과 출동 상태 변경을 우선순위에 따라 처리합니다.",
    breadcrumb:systemAdmin?"운영 알림":general?"알림":"업무 알림",
    listTitle:systemAdmin?"운영 알림 목록":general?"알림 목록":"처리할 업무",
    listDescription:general?"계정 및 서비스 안내":null,
    detailTitle:general?"알림 상세":"업무 상세",
    emptyTitle:general?"새로운 알림이 없습니다":"새로운 업무 알림이 없습니다",
    emptyDescription:general?"계정이나 서비스 관련 안내가 도착하면 이곳에서 확인할 수 있습니다":"새로운 알림이 도착하면 이곳에서 확인할 수 있습니다.",
    detailEmptyDescription:general?"알림 목록에서 확인할 알림을 선택해 주세요":"처리할 업무에서 알림을 선택해 주세요.",
  };
}
