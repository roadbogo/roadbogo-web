import { describe, expect, it } from "vitest";

import {
  formatCoordinate,
  formatLocationKst,
  getCctvSourceLabel,
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

  it("출처와 최근 동기화 시각을 사용자용 값으로 변환한다",()=>{
    expect(getCctvSourceLabel("ITS")).toBe("ITS 연동");
    expect(getCctvSourceLabel("MANUAL")).toBe("수동 등록");
    expect(getCctvSourceLabel("UNKNOWN")).toBe("확인되지 않은 출처");
    expect(formatLocationKst("2026-07-30T02:36:00Z")).toContain("2026. 07. 30.");
    expect(formatLocationKst("invalid")).toBe("기록 확인 필요");
  });
});
