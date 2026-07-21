import{describe,expect,it}from"vitest";
import{resolveNotificationAudience}from"./notificationAudience";

describe("notification audience presentation",()=>{
 it("uses account and service copy without operations controls for general users",()=>{const audience=resolveNotificationAudience("GENERAL_USER");expect(audience).toMatchObject({general:true,showOperationsControls:false,pageTitle:"알림",pageDescription:"계정과 서비스 관련 안내를 확인합니다",breadcrumb:"알림",listTitle:"알림 목록",listDescription:"계정 및 서비스 안내",detailTitle:"알림 상세",emptyTitle:"새로운 알림이 없습니다",detailEmptyDescription:"알림 목록에서 확인할 알림을 선택해 주세요"});expect(audience.views).toEqual(["all","unread"]);expect(audience.views).not.toContain("action")});
 it.each(["SYSTEM_ADMIN","CONTROL_MANAGER","CONTROLLER","RESPONDER"]as const)("keeps the operations inbox for %s",role=>{const audience=resolveNotificationAudience(role);expect(audience.general).toBe(false);expect(audience.showOperationsControls).toBe(true);expect(audience.pageTitle).toBe("업무 알림");expect(audience.listTitle).toBe("처리할 업무");expect(audience.detailTitle).toBe("업무 상세");expect(audience.views).toEqual(["action","all","unread"])});
});
