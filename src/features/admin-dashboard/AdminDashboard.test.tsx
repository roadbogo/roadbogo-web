// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import {cleanup,fireEvent,render,screen,waitFor} from "@testing-library/react";
import {afterEach,beforeEach,describe,expect,it,vi} from "vitest";

const dashboardAdapter=vi.hoisted(()=>({load:vi.fn()}));
const authState=vi.hoisted(()=>({permissions:["USER.READ_ALL","USER.WRITE","ROLE.MANAGE","CCTV.READ","AUDIT.READ"]}));

vi.mock("@/components/auth/AuthContext",()=>({useAuth:()=>({user:{apiPermissions:authState.permissions}})}));
vi.mock("./adminDashboardAdapter",()=>({createAdminDashboardAdapter:()=>({load:dashboardAdapter.load})}));

const issueUser=(name:string,email:string,context:string,status:"ACTIVE"|"INACTIVE"="ACTIVE")=>({publicId:`user-${name}`,name,email,organization:"도로안전 운영팀",accountStatus:status,context});
const allIssues=[
  {key:"ROLE_UNASSIGNED",title:"역할이 지정되지 않은 활성 계정",description:"업무 기능을 이용하려면 운영 역할 지정이 필요합니다.",recommendedAction:"업무 범위를 확인하고 적절한 운영 역할을 부여해 주세요.",affectedUsers:[issueUser("김관리","admin-long-address@roadbogo.kr","현재 역할 · 역할 없음")],target:{href:"/admin/roles?view=unassigned"}},
  {key:"NO_LOGIN_HISTORY",title:"로그인 기록이 없는 운영 계정",description:"발급 후 실제 사용 여부를 확인해야 합니다.",recommendedAction:"계정 전달 여부와 실제 사용 계획을 확인해 주세요.",affectedUsers:[issueUser("이운영","operator@roadbogo.kr","마지막 로그인 · 기록 없음")],target:{href:"/admin/users?view=attention&issue=never-logged-in"}},
  {key:"INACTIVE_ACCOUNT",title:"비활성 계정",description:"비활성 사유와 현재 상태를 확인해야 합니다.",recommendedAction:"비활성 사유와 최근 변경 이력을 확인해 주세요.",affectedUsers:[issueUser("박관제","inactive@roadbogo.kr","계정 상태 · 비활성","INACTIVE")],target:{href:"/admin/users?view=inactive"}},
] as const;

vi.mock("./adminConsoleViewModel",()=>({
  createAdminConsoleViewModel:(snapshot:{users?:unknown[]|null;accountSummary?:object|null;recentChanges?:unknown[]|null;scenario?:"empty"|"without-login";systemHealth?:{status:string;api:string;database:string}})=>({
    checkedAt:"2026-07-29T03:01:00.000Z",
    health:{overall:snapshot.systemHealth?.status??"healthy",api:snapshot.systemHealth?.api??"healthy",database:snapshot.systemHealth?.database??"healthy"},
    accountSummary:snapshot.accountSummary===null?null:{totalUsers:12,activeUsers:9,inactiveUsers:3,usersWithoutRoles:1,multipleRoleUsers:1,attentionCount:3,todayChangeCount:2},
    issues:snapshot.users===null||snapshot.scenario==="empty"?[]:snapshot.scenario==="without-login"?allIssues.filter(issue=>issue.key!=="NO_LOGIN_HISTORY"):allIssues,
    recentChanges:snapshot.recentChanges===null?[]:snapshot.recentChanges??[{id:"change-1",action:"역할 변경",target:"감사대상 전용",detail:"관제 담당자 → 관제센터 책임자",actor:"로컬 시스템 관리자",occurredAt:"2026-07-29T03:01:00.000Z"}],
    roleCoverage:[],
  }),
}));

import {AdminDashboard} from "./AdminDashboard";
const styles=new Proxy({} as Record<string,string>,{get:(_,key)=>String(key)});
const snapshot=(extra:Record<string,unknown>={})=>({generatedAt:"2026-07-29T03:01:00.000Z",systemHealth:{status:"healthy",api:"healthy",database:"healthy"},partialErrors:[],...extra});

afterEach(cleanup);
beforeEach(()=>{authState.permissions=["USER.READ_ALL","USER.WRITE","ROLE.MANAGE","CCTV.READ","AUDIT.READ"];dashboardAdapter.load.mockReset().mockResolvedValue(snapshot())});

