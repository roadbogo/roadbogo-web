// @vitest-environment jsdom
import {cleanup,fireEvent,render,screen,waitFor} from "@testing-library/react";
import {afterEach,beforeEach,describe,expect,it,vi} from "vitest";

const navigation=vi.hoisted(()=>({params:new URLSearchParams(),replace:vi.fn(),push:vi.fn()}));
vi.mock("next/navigation",()=>({
 usePathname:()=>"/admin/audit-logs",
 useSearchParams:()=>navigation.params,
 useRouter:()=>({replace:navigation.replace,push:navigation.push}),
}));

import {AuditLogWorkspace} from "./AuditLogWorkspace";

let desktop=true;
const applyUrl=(url:string)=>{navigation.params=new URL(url,"http://localhost").searchParams};

beforeEach(()=>{
 desktop=true;
 navigation.params=new URLSearchParams();
 navigation.replace.mockReset();
 navigation.push.mockReset();
 navigation.replace.mockImplementation(applyUrl);
 navigation.push.mockImplementation(applyUrl);
 vi.stubGlobal("matchMedia",vi.fn((query:string)=>({matches:query.includes("min-width")?desktop:!desktop,media:query,onchange:null,addListener:vi.fn(),removeListener:vi.fn(),addEventListener:vi.fn(),removeEventListener:vi.fn(),dispatchEvent:vi.fn()})));
});
afterEach(()=>{cleanup();vi.unstubAllGlobals()});

async function openInitialDetail(){
 const view=render(<AuditLogWorkspace/>);
 await waitFor(()=>expect(navigation.replace).toHaveBeenCalledWith(expect.stringContaining("selected="),{scroll:false}));
 view.rerender(<AuditLogWorkspace/>);
 await screen.findByRole("dialog",{name:"감사 이벤트 상세"});
 return view;
}

describe("AuditLogWorkspace detail selection",()=>{
 it("selects the first event on the initial desktop entry",async()=>{
  await openInitialDetail();
  expect(screen.getByRole("dialog",{name:"감사 이벤트 상세"})).toBeTruthy();
 });

 it("keeps the list open after the user returns from detail",async()=>{
  const view=await openInitialDetail();
  fireEvent.click(screen.getByRole("button",{name:"감사 기록으로 돌아가기"}));
  view.rerender(<AuditLogWorkspace/>);
  await waitFor(()=>expect(screen.queryByRole("dialog",{name:"감사 이벤트 상세"})).toBeNull());
  expect(navigation.params.has("selected")).toBe(false);
 });

 it("does not reopen detail when the viewport changes from tablet to desktop",async()=>{
  const view=await openInitialDetail();
  desktop=false;
  fireEvent.click(screen.getByRole("button",{name:"감사 기록으로 돌아가기"}));
  view.rerender(<AuditLogWorkspace/>);
  await waitFor(()=>expect(screen.queryByRole("dialog",{name:"감사 이벤트 상세"})).toBeNull());
  navigation.replace.mockClear();
  desktop=true;
  navigation.params=new URLSearchParams("sort=oldest");
  view.rerender(<AuditLogWorkspace/>);
  await screen.findByText("오래된순");
  await waitFor(()=>expect(navigation.replace).not.toHaveBeenCalledWith(expect.stringContaining("selected="),expect.anything()));
  expect(screen.queryByRole("dialog",{name:"감사 이벤트 상세"})).toBeNull();
 });

 it("keeps the list open when browser history removes the selected id",async()=>{
  const view=await openInitialDetail();
  navigation.params=new URLSearchParams();
  navigation.replace.mockClear();
  view.rerender(<AuditLogWorkspace/>);
  await waitFor(()=>expect(screen.queryByRole("dialog",{name:"감사 이벤트 상세"})).toBeNull());
  expect(navigation.replace).not.toHaveBeenCalledWith(expect.stringContaining("selected="),expect.anything());
 });

 it("opens an event selected directly from the list after dismissal",async()=>{
  const view=await openInitialDetail();
  fireEvent.click(screen.getByRole("button",{name:"감사 기록으로 돌아가기"}));
  view.rerender(<AuditLogWorkspace/>);
  const rows=await screen.findAllByRole("row");
  fireEvent.click(rows.at(-1)!);
  expect(navigation.push).toHaveBeenCalledWith(expect.stringContaining("selected="),{scroll:false});
  view.rerender(<AuditLogWorkspace/>);
  expect(await screen.findByRole("dialog",{name:"감사 이벤트 상세"})).toBeTruthy();
 });

 it("does not replace an invalid audit id with the first event",async()=>{
  navigation.params=new URLSearchParams("selected=missing-audit-id");
  render(<AuditLogWorkspace/>);
  await screen.findByText("확인할 감사 이벤트를 선택해 주세요.");
  await waitFor(()=>expect(navigation.replace).not.toHaveBeenCalledWith(expect.stringContaining("selected="),expect.anything()));
  expect(screen.queryByRole("dialog",{name:"감사 이벤트 상세"})).toBeNull();
 });
});
