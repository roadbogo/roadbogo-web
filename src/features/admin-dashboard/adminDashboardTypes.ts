import type { ManagedUser } from "@/features/user-management/userManagementTypes";
import type { UserRole } from "@/types/auth";

export type AdminStatus="healthy"|"warning"|"offline"|"loading"|"unavailable";
export type AdminManagementArea="users"|"roles"|"cctv"|"audit";
export type AdminRecentChange={id:string;action:string;target:string;detail:string;actor:string|null;occurredAt:string};
export type AdminDashboardSnapshot={
  generatedAt:string;
  systemHealth:{status:AdminStatus;api:AdminStatus;database:AdminStatus};
  users:ManagedUser[]|null;
  accountSummary:{totalUsers:number;activeUsers:number;inactiveUsers:number;activeUsersWithoutRoles:number;usersWithoutLoginHistory:number}|null;
  roleCounts:Record<UserRole,number>|null;
  recentChanges:AdminRecentChange[]|null;
  featureAvailability:Record<AdminManagementArea,{available:boolean;href?:string}>;
  partialErrors:string[];
};
export interface AdminDashboardAdapter{load(signal:AbortSignal):Promise<AdminDashboardSnapshot>}
