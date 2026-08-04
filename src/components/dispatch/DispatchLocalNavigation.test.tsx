// @vitest-environment jsdom
import {cleanup,render,screen} from "@testing-library/react";
import {afterEach,beforeEach,describe,expect,it,vi} from "vitest";
const mocks=vi.hoisted(()=>({pathname:"/dispatch",view:null as string|null,permissions:["DISPATCH.READ_OWN"],detailStatus:"EN_ROUTE",items:[{status:"REQUESTED"},{status:"EN_ROUTE"},{status:"ACTION_COMPLETED"}]}));
vi.mock("next/navigation",()=>({usePathname:()=>mocks.pathname,useSearchParams:()=>new URLSearchParams(mocks.view?{view:mocks.view}:{})}));
vi.mock("@/components/auth/AuthContext",()=>({useAuth:()=>({user:{apiPermissions:mocks.permissions}})}));
vi.mock("@/features/dispatch/dispatchAdapterFactory",()=>({createDispatchAdapter:()=>({list:vi.fn().mockImplementation(()=>Promise.resolve({items:mocks.items})),detail:vi.fn().mockImplementation(()=>Promise.resolve({status:mocks.detailStatus}))})}));
import {DispatchLocalNavigation,classifyDispatchNavigationStatus} from "./DispatchLocalNavigation";
afterEach(cleanup);beforeEach(()=>{mocks.pathname="/dispatch";mocks.view=null;mocks.permissions=["DISPATCH.READ_OWN"];mocks.detailStatus="EN_ROUTE"});
describe("DispatchLocalNavigation",()=>{
  it.each([[null,"출동 홈"],["requested","신규 요청"],["active","진행 중"],["history","완료 이력"],["invalid","출동 홈"]])("maps view %s to %s",async(view,label)=>{mocks.view=view;render(<DispatchLocalNavigation/>);expect((await screen.findByRole("link",{name:new RegExp(label)})).getAttribute("aria-current")).toBe("page")});
  it("uses links, accessible counts, and the requested permission",async()=>{render(<DispatchLocalNavigation/>);expect(await screen.findByRole("navigation",{name:"출동 업무 메뉴"})).toBeTruthy();expect((await screen.findByRole("link",{name:/신규 요청.*1건/})).getAttribute("href")).toBe("/dispatch?view=requested");cleanup();mocks.permissions=[];render(<DispatchLocalNavigation/>);expect(screen.queryByRole("navigation",{name:"출동 업무 메뉴"})).toBeNull()});
  it("classifies every supported state once",()=>{expect(classifyDispatchNavigationStatus("REQUESTED")).toBe("requested");expect(classifyDispatchNavigationStatus("ACCEPTED")).toBe("active");expect(classifyDispatchNavigationStatus("ACTION_IN_PROGRESS")).toBe("active");expect(classifyDispatchNavigationStatus("ACTION_COMPLETED")).toBe("history");expect(classifyDispatchNavigationStatus("REJECTED")).toBe("history");expect(classifyDispatchNavigationStatus("CANCELLED")).toBe("history")});
  it("keeps detail routes in the active section",async()=>{mocks.pathname="/dispatch/dispatch-1/action";render(<DispatchLocalNavigation/>);expect((await screen.findByRole("link",{name:/진행 중/})).getAttribute("aria-current")).toBe("page")});
  it("uses history for a completed read-only result",async()=>{mocks.pathname="/dispatch/dispatch-1/action";mocks.detailStatus="ACTION_COMPLETED";render(<DispatchLocalNavigation/>);expect((await screen.findByRole("link",{name:/완료 이력/})).getAttribute("aria-current")).toBe("page")});
});
