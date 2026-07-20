import{beforeEach,describe,expect,it,vi}from"vitest";
import{RECENT_WORK_TTL_MS,clearPostLoginRoutingState,getRoleDefaultRoute,readRecentWork,resolvePostLoginDestination,sanitizeInternalReturnTo,saveRecentWork}from"./postLoginRouting";
const storage=()=>{const values=new Map<string,string>();return{getItem:(key:string)=>values.get(key)??null,setItem:(key:string,value:string)=>values.set(key,value),removeItem:(key:string)=>values.delete(key),clear:()=>values.clear()}};
const controller={publicId:"controller-1",accountStatus:"ACTIVE",roles:["CONTROLLER"]as const,apiPermissions:["INCIDENT.READ_ALL"]};
beforeEach(()=>vi.stubGlobal("sessionStorage",storage()));
describe("post login routing",()=>{
 it.each(["https://example.com","//example.com","/%2Fexample.com","/%252Fexample.com","/login","/logout","/signup","/reset-password?token=secret","/missing","/control\r\nX-Test:1"])("rejects unsafe or unavailable returnTo %s",value=>expect(resolvePostLoginDestination({user:controller,returnTo:value}).path).toBe("/control"));
 it("keeps a safe authorized incident returnTo",()=>expect(resolvePostLoginDestination({user:controller,returnTo:"/control/incidents/INC-20260719-0013?view=evidence#timeline"})).toEqual({path:"/control/incidents/INC-20260719-0013?view=evidence#timeline",reason:"RETURN_TO"}));
 it("does not allow a general user into control",()=>{const general={publicId:"g",accountStatus:"ACTIVE",roles:["GENERAL_USER"]as const,apiPermissions:[]};expect(resolvePostLoginDestination({user:general,returnTo:"/control"}).path).toBe("/")});
 it("uses permission-aware defaults",()=>{
  expect(getRoleDefaultRoute(controller)).toBe("/control");
  expect(getRoleDefaultRoute({...controller,roles:["CONTROL_MANAGER"]})).toBe("/control");
  expect(getRoleDefaultRoute({...controller,roles:["RESPONDER"],apiPermissions:["DISPATCH.READ_OWN"]})).toBe("/dispatch");
  expect(getRoleDefaultRoute({...controller,roles:["SYSTEM_ADMIN"],apiPermissions:["USER.READ_ALL"]})).toBe("/mypage");
  expect(getRoleDefaultRoute({...controller,roles:["SYSTEM_ADMIN"],apiPermissions:["INCIDENT.READ_ALL"]})).toBe("/control");
 });
 it("uses permissions instead of the first role in a multi-role account",()=>expect(getRoleDefaultRoute({...controller,roles:["SYSTEM_ADMIN","CONTROLLER"],apiPermissions:["INCIDENT.READ_ALL"]})).toBe("/control"));
 it("restores only a matching recent work item within the TTL",()=>{
  saveRecentWork(controller,"/control/incidents/incident-1",1000);
  expect(readRecentWork(controller,1000+RECENT_WORK_TTL_MS)).toBe("/control");
  expect(readRecentWork(controller,1001+RECENT_WORK_TTL_MS)).toBeNull();
  saveRecentWork(controller,"/control",2000);
  expect(readRecentWork({...controller,publicId:"other"},2001)).toBeNull();
 });
 it("falls back when recent work storage is invalid",()=>{sessionStorage.setItem("roadbogo_recent_work","{bad");expect(readRecentWork(controller)).toBeNull()});
 it("clears recent work and pending return data",()=>{saveRecentWork(controller,"/control");sessionStorage.setItem("roadbogo_return_to","/control");clearPostLoginRoutingState();expect(readRecentWork(controller)).toBeNull();expect(sessionStorage.getItem("roadbogo_return_to")).toBeNull()});
 it("sanitizes a same-origin route without changing safe query and hash",()=>expect(sanitizeInternalReturnTo("/mypage?tab=security#account")).toBe("/mypage?tab=security#account"));
});
