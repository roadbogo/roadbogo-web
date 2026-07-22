import { describe, expect, it } from "vitest";
import type { IncidentEvidence } from "./incidentDetailTypes";
import { getEvidenceOverlayBbox, getRepresentativeOverlayBbox } from "./incidentEvidencePresentation";
import { createMockDashboardSnapshot } from "@/features/control-dashboard/mockDashboardAdapter";

const base: IncidentEvidence = {
  detection_public_id: "detection-1", detected_at: "2026-07-22T00:00:00Z", object_category: "VEHICLE",
  class_code: "CAR", class_name: "차량", confidence: 0.87, is_representative: true,
  bbox: { x: 0.1, y: 0.2, width: 0.3, height: 0.4 }, original_image_url: "/original.png", annotated_image_url: null,
  risk: { risk_score: 50, risk_grade: "MEDIUM", duration_ms: 1000, repeat_count: 1, track_id: null, reason_codes: [] },
};

describe("incident evidence overlay policy", () => {
  it("does not duplicate a box already drawn into an annotated image", () => {
    expect(getEvidenceOverlayBbox({ ...base, annotated_image_url: "/annotated.png" }, "annotated")).toBeNull();
  });

  it("uses explicit coordinates over the original image in annotated and compare views", () => {
    expect(getEvidenceOverlayBbox(base, "annotated")).toEqual(base.bbox);
    expect(getEvidenceOverlayBbox(base, "compare")).toEqual(base.bbox);
  });

  it("does not draw a box in original view or when coordinates are missing", () => {
    expect(getEvidenceOverlayBbox(base, "original")).toBeNull();
    expect(getEvidenceOverlayBbox({ ...base, bbox: null }, "annotated")).toBeNull();
  });

  it("only overlays an original representative image in focus monitoring", () => {
    const incident=createMockDashboardSnapshot().incidents.find(item=>item.detection_bbox)!;
    expect(getRepresentativeOverlayBbox(incident)).toEqual(incident.detection_bbox);
    expect(getRepresentativeOverlayBbox({...incident,representative_image_kind:"ANNOTATED"})).toBeNull();
    expect(getRepresentativeOverlayBbox({...incident,representative_image_kind:null})).toBeNull();
    expect(getRepresentativeOverlayBbox({...incident,detection_bbox:null})).toBeNull();
  });
});
