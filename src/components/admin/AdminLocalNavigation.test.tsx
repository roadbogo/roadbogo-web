import {renderToStaticMarkup} from "react-dom/server";
import {beforeEach,describe,expect,it,vi} from "vitest";
import {AdminLocalNavigation} from "./AdminLocalNavigation";

let pathname="/admin";
let apiPermissions:string[]=[];
vi.mock("next/navigation",()=>({usePathname:()=>pathname}));
vi.mock("@/components/auth/AuthContext",()=>({useAuth:()=>({user:{apiPermissions}})}));

describe("AdminLocalNavigation",()=>{
  beforeEach(()=>{pathname="/admin";apiPermissions=[]});

  it("marks the console route as current and hides unauthorized destinations",()=>{
    const html=renderToStaticMarkup(<AdminLocalNavigation/>);
    expect(html).toContain('aria-current="page" href="/admin"');
    expect(html).not.toContain("/admin/users");
  });

  it("uses parent-route matching for user detail and create pages",()=>{
    pathname="/admin/users/new";
    apiPermissions=["USER.READ_ALL","ROLE.MANAGE","CCTV.READ"];
    const html=renderToStaticMarkup(<AdminLocalNavigation/>);
    expect(html).toContain('aria-current="page" href="/admin/users"');
    expect(html).toContain('href="/admin/roles"');
    expect(html).toContain('href="/admin/cctvs"');
    expect(html).toContain("CCTV 조회");
  });

  it("shows and activates audit logs only with AUDIT.READ",()=>{
    pathname="/admin/audit-logs";
    apiPermissions=["AUDIT.READ"];
    const html=renderToStaticMarkup(<AdminLocalNavigation/>);
    expect(html).toContain('aria-current="page" href="/admin/audit-logs"');
    expect(html).toContain("감사 로그");
  });

  it("uses a round key icon for roles without the shield check path",()=>{
    apiPermissions=["ROLE.MANAGE"];
    const html=renderToStaticMarkup(<AdminLocalNavigation/>);
    expect(html).toContain('<circle cx="8" cy="12" r="4"');
    expect(html).not.toContain("m9.5 12 1.7 1.7");
  });
});
