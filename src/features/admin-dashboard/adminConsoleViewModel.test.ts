import {describe,expect,it} from "vitest";
import {mockAdminDashboardSnapshot} from "./adminDashboardMock";
import {createAdminConsoleViewModel} from "./adminConsoleViewModel";

describe("admin console view model",()=>{
 it("derives issue users and totals from the same mock user source",()=>{
  const view=createAdminConsoleViewModel(mockAdminDashboardSnapshot);
  for(const issue of view.issues){
   expect(issue.affectedUsers.length).toBeGreaterThan(0);
   expect(issue.affectedUsers.every(user=>Boolean(user.name&&user.email))).toBe(true);
  }
  expect(view.issues.find(issue=>issue.key==="ROLE_UNASSIGNED")?.affectedUsers.every(user=>user.accountStatus==="ACTIVE")).toBe(true);
 expect(view.accountSummary?.usersWithoutRoles).toBe(view.issues.find(issue=>issue.key==="ROLE_UNASSIGNED")?.affectedUsers.length);
  expect(view.accountSummary?.totalUsers).toBe((view.accountSummary?.activeUsers??0)+(view.accountSummary?.inactiveUsers??0));
 });
 it("uses only supported user-management work view links",()=>{
  const view=createAdminConsoleViewModel(mockAdminDashboardSnapshot);
  expect(view.issues.map(issue=>issue.target?.href)).toEqual(expect.arrayContaining(["/admin/roles?view=unassigned","/admin/users?view=attention&issue=never-logged-in","/admin/users?view=inactive"]));
 });
 it("does not present missing API domains as healthy account data",()=>{
  const view=createAdminConsoleViewModel({...mockAdminDashboardSnapshot,users:null,accountSummary:null,recentChanges:null});
  expect(view.accountSummary).toBeNull();
  expect(view.issues).toEqual([]);
 expect(view.recentChanges).toEqual([]);
 });
 it("keeps every recent change sorted newest first for UI pagination",()=>{
  const changes=Array.from({length:6},(_,index)=>({...mockAdminDashboardSnapshot.recentChanges![0],id:`change-${index}`,occurredAt:new Date(Date.UTC(2026,6,29,index)).toISOString()}));
  const view=createAdminConsoleViewModel({...mockAdminDashboardSnapshot,recentChanges:changes});
  expect(view.recentChanges).toHaveLength(6);
  expect(view.recentChanges.map(change=>change.id)).toEqual(["change-5","change-4","change-3","change-2","change-1","change-0"]);
 });
 it("keeps role connections, unassigned users, and multi-role users as separate counts",()=>{
  const view=createAdminConsoleViewModel(mockAdminDashboardSnapshot);
  expect(view.roleCoverage.map(item=>item.roleCode)).not.toContain("GENERAL_USER");
  expect(view.accountSummary?.multipleRoleUsers).toBe(mockAdminDashboardSnapshot.users?.filter(user=>user.roles.length>1).length);
  expect(view.accountSummary?.todayChangeCount).toBe(2);
 });
});
