import type { DashboardSnapshotDto } from "./dashboardApiTypes";
import { mapDashboardSnapshot } from "./dashboardMapper";
import type { DashboardAdapter, DashboardSnapshot } from "./dashboardTypes";

export const mockIncidentPublicIds = {
  "INC-20260719-0012": "11111111-1111-4111-8111-111111111112",
  "INC-20260719-0013": "11111111-1111-4111-8111-111111111113",
  "INC-20260719-0011": "11111111-1111-4111-8111-111111111111",
  "INC-20260719-0008": "11111111-1111-4111-8111-111111111108",
  "INC-20260719-0007": "11111111-1111-4111-8111-111111111107",
  "INC-20260719-0006": "11111111-1111-4111-8111-111111111106",
  "INC-20260719-0005": "11111111-1111-4111-8111-111111111105",
  "INC-20260719-0004": "11111111-1111-4111-8111-111111111104",
  "INC-20260719-0003": "11111111-1111-4111-8111-111111111103",
  "INC-20260719-0002": "11111111-1111-4111-8111-111111111102",
  "INC-20260719-0001": "11111111-1111-4111-8111-111111111101",
  "INC-20260718-0098": "11111111-1111-4111-8111-111111110098",
} as const;

const mockDto: DashboardSnapshotDto = {
  cctvs: [
    { public_id: "cctv-01", cctv_name: "CAM 01", source_type: "ITS", stream_type: "LIVE", direction_code: "ASC", operational_status: "NORMAL", has_stream: true, fallback_used: false, video_state: "PLAYING", road: { road_name: "중부고속도로" }, road_section: { section_name: "일죽IC ~ 호법JC" } },
    { public_id: "cctv-02", cctv_name: "CAM 02", source_type: "ITS", stream_type: "LIVE", direction_code: "ASC", operational_status: "NORMAL", has_stream: true, fallback_used: false, video_state: "PLAYING", road: { road_name: "중부고속도로" }, road_section: { section_name: "일죽IC ~ 호법JC" } },
    { public_id: "cctv-03", cctv_name: "CAM 03", source_type: "DEMO", stream_type: "DEMO", direction_code: "DESC", operational_status: "NORMAL", has_stream: true, fallback_used: false, video_state: "DEMO", road: { road_name: "영동고속도로" }, road_section: { section_name: "여주JC ~ 이천IC" } },
    { public_id: "cctv-04", cctv_name: "CAM 04", source_type: "ITS", stream_type: "LIVE", direction_code: "UNKNOWN", operational_status: "DELAYED", has_stream: true, fallback_used: true, video_state: "FALLBACK", road: { road_name: "경부고속도로" }, road_section: { section_name: "수원신갈IC ~ 서울TG" } },
    { public_id: "cctv-05", cctv_name: "CAM 05", source_type: "ITS", stream_type: "LIVE", direction_code: "UNKNOWN", operational_status: "FAULT", has_stream: false, fallback_used: false, video_state: "UNAVAILABLE", road: { road_name: "영동고속도로" }, road_section: { section_name: "덕평IC ~ 호법JC" } },
    { public_id: "cctv-06", cctv_name: "CAM 06", source_type: "MANUAL", stream_type: "LIVE", direction_code: "DESC", operational_status: "NORMAL", has_stream: true, fallback_used: false, video_state: "LOADING", road: { road_name: "서해안고속도로" }, road_section: { section_name: "서평택JC ~ 발안IC" } },
  ],
  incidents: [
    ["INC-20260719-0012", "cctv-02", "NEW", "DEBRIS", "TIRE", "타이어", 82.5, "HIGH", .91, 4200, 14, null, 0, "2026-07-19T05:24:00.000Z"],
    ["INC-20260719-0013", "cctv-01", "NEW", "VEHICLE", "STOPPED_VEHICLE", "정지 차량", 96.2, "CRITICAL", .94, 8100, 22, null, 0, "2026-07-19T05:25:00.000Z"],
    ["INC-20260719-0008", "cctv-03", "ACKNOWLEDGED", "OTHER", "PEDESTRIAN", "보행자", 71.4, "HIGH", .87, 3300, 8, null, 1, "2026-07-19T05:10:00.000Z"],
    ["INC-20260719-0007", "cctv-04", "CLAIMED", "DEBRIS", "BOX", "박스", 64.8, "MEDIUM", .84, 5100, 11, { public_id: "user-controller-other", display_name: "김관제" }, 1, "2026-07-19T04:54:00.000Z"],
    ["INC-20260719-0006", "cctv-01", "UNDER_REVIEW", "VEHICLE", "WRONG_WAY", "역주행 차량", 88.1, "HIGH", .92, 7200, 19, { public_id: "user-controller-demo", display_name: "조정민" }, 2, "2026-07-19T04:40:00.000Z"],
    ["INC-20260719-0005", "cctv-06", "DISPATCH_REQUESTED", "VEHICLE", "STOPPED_VEHICLE", "정지 차량", 75.2, "HIGH", .89, 6200, 16, { public_id: "user-controller-demo", display_name: "조정민" }, 3, "2026-07-19T04:35:00.000Z"],
    ["INC-20260719-0004", "cctv-03", "DISPATCHED", "DEBRIS", "TIRE", "타이어", 61, "MEDIUM", .82, 3900, 9, { public_id: "user-controller-demo", display_name: "조정민" }, 4, "2026-07-19T04:20:00.000Z"],
    ["INC-20260719-0003", "cctv-04", "ACTION_COMPLETED", "OTHER", "PEDESTRIAN", "보행자", 55, "MEDIUM", .78, 2800, 6, { public_id: "user-controller-demo", display_name: "조정민" }, 5, "2026-07-19T03:55:00.000Z"],
    ["INC-20260719-0002", "cctv-05", "CLOSED", "DEBRIS", "BOX", "박스", 39, "LOW", .74, 1700, 4, { public_id: "user-controller-demo", display_name: "조정민" }, 6, "2026-07-19T03:20:00.000Z"],
    ["INC-20260719-0001", "cctv-06", "FALSE_POSITIVE", "OTHER", "SHADOW", "그림자", 18, "LOW", .63, 900, 2, { public_id: "user-controller-demo", display_name: "조정민" }, 1, "2026-07-19T03:05:00.000Z"],
  ].map(([incident_no, cctv_public_id, status, object_category, class_code, class_name, current_risk_score, current_risk_grade, representative_confidence, duration_ms, detection_count, assigned_controller, version_no, created_at]) => ({
    public_id: mockIncidentPublicIds[incident_no as keyof typeof mockIncidentPublicIds],
    incident_no,
    cctv_public_id,
    status,
    object_category,
    class_code,
    class_name,
    current_risk_score,
    current_risk_grade,
    representative_confidence,
    duration_ms,
    detection_count,
    assigned_controller,
    version_no,
    created_at,
    updated_at: "2026-07-19T05:26:00.000Z",
  })) as DashboardSnapshotDto["incidents"],
  dispatches: [
    { public_id: "dispatch-0005", incident_public_id: mockIncidentPublicIds["INC-20260719-0005"], status: "REQUESTED", responder_label: "이천 대응팀", requested_at: "2026-07-19T04:36:00.000Z", updated_at: "2026-07-19T04:36:00.000Z" },
    { public_id: "dispatch-0004", incident_public_id: mockIncidentPublicIds["INC-20260719-0004"], status: "EN_ROUTE", responder_label: "여주 대응팀", requested_at: "2026-07-19T04:22:00.000Z", updated_at: "2026-07-19T05:14:00.000Z" },
    { public_id: "dispatch-0003", incident_public_id: mockIncidentPublicIds["INC-20260719-0003"], status: "ACTION_COMPLETED", responder_label: "수원 대응팀", requested_at: "2026-07-19T04:00:00.000Z", updated_at: "2026-07-19T05:18:00.000Z" },
  ],
  fetched_at: "2026-07-19T06:15:00.000Z",
};

export function createMockDashboardSnapshot(): DashboardSnapshot {
  return mapDashboardSnapshot(structuredClone(mockDto), "mock");
}

export class MockDashboardAdapter implements DashboardAdapter {
  async load(): Promise<DashboardSnapshot> {
    return createMockDashboardSnapshot();
  }

  async refreshIncident(public_id: string) {
    return createMockDashboardSnapshot().incidents.find(item => item.public_id === public_id) ?? null;
  }

  async refreshDispatch(public_id: string) {
    return createMockDashboardSnapshot().dispatches.find(item => item.public_id === public_id) ?? null;
  }
}
