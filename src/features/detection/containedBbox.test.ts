import { describe, expect, it } from "vitest";
import { projectBboxIntoContainedImage } from "./containedBbox";

const bbox = { x: 0.25, y: 0.25, width: 0.5, height: 0.5 };

describe("projectBboxIntoContainedImage", () => {
  it("keeps coordinates when image and container ratios match", () => {
    expect(projectBboxIntoContainedImage(bbox, { width: 1600, height: 900 }, { width: 800, height: 450 })).toEqual(bbox);
  });

  it("accounts for horizontal letterboxing", () => {
    expect(projectBboxIntoContainedImage(bbox, { width: 1200, height: 900 }, { width: 1600, height: 900 })).toEqual({
      x: 0.3125, y: 0.25, width: 0.375, height: 0.5,
    });
  });

  it("accounts for vertical letterboxing", () => {
    const projected = projectBboxIntoContainedImage(bbox, { width: 2100, height: 900 }, { width: 1600, height: 900 });
    expect(projected?.x).toBeCloseTo(0.25);
    expect(projected?.y).toBeCloseTo(0.3095238095);
    expect(projected?.width).toBeCloseTo(0.5);
    expect(projected?.height).toBeCloseTo(0.380952381);
  });

  it("projects a portrait image into a landscape container", () => {
    const projected = projectBboxIntoContainedImage(bbox, { width: 900, height: 1600 }, { width: 1600, height: 900 });
    expect(projected).toEqual({ x: 0.4208984375, y: 0.25, width: 0.158203125, height: 0.5 });
  });

  it("projects a landscape image into a nearly portrait container", () => {
    const projected = projectBboxIntoContainedImage(bbox, { width: 1600, height: 900 }, { width: 700, height: 900 });
    expect(projected).toEqual({ x: 0.25, y: 0.390625, width: 0.5, height: 0.21875 });
  });

  it("does not project missing or invalid coordinates and dimensions", () => {
    expect(projectBboxIntoContainedImage(null, { width: 1200, height: 900 }, { width: 1600, height: 900 })).toBeNull();
    expect(projectBboxIntoContainedImage({ ...bbox, width: 0 }, { width: 1200, height: 900 }, { width: 1600, height: 900 })).toBeNull();
    expect(projectBboxIntoContainedImage(bbox, { width: 0, height: 900 }, { width: 1600, height: 900 })).toBeNull();
    expect(projectBboxIntoContainedImage(bbox, { width: 1200, height: 900 }, { width: 0, height: 900 })).toBeNull();
  });
});
