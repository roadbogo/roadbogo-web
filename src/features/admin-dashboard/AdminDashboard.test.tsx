// @vitest-environment jsdom
import {cleanup, render, screen} from "@testing-library/react";
import {afterEach, describe, expect, it, vi} from "vitest";

vi.mock("@/components/auth/AuthContext",()=>({
  useAuth:()=>({user:{apiPermissions:["USER.READ_ALL","USER.WRITE","ROLE.MANAGE","CCTV.READ","AUDIT.READ"]}}),
}));
vi.mock("./adminDashboardAdapter",()=>({
  createAdminDashboardAdapter:()=>({load:vi.fn().mockResolvedValue({generatedAt:"2026-07-29T03:01:00.000Z"})}),
}));
vi.mock("./adminConsoleViewModel",()=>({
  createAdminConsoleViewModel:()=>({
    checkedAt:"2026-07-29T03:01:00.000Z",
    health:{overall:"healthy",api:"healthy",database:"healthy"},
    accountSummary:{totalUsers:12,activeUsers:9,inactiveUsers:3,usersWithoutRoles:1,multipleRoleUsers:1,attentionCount:3,todayChangeCount:2},
    issues:[
      {key:"ROLE_UNASSIGNED",title:"역할이 지정되지 않은 활성 계정",description:"운영 역할 지정이 필요합니다.",affectedUsers:[{name:"김관리"}],target:{href:"/admin/roles?view=unassigned"}},
      {key:"NO_LOGIN_HISTORY",title:"로그인 기록이 없는 운영 계정",description:"실제 사용 여부를 확인해야 합니다.",affectedUsers:[{name:"이운영"}],target:{href:"/admin/users?view=attention&issue=never-logged-in"}},
      {key:"INACTIVE_ACCOUNT",title:"비활성 계정",description:"현재 상태를 확인해야 합니다.",affectedUsers:[{name:"박관제"}],target:{href:"/admin/users?view=inactive"}},
    ],
    recentChanges:[{id:"change-1",action:"역할 변경",target:"김관리",detail:"관제 담당자 → 관제센터 책임자",actor:"로컬 시스템 관리자",occurredAt:"2026-07-29T03:01:00.000Z"}],
    roleCoverage:[
      {roleCode:"SYSTEM_ADMIN",roleName:"시스템 관리자",assignedUserCount:2},
      {roleCode:"CONTROL_CENTER_MANAGER",roleName:"관제센터 책임자",assignedUserCount:3},
    ],
  }),
}));

import {AdminDashboard} from "./AdminDashboard";

const styles=new Proxy({} as Record<string,string>,{get:(_,key)=>String(key)});
afterEach(cleanup);

describe("AdminDashboard workbench",()=>{
  it("renders the operational briefing with audit-log entry points",async()=>{
    const{container}=render(<AdminDashboard classNames={styles}/>);
    await screen.findByText("역할이 지정되지 않은 활성 계정");
    expect(screen.getByRole("heading",{name:"관리 콘솔"})).toBeTruthy();
    expect(screen.getByRole("heading",{name:"우선 처리"})).toBeTruthy();
    expect(screen.getByRole("heading",{name:"최근 활동"})).toBeTruthy();
    expect(screen.queryByRole("link",{name:"운영 계정 추가"})).toBeNull();
    expect(screen.queryByRole("heading",{name:"계정 상태"})).toBeNull();
    expect(screen.queryByRole("heading",{name:"역할 구성"})).toBeNull();
    expect(screen.getByRole("link",{name:/오늘 변경.*2건/}).getAttribute("href")).toBe("/admin/audit-logs?range=today");
    expect(screen.getByRole("link",{name:/전체 감사 로그 보기/}).getAttribute("href")).toBe("/admin/audit-logs");
    expect(screen.getByRole("heading",{name:"운영 상태"})).toBeTruthy();
    expect(screen.getByRole("link",{name:/활성 계정.*9 \/ 12명/}).getAttribute("href")).toBe("/admin/users?account_status=ACTIVE");
    expect(screen.queryByText("오늘 확인할 항목")).toBeNull();
    expect(screen.queryByText("기록됨")).toBeNull();
    expect(container.textContent).toContain("역할 배정→");
    expect(container.textContent).toContain("관제 담당자에서 관제센터 책임자로 변경");
  });

  it("uses explicit task links with supported admin routes",async()=>{
    render(<AdminDashboard classNames={styles}/>);
    await screen.findByText("역할이 지정되지 않은 활성 계정");
    expect(screen.getByRole("link",{name:/역할 배정/}).getAttribute("href")).toBe("/admin/roles?view=unassigned");
    expect(screen.getByRole("link",{name:/계정 검토/}).getAttribute("href")).toBe("/admin/users?view=attention&issue=never-logged-in");
    expect(screen.getByRole("link",{name:/계정 목록/}).getAttribute("href")).toBe("/admin/users?view=inactive");
    expect(screen.queryByRole("navigation",{name:"검토 대기열 필터"})).toBeNull();
    expect(screen.getByText("우선 확인")).toBeTruthy();
    expect(screen.getByText("사용 검토")).toBeTruthy();
    expect(screen.getAllByText("상태 확인").length).toBeGreaterThan(0);
    expect(screen.getByText("역할 및 권한")).toBeTruthy();
    expect(screen.getAllByText("사용자 관리")).toHaveLength(2);
  });

  it("disables refresh and announces loading state",async()=>{
    render(<AdminDashboard classNames={styles}/>);
    const refresh=screen.getByRole("button",{name:/갱신 중/});
    expect(refresh.hasAttribute("disabled")).toBe(true);
    expect(screen.getByRole("main").getAttribute("aria-busy")).toBe("true");
    await screen.findByRole("button",{name:"새로고침"});
  });
});
