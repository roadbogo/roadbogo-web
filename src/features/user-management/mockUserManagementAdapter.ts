import { mockManagedUsers, mockOrganizations } from "./mockUserFixtures";
import type { ActivateUserInput, CreateAdminUserInput, DeactivateUserInput, DeactivationCheckResult, ManagedUser, UpdateAdminUserInput, UpdateUserRolesInput, UserListQuery, UserListResult, UserManagementAdapter } from "./userManagementTypes";
import { UserManagementError } from "./userManagementTypes";
import {ROLE_ORDER,ROLE_PRESENTATIONS,sortRoles} from "./rolePresentationConfig";
import {getAccountRecoveryEligibility} from "./accountRecoveryPolicy";

const STORAGE_KEY="roadbogo:mock-admin-users:v2";
let memoryUsers:ManagedUser[]=structuredClone(mockManagedUsers);
function readUsers(){
  if(typeof window==="undefined")return memoryUsers;
  const saved=window.localStorage.getItem(STORAGE_KEY);
  if(saved){try{memoryUsers=JSON.parse(saved) as ManagedUser[]}catch{}}
  return memoryUsers;
}
function writeUsers(users:ManagedUser[]){memoryUsers=users;if(typeof window!=="undefined")window.localStorage.setItem(STORAGE_KEY,JSON.stringify(users))}
function publicId(){return crypto.randomUUID()}
function change(action:string,summary:string){return{id:crypto.randomUUID(),action,summary,actor:"로컬 시스템 관리자",occurredAt:new Date().toISOString()}}

const wait=(signal:AbortSignal,delay=160)=>new Promise<void>((resolve,reject)=>{
  const timer=setTimeout(resolve,delay);
  signal.addEventListener("abort",()=>{clearTimeout(timer);reject(new DOMException("Aborted","AbortError"))},{once:true});
});

