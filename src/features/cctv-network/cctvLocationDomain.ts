export type CoordinateValidation =
  | { valid: true; latitude: number; longitude: number }
  | { valid: false; reason: "MISSING" | "OUT_OF_RANGE" };

export function validateCoordinates(
  latitude: number | null | undefined,
  longitude: number | null | undefined,
): CoordinateValidation {
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    return { valid: false, reason: "MISSING" };
  }

  if (latitude! < -90 || latitude! > 90 || longitude! < -180 || longitude! > 180) {
    return { valid: false, reason: "OUT_OF_RANGE" };
  }

  return { valid: true, latitude: latitude!, longitude: longitude! };
}

export function formatCoordinate(value: number) {
  return value.toFixed(6);
}

export function getDirectionLabel(directionCode: string) {
  const labels: Record<string, string> = {
    BOTH: "양방향",
    FORWARD: "정방향",
    REVERSE: "역방향",
    UP: "상행",
    DOWN: "하행",
  };

  return labels[directionCode] ?? directionCode;
}
