import { apiRequest } from "@/lib/apiClient";
import { resolveDashboardDataMode } from "@/features/control-dashboard/dashboardAdapterFactory";
import type { IncidentListDto, IncidentListItemDto, IncidentSummaryDto } from "@/features/control-dashboard/dashboardApiTypes";
import { mapDashboardIncident } from "@/features/control-dashboard/dashboardMapper";
import { createMockDashboardSnapshot } from "@/features/control-dashboard/mockDashboardAdapter";
import { filterAndSortIncidents, isArchiveEligible } from "./incidentManagementDomain";
import type { IncidentListQuery, IncidentListResult, IncidentManagementItem, IncidentManagementRepository } from "./incidentManagementTypes";

function mapApiItem(item: IncidentListItemDto): IncidentManagementItem {
  return {
    ...mapDashboardIncident(item),
    first_detected_at: item.first_detected_at,
    last_detected_at: item.last_detected_at,
    cctv_name: item.cctv.cctv_name,
    direction_code: item.cctv.direction_code,
    road_name: item.location.road_name,
    road_section_name: item.location.road_section_name,
  };
}

export function buildIncidentListApiPath(query: IncidentListQuery) {
  const params = new URLSearchParams({ page: String(query.page), size: String(query.size), sort: query.sort });
  if (query.keyword) params.set("keyword", query.keyword);
  if (query.risk !== "ALL") params.set("risk_grade", query.risk);
  if (query.from) params.set("from", query.from);
  if (query.to) params.set("to", query.to);
  const terminal = query.tab === "closed";
  if (terminal) params.set("status", "CLOSED,FALSE_POSITIVE");
  else if (query.status === "ALL") {
    params.set("status", "NEW,ACKNOWLEDGED,CLAIMED,UNDER_REVIEW,DISPATCH_REQUESTED,DISPATCHED,ON_SCENE,ACTION_IN_PROGRESS,ACTION_COMPLETED");
  } else {
    const status = { OPEN: "NEW,ACKNOWLEDGED,CLAIMED", REVIEW: "UNDER_REVIEW", DISPATCH: "DISPATCH_REQUESTED,DISPATCHED,ON_SCENE,ACTION_IN_PROGRESS", DONE: "ACTION_COMPLETED" }[query.status];
    if (status) params.set("status", status);
  }
  return `/incidents?${params.toString()}`;
}

export class ApiIncidentManagementRepository implements IncidentManagementRepository {
  readonly mode = "api" as const;
  readonly capabilities = { supportsArchivedIncidentList: false, supportsBulkIncidentArchive: false, supportsBulkIncidentRestore: false };
  async list(query: IncidentListQuery): Promise<IncidentListResult> {
    if (query.tab === "archived") return { items: [], page: 1, size: query.size, totalElements: 0, totalPages: 0, counts: {} };
    const [list, summary] = await Promise.all([
      apiRequest<IncidentListDto>(buildIncidentListApiPath(query)),
      apiRequest<IncidentSummaryDto>("/incidents/summary"),
    ]);
    return {
      items: list.items.map(mapApiItem), page: list.pagination.page, size: list.pagination.size,
      totalElements: list.pagination.total_elements, totalPages: list.pagination.total_pages,
      counts: {
        active: summary.total_count - summary.closed_count - summary.false_positive_count,
        closed: summary.closed_count + summary.false_positive_count,
      },
    };
  }
  async archive() { throw new Error("사건 보관 기능은 백엔드 연동 후 사용할 수 있습니다."); }
  async restore() { throw new Error("사건 복원 기능은 백엔드 연동 후 사용할 수 있습니다."); }
}

type ArchiveMetadata = { archived_at: string; archived_by: string; archive_reason?: string };

export class MockIncidentManagementRepository implements IncidentManagementRepository {
  readonly mode = "mock" as const;
  readonly capabilities = { supportsArchivedIncidentList: true, supportsBulkIncidentArchive: true, supportsBulkIncidentRestore: true };
  private archived = new Map<string, ArchiveMetadata>();
  constructor(private readonly fixtures?:IncidentManagementItem[]){}

  private allItems(): IncidentManagementItem[] {
    if(this.fixtures)return this.fixtures.map(item=>({...item}));
    const snapshot = createMockDashboardSnapshot();
    const cctvs = new Map(snapshot.cctvs.map(cctv => [cctv.public_id, cctv]));
    return snapshot.incidents.map(item => {
      const cctv = cctvs.get(item.cctv_public_id);
      const metadata = this.archived.get(item.public_id);
      return {
        ...item, first_detected_at: item.created_at, last_detected_at: item.updated_at,
        cctv_name: cctv?.cctv_name ?? "CCTV 정보 없음", direction_code: cctv?.direction_code ?? "UNKNOWN",
        road_name: cctv?.road.road_name ?? "도로 정보 없음", road_section_name: cctv?.road_section.section_name ?? "구간 정보 없음",
        ...metadata,
      };
    });
  }

  async list(query: IncidentListQuery): Promise<IncidentListResult> {
    const all = this.allItems();
    const archivedIds = new Set(this.archived.keys());
    const filtered = filterAndSortIncidents(all, query, archivedIds);
    const start = (query.page - 1) * query.size;
    return {
      items: filtered.slice(start, start + query.size), page: query.page, size: query.size,
      totalElements: filtered.length, totalPages: Math.ceil(filtered.length / query.size),
      counts: {
        active: all.filter(item => !isArchiveEligible(item) && !archivedIds.has(item.public_id)).length,
        closed: all.filter(item => isArchiveEligible(item) && !archivedIds.has(item.public_id)).length,
        archived: archivedIds.size,
      },
    };
  }

  async archive(publicIds: string[], reason?: string) {
    const eligible = new Map(this.allItems().filter(isArchiveEligible).map(item => [item.public_id, item]));
    if (publicIds.some(id => !eligible.has(id) || this.archived.has(id))) throw new Error("종료된 사건만 보관할 수 있습니다.");
    const archived_at = new Date().toISOString();
    publicIds.forEach(id => this.archived.set(id, { archived_at, archived_by: "현재 관제자", ...(reason ? { archive_reason: reason } : {}) }));
  }

  async restore(publicIds: string[]) {
    if (publicIds.some(id => !this.archived.has(id))) throw new Error("복원할 수 없는 사건이 포함되어 있습니다.");
    publicIds.forEach(id => this.archived.delete(id));
  }
}

let repository: IncidentManagementRepository | undefined;
export function createIncidentManagementRepository() {
  repository ??= resolveDashboardDataMode(process.env.NODE_ENV, process.env.NEXT_PUBLIC_USE_MOCK) === "mock"
    ? new MockIncidentManagementRepository()
    : new ApiIncidentManagementRepository();
  return repository;
}
