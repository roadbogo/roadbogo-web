import type { ManagedUser } from "@/features/user-management/userManagementTypes";
import type { AdminDashboardSnapshot,AdminRecentChange,AdminStatus } from "./adminDashboardTypes";
import {ROLE_ORDER,ROLE_PRESENTATIONS} from "@/features/user-management/rolePresentationConfig";
import type {UserRole} from "@/types/auth";

export type AdminIssueUser={publicId:string;name:string;email:string;organization:string;accountStatus:"ACTIVE"|"INACTIVE";context:string};
export type AdminIssue={
  key:"ROLE_UNASSIGNED"|"NO_LOGIN_HISTORY"|"INACTIVE_ACCOUNT";
  category:"PERMISSION"|"ACCOUNT";title:string;description:string;priority:"HIGH"|"NORMAL";
  affectedUsers:AdminIssueUser[];recommendedAction:string;target:{label:string;href:string}|null;
};
export type AdminConsoleViewModel={
  checkedAt:string;health:{overall:AdminStatus;api:AdminStatus;database:AdminStatus};
  accountSummary:{totalUsers:number;activeUsers:number;inactiveUsers:number;usersWithoutRoles:number;multipleRoleUsers:number;attentionCount:number;todayChangeCount:number}|null;
  issues:AdminIssue[];recentChanges:AdminRecentChange[];roleCoverage:{roleCode:UserRole;roleName:string;assignedUserCount:number}[];
};
const toIssueUser=(user:ManagedUser,context:string):AdminIssueUser=>({publicId:user.publicId,name:user.userName,email:user.email,organization:user.organization?.name??"소속 없음",accountStatus:user.accountStatus,context});
export function createAdminConsoleViewModel(snapshot:AdminDashboardSnapshot):AdminConsoleViewModel{
  const users=snapshot.users??[];
  const unassigned=users.filter(user=>user.accountStatus==="ACTIVE"&&user.roles.length===0);
  const noLogin=users.filter(user=>user.roles.length>0&&user.lastLoginAt===null);
  const inactive=users.filter(user=>user.accountStatus==="INACTIVE");
  const multipleRoleUsers=users.filter(user=>user.roles.length>1).length;
  const issues:AdminIssue[]=[
    {key:"ROLE_UNASSIGNED",category:"PERMISSION",title:"역할이 지정되지 않은 활성 계정",description:"업무 기능을 이용하려면 운영 역할 지정이 필요합니다.",priority:"HIGH",affectedUsers:unassigned.map(user=>toIssueUser(user,"현재 역할 · 역할 없음")),recommendedAction:"업무 범위를 확인하고 적절한 운영 역할을 부여해 주세요.",target:{label:"역할 관리에서 확인",href:"/admin/roles?view=unassigned"}},
    {key:"NO_LOGIN_HISTORY",category:"ACCOUNT",title:"로그인 기록이 없는 운영 계정",description:"발급 후 실제 사용 여부를 확인해야 합니다.",priority:"NORMAL",affectedUsers:noLogin.map(user=>toIssueUser(user,"마지막 로그인 · 기록 없음")),recommendedAction:"계정 전달 여부와 실제 사용 계획을 확인해 주세요.",target:{label:"계정 확인",href:"/admin/users?view=attention&issue=never-logged-in"}},
    {key:"INACTIVE_ACCOUNT",category:"ACCOUNT",title:"비활성 계정",description:"비활성 사유와 현재 상태를 확인해야 합니다.",priority:"NORMAL",affectedUsers:inactive.map(user=>toIssueUser(user,"계정 상태 · 비활성")),recommendedAction:"비활성 사유와 최근 변경 이력을 확인해 주세요.",target:{label:"비활성 계정 확인",href:"/admin/users?view=inactive"}},
  ].filter(issue=>issue.affectedUsers.length>0) as AdminIssue[];
  const attentionUsers=new Set([...unassigned,...noLogin,...inactive].map(user=>user.publicId));
  const allChanges=(snapshot.recentChanges??[]).slice().sort((a,b)=>Date.parse(b.occurredAt)-Date.parse(a.occurredAt));
  const snapshotDay=new Intl.DateTimeFormat("en-CA",{timeZone:"Asia/Seoul"}).format(new Date(snapshot.generatedAt));
  const todayChangeCount=allChanges.filter(change=>new Intl.DateTimeFormat("en-CA",{timeZone:"Asia/Seoul"}).format(new Date(change.occurredAt))===snapshotDay).length;
  const recentChanges=allChanges;
  const roleCoverage=snapshot.roleCounts?ROLE_ORDER.filter(roleCode=>roleCode!=="GENERAL_USER").map(roleCode=>({roleCode,roleName:ROLE_PRESENTATIONS[roleCode].label,assignedUserCount:snapshot.roleCounts![roleCode]??0})):[];
  return{checkedAt:snapshot.generatedAt,health:{overall:snapshot.systemHealth.status,api:snapshot.systemHealth.api,database:snapshot.systemHealth.database},accountSummary:snapshot.accountSummary?{totalUsers:snapshot.accountSummary.totalUsers,activeUsers:snapshot.accountSummary.activeUsers,inactiveUsers:snapshot.accountSummary.inactiveUsers,usersWithoutRoles:unassigned.length,multipleRoleUsers,attentionCount:attentionUsers.size,todayChangeCount}:null,issues,recentChanges,roleCoverage};
}
