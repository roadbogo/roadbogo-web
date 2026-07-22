import { describe, expect, it } from "vitest";
import type { AuthenticatedUser } from "@/components/auth/AuthContext";
import { isGeneralUserOnly, resolveNotificationAudience } from "./notificationAudience";

const user = (roles: AuthenticatedUser["roles"]) => ({ roles }) as Pick<AuthenticatedUser, "roles">;

describe("notification audience presentation", () => {
  it("keeps the main account-service copy contract for a single general role", () => {
    const generalUser = user(["GENERAL_USER"]);
    const audience = resolveNotificationAudience(generalUser);

    expect(isGeneralUserOnly(generalUser)).toBe(true);
    expect(audience).toMatchObject({
      general: true,
      showOperationsControls: false,
      pageTitle: "알림",
      pageDescription: "계정과 서비스 관련 안내를 확인합니다",
      breadcrumb: "알림",
      listTitle: "알림 목록",
      listDescription: "계정 및 서비스 안내",
      detailTitle: "알림 상세",
      emptyTitle: "새로운 알림이 없습니다",
      detailEmptyDescription: "알림 목록에서 확인할 알림을 선택해 주세요",
    });
    expect(audience.views).toEqual(["all", "unread"]);
  });

  const operationRoleSets: Array<[AuthenticatedUser["roles"]]> = [
    [["CONTROLLER"]],
    [["CONTROL_MANAGER"]],
    [["RESPONDER"]],
    [["SYSTEM_ADMIN"]],
    [["GENERAL_USER", "CONTROLLER"]],
    [[]],
  ];
  it.each(operationRoleSets)("keeps %j on the operations UI", roles => {
    const account = user(roles);
    const audience = resolveNotificationAudience(account);

    expect(isGeneralUserOnly(account)).toBe(false);
    expect(audience).toMatchObject({
      general: false,
      showOperationsControls: true,
      pageTitle: "업무 알림",
      listTitle: "처리할 업무",
      detailTitle: "업무 상세",
    });
    expect(audience.views).toEqual(["action", "all", "unread"]);
  });

  it.each([null, undefined])("does not expose general UI while user data is %s", account => {
    expect(isGeneralUserOnly(account)).toBe(false);
    expect(resolveNotificationAudience(account).general).toBe(false);
  });
});
