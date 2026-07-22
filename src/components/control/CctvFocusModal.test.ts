import { describe, expect, it } from "vitest";
import { getFocusCctvOptions, getFocusDetectionBox, projectBboxIntoContainedImage } from "./CctvFocusModal";
import { createMockDashboardSnapshot } from "@/features/control-dashboard/mockDashboardAdapter";

describe("focus monitoring detection boxes", () => {
  it("uses normalized category-specific boxes inside the video", () => {
    const pedestrian=getFocusDetectionBox("PEDESTRIAN");
    const vehicle=getFocusDetectionBox("VEHICLE");
    expect(pedestrian).not.toEqual(vehicle);
    for(const box of [pedestrian,vehicle,getFocusDetectionBox("DEBRIS"),getFocusDetectionBox("UNKNOWN")]){
      expect(box.x).toBeGreaterThanOrEqual(0);
      expect(box.y).toBeGreaterThanOrEqual(0);
      expect(box.x+box.width).toBeLessThanOrEqual(1);
      expect(box.y+box.height).toBeLessThanOrEqual(1);
    }
  });
  it("uses class-specific coordinates for a stopped vehicle",()=>{
    expect(getFocusDetectionBox("VEHICLE","STOPPED_VEHICLE")).toEqual({x:.49,y:.4,width:.1,height:.12});
  });
  it("uses public IDs to exclude the selected CCTV and renders at most five alternatives",()=>{
    const cctvs=createMockDashboardSnapshot().cctvs;
    const alternatives=getFocusCctvOptions(cctvs,cctvs[2].public_id);
    expect(alternatives).toHaveLength(5);
    expect(alternatives).not.toContainEqual(expect.objectContaining({public_id:cctvs[2].public_id}));
    expect(getFocusCctvOptions(cctvs.slice(0,3),cctvs[0].public_id)).toHaveLength(2);
  });
  it("projects normalized boxes into contain letterboxing without guessing offsets",()=>{
    expect(projectBboxIntoContainedImage({x:.25,y:.25,width:.5,height:.5},4/3)).toEqual({x:.3125,y:.25,width:.375,height:.5});
    expect(projectBboxIntoContainedImage({x:.25,y:.25,width:.5,height:.5},21/9)).toEqual({x:.25,y:.30952380952380953,width:.5,height:.38095238095238093});
  });
});
