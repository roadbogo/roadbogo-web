import { describe, expect, it } from "vitest";

import {
  formatCoordinate,
  getDirectionLabel,
  validateCoordinates,
} from "./cctvLocationDomain";

describe("CCTV 위치 표현", () => {
  it("유효한 좌표를 조사 화면에 전달한다", () => {
    expect(validateCoordinates(37.1234567, 127.7654321)).toEqual({
      valid: true,
      latitude: 37.1234567,
      longitude: 127.7654321,
    });
  });

  it("누락되거나 범위를 벗어난 좌표를 차단한다", () => {
    expect(validateCoordinates(Number.NaN, 127)).toEqual({ valid: false, reason: "MISSING" });
    expect(validateCoordinates(91, 127)).toEqual({ valid: false, reason: "OUT_OF_RANGE" });
    expect(validateCoordinates(37, 181)).toEqual({ valid: false, reason: "OUT_OF_RANGE" });
  });

  it("좌표와 방향을 안정적으로 표시한다", () => {
    expect(formatCoordinate(37.1)).toBe("37.100000");
    expect(getDirectionLabel("BOTH")).toBe("양방향");
    expect(getDirectionLabel("CUSTOM")).toBe("CUSTOM");
  });
});