export class MockUserManagementAdapter implements UserManagementAdapter{
  async getRoles(signal:AbortSignal){
    await wait(signal,80);
    return ROLE_ORDER.map(code=>({code,name:ROLE_PRESENTATIONS[code].label,description:ROLE_PRESENTATIONS[code].fullDescription,permissionLabels:[...ROLE_PRESENTATIONS[code].permissionLabels],permissionCodes:[...ROLE_PRESENTATIONS[code].permissionCodes]}));
  }
  async listUsers(query:UserListQuery,signal:AbortSignal):Promise<UserListResult>{
    await wait(signal);
    if(query.keyword==="__error__")throw new Error("mock list error");
    const keyword=query.keyword.toLocaleLowerCase("ko-KR");
    const users=readUsers();
    const isOperating=(user:ManagedUser)=>user.roles.some(role=>role!=="GENERAL_USER");
    const isGeneral=(user:ManagedUser)=>user.roles.length===1&&user.roles[0]==="GENERAL_USER";
    const unassigned=(user:ManagedUser)=>user.accountStatus==="ACTIVE"&&user.roles.length===0;
    const neverLoggedIn=(user:ManagedUser)=>isOperating(user)&&user.lastLoginAt===null;
    const withoutOrganization=(user:ManagedUser)=>isOperating(user)&&!user.organization;
    const needsAttention=(user:ManagedUser)=>unassigned(user)||neverLoggedIn(user)||withoutOrganization(user)||user.accountStatus==="INACTIVE"||(user.activeAssignments??0)>0;
    const summary={total:users.length,operating:users.filter(isOperating).length,general:users.filter(isGeneral).length,active:users.filter(user=>user.accountStatus==="ACTIVE").length,attention:users.filter(needsAttention).length,unassigned:users.filter(unassigned).length,inactive:users.filter(user=>user.accountStatus==="INACTIVE").length,neverLoggedIn:users.filter(neverLoggedIn).length,withoutOrganization:users.filter(withoutOrganization).length};
    const filtered=users.filter(user=>
      (!keyword||user.userName.toLocaleLowerCase("ko-KR").includes(keyword)||user.email.toLowerCase().includes(keyword)||user.organization?.name.toLocaleLowerCase("ko-KR").includes(keyword)||user.roles.some(role=>ROLE_PRESENTATIONS[role].label.toLocaleLowerCase("ko-KR").includes(keyword)))&&
      (query.view==="all"||query.view==="operating"&&isOperating(user)||query.view==="general"&&isGeneral(user)||query.view==="attention"&&needsAttention(user)||query.view==="inactive"&&user.accountStatus==="INACTIVE")&&
      (!query.attentionReason||query.attentionReason==="unassigned"&&unassigned(user)||query.attentionReason==="never-logged-in"&&neverLoggedIn(user)||query.attentionReason==="no-organization"&&withoutOrganization(user))&&
      (!query.role||user.roles.includes(query.role))&&
      (!query.accountStatus||user.accountStatus===query.accountStatus)&&
      (!query.organizationPublicId||user.organization?.publicId===query.organizationPublicId)
      &&(!query.organizationUnassigned||!user.organization)
    ).sort((a,b)=>query.sort==="name,asc"?a.userName.localeCompare(b.userName,"ko-KR"):query.sort==="last_login,desc"?(b.lastLoginAt??"").localeCompare(a.lastLoginAt??""):(query.sort==="created_at,desc"?-1:1)*(a.createdAt.localeCompare(b.createdAt)));
    const start=(query.page-1)*query.size;
    return{items:structuredClone(filtered.slice(start,start+query.size)),summary,pagination:{page:query.page,size:query.size,totalElements:filtered.length,totalPages:Math.ceil(filtered.length/query.size)}};
  }
  async getUserDetail(publicId:string,signal:AbortSignal):Promise<ManagedUser|null>{
    await wait(signal,120);
    return structuredClone(readUsers().find(user=>user.publicId===publicId)??null);
  }
  async listOrganizations(signal:AbortSignal){await wait(signal,60);return structuredClone(mockOrganizations)}
  async checkEmailAvailability(email:string){const existing=readUsers().find(user=>user.email.toLowerCase()===email.trim().toLowerCase());return{available:!existing,existingPublicId:existing?.publicId}}
  async checkResponderCodeAvailability(code:string){const existing=readUsers().find(user=>user.responderProfile?.responderCode===code.trim().toUpperCase());return{available:!existing,existingPublicId:existing?.publicId}}
  async createUser(input:CreateAdminUserInput){
    if(!(await this.checkEmailAvailability(input.email)).available)throw new UserManagementError("USER_EMAIL_DUPLICATE","이미 등록된 이메일입니다.");
    if(input.responderProfile&&!(await this.checkResponderCodeAvailability(input.responderProfile.responderCode)).available)throw new UserManagementError("RESPONDER_CODE_DUPLICATE","이미 사용 중인 출동 담당자 코드입니다.");
    const now=new Date().toISOString(),organization=mockOrganizations.find(item=>item.publicId===input.organizationPublicId)??null;
    const user:ManagedUser={publicId:publicId(),email:input.email.trim().toLowerCase(),userName:input.userName.trim(),phone:input.phone??null,accountStatus:"ACTIVE",organization,roles:[...new Set(input.roles)],lastLoginAt:null,createdAt:now,updatedAt:now,changes:[change("운영 사용자 등록","관리자 화면에서 운영 계정을 등록함")],responderProfile:input.responderProfile?{...input.responderProfile,linked:true}:null,deactivatedAt:null,activeAssignments:0};
    writeUsers([user,...readUsers()]);return structuredClone(user);
  }
  async updateUser(id:string,input:UpdateAdminUserInput){
    const users=readUsers(),index=users.findIndex(user=>user.publicId===id);if(index<0)throw new UserManagementError("USER_NOT_FOUND","사용자를 찾을 수 없습니다.");
    const current=users[index],organization=input.organizationPublicId?mockOrganizations.find(item=>item.publicId===input.organizationPublicId)??current.organization:current.organization;
    const next={...current,...(input.userName!==undefined?{userName:input.userName.trim()}:{}),...(input.phone!==undefined?{phone:input.phone}:{}),organization,updatedAt:new Date().toISOString(),changes:[change("기본정보 수정","사용자 연락처 또는 소속 정보를 변경함"),...current.changes]};
    users[index]=next;writeUsers([...users]);return structuredClone(next);
  }
  async updateUserRoles(id:string,input:UpdateUserRolesInput){
    if(!input.roles.length)throw new UserManagementError("ROLE_REQUIRED","역할을 하나 이상 선택해 주세요.");
    const users=readUsers(),index=users.findIndex(user=>user.publicId===id);if(index<0)throw new UserManagementError("USER_NOT_FOUND","사용자를 찾을 수 없습니다.");
    const roles=sortRoles([...new Set(input.roles)]);
    if(roles.some(role=>!ROLE_ORDER.includes(role)))throw new UserManagementError("ROLE_INVALID","지원하지 않는 역할이 포함되어 있습니다.");
    const current=users[index],removesAdmin=current.accountStatus==="ACTIVE"&&current.roles.includes("SYSTEM_ADMIN")&&!roles.includes("SYSTEM_ADMIN");
    if(removesAdmin&&users.filter(user=>user.accountStatus==="ACTIVE"&&user.roles.includes("SYSTEM_ADMIN")).length<=1)throw new UserManagementError("LAST_ACTIVE_SYSTEM_ADMIN","마지막 활성 시스템 관리자의 역할은 해제할 수 없습니다.");
    const addsResponder=!current.roles.includes("RESPONDER")&&roles.includes("RESPONDER");
    if(addsResponder&&!current.responderProfile&&!input.responderProfile)throw new UserManagementError("RESPONDER_PROFILE_REQUIRED","출동 담당자 설정이 필요합니다.");
    const removesResponder=current.roles.includes("RESPONDER")&&!roles.includes("RESPONDER");
    if(removesResponder&&(current.activeAssignments??0)>0)throw new UserManagementError("RESPONDER_ACTIVE_ASSIGNMENT","진행 중인 출동이 있어 출동 담당자 역할을 해제할 수 없습니다.");
    const hasResponder=roles.includes("RESPONDER"),before=current.roles.join(", ")||"역할 없음",after=roles.join(", ");
    const next={...current,roles,responderProfile:hasResponder?(current.responderProfile??(input.responderProfile?{...input.responderProfile,linked:true}:null)):(current.responderProfile?{...current.responderProfile,linked:false}:null),updatedAt:new Date().toISOString(),changes:[change("역할 변경",`${before} → ${after} · 사유: ${input.reason.trim()}`),...current.changes]};
    users[index]=next;writeUsers([...users]);return structuredClone(next);
  }
  async checkDeactivation(id:string,actorPublicId:string,signal:AbortSignal):Promise<DeactivationCheckResult>{
    await wait(signal,180);
    const users=readUsers(),user=users.find(item=>item.publicId===id);
    if(!user)throw new UserManagementError("USER_NOT_FOUND","사용자를 찾을 수 없습니다.");
    if(user.publicId===actorPublicId)return{user:structuredClone(user),allowed:false,blockReason:"SELF"};
    if(user.accountStatus==="INACTIVE")return{user:structuredClone(user),allowed:false,blockReason:"ALREADY_INACTIVE"};
    const activeAdmins=users.filter(item=>item.accountStatus==="ACTIVE"&&item.roles.includes("SYSTEM_ADMIN")).length;
    if(user.roles.includes("SYSTEM_ADMIN")&&activeAdmins<=1)return{user:structuredClone(user),allowed:false,blockReason:"LAST_ACTIVE_ADMIN"};
    if((user.activeAssignments??0)>0)return{user:structuredClone(user),allowed:false,blockReason:"ACTIVE_ASSIGNMENT",activeAssignments:user.activeAssignments};
    return{user:structuredClone(user),allowed:true};
  }
  async deactivateUser(id:string,input:DeactivateUserInput){
    const users=readUsers(),index=users.findIndex(user=>user.publicId===id);if(index<0)throw new UserManagementError("USER_NOT_FOUND","사용자를 찾을 수 없습니다.");
    const current=users[index];if(current.accountStatus==="INACTIVE")throw new UserManagementError("USER_ALREADY_INACTIVE","이미 비활성 상태입니다.");if(current.roles.includes("SYSTEM_ADMIN")&&users.filter(user=>user.accountStatus==="ACTIVE"&&user.roles.includes("SYSTEM_ADMIN")).length<=1)throw new UserManagementError("LAST_ACTIVE_SYSTEM_ADMIN","마지막 활성 시스템 관리자 계정은 비활성화할 수 없습니다.");if((current.activeAssignments??0)>0)throw new UserManagementError("USER_ACTIVE_ASSIGNMENT_EXISTS",`현재 담당 중인 업무 ${current.activeAssignments}건이 있습니다.`);
    const now=new Date().toISOString(),next={...current,accountStatus:"INACTIVE" as const,deactivatedAt:now,updatedAt:now,changes:[change("계정 비활성화",input.reason),...current.changes]};users[index]=next;writeUsers([...users]);return structuredClone(next);
  }
  async activateUser(id:string,input:ActivateUserInput){
    const users=readUsers(),index=users.findIndex(user=>user.publicId===id);
    if(index<0)throw new UserManagementError("USER_NOT_FOUND","사용자를 찾을 수 없습니다.");
    const current=users[index];
    if(current.accountStatus!=="INACTIVE")throw new UserManagementError("USER_ALREADY_ACTIVE","이미 활성 상태인 계정입니다.");
    const recovery=getAccountRecoveryEligibility(current);
    if(recovery.eligibility!=="AVAILABLE")throw new UserManagementError(recovery.eligibility==="UNAVAILABLE"?"USER_RECOVERY_UNAVAILABLE":"USER_RECOVERY_REVIEW_REQUIRED",recovery.reason);
    const reason=input.reason.trim();
    if(reason.length<5||reason.length>200)throw new UserManagementError("ACTIVATION_REASON_INVALID","활성화 사유를 5자 이상 200자 이하로 입력해 주세요.");
    const now=new Date().toISOString(),next={...current,accountStatus:"ACTIVE" as const,deactivatedAt:null,updatedAt:now,changes:[change("계정 활성화",reason),...current.changes]};
    users[index]=next;writeUsers([...users]);return structuredClone(next);
  }
}

