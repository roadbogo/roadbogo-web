import type { DashboardIncident, DirectionCode, IncidentStatus, RiskGrade } from "@/features/control-dashboard/dashboardTypes";

export type IncidentListTab = "active" | "closed" | "archived";
export type IncidentSort =
  | "priority,desc"
  | "first_detected_at,desc"
  | "first_detected_at,asc"
  | "last_detected_at,desc"
  | "risk_score,desc";
export type StatusFilter = "ALL" | "OPEN" | "REVIEW" | "DISPATCH" | "DONE";
export type RiskFilter = "ALL" | RiskGrade;
export type IncidentQuickFilter="ALL"|"IMMEDIATE"|"UNASSIGNED"|"REVIEW"|"DISPATCH";

export interface IncidentManagementItem extends DashboardIncident {
  first_detected_at: string;
  last_detected_at: string;
  cctv_name: string;
  direction_code: DirectionCode;
  road_name: string;
  road_section_name: string;
  archived_at?: string;
  archived_by?: string;
  archive_reason?: string;
}

export interface IncidentListQuery {
  page: number;
  size: number;
  keyword: string;
  status: StatusFilter;
  risk: RiskFilter;
  quick:IncidentQuickFilter;
  tab: IncidentListTab;
  from?: string;
  to?: string;
  sort: IncidentSort;
}

export interface IncidentListResult {
  items: IncidentManagementItem[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
  counts: { active?: number; closed?: number; archived?: number };
  quickCounts:{IMMEDIATE:number;UNASSIGNED:number;REVIEW:number;DISPATCH:number};
}

export interface IncidentManagementCapabilities {
  supportsArchivedIncidentList: boolean;
  supportsBulkIncidentArchive: boolean;
  supportsBulkIncidentRestore: boolean;
}

export interface IncidentManagementRepository {
  readonly mode: "api" | "mock";
  readonly capabilities: IncidentManagementCapabilities;
  list(query: IncidentListQuery): Promise<IncidentListResult>;
  archive(publicIds: string[], reason?: string): Promise<void>;
  restore(publicIds: string[]): Promise<void>;
}

export const terminalStatuses: IncidentStatus[] = ["CLOSED", "FALSE_POSITIVE"];
