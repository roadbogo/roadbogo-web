import {renderToStaticMarkup} from "react-dom/server";
import {describe,expect,it,vi} from "vitest";
vi.mock("@/components/auth/AuthContext",()=>({useAuth:()=>({user:{apiPermissions:["USER.READ_ALL","USER.WRITE","ROLE.MANAGE","CCTV.READ"]}})}));
import {AdminDashboard} from "./AdminDashboard";

const styles=new Proxy({} as Record<string,string>,{get:(_,key)=>String(key)});

describe("AdminDashboard structure",()=>{
 it("uses briefing, exception list, and recent-change feed without selection UI",()=>{
  const html=renderToStaticMarkup(<AdminDashboard classNames={styles}/>);
  expect(html).toContain("관리 콘솔");
  expect(html).toContain("지금 처리할 작업");
  expect(html).toContain("최근 관리자 활동");
  expect(html).toContain("운영 계정 추가");
  expect(html).not.toContain("전체 사용자 보기");
  expect(html).toContain("역할 구성 현황");
  expect(html).not.toContain("선택 항목");
  expect(html).not.toContain("aria-selected");
  expect(html).not.toContain("→");
  expect(html).not.toContain("↻");
 });
});
