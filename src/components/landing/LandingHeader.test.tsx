// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import {cleanup,fireEvent,render,screen,waitFor} from "@testing-library/react";
import {afterEach,beforeEach,describe,expect,it,vi} from "vitest";
import {LandingHeader} from "./LandingHeader";

const headerState=vi.hoisted(()=>({pathname:"/admin/audit-logs",user:{role:"SYSTEM_ADMIN"} as {role:string}|null}));
vi.mock("next/navigation",()=>({usePathname:()=>headerState.pathname,useRouter:()=>({push:vi.fn()})}));
vi.mock("@/components/auth/AuthContext",()=>({useAuth:()=>({user:headerState.user})}));
vi.mock("@/components/auth/AccountMenu",()=>({AccountMenu:()=> <button type="button">계정</button>}));
vi.mock("@/features/notifications/NotificationPopover",()=>({NotificationPopover:()=> <button type="button">알림</button>}));
vi.mock("@/hooks/useSystemHealth",()=>({useSystemHealth:()=>({isLoading:false,status:"healthy",api:true,database:true,checkedAt:null,refresh:vi.fn()})}));
vi.mock("./SystemHealthPanel",()=>({SystemHealthPanel:()=>null}));
vi.mock("./sidebarMenuConfig",()=>({
  getActiveSidebarMenuId:()=>"admin",
  getAuthenticatedSidebarMenus:()=>[{id:"admin",label:"시스템 관리",icon:"admin",href:"/admin"}],
  getLandingSidebarMenus:()=>[],
}));

class IntersectionObserverStub{
  observe(){}
  disconnect(){}
}

describe("LandingHeader mobile navigation",()=>{
  beforeEach(()=>{
    headerState.pathname="/admin/audit-logs";
    headerState.user={role:"SYSTEM_ADMIN"};
    vi.stubGlobal("IntersectionObserver",IntersectionObserverStub);
    vi.stubGlobal("matchMedia",vi.fn().mockReturnValue({matches:true,addEventListener:vi.fn(),removeEventListener:vi.fn()}));
  });
  afterEach(()=>{cleanup();vi.unstubAllGlobals()});

  it("keeps the mobile trigger in the header and restores focus after closing",async()=>{
    const{container}=render(<LandingHeader showSections={false}/>);
    await screen.findAllByRole("button",{name:"메뉴 열기"});
    const trigger=container.querySelector<HTMLButtonElement>(".mobile-menu-trigger")!;
    const header=container.querySelector(".main-header");
    expect(header).toContainElement(trigger);
    expect(trigger).toHaveAttribute("aria-controls","landing-sidebar");
    expect(trigger).toHaveAttribute("aria-expanded","false");

    fireEvent.click(trigger);
    expect(trigger).toHaveAttribute("aria-expanded","true");
    expect(container.querySelector("#landing-sidebar")).toHaveClass("is-open");
    expect(container.querySelector(".landing-sidebar-backdrop")).toHaveClass("is-open");

    fireEvent.keyDown(document,{key:"Escape"});
    await waitFor(()=>expect(trigger).toHaveFocus());
    expect(trigger).toHaveAttribute("aria-expanded","false");
    expect(container.querySelector("#landing-sidebar")).toHaveClass("is-collapsed");
  });

  it("keeps the signed-out mobile trigger and account actions together in the header",async()=>{
    headerState.pathname="/";
    headerState.user=null;
    const{container}=render(<LandingHeader/>);
    await screen.findAllByRole("button",{name:"메뉴 열기"});
    const header=container.querySelector(".main-header")!;
    const trigger=container.querySelector<HTMLButtonElement>(".mobile-menu-trigger")!;
    expect(header).toContainElement(trigger);
    expect(header.querySelector(".main-header__right")).toBeInTheDocument();
    expect(screen.getByRole("link",{name:"로그인"})).toBeInTheDocument();
    expect(screen.getByRole("link",{name:"실시간 관제 보기"})).toBeInTheDocument();

    fireEvent.click(trigger);
    expect(container.querySelector("#landing-sidebar")).toHaveClass("is-open");
    fireEvent.keyDown(document,{key:"Escape"});
    await waitFor(()=>expect(trigger).toHaveFocus());
    expect(container.querySelector("#landing-sidebar")).toHaveClass("is-collapsed");
  });
});
