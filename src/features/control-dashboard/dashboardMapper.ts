import type {
  DashboardCctvDto,
  DashboardDispatchDto,
  DashboardIncidentDto,
  DashboardSnapshotDto,
} from "./dashboardApiTypes";
import type {
  DashboardCctv,
  DashboardDispatch,
  DashboardIncident,
  DashboardSnapshot,
  DirectionCode,
  ObjectCategory,
  OperationalStatus,
} from "./dashboardTypes";

export const directionLabel: Record<DirectionCode, string> = {
  ASC: "상행",
  DESC: "하행",
  BOTH: "양방향",
  UNKNOWN: "방향 미상",
};

export const operationalStatusLabel: Record<OperationalStatus, string> = {
  NORMAL: "정상",
  DELAYED: "지연",
  FAULT: "장애",
  INACTIVE: "비활성",
  UNKNOWN: "상태 미상",
};

export const objectCategoryLabel: Record<ObjectCategory, string> = {
  VEHICLE: "차량",
  DEBRIS: "낙하물",
  WILDLIFE: "야생동물",
  OTHER: "기타",
};

export function mapDashboardCctv(dto: DashboardCctvDto): DashboardCctv {
  return { ...dto };
}

export function mapDashboardIncident(dto: DashboardIncidentDto): DashboardIncident {
  return { ...dto };
}

export function mapDashboardDispatch(dto: DashboardDispatchDto): DashboardDispatch {
  return { ...dto };
}

export function mapDashboardSnapshot(dto: DashboardSnapshotDto, source: DashboardSnapshot["source"]): DashboardSnapshot {
  return {
    cctvs: dto.cctvs.map(mapDashboardCctv),
    incidents: dto.incidents.map(mapDashboardIncident),
    dispatches: dto.dispatches.map(mapDashboardDispatch),
    fetched_at: dto.fetched_at,
    source,
  };
}
