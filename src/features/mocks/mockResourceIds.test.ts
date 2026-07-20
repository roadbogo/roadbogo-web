import { describe, expect, it } from "vitest";
import { createMockDashboardSnapshot } from "@/features/control-dashboard/mockDashboardAdapter";
import { mockCctvPublicIds, mockDispatchPublicIds, mockIncidentPublicIds } from "./mockResourceIds";

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

describe("operational Mock public IDs", () => {
  it("uses UUIDs for every external CCTV, incident and dispatch public ID", () => {
    const snapshot = createMockDashboardSnapshot();

    expect(snapshot.cctvs.every(item => uuidPattern.test(item.public_id))).toBe(true);
    expect(snapshot.incidents.every(item => uuidPattern.test(item.public_id))).toBe(true);
    expect(snapshot.dispatches.every(item => uuidPattern.test(item.public_id))).toBe(true);
    expect(Object.values(mockCctvPublicIds).every(value => uuidPattern.test(value))).toBe(true);
    expect(Object.values(mockIncidentPublicIds).every(value => uuidPattern.test(value))).toBe(true);
    expect(Object.values(mockDispatchPublicIds).every(value => uuidPattern.test(value))).toBe(true);
  });

  it("keeps CCTV display codes separate from UUID public IDs", () => {
    const cctv = createMockDashboardSnapshot().cctvs[0];

    expect(cctv.cctv_code).toBe("CCTV-ITS-001");
    expect(cctv.public_id).not.toBe(cctv.cctv_code);
  });
});
