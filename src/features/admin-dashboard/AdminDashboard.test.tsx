// @vitest-environment jsdom
import {cleanup,fireEvent,render,screen,waitFor} from "@testing-library/react";
import {afterEach,beforeEach,describe,expect,it,vi} from "vitest";

const state=vi.hoisted(()=>({load:vi.fn(),permissions:["USER.READ_ALL","ROLE.MANAGE","AUDIT.READ"]}));
vi.mock("@/components/auth/AuthContext",()=>({useAuth:()=>({user:{apiPermissions:state.permissions}})}));
vi.mock("./adminDashboardAdapter",()=>({createAdminDashboardAdapter:()=>({load:state.load})}));

const baseIssues=[
  {key:"ROLE_UNASSIGNED",title:"역할이 지정되지 않은 활성 계정",description:"운영 역할 지정이 필요합니다.",recommendedAction:"적절한 역할을 부여해 주세요.",affectedUsers:[{publicId:"user-1",name:"김관리",email:"admin@example.com",organization:"관제센터",accountStatus:"ACTIVE",context:"현재 역할 · 역할 없음"}],target:{href:"/admin/roles?view=unassigned"}},
  {key:"NO_LOGIN_HISTORY",title:"로그인 기록이 없는 운영 계정",description:"실제 사용 여부를 확인해야 합니다.",recommendedAction:"사용 계획을 확인해 주세요.",affectedUsers:[{publicId:"user-2",name:"이운영",email:"operator@example.com",organization:"운영팀",accountStatus:"ACTIVE",context:"마지막 로그인 · 기록 없음"}],target:{href:"/admin/users?view=attention&issue=never-logged-in"}},
  {key:"INACTIVE_ACCOUNT",title:"비활성 계정",description:"현재 상태를 확인해야 합니다.",recommendedAction:"비활성 사유를 확인해 주세요.",affectedUsers:[{publicId:"user-3",name:"박관제",email:"inactive@example.com",organization:"관제센터",accountStatus:"INACTIVE",context:"계정 상태 · 비활성"}],target:{href:"/admin/users?view=inactive"}},
];
vi.mock("./adminConsoleViewModel",()=>({createAdminConsoleViewModel:(snapshot:{accountSummary?:object|null;systemHealth?:{status:string;api:string;database:string};recentChanges?:unknown[];issues?:unknown[]})=>({checkedAt:"2026-07-29T03:01:00.000Z",health:{overall:snapshot.systemHealth?.status??"healthy",api:snapshot.systemHealth?.api??"healthy",database:snapshot.systemHealth?.database??"healthy"},accountSummary:snapshot.accountSummary===null?null:{totalUsers:12,activeUsers:9,inactiveUsers:3,usersWithoutRoles:1,multipleRoleUsers:1,attentionCount:3,todayChangeCount:2},issues:snapshot.issues??baseIssues,recentChanges:snapshot.recentChanges??[{id:"change-1",action:"역할 변경",target:"김관리",detail:"관제 담당자 → 관제센터 책임자",actor:"로컬 시스템 관리자",occurredAt:"2026-07-29T03:01:00.000Z"}],roleCoverage:[]})}));

import {AdminDashboard} from "./AdminDashboard";
const styles=new Proxy({} as Record<string,string>,{get:(_,key)=>String(key)});
const snapshot=(overrides:Record<string,unknown>={})=>({generatedAt:"2026-07-29T03:01:00.000Z",systemHealth:{status:"healthy",api:"healthy",database:"healthy"},partialErrors:[],...overrides});
afterEach(cleanup);
beforeEach(()=>{state.permissions=["USER.READ_ALL","ROLE.MANAGE","AUDIT.READ"];state.load.mockReset().mockResolvedValue(snapshot())});