describe("AdminDashboard management workbench",()=>{
  it("selects the first task and renders its detailed action without arrow characters",async()=>{
    const{container}=render(<AdminDashboard classNames={styles}/>);
    const selected=await screen.findByRole("button",{name:/역할이 지정되지 않은 활성 계정/,pressed:true});
    expect(selected).toHaveAttribute("data-kind","ROLE_UNASSIGNED");
    expect(selected.querySelector('[data-icon="shield"]')).toBeTruthy();
    expect(screen.getByText("우선")).toBeTruthy();
    expect(screen.getByRole("heading",{name:"역할이 지정되지 않은 활성 계정"})).toBeTruthy();
    expect(screen.getAllByText("업무 기능을 이용하려면 운영 역할 지정이 필요합니다.")).toHaveLength(2);
    expect(screen.getByText("업무 범위를 확인하고 적절한 운영 역할을 부여해 주세요.")).toBeTruthy();
    expect(screen.getByText("admin-long-address@roadbogo.kr")).toBeTruthy();
    expect(screen.getByText("도로안전 운영팀")).toBeTruthy();
    expect(screen.getByText("현재 역할 · 역할 없음")).toBeTruthy();
    const action=screen.getByRole("link",{name:"역할 배정"});
    expect(action).toHaveAttribute("href","/admin/roles?view=unassigned");
    expect(action.textContent).not.toMatch(/[→←›‹]/);
    expect(container.querySelectorAll(".taskList button")).toHaveLength(3);
  });

  it("changes only the detail panel when another task is selected",async()=>{
    render(<AdminDashboard classNames={styles}/>);
    const next=await screen.findByRole("button",{name:/로그인 기록이 없는 운영 계정/});
    fireEvent.click(next);
    expect(next).toHaveAttribute("aria-pressed","true");
    expect(screen.getByRole("button",{name:/역할이 지정되지 않은 활성 계정/})).toHaveAttribute("aria-pressed","false");
    expect(screen.getByRole("heading",{name:"로그인 기록이 없는 운영 계정"})).toBeTruthy();
    expect(screen.getByText("계정 전달 여부와 실제 사용 계획을 확인해 주세요.")).toBeTruthy();
    expect(screen.getByRole("link",{name:"검토 대상 보기"})).toHaveAttribute("href","/admin/users?view=attention&issue=never-logged-in");
  });

  it("shows independent people metrics and a separate task-type count",async()=>{
    render(<AdminDashboard classNames={styles}/>);
    await screen.findByRole("button",{name:/역할이 지정되지 않은 활성 계정/});
    const summary=screen.getByRole("region",{name:"업무 중심 운영 요약"});
    expect(summary).toHaveTextContent("확인 대상3명");
    expect(summary).toHaveTextContent("역할 미배정1명");
    expect(summary).toHaveTextContent("사용 검토1명");
    expect(summary).toHaveTextContent("비활성 상태1명");
    expect(screen.getByText("3개 업무 유형")).toBeTruthy();
    expect(screen.queryByText("총 3건")).toBeNull();
  });

  it("switches to recent activity and preserves both audit-log entry points",async()=>{
    render(<AdminDashboard classNames={styles}/>);
    await screen.findByRole("button",{name:/역할이 지정되지 않은 활성 계정/});
    fireEvent.click(screen.getByRole("tab",{name:"최근 관리 활동"}));
    expect(screen.getByText("관제 담당자에서 관제센터 책임자로 변경")).toBeTruthy();
    expect(screen.getByRole("link",{name:"오늘 변경"})).toHaveAttribute("href","/admin/audit-logs?range=today");
    expect(screen.getByRole("link",{name:"전체 감사 로그"})).toHaveAttribute("href","/admin/audit-logs");
    fireEvent.click(screen.getByRole("tab",{name:"작업 상세"}));
    expect(screen.getByRole("heading",{name:"역할이 지정되지 않은 활성 계정"})).toBeTruthy();
  });

  it("supports roving focus and selection with tab keyboard commands",async()=>{
    render(<AdminDashboard classNames={styles}/>);
    await screen.findByRole("button",{name:/역할이 지정되지 않은 활성 계정/});
    const detail=screen.getByRole("tab",{name:"작업 상세"}),activity=screen.getByRole("tab",{name:"최근 관리 활동"});
    expect(detail).toHaveAttribute("tabindex","0");
    expect(activity).toHaveAttribute("tabindex","-1");
    detail.focus();
    fireEvent.keyDown(detail,{key:"ArrowRight"});
    expect(activity).toHaveFocus();
    expect(activity).toHaveAttribute("aria-selected","true");
    expect(activity).toHaveAttribute("tabindex","0");
    fireEvent.keyDown(activity,{key:"Home"});
    expect(detail).toHaveFocus();
    expect(detail).toHaveAttribute("aria-selected","true");
    fireEvent.keyDown(detail,{key:"End"});
    expect(activity).toHaveFocus();
    fireEvent.keyDown(activity,{key:"ArrowLeft"});
    expect(detail).toHaveFocus();
    expect(detail).toHaveAttribute("aria-selected","true");
  });

  it("hides the activity tab, audit data, and audit links without AUDIT.READ",async()=>{
    authState.permissions=["USER.READ_ALL"];
    render(<AdminDashboard classNames={styles}/>);
    await screen.findByRole("button",{name:/로그인 기록이 없는 운영 계정/});
    expect(screen.queryByRole("tab",{name:"최근 관리 활동"})).toBeNull();
    expect(screen.getByRole("tab",{name:"작업 상세"})).toHaveAttribute("tabindex","0");
    expect(screen.queryByText("감사대상 전용")).toBeNull();
    expect(screen.queryByText("관제 담당자에서 관제센터 책임자로 변경")).toBeNull();
    expect(screen.queryByText(/로컬 시스템 관리자/)).toBeNull();
    expect(screen.queryByRole("link",{name:"전체 감사 로그"})).toBeNull();
    expect(screen.queryByRole("link",{name:"오늘 변경"})).toBeNull();
    expect(screen.getByRole("heading",{name:"로그인 기록이 없는 운영 계정"})).toBeTruthy();
  });

  it("distinguishes unavailable audit data from a healthy empty activity list",async()=>{
    dashboardAdapter.load.mockResolvedValue(snapshot({recentChanges:null}));
    const first=render(<AdminDashboard classNames={styles}/>);
    await screen.findByRole("button",{name:/역할이 지정되지 않은 활성 계정/});
    fireEvent.click(screen.getByRole("tab",{name:"최근 관리 활동"}));
    expect(screen.getByText("감사 기록을 확인할 수 없습니다.")).toBeTruthy();
    expect(screen.getByText("감사 데이터 연결 상태를 확인한 후 다시 시도해 주세요.")).toBeTruthy();
    expect(screen.queryByText("아직 기록된 관리자 활동이 없습니다.")).toBeNull();
    expect(screen.queryByRole("link",{name:"오늘 변경"})).toBeNull();
    expect(screen.queryByRole("link",{name:"전체 감사 로그"})).toBeNull();
    first.unmount();
    dashboardAdapter.load.mockResolvedValue(snapshot({recentChanges:[]}));
    render(<AdminDashboard classNames={styles}/>);
    await screen.findByRole("button",{name:/역할이 지정되지 않은 활성 계정/});
    fireEvent.click(screen.getByRole("tab",{name:"최근 관리 활동"}));
    expect(screen.getByText("아직 기록된 관리자 활동이 없습니다.")).toBeTruthy();
    expect(screen.queryByText("감사 기록을 확인할 수 없습니다.")).toBeNull();
  });

  it("shows each management CTA only with its destination permission",async()=>{
    authState.permissions=["ROLE.MANAGE","USER.READ_ALL"];
    render(<AdminDashboard classNames={styles}/>);
    await screen.findByRole("button",{name:/역할이 지정되지 않은 활성 계정/});
    expect(screen.getByRole("link",{name:"역할 배정"})).toHaveAttribute("href","/admin/roles?view=unassigned");
    fireEvent.click(screen.getByRole("button",{name:/로그인 기록이 없는 운영 계정/}));
    expect(screen.getByRole("link",{name:"검토 대상 보기"})).toHaveAttribute("href","/admin/users?view=attention&issue=never-logged-in");
    fireEvent.click(screen.getByRole("button",{name:/비활성 계정/}));
    expect(screen.getByRole("link",{name:"비활성 계정 보기"})).toHaveAttribute("href","/admin/users?view=inactive");
  });

  it("exposes only role-management work and its affected account with ROLE.MANAGE",async()=>{
    authState.permissions=["ROLE.MANAGE"];
    const{container}=render(<AdminDashboard classNames={styles}/>);
    await screen.findByRole("link",{name:"역할 배정"});
    expect(container.querySelectorAll(".taskList button")).toHaveLength(1);
    expect(container.querySelector('[data-kind="ROLE_UNASSIGNED"]')).toBeTruthy();
    expect(screen.getByText("1개 업무 유형")).toBeTruthy();
    expect(screen.getByRole("region",{name:"업무 중심 운영 요약"})).toHaveTextContent("확인 대상1명");
    expect(screen.queryByText("operator@roadbogo.kr")).toBeNull();
    expect(screen.queryByText("inactive@roadbogo.kr")).toBeNull();
    expect(screen.queryByText("사용 검토")).toBeNull();
    expect(screen.queryByText("비활성 상태")).toBeNull();
  });

  it("exposes only user-management work with USER.READ_ALL",async()=>{
    authState.permissions=["USER.READ_ALL"];
    const{container}=render(<AdminDashboard classNames={styles}/>);
    await screen.findByRole("link",{name:"검토 대상 보기"});
    expect(container.querySelectorAll(".taskList button")).toHaveLength(2);
    expect(container.querySelector('[data-kind="ROLE_UNASSIGNED"]')).toBeNull();
    expect(screen.getByText("2개 업무 유형")).toBeTruthy();
    expect(screen.getByRole("region",{name:"업무 중심 운영 요약"})).toHaveTextContent("확인 대상2명");
    expect(screen.queryByText("admin-long-address@roadbogo.kr")).toBeNull();
    expect(screen.queryByText("역할 미배정")).toBeNull();
  });

  it("shows a permission-specific empty state without leaking task data",async()=>{
    authState.permissions=[];
    const{container}=render(<AdminDashboard classNames={styles}/>);
    expect(await screen.findAllByText("현재 권한으로 확인 가능한 관리 작업이 없습니다.")).toHaveLength(2);
    expect(screen.getAllByText("필요한 관리 권한을 확인해 주세요.")).toHaveLength(2);
    expect(container.querySelectorAll(".taskList button")).toHaveLength(0);
    expect(container.querySelector(".issueDetail")).toBeNull();
    expect(container.querySelector(".issueDetail > footer")).toBeNull();
    expect(screen.queryByText("admin-long-address@roadbogo.kr")).toBeNull();
    expect(screen.queryByText("operator@roadbogo.kr")).toBeNull();
    expect(screen.queryByText("inactive@roadbogo.kr")).toBeNull();
    expect(screen.queryByText("계정과 권한 운영 상태가 정상입니다.")).toBeNull();
    expect(screen.getByRole("region",{name:"업무 중심 운영 요약"})).toHaveTextContent("확인 대상0명");
  });

  it("falls back synchronously when the selected task permission disappears",async()=>{
    const view=render(<AdminDashboard classNames={styles}/>);
    const loginIssue=await screen.findByRole("button",{name:/로그인 기록이 없는 운영 계정/});
    fireEvent.click(loginIssue);
    expect(screen.getByText("operator@roadbogo.kr")).toBeTruthy();
    authState.permissions=["ROLE.MANAGE"];
    view.rerender(<AdminDashboard classNames={styles}/>);
    expect(screen.queryByText("operator@roadbogo.kr")).toBeNull();
    expect(screen.getByRole("button",{name:/역할이 지정되지 않은 활성 계정/})).toHaveAttribute("aria-pressed","true");
    expect(screen.getByText("admin-long-address@roadbogo.kr")).toBeTruthy();
  });

  it("corrects the active audit tab during render and restores focus when AUDIT.READ disappears",async()=>{
    const view=render(<AdminDashboard classNames={styles}/>);
    await screen.findByRole("button",{name:/역할이 지정되지 않은 활성 계정/});
    const activity=screen.getByRole("tab",{name:"최근 관리 활동"});
    fireEvent.click(activity);
    activity.focus();
    authState.permissions=["ROLE.MANAGE","USER.READ_ALL"];
    view.rerender(<AdminDashboard classNames={styles}/>);
    const detail=screen.getByRole("tab",{name:"작업 상세"});
    expect(screen.queryByRole("tab",{name:"최근 관리 활동"})).toBeNull();
    expect(detail).toHaveAttribute("aria-selected","true");
    expect(detail).toHaveAttribute("tabindex","0");
    expect(screen.getByRole("tabpanel",{name:"작업 상세"})).toBeTruthy();
    await waitFor(()=>expect(detail).toHaveFocus());
  });

  it("shows coordinated empty states when there are no management tasks",async()=>{
    dashboardAdapter.load.mockResolvedValue(snapshot({scenario:"empty"}));
    render(<AdminDashboard classNames={styles}/>);
    expect(await screen.findByText("현재 확인할 관리 작업이 없습니다.")).toBeTruthy();
    expect(screen.getByText("계정과 권한 운영 상태가 정상입니다.")).toBeTruthy();
    expect(screen.getByText("처리할 작업이 없습니다.")).toBeTruthy();
    expect(screen.getByText("새로운 관리 항목이 발생하면 이곳에서 상세 내용을 확인할 수 있습니다.")).toBeTruthy();
  });

  it("separates unavailable account data from a healthy empty state",async()=>{
    dashboardAdapter.load.mockResolvedValue(snapshot({users:null,accountSummary:{totalUsers:12},partialErrors:["계정 데이터 API가 연결되지 않았습니다."]}));
    const{container}=render(<AdminDashboard classNames={styles}/>);
    expect(container.querySelector(".operationSummary .skeleton")).toBeTruthy();
    expect(await screen.findByText("운영 요약을 표시할 수 없습니다.")).toBeTruthy();
    expect(screen.getByText("계정 데이터 연결 후 운영 지표가 표시됩니다.")).toBeTruthy();
    expect(screen.getAllByText("계정 데이터를 확인할 수 없습니다.")).toHaveLength(2);
    expect(screen.getAllByText("데이터 연결 상태를 확인한 후 다시 시도해 주세요.")).toHaveLength(2);
    expect(screen.queryByText("현재 확인할 관리 작업이 없습니다.")).toBeNull();
    expect(screen.queryByText("계정과 권한 운영 상태가 정상입니다.")).toBeNull();
    expect(screen.queryByText(/역할 미배정/)).toBeNull();
    expect(screen.queryByText(/사용 검토/)).toBeNull();
    expect(screen.queryByText(/비활성 상태/)).toBeNull();
    expect(screen.getByRole("alert")).toHaveTextContent("일부 관리 정보를 확인하지 못했습니다.");
    expect(container.querySelector(".operationSummary .skeleton")).toBeNull();
  });

  it("keeps a selected task after refresh and falls back when it disappears",async()=>{
    dashboardAdapter.load.mockResolvedValueOnce(snapshot()).mockResolvedValueOnce(snapshot()).mockResolvedValueOnce(snapshot({scenario:"without-login"}));
    render(<AdminDashboard classNames={styles}/>);
    const loginIssue=await screen.findByRole("button",{name:/로그인 기록이 없는 운영 계정/});
    fireEvent.click(loginIssue);
    fireEvent.click(screen.getByRole("button",{name:"새로고침"}));
    await waitFor(()=>expect(screen.getByRole("button",{name:/로그인 기록이 없는 운영 계정/})).toHaveAttribute("aria-pressed","true"));
    fireEvent.click(screen.getByRole("button",{name:"새로고침"}));
    await waitFor(()=>expect(screen.queryByRole("button",{name:/로그인 기록이 없는 운영 계정/})).toBeNull());
    expect(screen.getByRole("button",{name:/역할이 지정되지 않은 활성 계정/})).toHaveAttribute("aria-pressed","true");
  });

  it("keeps existing workbench data visible when refresh fails",async()=>{
    dashboardAdapter.load.mockResolvedValueOnce(snapshot()).mockRejectedValueOnce(new Error("refresh failed"));
    render(<AdminDashboard classNames={styles}/>);
    await screen.findByRole("button",{name:/역할이 지정되지 않은 활성 계정/});
    fireEvent.click(screen.getByRole("button",{name:"새로고침"}));
    await waitFor(()=>expect(screen.getByRole("button",{name:"새로고침"})).not.toBeDisabled());
    expect(screen.getByRole("button",{name:/역할이 지정되지 않은 활성 계정/})).toBeTruthy();
    expect(screen.getByRole("status")).toHaveTextContent("관리 현황을 갱신하지 못했습니다.");
  });

  it("keeps unavailable health semantics and enables refresh after loading",async()=>{
    dashboardAdapter.load.mockResolvedValue(snapshot({systemHealth:{status:"unavailable",api:"unavailable",database:"unavailable"},partialErrors:["운영 상태를 불러오지 못했습니다."]}));
    render(<AdminDashboard classNames={styles}/>);
    expect(await screen.findByText("상태 확인 불가")).toBeTruthy();
    expect(screen.getByText(/API 정보 없음 · DB 정보 없음/)).toBeTruthy();
    expect(screen.getByRole("alert")).toHaveTextContent("운영 상태를 확인하지 못했습니다.");
    expect(screen.getByRole("status")).toHaveTextContent("관리 현황 일부를 확인하지 못했습니다.");
    expect(screen.getByRole("button",{name:"새로고침"})).not.toBeDisabled();
  });
});
