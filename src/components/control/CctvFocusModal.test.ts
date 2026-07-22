import { describe, expect, it } from "vitest";
import { getFocusCctvOptions, getFocusMediaKey } from "./CctvFocusModal";
import { createMockDashboardSnapshot } from "@/features/control-dashboard/mockDashboardAdapter";
import { getRepresentativeOverlayBbox } from "@/features/incident-detail/incidentEvidencePresentation";

describe("focus monitoring detection boxes", () => {
  it("keeps missing backend or mock coordinates missing instead of inventing a fallback", () => {
    const snapshot=createMockDashboardSnapshot();
    const incident={...snapshot.incidents[0],detection_bbox:null};
    expect(incident.detection_bbox).toBeNull();
  });
  it("shows an overlay only for an original representative image with a bbox",()=>{
    const incident=createMockDashboardSnapshot().incidents[0];
    expect(getRepresentativeOverlayBbox({...incident,representative_image_kind:"ORIGINAL"})).toEqual(incident.detection_bbox);
    expect(getRepresentativeOverlayBbox({...incident,representative_image_kind:"ANNOTATED"})).toBeNull();
    expect(getRepresentativeOverlayBbox({...incident,representative_image_kind:null})).toBeNull();
    expect(getRepresentativeOverlayBbox({...incident,representative_image_kind:"ORIGINAL",detection_bbox:null})).toBeNull();
  });
  it("uses public IDs to exclude the selected CCTV and renders at most five alternatives",()=>{
    const cctvs=createMockDashboardSnapshot().cctvs;
    const alternatives=getFocusCctvOptions(cctvs,cctvs[2].public_id);
    expect(alternatives).toHaveLength(5);
    expect(alternatives).not.toContainEqual(expect.objectContaining({public_id:cctvs[2].public_id}));
    expect(getFocusCctvOptions(cctvs.slice(0,3),cctvs[0].public_id)).toHaveLength(2);
  });
  it("remounts shared media URLs when the selected CCTV or incident changes",()=>{
    const url="/images/incidents/response-ai-detection-v2.png";
    const first=getFocusMediaKey("cctv-1","incident-1",url);
    expect(getFocusMediaKey("cctv-2","incident-1",url)).not.toBe(first);
    expect(getFocusMediaKey("cctv-1","incident-2",url)).not.toBe(first);
    expect(getFocusMediaKey("cctv-1","incident-1",url)).toBe(first);
  });
});
