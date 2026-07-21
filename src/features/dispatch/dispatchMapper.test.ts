import { describe, expect, it } from "vitest";
import { mapDispatchDetail, mapDispatchPage } from "./dispatchMapper";
import type { DispatchDetailDto } from "./dispatchTypes";

export const dispatchDto: DispatchDetailDto = {
  public_id: "11111111-1111-4111-8111-111111111111", attempt_no: 1, status: "REQUESTED",
  request_message: null, requested_at: "2026-07-21T00:00:00Z", accepted_at: null, version_no: 0,
  incident: { public_id: "22222222-2222-4222-8222-222222222222", incident_no: "INC-1", status: "DISPATCH_REQUESTED", object_category: "DEBRIS", ai_risk_grade: "HIGH", cctv_name: "CAM 01", road_name: "중부고속도로", road_section_name: "일죽IC~호법JC", latitude: 37.5, longitude: 127.1 },
  assigned_by: { public_id: "33333333-3333-4333-8333-333333333333", user_name: "관제자" },
  rejection_reason: null, departed_at: null, en_route_at: null, arrived_at: null, action_started_at: null, action_completed_at: null, cancelled_at: null, previous_dispatch_public_id: null,
};
describe("dispatch mapper", () => {
  it("maps snake case identifiers and version zero", () => { const value = mapDispatchDetail(dispatchDto); expect(value.publicId).toBe(dispatchDto.public_id); expect(value.versionNo).toBe(0); expect(value.assignedBy.name).toBe("관제자"); });
  it("maps backend pagination", () => { const page = mapDispatchPage({ items: [dispatchDto], pagination: { page: 1, size: 20, total_elements: 1, total_pages: 1 } }); expect(page.pagination.totalElements).toBe(1); });
});
