import { describe, expect, it } from "vitest";
import type { DashboardSnapshotDto } from "./dashboardApiTypes";
import { directionLabel, mapDashboardSnapshot } from "./dashboardMapper";

const dto: DashboardSnapshotDto = {
  cctvs: [{
    public_id: "cctv-1",
    cctv_code: "CCTV-TEST-001",
    cctv_name: "CAM 1",
    source_type: "ITS",
    stream_type: "LIVE",
    direction_code: "ASC",
    operational_status: "FAULT",
    has_stream: false,
    fallback_used: false,
    video_state: "UNAVAILABLE",
    road: { road_name: "테스트 도로" },
    road_section: { section_name: "테스트 구간" },
  }],
  incidents: [{
    public_id: "11111111-1111-4111-8111-111111111111",
    incident_no: "INC-20260719-0001",
    cctv_public_id: "cctv-1",
    status: "NEW",
    object_category: "DEBRIS",
    class_code: "TIRE",
    class_name: "타이어",
    current_risk_score: 80,
    current_risk_grade: "HIGH",
    representative_confidence: .9,
    duration_ms: 1000,
    detection_count: 2,
    assigned_controller: null,
    version_no: 0,
    created_at: "2026-07-19T00:00:00Z",
    updated_at: "2026-07-19T00:00:00Z",
  }],
  dispatches: [],
  fetched_at: "2026-07-19T00:00:00Z",
};

describe("dashboard API mapper", () => {
  it("maps backend DTOs without turning display labels into API codes", () => {
    const snapshot = mapDashboardSnapshot(dto, "api");

    expect(snapshot.cctvs[0]).toMatchObject({
      source_type: "ITS",
      stream_type: "LIVE",
      direction_code: "ASC",
      operational_status: "FAULT",
    });
    expect(directionLabel[snapshot.cctvs[0].direction_code]).toBe("상행");
    expect(snapshot.incidents[0]).toMatchObject({
      public_id: "11111111-1111-4111-8111-111111111111",
      incident_no: "INC-20260719-0001",
      object_category: "DEBRIS",
      class_code: "TIRE",
      class_name: "타이어",
      version_no: 0,
    });
    expect(snapshot.incidents[0]).not.toHaveProperty("organization_public_id");
  });
});
