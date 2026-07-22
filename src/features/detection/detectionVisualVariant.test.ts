import { describe, expect, it } from "vitest";
import { getDetectionVisualVariant } from "./detectionVisualVariant";

describe("getDetectionVisualVariant", () => {
  it.each(["VEHICLE", "CAR", "SEDAN", "BUS", "TRUCK"])("treats %s as traffic", classCode => {
    expect(getDetectionVisualVariant({ objectCategory: "VEHICLE", classCode })).toBe("traffic");
  });

  it.each([
    ["DEBRIS", "TIRE"],
    ["DEBRIS", "BOX"],
    ["WILDLIFE", "WILDLIFE"],
    ["OTHER", "FALLEN_OBJECT"],
  ])("treats %s/%s as a hazard", (objectCategory, classCode) => {
    expect(getDetectionVisualVariant({ objectCategory, classCode })).toBe("hazard");
  });

  it.each(["MOTORCYCLE", "MOTORBIKE"])("lets %s override the VEHICLE category", classCode => {
    expect(getDetectionVisualVariant({ objectCategory: "VEHICLE", classCode })).toBe("hazard");
  });

  it("keeps pedestrians and unknown codes on the default variant", () => {
    expect(getDetectionVisualVariant({ objectCategory: "OTHER", classCode: "PEDESTRIAN" })).toBe("default");
    expect(getDetectionVisualVariant({ objectCategory: "OTHER", classCode: "SHADOW" })).toBe("default");
  });
});
