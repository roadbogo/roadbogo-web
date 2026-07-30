import { describe, expect, it } from "vitest";
import { MockUserManagementAdapter } from "./mockUserManagementAdapter";
import type { UserListQuery } from "./userManagementTypes";

const base:UserListQuery={page:1,size:20,keyword:"",view:"all",attentionReason:null,role:null,accountStatus:null,organizationPublicId:null,organizationUnassigned:false,sort:"created_at,desc"};
const load=(overrides:Partial<UserListQuery>={})=>new MockUserManagementAdapter().listUsers({...base,...overrides},new AbortController().signal);

describe("MockUserManagementAdapter",()=>{
  it("exposes the trusted role catalogue through the adapter",async()=>{
    const roles=await new MockUserManagementAdapter().getRoles(new AbortController().signal);
    expect(roles.map(role=>role.code)).toEqual(["SYSTEM_ADMIN","CONTROL_MANAGER","CONTROLLER","RESPONDER","GENERAL_USER"]);
    expect(roles.every(role=>role.name&&role.description&&role.permissionCodes.length)).toBe(true);
  });
  it("provides enough typed users for pagination and fixture edge cases",async()=>{
    const first=await load();
    const second=await load({page:2});
    expect(first.pagination).toEqual({page:1,size:20,totalElements:27,totalPages:2});
    expect(second.items).toHaveLength(7);
    expect([...first.items,...second.items].some(user=>user.roles.length>1)).toBe(true);
    expect([...first.items,...second.items].some(user=>!user.organization)).toBe(true);
    expect([...first.items,...second.items].some(user=>!user.lastLoginAt)).toBe(true);
    expect([...first.items,...second.items].some(user=>user.accountStatus==="INACTIVE")).toBe(true);
  });

  it("paginates 27 users into 10, 10, and 7 rows for the frontend default",async()=>{
    const first=await load({page:1,size:10}),second=await load({page:2,size:10}),third=await load({page:3,size:10});
    expect(first.items).toHaveLength(10);
    expect(second.items).toHaveLength(10);
    expect(third.items).toHaveLength(7);
    expect(first.pagination).toEqual({page:1,size:10,totalElements:27,totalPages:3});
  });

  it("searches names and emails and combines role, status, and organization filters",async()=>{
    expect((await load({keyword:"김관제"})).items.length).toBeGreaterThan(0);
    expect((await load({keyword:"user02@roadbogo.kr"})).items).toHaveLength(1);
    const organization=(await new MockUserManagementAdapter().listOrganizations(new AbortController().signal))[0];
    const filtered=await load({role:"CONTROLLER",accountStatus:"ACTIVE",organizationPublicId:organization.publicId});
    expect(filtered.items.every(user=>user.roles.includes("CONTROLLER")&&user.accountStatus==="ACTIVE"&&user.organization?.publicId===organization.publicId)).toBe(true);
  });

  it("sorts deterministically and returns detail by public id",async()=>{
    const newest=await load({sort:"created_at,desc"});
    const oldest=await load({sort:"created_at,asc"});
    expect(newest.items[0].createdAt>newest.items[1].createdAt).toBe(true);
    expect(oldest.items[0].createdAt<oldest.items[1].createdAt).toBe(true);
    const detail=await new MockUserManagementAdapter().getUserDetail(newest.items[0].publicId,new AbortController().signal);
    expect(detail?.publicId).toBe(newest.items[0].publicId);
    expect(detail?.changes).toBeDefined();
  });

  it("filters work views before pagination and de-duplicates attention users",async()=>{
    const operating=await load({view:"operating",size:50});
    expect(operating.items.every(user=>user.roles.some(role=>role!=="GENERAL_USER"))).toBe(true);
    expect(operating.pagination.totalElements).toBe(operating.summary.operating);
    const general=await load({view:"general",size:50});
    expect(general.items.every(user=>user.roles.length===1&&user.roles[0]==="GENERAL_USER")).toBe(true);
    expect(general.pagination.totalElements).toBe(general.summary.general);
    const attention=await load({view:"attention"});
    expect(new Set(attention.items.map(user=>user.publicId)).size).toBe(attention.items.length);
    expect(attention.pagination.totalElements).toBe(attention.summary.attention);
    const unassigned=await load({view:"attention",attentionReason:"unassigned"});
    expect(unassigned.items.every(user=>user.roles.length===0&&user.accountStatus==="ACTIVE")).toBe(true);
    expect(unassigned.pagination.totalElements).toBe(attention.summary.unassigned);
    const withoutOrganization=await load({view:"attention",attentionReason:"no-organization"});
    expect(withoutOrganization.items.every(user=>!user.organization&&user.roles.some(role=>role!=="GENERAL_USER"))).toBe(true);
    expect(withoutOrganization.pagination.totalElements).toBe(attention.summary.withoutOrganization);
  });

  it("keeps the unassigned organization filter distinct from organization public ids",async()=>{
    const result=await load({organizationUnassigned:true});
    expect(result.items.length).toBeGreaterThan(0);
    expect(result.items.every(user=>user.organization===null)).toBe(true);
  });

  it("exposes a deterministic mock error state without a network request",async()=>{
    await expect(load({keyword:"__error__"})).rejects.toThrow("mock list error");
  });

  it("creates, updates, changes roles, and deactivates without persisting a password",async()=>{
    const adapter=new MockUserManagementAdapter();
    const created=await adapter.createUser({email:`created-${Date.now()}@roadbogo.kr`,password:"Secret123",userName:"신규 관제자",organizationPublicId:"11111111-1111-4111-8111-111111111101",roles:["CONTROLLER"]});
    expect("password" in created).toBe(false);
    const updated=await adapter.updateUser(created.publicId,{userName:"수정 관제자",phone:"01012345678"});
    expect(updated.userName).toBe("수정 관제자");
    const roleChanged=await adapter.updateUserRoles(created.publicId,{roles:["CONTROLLER","RESPONDER"],reason:"현장 대응 업무 추가",responderProfile:{responderCode:`RSP-${Date.now()}`,dutyStatus:"AVAILABLE",coverageArea:null,isDispatchEnabled:true}});
    expect(roleChanged.roles).toContain("RESPONDER");
    const inactive=await adapter.deactivateUser(created.publicId,{reason:"Mock 검증"});
    expect(inactive.accountStatus).toBe("INACTIVE");
    expect(inactive.deactivatedAt).toBeTruthy();
    expect(inactive.changes[0]).toMatchObject({action:"계정 비활성화",summary:"Mock 검증"});
    const active=await adapter.activateUser(created.publicId,{reason:"업무 복귀에 따른 계정 사용 재개"});
    expect(active.accountStatus).toBe("ACTIVE");
    expect(active.deactivatedAt).toBeNull();
    expect(active.roles).toEqual(roleChanged.roles);
    expect(active.organization).toEqual(roleChanged.organization);
    expect(active.changes[0]).toMatchObject({action:"계정 활성화"});
  });

  it("requires an auditable activation reason",async()=>{
    const adapter=new MockUserManagementAdapter();
    const created=await adapter.createUser({email:`activation-${Date.now()}@roadbogo.kr`,password:"Secret123",userName:"복구 검증 사용자",organizationPublicId:"11111111-1111-4111-8111-111111111101",roles:["CONTROLLER"]});
    await adapter.deactivateUser(created.publicId,{reason:"복구 사유 검증용 비활성화"});
    await expect(adapter.activateUser(created.publicId,{reason:"짧음"})).rejects.toMatchObject({code:"ACTIVATION_REASON_INVALID"});
  });

  it("rechecks unavailable and unknown recovery states before activation",async()=>{
    const adapter=new MockUserManagementAdapter();
    await expect(adapter.activateUser("22222222-2222-4222-8222-000000000007",{reason:"관리자 검토를 통한 복구 요청"})).rejects.toMatchObject({code:"USER_RECOVERY_UNAVAILABLE"});
    await expect(adapter.activateUser("22222222-2222-4222-8222-000000000013",{reason:"관리자 검토를 통한 복구 요청"})).rejects.toMatchObject({code:"USER_RECOVERY_REVIEW_REQUIRED"});
  });

  it("checks self-deactivation and active assignments before execution",async()=>{
    const adapter=new MockUserManagementAdapter(),users=(await load({size:50})).items;
    const target=users.find(user=>user.accountStatus==="ACTIVE"&&(user.activeAssignments??0)===0)!;
    await expect(adapter.checkDeactivation(target.publicId,target.publicId,new AbortController().signal)).resolves.toMatchObject({allowed:false,blockReason:"SELF"});
    const assigned=users.find(user=>(user.activeAssignments??0)>0)!;
    await expect(adapter.checkDeactivation(assigned.publicId,"different-admin",new AbortController().signal)).resolves.toMatchObject({allowed:false,blockReason:"ACTIVE_ASSIGNMENT",activeAssignments:assigned.activeAssignments});
    await expect(adapter.checkDeactivation(target.publicId,"different-admin",new AbortController().signal)).resolves.toMatchObject({allowed:true});
  });

  it("validates responder role changes in the shared mock repository",async()=>{
    const adapter=new MockUserManagementAdapter(),users=(await load({size:50})).items;
    const withoutProfile=users.find(user=>!user.roles.includes("RESPONDER")&&!user.responderProfile)!;
    await expect(adapter.updateUserRoles(withoutProfile.publicId,{roles:[...withoutProfile.roles,"RESPONDER"],reason:"출동 역할 추가"})).rejects.toMatchObject({code:"RESPONDER_PROFILE_REQUIRED"});
    const assigned=users.find(user=>user.roles.includes("RESPONDER")&&(user.activeAssignments??0)>0)!;
    await expect(adapter.updateUserRoles(assigned.publicId,{roles:["CONTROLLER"],reason:"출동 역할 해제"})).rejects.toMatchObject({code:"RESPONDER_ACTIVE_ASSIGNMENT"});
  });
});
