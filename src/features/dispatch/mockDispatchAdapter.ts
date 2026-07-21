import { createMockDashboardSnapshot } from "@/features/control-dashboard/mockDashboardAdapter";
import { activeDispatchStatuses } from "./dispatchDomain";
import type { DispatchAdapter, DispatchCommandResult, DispatchDetail, DispatchListQuery } from "./dispatchTypes";

function records(): DispatchDetail[] {
  const snapshot = createMockDashboardSnapshot();
  return snapshot.dispatches.map((dispatch, index) => {
    const incident = snapshot.incidents.find((item) => item.public_id === dispatch.incident_public_id)!;
    const cctv = snapshot.cctvs.find((item) => item.public_id === incident.cctv_public_id)!;
    return {
      publicId: dispatch.public_id,
      attemptNo: 1,
      status: dispatch.status,
      requestMessage: "현장 확인 및 조치를 요청합니다.",
      requestedAt: dispatch.requested_at,
      acceptedAt: dispatch.status === "REQUESTED" ? null : dispatch.updated_at,
      versionNo: index,
      incident: {
        publicId: incident.public_id,
        incidentNo: incident.incident_no,
        status: incident.status,
        objectCategory: incident.object_category,
        riskGrade: incident.current_risk_grade,
        cctvName: cctv.cctv_name,
        roadName: cctv.road.road_name,
        roadSectionName: cctv.road_section.section_name,
        latitude: 37.5,
        longitude: 127.1,
      },
      assignedBy: { publicId: "33333333-3333-4333-8333-333333333333", name: "관제 담당자" },
      rejectionReason: null, departedAt: null, enRouteAt: null, arrivedAt: null,
      actionStartedAt: null, actionCompletedAt: null, cancelledAt: null, previousDispatchPublicId: null,
    };
  });
}

export class MockDispatchAdapter implements DispatchAdapter {
  readonly mode = "mock" as const;
  private data = records();
  async list(query: DispatchListQuery = {}) {
    const page = query.page ?? 1, size = query.size ?? 20, activeOnly = query.activeOnly ?? true;
    let items = this.data.filter((item) => !activeOnly || activeDispatchStatuses.includes(item.status));
    if (query.status) items = items.filter((item) => item.status === query.status);
    return { items: items.slice((page - 1) * size, page * size), pagination: { page, size, totalElements: items.length, totalPages: Math.ceil(items.length / size) } };
  }
  async detail(publicId: string) { return this.data.find((item) => item.publicId === publicId) ?? null; }
  async accept(publicId: string, versionNo: number, key: string) { return this.update(publicId, versionNo, "ACCEPTED", key); }
  async reject(publicId: string, versionNo: number, reason: string, key: string) { return this.update(publicId, versionNo, "REJECTED", key, reason); }
  private async update(publicId: string, versionNo: number, status: "ACCEPTED" | "REJECTED", key: string, reason?: string): Promise<DispatchCommandResult> {
    void key;
    const current = await this.detail(publicId);
    if (!current) return { ok: false, code: "DISPATCH_NOT_FOUND", latest: null };
    if (current.versionNo !== versionNo) return { ok: false, code: "DISPATCH_VERSION_CONFLICT", latest: current };
    if (current.status !== "REQUESTED") return { ok: false, code: "DISPATCH_INVALID_STATE_TRANSITION", latest: current };
    const next: DispatchDetail = { ...current, status, versionNo: current.versionNo + 1, acceptedAt: status === "ACCEPTED" ? new Date().toISOString() : null, rejectionReason: reason ?? null };
    this.data = this.data.map((item) => item.publicId === publicId ? next : item);
    return { ok: true, detail: next };
  }
}