export class UnavailableUserManagementAdapter implements UserManagementAdapter{
  private unsupported():never{throw new UserManagementError("USER_MANAGEMENT_API_UNAVAILABLE","사용자 관리 API가 아직 연결되지 않았습니다. Mock 모드를 활성화해 주세요.")}
  async getRoles(){return this.unsupported()}
  async listUsers():Promise<UserListResult>{return this.unsupported()}
  async getUserDetail():Promise<ManagedUser|null>{return this.unsupported()}
  async listOrganizations(){return this.unsupported()}
  async createUser():Promise<ManagedUser>{return this.unsupported()}
  async updateUser():Promise<ManagedUser>{return this.unsupported()}
  async updateUserRoles():Promise<ManagedUser>{return this.unsupported()}
  async checkDeactivation():Promise<DeactivationCheckResult>{return this.unsupported()}
  async deactivateUser():Promise<ManagedUser>{return this.unsupported()}
  async activateUser():Promise<ManagedUser>{return this.unsupported()}
  async checkEmailAvailability(){return this.unsupported()}
  async checkResponderCodeAvailability(){return this.unsupported()}
}

export function createUserManagementAdapter():UserManagementAdapter{
  return process.env.NEXT_PUBLIC_USE_MOCK==="true"?new MockUserManagementAdapter():new UnavailableUserManagementAdapter();
}
