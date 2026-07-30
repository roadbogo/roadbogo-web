// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import {cleanup,fireEvent,render,screen,waitFor} from "@testing-library/react";
import {afterEach,beforeEach,describe,expect,it,vi} from "vitest";

const navigation=vi.hoisted(()=>({params:new URLSearchParams(),replace:vi.fn(),push:vi.fn()}));
vi.mock("next/navigation",()=>({usePathname:()=>"/admin/roles",useRouter:()=>({replace:navigation.replace,push:navigation.push}),useSearchParams:()=>navigation.params}));
vi.mock("next/link",()=>({default:({href,children,...props}:{href:string;children:React.ReactNode})=><a href={href} {...props}>{children}</a>}));
vi.mock("@/components/auth/AuthContext",()=>({useAuth:()=>({user:{publicId:"admin",role:"SYSTEM_ADMIN",roles:["SYSTEM_ADMIN"],apiPermissions:["ROLE.MANAGE"]}})}));
vi.mock("./mockUserManagementAdapter",async importOriginal=>{
 const actual=await importOriginal<typeof import("./mockUserManagementAdapter")>();
 return{...actual,createUserManagementAdapter:()=>new actual.MockUserManagementAdapter()};
});
import {RoleManagementWorkspace} from "./RoleManagementWorkspace";

beforeEach(()=>{navigation.params=new URLSearchParams();navigation.replace.mockClear();navigation.push.mockClear()});
afterEach(cleanup);

describe("RoleManagementWorkspace",()=>{
 it("renders the full five-role matrix and opens editing in an overlay drawer",async()=>{
  render(<RoleManagementWorkspace/>);
  await waitFor(()=>expect(screen.getByRole("columnheader",{name:/시스템 관리자/})).toBeInTheDocument());
  expect(screen.getByRole("heading",{name:"역할 관리"})).toBeInTheDocument();
  const row=screen.getAllByRole("row").find(item=>item.textContent?.includes("user01@roadbogo.kr"));
  expect(row).toBeDefined();
  fireEvent.click(row!);
  expect(navigation.push).toHaveBeenCalledWith(expect.stringMatching(/^\/admin\/roles\?user=/),{scroll:false});
 });
 it("restores a selected user from the user query",async()=>{
  navigation.params=new URLSearchParams("user=public-user-id");
  render(<RoleManagementWorkspace/>);
  await waitFor(()=>expect(screen.getByText("선택한 사용자를 찾을 수 없습니다.")).toBeInTheDocument());
  expect(navigation.replace).toHaveBeenCalled();
 });
 it("uses accessible custom filters instead of native selects in the filter toolbar",async()=>{
  render(<RoleManagementWorkspace/>);
  await waitFor(()=>expect(screen.getByRole("button",{name:/계정 상태 필터/})).toBeInTheDocument());
  const toolbar=screen.getByRole("region",{name:"역할 사용자 검색 및 필터"});
  expect(toolbar.querySelector("select")).toBeNull();
  fireEvent.click(screen.getByRole("button",{name:/계정 상태 필터/}));
  expect(screen.getByRole("listbox",{name:"계정 상태 필터"})).toBeInTheDocument();
  fireEvent.click(screen.getByRole("option",{name:"활성"}));
  expect(navigation.replace).toHaveBeenCalledWith(expect.stringContaining("account_status=ACTIVE"),{scroll:false});
 });
 it("searches organization reference data in the portal combobox",async()=>{
  render(<RoleManagementWorkspace/>);
  await waitFor(()=>expect(screen.getByRole("button",{name:/소속 · 전체/})).toBeInTheDocument());
  fireEvent.click(screen.getByRole("button",{name:/소속 · 전체/}));
  const search=screen.getByRole("combobox",{name:"소속명·조직 코드 검색"});
  fireEvent.change(search,{target:{value:"CTRL-YD"}});
  expect(await screen.findByRole("option",{name:/영동고속도로 관제센터/})).toBeInTheDocument();
 });
});