describe("AdminDashboard workbench",()=>{
  it("keeps the summary links and renders one integrated workbench",async()=>{
    const{container}=render(<AdminDashboard classNames={styles}/>);await screen.findAllByText("역할이 지정되지 않은 활성 계정");
    expect(screen.getByRole("heading",{name:"관리 작업"})).toBeTruthy();
    expect(screen.getByText("3개 업무 유형")).toBeTruthy();
    expect(screen.getByRole("link",{name:/확인 대상.*3명/}).getAttribute("href")).toBe("/admin/users?view=attention");
    expect(screen.getByRole("link",{name:/역할 미배정.*1명/}).getAttribute("href")).toBe("/admin/roles?view=unassigned");
    expect(screen.getByRole("tab",{name:"작업 상세"}).getAttribute("aria-selected")).toBe("true");
    expect(container.textContent).not.toMatch(/[→←›‹]/);
  });

  it("changes only the detail when a task row is selected",async()=>{
    render(<AdminDashboard classNames={styles}/>);await screen.findAllByText("역할이 지정되지 않은 활성 계정");
    const inactive=screen.getByRole("button",{name:/상태.*비활성 계정/});fireEvent.click(inactive);
    expect(inactive.getAttribute("aria-pressed")).toBe("true");
    expect(screen.getByRole("tabpanel").textContent).toContain("박관제");
    expect(screen.getByRole("link",{name:"비활성 계정 보기"}).getAttribute("href")).toBe("/admin/users?view=inactive");
  });

  it("updates permission-aware contextual shortcuts from the selected task",async()=>{
    render(<AdminDashboard classNames={styles}/>);await screen.findAllByText("역할이 지정되지 않은 활성 계정");
    expect(screen.getByRole("link",{name:"역할 및 권한 · 주 작업"}).getAttribute("href")).toBe("/admin/roles");
    expect(screen.getByRole("link",{name:"사용자 관리"}).getAttribute("href")).toBe("/admin/users");
    expect(screen.getByRole("link",{name:"감사 로그"}).getAttribute("href")).toBe("/admin/audit-logs");
    fireEvent.click(screen.getByRole("button",{name:/검토.*로그인 기록이 없는 운영 계정/}));
    expect(screen.queryByRole("link",{name:/역할 및 권한/})).toBeNull();
    expect(screen.getByRole("link",{name:"사용자 관리 · 주 작업"})).toBeTruthy();
    expect(screen.getByRole("tabpanel").textContent).toContain("이운영");
  });

  it("hides unavailable contextual links and the whole bar when none remain",async()=>{
    state.permissions=["USER.READ_ALL"];render(<AdminDashboard classNames={styles}/>);await screen.findAllByText("역할이 지정되지 않은 활성 계정");
    expect(screen.queryByRole("link",{name:/역할 및 권한/})).toBeNull();
    expect(screen.getByRole("link",{name:"사용자 관리 · 주 작업"})).toBeTruthy();
    cleanup();state.permissions=[];render(<AdminDashboard classNames={styles}/>);await screen.findAllByText("역할이 지정되지 않은 활성 계정");
    expect(screen.queryByRole("navigation",{name:"관련 화면 바로가기"})).toBeNull();
  });

  it("shows at most three activities in a semantic tab without pagination",async()=>{
    const changes=Array.from({length:6},(_,index)=>({id:`change-${index}`,action:"역할 변경",target:`대상 ${index}`,detail:"기존 → 변경",actor:"관리자",occurredAt:new Date(Date.UTC(2026,6,29,index)).toISOString()}));
    state.load.mockResolvedValue(snapshot({recentChanges:changes}));render(<AdminDashboard classNames={styles}/>);await screen.findAllByText("역할이 지정되지 않은 활성 계정");
    fireEvent.click(screen.getByRole("tab",{name:"최근 관리 활동"}));
    expect(screen.getAllByText(/대상 \d+/)).toHaveLength(3);
    expect(screen.queryByRole("button",{name:/페이지/})).toBeNull();
    expect(screen.getByRole("link",{name:"전체 감사 로그"}).getAttribute("href")).toBe("/admin/audit-logs");
  });

  it("hides the audit entry without AUDIT.READ",async()=>{
    state.permissions=["USER.READ_ALL"];render(<AdminDashboard classNames={styles}/>);await screen.findAllByText("역할이 지정되지 않은 활성 계정");fireEvent.click(screen.getByRole("tab",{name:"최근 관리 활동"}));
    expect(screen.queryByRole("link",{name:"전체 감사 로그"})).toBeNull();
  });

  it("preserves a valid selection after refresh and falls back when it disappears",async()=>{
    state.load.mockResolvedValueOnce(snapshot()).mockResolvedValueOnce(snapshot()).mockResolvedValueOnce(snapshot({issues:[baseIssues[0]]}));render(<AdminDashboard classNames={styles}/>);await screen.findAllByText("역할이 지정되지 않은 활성 계정");
    fireEvent.click(screen.getByRole("button",{name:/상태.*비활성 계정/}));fireEvent.click(screen.getByRole("button",{name:"새로고침"}));await waitFor(()=>expect(screen.getByRole("button",{name:/상태.*비활성 계정/}).getAttribute("aria-pressed")).toBe("true"));
    fireEvent.click(screen.getByRole("button",{name:"새로고침"}));await waitFor(()=>expect(screen.getByRole("button",{name:/우선.*역할이 지정되지 않은/}).getAttribute("aria-pressed")).toBe("true"));
  });

  it("renders coordinated empty states",async()=>{
    state.load.mockResolvedValue(snapshot({issues:[]}));render(<AdminDashboard classNames={styles}/>);
    expect(await screen.findByText("현재 확인할 관리 작업이 없습니다.")).toBeTruthy();
    expect(screen.getByText("처리할 작업이 없습니다.")).toBeTruthy();
  });

  it("shows loading and then a summary unavailable state",async()=>{
    state.load.mockResolvedValue(snapshot({accountSummary:null,partialErrors:["계정 데이터 연결 실패"]}));const{container}=render(<AdminDashboard classNames={styles}/>);expect(container.querySelector(".operationSummary .skeleton")).toBeTruthy();
    expect(await screen.findByText("운영 요약을 표시할 수 없습니다.")).toBeTruthy();expect(container.querySelector(".operationSummary .skeleton")).toBeNull();
  });

  it("keeps existing data visible when refresh fails",async()=>{
    state.load.mockResolvedValueOnce(snapshot()).mockRejectedValueOnce(new Error("refresh failed"));render(<AdminDashboard classNames={styles}/>);await screen.findByRole("link",{name:/확인 대상.*3명/});fireEvent.click(screen.getByRole("button",{name:"새로고침"}));
    await waitFor(()=>expect(screen.getByRole("button",{name:"새로고침"}).hasAttribute("disabled")).toBe(false));expect(screen.getByRole("link",{name:/확인 대상.*3명/})).toBeTruthy();
  });
});
