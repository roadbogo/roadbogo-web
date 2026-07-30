import { mockManagedUsers } from "@/features/user-management/mockUserFixtures";
import type { AdminDashboardSnapshot } from "./adminDashboardTypes";

const operatingUsers=mockManagedUsers.filter(user=>user.roles.some(role=>role!=="GENERAL_USER")||user.roles.length===0);
export const mockAdminDashboardSnapshot:AdminDashboardSnapshot={
  generatedAt:"2026-07-29T03:06:00.000Z",
  systemHealth:{status:"healthy",api:"healthy",database:"healthy"},
  users:operatingUsers,
  accountSummary:{
    totalUsers:operatingUsers.length,
    activeUsers:operatingUsers.filter(user=>user.accountStatus==="ACTIVE").length,
    inactiveUsers:operatingUsers.filter(user=>user.accountStatus==="INACTIVE").length,
    activeUsersWithoutRoles:operatingUsers.filter(user=>user.accountStatus==="ACTIVE"&&user.roles.length===0).length,
    usersWithoutLoginHistory:operatingUsers.filter(user=>user.roles.length>0&&user.lastLoginAt===null).length,
  },
  roleCounts:{SYSTEM_ADMIN:2,CONTROL_MANAGER:3,CONTROLLER:9,RESPONDER:7,GENERAL_USER:8},
  recentChanges:[
    {id:"change-role-1",action:"역할 변경",target:"김관제",detail:"관제 담당자 → 관제센터 책임자",actor:"로컬 시스템 관리자",occurredAt:"2026-07-29T03:01:00.000Z"},
    {id:"change-status-1",action:"계정 비활성화",target:"이출동",detail:"활성 → 비활성",actor:"로컬 시스템 관리자",occurredAt:"2026-07-29T02:42:00.000Z"},
  ],
  featureAvailability:{users:{available:true,href:"/admin/users"},roles:{available:true,href:"/admin/roles"},cctv:{available:true,href:"/admin/cctvs"},audit:{available:false}},
  partialErrors:[],
};
